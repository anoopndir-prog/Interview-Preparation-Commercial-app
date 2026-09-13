import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { config } from './config.js';

fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,               -- NULL when a social provider shares no verified email
  name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Google / Apple accounts linked to a user. One user can have email, Google and Apple sign-in.
CREATE TABLE IF NOT EXISTS auth_identities (
  provider TEXT NOT NULL,          -- 'google' | 'apple'
  subject TEXT NOT NULL,           -- the provider's stable user id ("sub")
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, subject)
);

-- A prep kit = one resume/JD combination and the plan Claude built from it.
-- Raw uploads are never stored; only the extracted profile.
CREATE TABLE IF NOT EXISTS preps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  source TEXT NOT NULL,            -- 'both' | 'resume' | 'jd'
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  prep_id TEXT NOT NULL REFERENCES preps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  focus_topics_json TEXT NOT NULL,
  position INTEGER NOT NULL
);

-- Adaptive state per section: current phase, streak counters, training mode.
CREATE TABLE IF NOT EXISTS section_progress (
  section_id TEXT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  high_streak INTEGER NOT NULL DEFAULT 0,
  low_streak INTEGER NOT NULL DEFAULT 0,
  training INTEGER NOT NULL DEFAULT 0,
  weak_areas_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL,
  is_training INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  rubric_json TEXT NOT NULL DEFAULT '[]',
  answer_seconds INTEGER NOT NULL DEFAULT 120,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS questions_section ON questions(section_id, created_at);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL,
  answer TEXT NOT NULL,
  input_mode TEXT NOT NULL,        -- 'voice' | 'text'
  duration_sec INTEGER,
  score INTEGER NOT NULL,
  evaluation_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS answers_section ON answers(section_id, created_at);

-- One row per user per local day with at least one answer: drives streaks and daily limits.
CREATE TABLE IF NOT EXISTS activity (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  answers INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS news (
  domain TEXT NOT NULL,
  edition TEXT NOT NULL,
  items_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (domain, edition)
);
`);

export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

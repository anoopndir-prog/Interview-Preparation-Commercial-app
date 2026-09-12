import crypto from 'node:crypto';

import { Router } from 'express';
import multer from 'multer';

import { applyScore, voiceMetrics, type SectionProgress } from './adaptive.js';
import { buildPrepPlan, evaluateAnswer, writeQuestion, type PrepPlan } from './ai.js';
import { findOrCreateUser, normalizeEmail, requireAuth, sendLoginCode, signToken, verifyLoginCode } from './auth.js';
import { config } from './config.js';
import { all, one, run, transaction } from './db.js';
import { fileToContent, textBlock } from './documents.js';
import { badRequest, HttpError, limitReached, notFound } from './errors.js';
import { getNews } from './news.js';
import { PLANS, planFor } from './plans.js';
import { answersToday, recordAnswer, safeTimezone, streakFor } from './streak.js';
import { DIFFICULTIES, type Difficulty, type PlanId, type User } from './types.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
});

export const api = Router();

api.use((req, _res, next) => {
  req.tz = safeTimezone(req.headers['x-timezone']);
  next();
});

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Auth (public)
// ---------------------------------------------------------------------------

api.post('/auth/request-code', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { devCode } = await sendLoginCode(email);
  res.json({ sent: true, devCode });
});

api.post('/auth/verify', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!verifyLoginCode(email, String(req.body?.code ?? ''))) {
    throw new HttpError(401, 'That code is incorrect or has expired', 'bad_code');
  }
  const user = findOrCreateUser(email, String(req.body?.name ?? '').trim().slice(0, 80));
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// RevenueCat → keeps the user's plan in sync with App Store / Play Store subscriptions.
// Configure the app user id in RevenueCat as our user id.
api.post('/billing/revenuecat', (req, res) => {
  const auth = req.headers.authorization ?? '';
  if (!config.revenueCatSecret || (auth !== config.revenueCatSecret && auth !== `Bearer ${config.revenueCatSecret}`)) {
    throw new HttpError(401, 'Invalid webhook secret', 'unauthorized');
  }
  const event = req.body?.event ?? {};
  const grantsPro = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED'];
  const plan: PlanId | null = grantsPro.includes(event.type) ? 'pro' : event.type === 'EXPIRATION' ? 'free' : null;
  if (plan && typeof event.app_user_id === 'string') {
    run('UPDATE users SET plan = ? WHERE id = ?', plan, event.app_user_id);
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Everything below requires a signed-in user
// ---------------------------------------------------------------------------

api.use(requireAuth);

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, plan: u.plan });

api.get('/me', (req, res) => {
  const user = req.user!;
  res.json({
    user: publicUser(user),
    limits: planFor(user.plan),
    plans: PLANS,
    streak: streakFor(user.id, req.tz),
    devBilling: config.devAuth,
  });
});

api.patch('/me', (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 80);
  if (name) run('UPDATE users SET name = ? WHERE id = ?', name, req.user!.id);
  res.json({ user: publicUser({ ...req.user!, name: name || req.user!.name }) });
});

api.post('/billing/dev-upgrade', (req, res) => {
  if (!config.devAuth) throw notFound('Route');
  const plan: PlanId = req.body?.plan === 'pro' ? 'pro' : 'free';
  run('UPDATE users SET plan = ? WHERE id = ?', plan, req.user!.id);
  res.json({ plan, limits: planFor(plan) });
});

// ---------------------------------------------------------------------------
// Prep kits
// ---------------------------------------------------------------------------

interface PrepRow {
  id: string;
  user_id: string;
  title: string;
  domain: string;
  source: string;
  profile_json: string;
  created_at: string;
}
interface SectionRow {
  id: string;
  prep_id: string;
  name: string;
  kind: string;
  description: string;
  focus_topics_json: string;
  position: number;
}
interface ProgressRow {
  section_id: string;
  difficulty: Difficulty;
  high_streak: number;
  low_streak: number;
  training: number;
  weak_areas_json: string;
}

function getProgress(sectionId: string): SectionProgress {
  const row = one<ProgressRow>('SELECT * FROM section_progress WHERE section_id = ?', sectionId);
  return row
    ? { ...row, weak_areas: JSON.parse(row.weak_areas_json) }
    : { difficulty: 'easy', high_streak: 0, low_streak: 0, training: 0, weak_areas: [] };
}

function saveProgress(sectionId: string, p: SectionProgress) {
  run(
    `INSERT INTO section_progress (section_id, difficulty, high_streak, low_streak, training, weak_areas_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (section_id) DO UPDATE SET difficulty = excluded.difficulty, high_streak = excluded.high_streak,
       low_streak = excluded.low_streak, training = excluded.training, weak_areas_json = excluded.weak_areas_json`,
    sectionId,
    p.difficulty,
    p.high_streak,
    p.low_streak,
    p.training,
    JSON.stringify(p.weak_areas),
  );
}

function sectionDto(s: SectionRow) {
  const progress = getProgress(s.id);
  const stats = one<{ attempts: number; avg: number | null }>(
    'SELECT COUNT(*) AS attempts, AVG(score) AS avg FROM answers WHERE section_id = ?',
    s.id,
  )!;
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    description: s.description,
    focusTopics: JSON.parse(s.focus_topics_json) as string[],
    difficulty: progress.difficulty,
    training: Boolean(progress.training),
    weakAreas: progress.weak_areas,
    attempts: stats.attempts,
    avgScore: stats.avg === null ? null : Math.round(stats.avg * 10) / 10,
  };
}

function prepDto(p: PrepRow) {
  const profile = JSON.parse(p.profile_json) as PrepPlan;
  const sections = all<SectionRow>('SELECT * FROM sections WHERE prep_id = ? ORDER BY position', p.id);
  return {
    id: p.id,
    title: p.title,
    domain: p.domain,
    source: p.source,
    createdAt: p.created_at,
    profile: {
      seniority: profile.seniority,
      candidateSummary: profile.candidate_summary,
      roleSummary: profile.role_summary,
      keySkills: profile.key_skills,
      gaps: profile.gaps,
    },
    sections: sections.map(sectionDto),
  };
}

function ownedPrep(prepId: string, userId: string): PrepRow {
  const prep = one<PrepRow>('SELECT * FROM preps WHERE id = ? AND user_id = ?', prepId, userId);
  if (!prep) throw notFound('Prep kit');
  return prep;
}

api.get('/preps', (req, res) => {
  const preps = all<PrepRow>('SELECT * FROM preps WHERE user_id = ? ORDER BY created_at DESC', req.user!.id);
  res.json({ preps: preps.map(prepDto) });
});

api.get('/preps/:id', (req, res) => {
  res.json(prepDto(ownedPrep(req.params.id, req.user!.id)));
});

api.delete('/preps/:id', (req, res) => {
  ownedPrep(req.params.id, req.user!.id);
  run('DELETE FROM preps WHERE id = ?', req.params.id);
  res.status(204).end();
});

const text = (v: unknown, max = 60000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

api.post(
  '/preps',
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'jd', maxCount: 1 },
  ]),
  async (req, res) => {
    const user = req.user!;
    const limits = planFor(user.plan);
    const count = one<{ n: number }>('SELECT COUNT(*) AS n FROM preps WHERE user_id = ?', user.id)!.n;
    if (count >= limits.maxPrepKits) {
      throw limitReached(`The ${limits.label} plan includes ${limits.maxPrepKits} prep kits. Delete one or upgrade to Pro.`);
    }

    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const resumeFile = files.resume?.[0];
    const jdFile = files.jd?.[0];
    const resumeText = text(req.body?.resumeText);
    const jdText = text(req.body?.jdText);

    const resume = resumeFile ? await fileToContent('RESUME', resumeFile) : resumeText ? [textBlock('RESUME', resumeText)] : [];
    const jd = jdFile ? await fileToContent('JOB DESCRIPTION', jdFile) : jdText ? [textBlock('JOB DESCRIPTION', jdText)] : [];
    if (!resume.length && !jd.length) throw badRequest('Attach a resume, a job description, or both');

    const source = resume.length && jd.length ? 'both' : resume.length ? 'resume' : 'jd';
    const plan = await buildPrepPlan([...resume, ...jd], source);
    if (!plan.sections.length) throw new HttpError(502, 'Could not build a plan from these documents', 'ai_incomplete');

    const prepId = crypto.randomUUID();
    transaction(() => {
      run(
        'INSERT INTO preps (id, user_id, title, domain, source, profile_json) VALUES (?, ?, ?, ?, ?, ?)',
        prepId,
        user.id,
        plan.title,
        plan.domain,
        source,
        JSON.stringify(plan),
      );
      plan.sections.slice(0, 7).forEach((s, i) => {
        const sectionId = crypto.randomUUID();
        run(
          'INSERT INTO sections (id, prep_id, name, kind, description, focus_topics_json, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
          sectionId,
          prepId,
          s.name,
          s.kind,
          s.description,
          JSON.stringify(s.focus_topics),
          i,
        );
        run('INSERT INTO section_progress (section_id) VALUES (?)', sectionId);
      });
    });
    res.status(201).json(prepDto(ownedPrep(prepId, user.id)));
  },
);

// ---------------------------------------------------------------------------
// Practice: next question, answer + grade + follow-up
// ---------------------------------------------------------------------------

interface QuestionRow {
  id: string;
  section_id: string;
  parent_id: string | null;
  depth: number;
  difficulty: Difficulty;
  is_training: number;
  text: string;
  hint: string;
  rubric_json: string;
  answer_seconds: number;
}

const questionDto = (q: QuestionRow) => ({
  id: q.id,
  sectionId: q.section_id,
  difficulty: q.difficulty,
  text: q.text,
  hint: q.hint,
  answerSeconds: q.answer_seconds,
  isFollowUp: q.depth > 0,
  isTraining: Boolean(q.is_training),
  depth: q.depth,
});

function ownedSection(sectionId: string, userId: string) {
  const row = one<SectionRow & { profile_json: string }>(
    `SELECT s.*, p.profile_json FROM sections s JOIN preps p ON p.id = s.prep_id WHERE s.id = ? AND p.user_id = ?`,
    sectionId,
    userId,
  );
  if (!row) throw notFound('Section');
  return row;
}

function assertDailyAllowance(user: User, tz: string) {
  const limits = planFor(user.plan);
  if (answersToday(user.id, tz) >= limits.dailyAnswers) {
    throw limitReached(
      user.plan === 'free'
        ? `You've used today's ${limits.dailyAnswers} free answers — great work! Come back tomorrow or go Pro for more.`
        : `You've reached today's fair-use limit of ${limits.dailyAnswers} answers.`,
    );
  }
}

api.post('/sections/:id/next', async (req, res) => {
  const user = req.user!;
  const section = ownedSection(req.params.id, user.id);
  assertDailyAllowance(user, req.tz);

  let progress = getProgress(section.id);
  const requested = req.body?.difficulty as Difficulty | undefined;
  if (requested && DIFFICULTIES.includes(requested) && requested !== progress.difficulty) {
    // The user chose a phase themselves: honour it and restart the streak counters.
    progress = { ...progress, difficulty: requested, high_streak: 0, low_streak: 0 };
    saveProgress(section.id, progress);
  }

  const previous = all<{ text: string }>(
    'SELECT text FROM questions WHERE section_id = ? ORDER BY created_at DESC LIMIT 30',
    section.id,
  ).map((r) => r.text);

  const generated = await writeQuestion({
    profile: JSON.parse(section.profile_json),
    section: {
      name: section.name,
      kind: section.kind,
      description: section.description,
      focusTopics: JSON.parse(section.focus_topics_json),
    },
    difficulty: progress.difficulty,
    training: Boolean(progress.training),
    weakAreas: progress.weak_areas,
    previousQuestions: previous,
  });

  const id = crypto.randomUUID();
  run(
    `INSERT INTO questions (id, section_id, difficulty, is_training, text, hint, rubric_json, answer_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    section.id,
    progress.difficulty,
    progress.training,
    generated.question,
    generated.hint,
    JSON.stringify(generated.rubric),
    Math.min(180, Math.max(60, generated.answer_seconds)),
  );
  res.json({ question: questionDto(one<QuestionRow>('SELECT * FROM questions WHERE id = ?', id)!), section: sectionDto(section) });
});

api.post('/questions/:id/answer', async (req, res) => {
  const user = req.user!;
  const limits = planFor(user.plan);
  const q = one<QuestionRow & { section_name: string; focus_topics_json: string; profile_json: string }>(
    `SELECT q.*, s.name AS section_name, s.focus_topics_json, p.profile_json
     FROM questions q JOIN sections s ON s.id = q.section_id JOIN preps p ON p.id = s.prep_id
     WHERE q.id = ? AND p.user_id = ?`,
    req.params.id,
    user.id,
  );
  if (!q) throw notFound('Question');
  if (one('SELECT 1 FROM answers WHERE question_id = ?', q.id)) {
    throw new HttpError(409, 'This question has already been answered', 'already_answered');
  }

  const answer = text(req.body?.answer, 8000);
  if (answer.length < 2) throw badRequest('Say or type an answer first');
  const inputMode = req.body?.inputMode === 'voice' ? 'voice' : 'text';
  const durationSec = Number.isFinite(req.body?.durationSec) ? Math.round(req.body.durationSec) : null;
  assertDailyAllowance(user, req.tz);

  const allowFollowUp = q.depth < limits.maxFollowUpDepth;
  const evaluation = await evaluateAnswer({
    profile: JSON.parse(q.profile_json),
    sectionName: q.section_name,
    focusTopics: JSON.parse(q.focus_topics_json),
    difficulty: q.difficulty,
    question: q.text,
    rubric: JSON.parse(q.rubric_json),
    answer,
    allowFollowUp,
  });
  const score = Math.min(10, Math.max(0, Math.round(evaluation.score)));
  const { next, event } = applyScore(getProgress(q.section_id), score, evaluation.weak_areas);

  let followUpId: string | null = null;
  transaction(() => {
    run(
      `INSERT INTO answers (id, question_id, section_id, difficulty, answer, input_mode, duration_sec, score, evaluation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      q.id,
      q.section_id,
      q.difficulty,
      answer,
      inputMode,
      durationSec,
      score,
      JSON.stringify(evaluation),
    );
    saveProgress(q.section_id, next);
    recordAnswer(user.id, req.tz);
    if (allowFollowUp && evaluation.follow_up) {
      followUpId = crypto.randomUUID();
      run(
        `INSERT INTO questions (id, section_id, parent_id, depth, difficulty, is_training, text, answer_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, 120)`,
        followUpId,
        q.section_id,
        q.id,
        q.depth + 1,
        q.difficulty,
        q.is_training,
        evaluation.follow_up,
      );
    }
  });

  const followUp = followUpId ? one<QuestionRow>('SELECT * FROM questions WHERE id = ?', followUpId) : undefined;
  res.json({
    score,
    verdict: evaluation.verdict,
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    modelAnswer: limits.modelAnswers ? evaluation.model_answer : null,
    modelAnswerLocked: !limits.modelAnswers,
    rubric: JSON.parse(q.rubric_json) as string[],
    voice: inputMode === 'voice' ? voiceMetrics(answer, durationSec) : null,
    progress: { difficulty: next.difficulty, training: Boolean(next.training), weakAreas: next.weak_areas },
    event,
    followUp: followUp ? questionDto(followUp) : null,
    streak: streakFor(user.id, req.tz),
  });
});

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

api.get('/scores', (req, res) => {
  const userId = req.user!.id;
  const sections = all<SectionRow & { prep_title: string }>(
    `SELECT s.*, p.title AS prep_title FROM sections s JOIN preps p ON p.id = s.prep_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC, s.position`,
    userId,
  );

  const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

  const sectionScores = sections.map((s) => {
    const byDifficulty = Object.fromEntries(
      DIFFICULTIES.map((d) => {
        const r = one<{ n: number; avg: number | null }>(
          'SELECT COUNT(*) AS n, AVG(score) AS avg FROM answers WHERE section_id = ? AND difficulty = ?',
          s.id,
          d,
        )!;
        return [d, { attempts: r.n, avgScore: round(r.avg) }];
      }),
    );
    const trend = all<{ score: number }>(
      'SELECT score FROM (SELECT score, created_at FROM answers WHERE section_id = ? ORDER BY created_at DESC LIMIT 10) ORDER BY created_at',
      s.id,
    ).map((r) => r.score);
    return { ...sectionDto(s), prepId: s.prep_id, prepTitle: s.prep_title, byDifficulty, trend };
  });

  const categories = all<{ kind: string; attempts: number; avg: number | null }>(
    `SELECT s.kind, COUNT(a.id) AS attempts, AVG(a.score) AS avg
     FROM answers a JOIN sections s ON s.id = a.section_id JOIN preps p ON p.id = s.prep_id
     WHERE p.user_id = ? GROUP BY s.kind ORDER BY attempts DESC`,
    userId,
  ).map((c) => ({ kind: c.kind, attempts: c.attempts, avgScore: round(c.avg) }));

  const overall = one<{ attempts: number; avg: number | null }>(
    `SELECT COUNT(a.id) AS attempts, AVG(a.score) AS avg
     FROM answers a JOIN sections s ON s.id = a.section_id JOIN preps p ON p.id = s.prep_id WHERE p.user_id = ?`,
    userId,
  )!;

  res.json({
    overall: { attempts: overall.attempts, avgScore: round(overall.avg) },
    categories,
    sections: sectionScores,
    streak: streakFor(userId, req.tz),
  });
});

// ---------------------------------------------------------------------------
// Daily news
// ---------------------------------------------------------------------------

api.get('/news', async (req, res) => {
  const limits = planFor(req.user!.plan);
  const allDomains = [
    ...new Set(
      all<{ domain: string }>('SELECT domain FROM preps WHERE user_id = ? ORDER BY created_at DESC', req.user!.id).map(
        (r) => r.domain,
      ),
    ),
  ];
  const domains = allDomains.slice(0, limits.newsDomains);
  const base = { domains, lockedDomains: allDomains.length - domains.length, refreshHour: 6, timezone: config.newsTimezone };
  if (!domains.length) {
    res.json({ ...base, domain: null, edition: null, items: [], generatedAt: null });
    return;
  }
  const domain = domains.includes(String(req.query.domain)) ? String(req.query.domain) : domains[0];
  res.json({ ...base, domain, ...(await getNews(domain)) });
});

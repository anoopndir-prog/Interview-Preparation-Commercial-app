import { DIFFICULTIES, type Difficulty } from './types.js';

export interface SectionProgress {
  difficulty: Difficulty;
  high_streak: number;
  low_streak: number;
  training: number; // 0 | 1
  weak_areas: string[];
}

export type ProgressEvent = 'promoted' | 'demoted' | 'training_on' | 'training_off' | null;

const PASS = 7; // 7+/10 counts toward moving up
const FAIL = 5; // below 5/10 counts toward training

/**
 * Easy → medium → hard progression with a training loop:
 * - 2 strong answers in a row promote the phase.
 * - 2 weak answers in a row switch on training mode (targeted, teaching questions).
 * - 3 weak answers in a row also drop one phase.
 * - A solid answer (6+) while training switches training off.
 */
export function applyScore(
  current: SectionProgress,
  score: number,
  weakAreas: string[],
): { next: SectionProgress; event: ProgressEvent } {
  const next: SectionProgress = { ...current, weak_areas: [...current.weak_areas] };
  let event: ProgressEvent = null;
  const level = DIFFICULTIES.indexOf(current.difficulty);

  if (score >= PASS) {
    next.high_streak += 1;
    next.low_streak = 0;
  } else if (score < FAIL) {
    next.low_streak += 1;
    next.high_streak = 0;
    next.weak_areas = [...new Set([...weakAreas, ...next.weak_areas])].slice(0, 5);
  } else {
    next.high_streak = 0;
    next.low_streak = 0;
  }

  if (next.training && score >= 6) {
    next.training = 0;
    next.weak_areas = next.weak_areas.filter((a) => !weakAreas.includes(a));
    event = 'training_off';
  }

  if (next.high_streak >= 2 && level < DIFFICULTIES.length - 1) {
    next.difficulty = DIFFICULTIES[level + 1];
    next.high_streak = 0;
    event = 'promoted';
  } else if (next.low_streak >= 3 && level > 0) {
    next.difficulty = DIFFICULTIES[level - 1];
    next.low_streak = 0;
    next.training = 1;
    event = 'demoted';
  } else if (next.low_streak >= 2 && !next.training) {
    next.training = 1;
    event = 'training_on';
  }

  return { next, event };
}

const FILLERS = /\b(um+|uh+|erm+|hmm+|you know|basically|literally|i mean|sort of|kind of)\b/gi;

/** Rough delivery metrics for spoken answers, in the spirit of Yoodli / Interview Warmup. */
export function voiceMetrics(transcript: string, durationSec: number | null) {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const fillerWords = transcript.match(FILLERS)?.length ?? 0;
  const wordsPerMinute = durationSec && durationSec >= 5 ? Math.round((words / durationSec) * 60) : null;
  return { words, fillerWords, wordsPerMinute };
}

import { all, one, run } from './db.js';

export function safeTimezone(tz: unknown): string {
  const value = typeof tz === 'string' ? tz : '';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for the given instant in the given timezone. */
export function dayKey(tz: string, at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const previousDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function recordAnswer(userId: string, tz: string) {
  run(
    `INSERT INTO activity (user_id, day, answers) VALUES (?, ?, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET answers = answers + 1`,
    userId,
    dayKey(tz),
  );
}

export function answersToday(userId: string, tz: string): number {
  return one<{ answers: number }>('SELECT answers FROM activity WHERE user_id = ? AND day = ?', userId, dayKey(tz))?.answers ?? 0;
}

export const DAILY_GOAL = 5;

/**
 * Current streak = consecutive days with at least one answer, ending today — or
 * ending yesterday if the user hasn't practised yet today (the streak is still alive).
 */
export function streakFor(userId: string, tz: string) {
  const days = all<{ day: string; answers: number }>(
    'SELECT day, answers FROM activity WHERE user_id = ? ORDER BY day DESC LIMIT 400',
    userId,
  );
  const active = new Set(days.map((d) => d.day));
  const today = dayKey(tz);

  let cursor = active.has(today) ? today : previousDay(today);
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }

  let longest = 0;
  let run_ = 0;
  let prev: string | null = null;
  for (const { day } of [...days].reverse()) {
    run_ = prev && previousDay(day) === prev ? run_ + 1 : 1;
    longest = Math.max(longest, run_);
    prev = day;
  }

  // Last 7 days, oldest first, for the week strip on the home screen.
  const week: { day: string; answers: number }[] = [];
  let d = today;
  for (let i = 0; i < 7; i++) {
    week.unshift({ day: d, answers: days.find((x) => x.day === d)?.answers ?? 0 });
    d = previousDay(d);
  }

  return {
    current,
    longest,
    practisedToday: active.has(today),
    todayAnswers: days.find((x) => x.day === today)?.answers ?? 0,
    dailyGoal: DAILY_GOAL,
    week,
  };
}

import type { Difficulty, ProgressEvent, SectionKind } from './types';

export const KIND_LABELS: Record<SectionKind, string> = {
  technical: 'Technical',
  coding: 'Coding',
  system_design: 'System Design',
  behavioral: 'Behavioral',
  hr: 'HR',
  situational: 'Situational',
  domain: 'Domain',
  leadership: 'Leadership',
  case_study: 'Case Study',
  communication: 'Communication',
};

export const kindLabel = (kind: string) => KIND_LABELS[kind as SectionKind] ?? kind;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const SOURCE_LABELS = {
  both: 'Tailored to your resume and the job description',
  resume: 'Based on your resume',
  jd: 'Based on the job description',
} as const;

export function eventMessage(event: ProgressEvent, difficulty: Difficulty, weakAreas: string[]): string | null {
  switch (event) {
    case 'promoted':
      return `Level up! Two strong answers in a row — moving you to ${DIFFICULTY_LABELS[difficulty]} questions.`;
    case 'demoted':
      return `Let's rebuild the foundations. Stepping back to ${DIFFICULTY_LABELS[difficulty]} with focused training questions.`;
    case 'training_on':
      return `Training mode on — your next questions will coach you on ${weakAreas.slice(0, 2).join(' and ') || 'the fundamentals'}.`;
    case 'training_off':
      return 'Nice recovery! Training mode is off — back to regular questions.';
    default:
      return null;
  }
}

const QUOTES = [
  'Preparation turns nerves into confidence.',
  "Every answer you practise today is one you won't fumble tomorrow.",
  'Small daily reps build big interview wins.',
  "You don't need to be perfect — just prepared.",
  'Confidence is a skill. Practise it.',
  'Every great hire was once a nervous candidate.',
  'Your next job starts with your next answer.',
];

export const quoteOfTheDay = () => QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length];

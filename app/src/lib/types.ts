// Mirrors the JSON shapes returned by the Go Interview API (server/src/routes.ts).

export type PlanId = 'free' | 'pro';
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type SectionKind =
  | 'technical'
  | 'behavioral'
  | 'hr'
  | 'situational'
  | 'system_design'
  | 'coding'
  | 'domain'
  | 'leadership'
  | 'case_study'
  | 'communication';

export interface User {
  id: string;
  /** null when the user signed in with Apple/Google and no verified email was shared. */
  email: string | null;
  name: string;
  plan: PlanId;
}

export interface PlanLimits {
  label: string;
  maxPrepKits: number;
  dailyAnswers: number;
  maxFollowUpDepth: number;
  modelAnswers: boolean;
  newsDomains: number;
}

export interface Streak {
  current: number;
  longest: number;
  practisedToday: boolean;
  todayAnswers: number;
  dailyGoal: number;
  week: { day: string; answers: number }[];
}

export interface Me {
  user: User;
  limits: PlanLimits;
  plans: Record<PlanId, PlanLimits>;
  streak: Streak;
  devBilling: boolean;
}

export interface Section {
  id: string;
  name: string;
  kind: SectionKind;
  description: string;
  focusTopics: string[];
  difficulty: Difficulty;
  training: boolean;
  weakAreas: string[];
  attempts: number;
  avgScore: number | null;
}

export interface Prep {
  id: string;
  title: string;
  domain: string;
  source: 'both' | 'resume' | 'jd';
  createdAt: string;
  profile: {
    seniority: string;
    candidateSummary: string | null;
    roleSummary: string | null;
    keySkills: string[];
    gaps: string[];
  };
  sections: Section[];
}

export interface Question {
  id: string;
  sectionId: string;
  difficulty: Difficulty;
  text: string;
  hint: string;
  answerSeconds: number;
  isFollowUp: boolean;
  isTraining: boolean;
  depth: number;
}

export type ProgressEvent = 'promoted' | 'demoted' | 'training_on' | 'training_off' | null;

export interface AnswerResult {
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  modelAnswer: string | null;
  modelAnswerLocked: boolean;
  rubric: string[];
  voice: { words: number; fillerWords: number; wordsPerMinute: number | null } | null;
  progress: { difficulty: Difficulty; training: boolean; weakAreas: string[] };
  event: ProgressEvent;
  followUp: Question | null;
  streak: Streak;
}

export interface SectionScore extends Section {
  prepId: string;
  prepTitle: string;
  byDifficulty: Record<Difficulty, { attempts: number; avgScore: number | null }>;
  trend: number[];
}

export interface Scores {
  overall: { attempts: number; avgScore: number | null };
  categories: { kind: SectionKind; attempts: number; avgScore: number | null }[];
  sections: SectionScore[];
  streak: Streak;
}

export interface NewsItem {
  headline: string;
  summary: string;
  interview_angle: string;
  source: string;
  url: string;
}

export interface News {
  domains: string[];
  lockedDomains: number;
  refreshHour: number;
  timezone: string;
  domain: string | null;
  edition: string | null;
  items: NewsItem[];
  generatedAt: string | null;
}

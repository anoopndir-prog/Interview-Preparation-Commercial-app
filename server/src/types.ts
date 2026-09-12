export type PlanId = 'free' | 'pro';
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const SECTION_KINDS = [
  'technical',
  'behavioral',
  'hr',
  'situational',
  'system_design',
  'coding',
  'domain',
  'leadership',
  'case_study',
  'communication',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanId;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      /** IANA timezone reported by the client, used for streaks and daily limits. */
      tz: string;
    }
  }
}

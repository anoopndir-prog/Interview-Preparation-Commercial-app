import type { PlanId } from './types.js';

export interface PlanLimits {
  label: string;
  /** Prep kits (resume/JD combinations) a user can keep. */
  maxPrepKits: number;
  /** Graded answers per local day. Pro is a fair-use cap, not a paywall. */
  dailyAnswers: number;
  /** How many follow-up questions deep a thread may go. */
  maxFollowUpDepth: number;
  /** Whether the ideal "model answer" is shown after grading. */
  modelAnswers: boolean;
  /** How many domains the daily news feed can follow. */
  newsDomains: number;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    label: 'Free',
    maxPrepKits: 2,
    dailyAnswers: 15,
    maxFollowUpDepth: 1,
    modelAnswers: false,
    newsDomains: 1,
  },
  pro: {
    label: 'Pro',
    maxPrepKits: 50,
    dailyAnswers: 300,
    maxFollowUpDepth: 3,
    modelAnswers: true,
    newsDomains: 5,
  },
};

export const planFor = (plan: PlanId): PlanLimits => PLANS[plan] ?? PLANS.free;

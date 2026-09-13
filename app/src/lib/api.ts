import { Platform } from 'react-native';

import type { AnswerResult, Difficulty, Me, News, PlanId, PlanLimits, Prep, Question, Scores, Section, User } from './types';

/**
 * On web the site is served by the API host itself, so relative URLs work.
 * Native builds need EXPO_PUBLIC_API_URL (e.g. https://gointerview.example.com).
 * Android emulator: use http://10.0.2.2:8080 to reach your computer's localhost.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'http://localhost:8080');

const timezone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
})();

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
  /** Free-plan limit hit — show an upgrade prompt instead of a plain error. */
  get isPlanLimit() {
    return this.status === 402;
  }
}

export const asApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError(0, err instanceof Error ? err.message : 'Something went wrong', 'error');

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Timezone': timezone };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { method: options.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError(0, "Can't reach Go Interview. Check your internet connection.", 'network');
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? 'Something went wrong', data.code ?? 'error');
  }
  return data as T;
}

export const api = {
  requestCode: (email: string) => request<{ sent: boolean; devCode?: string }>('/auth/request-code', { body: { email } }),
  verifyCode: (email: string, code: string, name: string) =>
    request<{ token: string; user: User }>('/auth/verify', { body: { email, code, name } }),

  googleSignIn: (idToken: string) => request<{ token: string; user: User }>('/auth/google', { body: { idToken } }),
  appleSignIn: (identityToken: string, fullName: string) =>
    request<{ token: string; user: User }>('/auth/apple', { body: { identityToken, fullName } }),

  me: () => request<Me>('/me'),
  updateName: (name: string) => request<{ user: User }>('/me', { method: 'PATCH', body: { name } }),
  devSetPlan: (plan: PlanId) => request<{ plan: PlanId; limits: PlanLimits }>('/billing/dev-upgrade', { body: { plan } }),

  preps: () => request<{ preps: Prep[] }>('/preps'),
  prep: (id: string) => request<Prep>(`/preps/${id}`),
  createPrep: (form: FormData) => request<Prep>('/preps', { body: form }),
  deletePrep: (id: string) => request<void>(`/preps/${id}`, { method: 'DELETE' }),

  nextQuestion: (sectionId: string, difficulty?: Difficulty) =>
    request<{ question: Question; section: Section }>(`/sections/${sectionId}/next`, { body: { difficulty } }),
  answer: (questionId: string, body: { answer: string; inputMode: 'voice' | 'text'; durationSec?: number }) =>
    request<AnswerResult>(`/questions/${questionId}/answer`, { body }),

  scores: () => request<Scores>('/scores'),
  news: (domain?: string) => request<News>(`/news${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),
};

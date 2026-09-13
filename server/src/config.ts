import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

// A variable copied from .env.example but left blank (e.g. `JWT_SECRET=`) counts as unset.
const env = (name: string, fallback: string) => process.env[name]?.trim() || fallback;

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

// Which AI service powers the coaching. Blank = the first provider that has a key set.
const AI_PROVIDERS = ['gemini', 'groq', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
const DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'openai/gpt-oss-120b',
  anthropic: 'claude-opus-5',
};
const aiProvider = (env('AI_PROVIDER', '').toLowerCase() ||
  (env('GEMINI_API_KEY', '') ? 'gemini' : env('GROQ_API_KEY', '') ? 'groq' : 'anthropic')) as AiProvider;
if (!AI_PROVIDERS.includes(aiProvider)) {
  throw new Error(`AI_PROVIDER must be one of: ${AI_PROVIDERS.join(', ')}`);
}

export const config = {
  isProduction,
  port: Number(env('PORT', '8080')),
  jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me'),
  dbPath: env('DB_PATH', './data/go-interview.db'),
  newsTimezone: env('NEWS_TIMEZONE', 'Asia/Kolkata'),
  webDistDir: env('WEB_DIST_DIR', '../app/dist'),
  corsOrigins: list(process.env.CORS_ORIGINS),
  devAuth: process.env.DEV_AUTH === 'true' && !isProduction,
  resendApiKey: env('RESEND_API_KEY', ''),
  emailFrom: env('EMAIL_FROM', 'Go Interview <login@example.com>'),
  revenueCatSecret: env('REVENUECAT_WEBHOOK_SECRET', ''),
  // Google OAuth client IDs whose ID tokens we accept (web, iOS and Android clients).
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS),
  // Apple identity tokens are issued for the app's bundle ID (and a Services ID if web is added).
  appleAudiences: list(env('APPLE_AUDIENCES', 'com.gointerview.app')),

  aiProvider,
  model: env('AI_MODEL', DEFAULT_MODELS[aiProvider]),
  geminiApiKey: env('GEMINI_API_KEY', ''),
  groqApiKey: env('GROQ_API_KEY', ''),
  // Groq helpers: a vision model that reads photographed documents, and the web-search system for news.
  groqVisionModel: env('GROQ_VISION_MODEL', 'qwen/qwen3.8-27b'),
  groqSearchModel: env('GROQ_SEARCH_MODEL', 'groq/compound'),
  // Question writing is quick; grading and planning benefit from more thought.
  effort: {
    plan: 'high',
    question: 'low',
    evaluate: 'medium',
    news: 'medium',
  } as const,
};

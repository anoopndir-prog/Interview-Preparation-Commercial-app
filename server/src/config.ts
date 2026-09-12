import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 8080),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  dbPath: process.env.DB_PATH ?? './data/go-interview.db',
  newsTimezone: process.env.NEWS_TIMEZONE ?? 'Asia/Kolkata',
  webDistDir: process.env.WEB_DIST_DIR ?? '../app/dist',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  devAuth: process.env.DEV_AUTH === 'true' && !isProduction,
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Go Interview <login@example.com>',
  revenueCatSecret: process.env.REVENUECAT_WEBHOOK_SECRET ?? '',

  model: 'claude-opus-5',
  // Question writing is quick; grading and planning benefit from more thought.
  effort: {
    plan: 'high',
    question: 'low',
    evaluate: 'medium',
    news: 'medium',
  } as const,
};

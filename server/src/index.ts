import fs from 'node:fs';
import path from 'node:path';

import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import multer from 'multer';

import { config } from './config.js';
import { HttpError } from './errors.js';
import { scheduleDailyNews } from './news.js';
import { ProviderError } from './providers.js';
import { api } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Native apps send no Origin header; browsers must be on the allow-list (any origin in dev).
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : !config.isProduction }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', api);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'not_found' });
});

// Serve the Expo web build from the same host, so the site and API share one origin.
const webDir = path.resolve(config.webDistDir);
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDir, 'index.html'));
  });
} else {
  console.log(`[web] no build at ${webDir} — run "npm run build:web" in ../app to serve the site`);
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
  } else if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be under 15 MB' : err.message;
    res.status(400).json({ error: message, code: 'upload_error' });
  } else if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
    res.status(503).json({ error: 'Our AI coach is busy right now — please try again in a moment.', code: 'ai_busy' });
  } else if (err instanceof Anthropic.APIError) {
    console.error('[claude]', err.status, err.message);
    res.status(502).json({ error: 'The AI service returned an error. Please try again.', code: 'ai_error' });
  } else if (err instanceof ProviderError && (err.status === 429 || err.status >= 500)) {
    console.error(`[${config.aiProvider}]`, err.status, err.message);
    res.status(503).json({ error: 'Our AI coach is busy right now — please try again in a moment.', code: 'ai_busy' });
  } else if (err instanceof ProviderError) {
    console.error(`[${config.aiProvider}]`, err.status, err.message);
    res.status(502).json({ error: 'The AI service returned an error. Please try again.', code: 'ai_error' });
  } else if (typeof err?.status === 'number' && err.status < 500) {
    res.status(err.status).json({ error: err.message ?? 'Bad request', code: 'bad_request' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong', code: 'server_error' });
  }
};
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Go Interview API listening on http://localhost:${config.port}`);
  const key = { gemini: config.geminiApiKey, groq: config.groqApiKey, anthropic: process.env.ANTHROPIC_API_KEY?.trim() }[config.aiProvider];
  console.log(`[ai] ${config.aiProvider} · ${config.model}${key ? '' : ' — WARNING: no API key set, AI features will fail'}`);
  if (config.devAuth) console.log('[dev-auth] sign-in codes are printed here; dev billing toggle enabled');
});

scheduleDailyNews();

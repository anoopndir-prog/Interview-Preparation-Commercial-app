import crypto from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';

import { config } from './config.js';
import { one, run, transaction } from './db.js';
import { HttpError } from './errors.js';
import type { User } from './types.js';

// Passwordless email sign-in. Codes live in memory: fine for a single instance;
// move to Redis/the database before running more than one server.
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const pendingCodes = new Map<string, { hash: string; expires: number; attempts: number }>();

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function normalizeEmail(email: unknown): string {
  const value = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new HttpError(400, 'Enter a valid email address', 'bad_email');
  }
  return value;
}

export async function sendLoginCode(email: string): Promise<{ devCode?: string }> {
  const code = crypto.randomInt(100000, 1000000).toString();
  pendingCodes.set(email, { hash: sha256(code), expires: Date.now() + CODE_TTL_MS, attempts: 0 });

  if (config.devAuth) {
    console.log(`[dev-auth] sign-in code for ${email}: ${code}`);
    return { devCode: code };
  }
  if (!config.resendApiKey) {
    throw new HttpError(503, 'Email sign-in is not configured on this server', 'email_unconfigured');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.emailFrom,
      to: email,
      subject: `${code} is your Go Interview sign-in code`,
      text: `Your Go Interview sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) throw new HttpError(502, 'Could not send the sign-in email', 'email_failed');
  return {};
}

export function verifyLoginCode(email: string, code: string): boolean {
  const entry = pendingCodes.get(email);
  if (!entry || entry.expires < Date.now()) {
    pendingCodes.delete(email);
    return false;
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    pendingCodes.delete(email);
    return false;
  }
  const ok = crypto.timingSafeEqual(Buffer.from(entry.hash), Buffer.from(sha256(code.trim())));
  if (ok) pendingCodes.delete(email);
  return ok;
}

export function findOrCreateUser(email: string, name: string): User {
  const existing = one<User>('SELECT * FROM users WHERE email = ?', email);
  if (existing) {
    if (name && !existing.name) run('UPDATE users SET name = ? WHERE id = ?', name, existing.id);
    return { ...existing, name: existing.name || name };
  }
  const id = crypto.randomUUID();
  run('INSERT INTO users (id, email, name) VALUES (?, ?, ?)', id, email, name);
  return one<User>('SELECT * FROM users WHERE id = ?', id)!;
}

// ---------------------------------------------------------------------------
// Google and Apple sign-in: the app obtains an ID token from the provider and we
// verify its signature, issuer and audience against the provider's public keys.
// ---------------------------------------------------------------------------

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

interface ProviderProfile {
  provider: 'google' | 'apple';
  subject: string;
  email: string | null; // only set when the provider vouches it is verified
  name: string;
}

const verifiedEmail = (payload: JWTPayload) => {
  const verified = payload.email_verified === true || payload.email_verified === 'true';
  return verified && typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
};

export async function verifyGoogleToken(idToken: string): Promise<ProviderProfile> {
  if (!config.googleClientIds.length) {
    throw new HttpError(503, 'Google sign-in is not configured on this server', 'google_unconfigured');
  }
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: config.googleClientIds,
    }));
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.', 'bad_token');
  }
  const name = typeof payload.given_name === 'string' ? payload.given_name : typeof payload.name === 'string' ? payload.name : '';
  return { provider: 'google', subject: String(payload.sub), email: verifiedEmail(payload), name };
}

/** Apple only sends the user's name to the app on the very first sign-in, so the app forwards it. */
export async function verifyAppleToken(identityToken: string, fullName: string): Promise<ProviderProfile> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(identityToken, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: config.appleAudiences,
    }));
  } catch {
    throw new HttpError(401, 'Apple sign-in could not be verified. Please try again.', 'bad_token');
  }
  return { provider: 'apple', subject: String(payload.sub), email: verifiedEmail(payload), name: fullName.trim().slice(0, 80) };
}

export function findOrCreateSocialUser(profile: ProviderProfile): User {
  return transaction(() => {
    const linked = one<{ user_id: string }>(
      'SELECT user_id FROM auth_identities WHERE provider = ? AND subject = ?',
      profile.provider,
      profile.subject,
    );
    if (linked) {
      if (profile.name) run(`UPDATE users SET name = ? WHERE id = ? AND name = ''`, profile.name, linked.user_id);
      return one<User>('SELECT * FROM users WHERE id = ?', linked.user_id)!;
    }

    // Same verified email as an existing account (e.g. they used email codes before) → same user.
    let user = profile.email ? one<User>('SELECT * FROM users WHERE email = ?', profile.email) : undefined;
    if (!user) {
      const id = crypto.randomUUID();
      run('INSERT INTO users (id, email, name) VALUES (?, ?, ?)', id, profile.email, profile.name);
      user = one<User>('SELECT * FROM users WHERE id = ?', id)!;
    } else if (profile.name && !user.name) {
      run('UPDATE users SET name = ? WHERE id = ?', profile.name, user.id);
      user = { ...user, name: profile.name };
    }
    run('INSERT INTO auth_identities (provider, subject, user_id) VALUES (?, ?, ?)', profile.provider, profile.subject, user.id);
    return user;
  });
}

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let userId: string | undefined;
  try {
    userId = (jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub;
  } catch {
    // fall through to 401
  }
  const user = userId ? one<User>('SELECT * FROM users WHERE id = ?', userId) : undefined;
  if (!user) return next(new HttpError(401, 'Please sign in again', 'unauthorized'));
  req.user = user;
  next();
}

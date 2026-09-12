# Go Interview

An AI interview coach for college students and working professionals. Attach a resume, a job description, or both — as PDF, Word, a photo or text — and Go Interview builds a tailored interview loop. You answer out loud, get scored with coaching and follow-up questions, and level up from Easy to Hard. It also gives you a daily industry news briefing every morning at 6:00 AM.

- **iOS and Android**: Expo / React Native app
- **Web**: the same app, served from the API host
- **AI**: Claude (`claude-opus-5`) via the Anthropic API, called only from the server

See [BENCHMARK.md](BENCHMARK.md) for how it compares with Interview Warmup, Yoodli, Final Round AI and others.

## Features

| Feature | Where |
|---|---|
| Email sign-in (one-time code), Free and Pro plans | `server/src/auth.ts`, `server/src/plans.ts` |
| Home: Resume and Job description attachments (PDF, DOCX, JPG/PNG/WebP, TXT, or pasted JD text) | `app/src/app/(tabs)/index.tsx` |
| Resume + JD → tailored plan; JD only → role-based; resume only → profile-based | `server/src/ai.ts` → `buildPrepPlan` |
| 3–7 sections per kit (technical, behavioral, HR, system design, coding, case study, domain…), each in its own colour | `app/src/constants/theme.ts` |
| Easy → Medium → Hard, starting at Easy by default or wherever the user chooses | `app/src/app/prep/[id].tsx` |
| Answer by microphone (on-device speech-to-text) or by typing; questions read aloud | `app/src/app/practice/[sectionId].tsx` |
| Scores 0–10 with strengths, fixes, rubric, a model answer (Pro), pace and filler words | `server/src/ai.ts` → `evaluateAnswer` |
| Follow-up questions based on the answer just given | same |
| Adaptive training when scores stay low | `server/src/adaptive.ts` |
| Scores screen: readiness %, per-category and per-section scores, per-phase breakdown, trend | `app/src/app/(tabs)/scores.tsx` |
| Streaks, daily goal, week strip | `server/src/streak.ts` |
| Daily domain news, rebuilt at 6:00 AM (web search) | `server/src/news.ts` |

## Run it locally

Requires Node 22.13+ and an Anthropic API key from https://console.anthropic.com.

```bash
# 1. API
cd server
cp .env.example .env        # set ANTHROPIC_API_KEY; DEV_AUTH=true prints sign-in codes to the console
npm install
npm run dev                 # http://localhost:8080

# 2. App (new terminal)
cd app
cp .env.example .env
npm install
npm run web                 # browser at http://localhost:8081
```

In dev mode the sign-in code is printed in the server console and filled in on screen for you. The Profile tab has a dev-only switch between Free and Pro.

### Phones

Voice input uses a native module (`expo-speech-recognition`), so it needs a **development build**; it won't work in Expo Go:

```bash
cd app
npx expo run:ios            # or: npx expo run:android
# or build in the cloud:    npx eas build --profile development --platform all
```

Set `EXPO_PUBLIC_API_URL` to an address your phone can reach (see `app/.env.example`).

## Host it (website + API in one place)

```bash
docker build -t go-interview .
docker run -p 8080:8080 -v go-interview-data:/data \
  -e ANTHROPIC_API_KEY=... -e JWT_SECRET=$(openssl rand -hex 32) \
  -e RESEND_API_KEY=... -e EMAIL_FROM="Go Interview <login@yourdomain.com>" \
  go-interview
```

The container serves the web app at `/` and the API at `/api`. Any Docker host works (Render, Railway, Fly.io, a VM). Mount a persistent volume at `/data` for the SQLite database. Then point the mobile builds at the same URL (`app/eas.json`) and release with `npx eas build` / `npx eas submit`.

## Before launch — decisions and to-dos

- **"Sign in with Claude."** Anthropic doesn't offer a consumer "Sign in with Claude" login for third-party apps, so users sign in with an email code. Claude powers the coaching through the app's own API key; users never need a Claude account. Google and Apple sign-in are the natural next step. Apple requires Sign in with Apple if you offer any other social login on iOS.
- **Payments.** App Store and Play Store rules require in-app purchase for digital subscriptions. The recommended path is RevenueCat: the webhook endpoint (`POST /api/billing/revenuecat`) that flips a user to Pro is already built. Stripe can handle web-only purchases.
- **Pricing and limits.** Set them in `server/src/plans.ts` and in the store listings.
- **Branding.** Replace the default icons in `app/assets/` with the Go Interview logo.
- **Email.** Production sign-in emails go through Resend (`RESEND_API_KEY`). Swap in any provider in `sendLoginCode`.
- **Scale.** Sign-in codes are held in memory and the database is SQLite. Both are fine for a single server; move to Postgres and Redis before running several instances.
- **Privacy.** Uploaded files are sent to Claude and then discarded; only the extracted profile is stored. Say this in your privacy policy.

## Project layout

```
server/   Express API, SQLite (node:sqlite), Claude calls, 6 AM news cron
app/      Expo Router app (iOS, Android, web)
Dockerfile
```

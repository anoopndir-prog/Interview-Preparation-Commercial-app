# Go Interview

An AI interview coach for college students and working professionals. Attach a resume, a job description, or both — as PDF, Word, a photo or text — and Go Interview builds a tailored interview loop. You answer out loud, get scored with coaching and follow-up questions, and level up from Easy to Hard. It also gives you a daily industry news briefing every morning at 6:00 AM.

- **iOS and Android**: Expo / React Native app
- **Web**: the same app, served from the API host
- **AI**: your choice of Google Gemini, Groq or Anthropic Claude (see [Choosing the AI provider](#choosing-the-ai-provider)), called only from the server

See [BENCHMARK.md](BENCHMARK.md) for how it compares with Interview Warmup, Yoodli, Final Round AI and others.

## Features

| Feature | Where |
|---|---|
| Sign in with Google, Apple or an email code; Free and Pro plans | `server/src/auth.ts`, `app/src/components/social-sign-in.tsx`, `server/src/plans.ts` |
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

Requires Node 22.13+ and an API key from one AI provider (see below).

```bash
# 1. API
cd server
cp .env.example .env        # set GEMINI_API_KEY, GROQ_API_KEY or ANTHROPIC_API_KEY; DEV_AUTH=true prints sign-in codes
npm install
npm run dev                 # http://localhost:8080

# 2. App (new terminal)
cd app
cp .env.example .env
npm install
npm run web                 # browser at http://localhost:8081
```

In dev mode the sign-in code is printed in the server console and filled in on screen for you. The Profile tab has a dev-only switch between Free and Pro.

### Choosing the AI provider

Set **one** key in `server/.env`. If `AI_PROVIDER` is blank, the server uses the first provider with a key (Gemini, then Groq, then Claude). The startup log shows which one is active: `[ai] gemini · gemini-3.8-flash`.

| | Google Gemini | Groq | Anthropic Claude |
|---|---|---|---|
| Key | `GEMINI_API_KEY` ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) | `GROQ_API_KEY` ([console.groq.com/keys](https://console.groq.com/keys)) | `ANTHROPIC_API_KEY` ([console.anthropic.com](https://console.anthropic.com)) |
| Default model (`AI_MODEL` overrides) | `gemini-3.8-flash` | `openai/gpt-oss-120b` | `claude-opus-5` |
| Resume/JD as PDF or photo | Read natively | PDF text is extracted on the server; photos are transcribed by `GROQ_VISION_MODEL` (`qwen/qwen3.8-27b`). Scanned PDFs need a photo, a DOCX or pasted text | Read natively |
| Daily news search | Google Search grounding | `GROQ_SEARCH_MODEL` (`groq/compound`) | Web search tool |
| Cost | Free tier, then pay-as-you-go | Free tier, then pay-as-you-go | Pay-as-you-go |

Prompts, scoring rules and the adaptive engine are the same for every provider; only `server/src/providers.ts` (Gemini, Groq) and `server/src/ai.ts` (Claude) differ. On free tiers, check each provider's terms on whether your users' data may be used for training before sending real resumes.

### Phones

Voice input uses a native module (`expo-speech-recognition`), so it needs a **development build**; it won't work in Expo Go:

```bash
cd app
npx expo run:ios            # or: npx expo run:android
# or build in the cloud:    npx eas build --profile development --platform all
```

Set `EXPO_PUBLIC_API_URL` to an address your phone can reach (see `app/.env.example`).

## Sign-in setup (Google, Apple, email)

The sign-in screen shows **Continue with Apple** (iOS), **Continue with Google** (iOS, Android and web), and email-code sign-in as a fallback. One person keeps one account however they sign in: accounts are matched by the provider's user ID, or by a verified email address.

**Google** — in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), set up the OAuth consent screen, then create three OAuth client IDs:

| Client type | Settings | Goes in |
|---|---|---|
| Web application | Authorised JavaScript origins: your site URL and `http://localhost:8081` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) and the first entry of `GOOGLE_CLIENT_IDS` (server) |
| iOS | Bundle ID `com.gointerview.app` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app) and `GOOGLE_CLIENT_IDS` (server) |
| Android | Package `com.gointerview.app` plus the SHA-1 of your signing key (`npx eas credentials`) | Nothing to paste; Google matches it by package and SHA-1 |

**Apple** — in the Apple Developer portal, enable *Sign in with Apple* for the App ID `com.gointerview.app` (`app.json` already sets `usesAppleSignIn`). The server accepts tokens whose audience is in `APPLE_AUDIENCES`. Sign in with Apple on the website would additionally need an Apple *Services ID*, so it is iOS-only for now.

Buttons appear only once their IDs are configured, and native sign-in needs a development build (`npx expo run:ios` / `run:android`).

## Host it (website + API in one place)

```bash
docker build -t go-interview .
docker run -p 8080:8080 -v go-interview-data:/data \
  -e GEMINI_API_KEY=... -e JWT_SECRET=$(openssl rand -hex 32) \
  -e RESEND_API_KEY=... -e EMAIL_FROM="Go Interview <login@yourdomain.com>" \
  go-interview
```

The container serves the web app at `/` and the API at `/api`. Any Docker host works (Render, Railway, Fly.io, a VM). Mount a persistent volume at `/data` for the SQLite database. Then point the mobile builds at the same URL (`app/eas.json`) and release with `npx eas build` / `npx eas submit`.

## Before launch — decisions and to-dos

- **"Sign in with Claude."** Anthropic doesn't offer a consumer "Sign in with Claude" login for third-party apps, so users sign in with Google, Apple or an email code. The AI provider is called with the app's own API key; users never need an account with it.
- **Payments.** App Store and Play Store rules require in-app purchase for digital subscriptions. The recommended path is RevenueCat: the webhook endpoint (`POST /api/billing/revenuecat`) that flips a user to Pro is already built. Stripe can handle web-only purchases.
- **Pricing and limits.** Set them in `server/src/plans.ts` and in the store listings.
- **Branding.** Replace the default icons in `app/assets/` with the Go Interview logo.
- **Email.** Production sign-in emails go through Resend (`RESEND_API_KEY`). Swap in any provider in `sendLoginCode`.
- **Scale.** Sign-in codes are held in memory and the database is SQLite. Both are fine for a single server; move to Postgres and Redis before running several instances.
- **Privacy.** Uploaded files are sent to the configured AI provider and then discarded; only the extracted profile is stored. Say this in your privacy policy, and use a paid tier whose terms don't allow training on your data.

## Project layout

```
server/   Express API, SQLite (node:sqlite), Claude calls, 6 AM news cron
app/      Expo Router app (iOS, Android, web)
Dockerfile
```

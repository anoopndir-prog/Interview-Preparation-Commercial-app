# Competitive benchmark

How Go Interview compares with the interview-prep apps our audience (college students and working professionals) already try, and what we borrowed from each. This is based on each product's publicly known feature set. Re-check it against their current apps and pricing pages before any marketing use.

| App | What it does well | What it lacks for our audience | What Go Interview adopts |
|---|---|---|---|
| **Google Interview Warmup** | Free, voice-first practice with a live transcript; highlights the talking points you covered | Fixed question banks for a few job fields; doesn't read your resume or the JD; no scoring or progress | Answer out loud, live transcript, an "interviewers listen for" rubric shown after each answer |
| **Yoodli** | Delivery analytics: pace, filler words, and so on | Focuses on how you speak, not on role-specific content | Words-per-minute and filler-word counts on every voice answer |
| **Final Round AI / Interviews by AI** | Mock questions generated from your resume and the JD | Mostly paid; little structured progression or habit building | Questions generated from resume + JD, resume-only or JD-only; gap-probing questions |
| **Big Interview** | Structured curriculum; answer frameworks such as STAR | Pre-recorded, generic content; feels dated on mobile | STAR model answers; sections by interview type |
| **Pramp / Exponent** | Realistic follow-ups from human peers or experts | Needs scheduling; not always-on | AI follow-up questions that dig into what you actually said |
| **Duolingo** (habit benchmark) | Streaks, a daily goal, a week strip, gentle nudges | — | Daily streak, 5-answer daily goal, week strip on the home screen |
| **LeetCode / InterviewBit** | Difficulty ladders (easy → medium → hard) | Coding only; text only | An Easy/Medium/Hard ladder in every section, with automatic promotion |

## Where Go Interview is different

1. **One upload, a whole interview loop.** From a resume, a JD or both, it builds 3–7 sections (technical, behavioral, HR, system design, case study, domain…) that match the real process for that role.
2. **Adaptive coaching, not just grading.** Two strong answers promote you a phase. Two weak ones switch on *training mode*: easier, teaching-oriented questions aimed at the exact weak areas. Three weak ones step you down a phase.
3. **Daily domain news with an interview angle.** Every morning at 6:00 AM there's a fresh briefing for your industry, and each story says how to use it in an interview. None of the apps above does this.
4. **Mobile and web from one codebase**, at a price students can afford (a generous free tier).

## Free vs Pro (initial proposal — tune after launch data)

| | Free | Pro |
|---|---|---|
| Prep kits | 2 | 50 |
| Graded answers per day | 15 | 300 (fair use) |
| Follow-up depth | 1 | 3 |
| Model answers | — | ✓ |
| News domains | 1 | 5 |

The limits live in `server/src/plans.ts`.

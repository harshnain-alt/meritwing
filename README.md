# Meritwing

**Your experience. Your next move.**

Meritwing helps business-school students turn what they personally did in a venture or project
into relevant internship application content — for operations, supply chain, growth, marketing
or any other function.

**Target user:** MBA, PGDM and other business-school students in India applying for internships,
who have real venture or project experience but find it hard to describe their own contribution.

**Live prototype:** <https://meritwing.vercel.app>

> **Prototype status:** the three-step onboarding, resume reading, AI follow-up questions and the
> review screen work. **AI application drafting is not built yet.** The app says so on screen and
> never shows simulated AI output. The follow-up questions need an Anthropic API key on the server
> (see [Environment variables](#environment-variables)); without one, the app explains that they
> aren't set up and lets the student continue.

## What works today

- **Three-step onboarding**, with progress, Back/Continue and inputs kept between steps:
  1. **Let's start** — full name, plus upload a resume (PDF), paste resume text, or continue
     without a resume. Optional *Additional details*: email, phone, State / Union Territory,
     business school, programme and graduation year.
  2. **What did you do?** — project or venture name, what the project was about, and what you
     personally did. Optional results, with whether they were yours or shared with the team.
  3. **Which internship?** — paste the job description; title and company are suggested from it
     and stay editable.
- **Resume reading** (no AI): text is extracted from text-based PDFs up to 5 MB, sorted into
  sections by simple rules, and used to fill empty details (never overwriting what the student
  typed). Scanned or unreadable PDFs fall back to pasting text. Students can check and edit
  everything that was read; the original text is kept unchanged.
- **Searchable dropdowns** for State / Union Territory (all 36) and business school (129
  institutions from NIRF 2025 plus verified additions, with free entry for any other school).
- **AI follow-up questions** after step 3 (*A few quick questions*): Claude reads the project
  description, what the student personally did, any results, the resume sections and the job
  description, and asks **at most three** short questions about the student's own contribution —
  or none when nothing important is missing. Each question has an *I don't know / Skip* option;
  numbers are never required. Answers are shown back as an editable summary, kept separate from
  notes labelled *AI interpretation*, which are never added to the student's facts. If the student
  edits their information afterwards, the questions are marked *Outdated* and can be refreshed
  (earlier answers are sent along so questions aren't repeated). Failures show Retry where it can
  help, and the student can always continue without questions.
- **Draft workspace** after the questions: an honest "drafting isn't connected" notice, fact checks where
  the resume and the answers disagree, a summary with Edit links, and a **resume layout preview**
  built only from the student's own wording, labelled *Unconfirmed* until they confirm the facts.
- **Clear my data** removes everything entered and read in the session.
- Responsive layout that works on mobile.

## Unfinished or not yet built

- **AI application drafting** — requirement-to-experience map, tailored resume bullets and a
  suitability answer. *Not implemented. Nothing in the app simulates it.*
- The resume layout preview is **not AI-written**: it arranges the student's own words, so some
  lines read like notes.
- Resume and job-description extraction use simple rules, so unusual layouts may need manual
  correction (every extracted value is editable).
- No accounts or saved progress: refreshing the page clears everything, by design for now.
- No PDF/Word export yet.

## How resume information is processed

- **Pasted text** stays in the browser tab. It is not sent anywhere.
- **Uploaded PDFs** are sent to the app's own server route (`/api/resume/extract`), which checks
  the size (max 5 MB) and that the file really is a PDF, extracts the text in memory with
  [unpdf](https://github.com/unjs/unpdf) (Mozilla pdf.js), and returns it. The file is **not
  saved** to disk or storage, and neither the file nor its text is logged.
- **AI follow-up questions** send, from the app's server to the Anthropic API: the resume's
  education, experience, skills and additional sections, the project details, any results and the
  job description. The student's **name, email and phone are not sent**; email addresses and phone
  numbers inside the text are replaced with placeholders first. The API key stays on the server,
  and neither the request nor the response is logged (only an error type and status on failure).
  Without a configured key, nothing is sent.
- All answers live only in the open browser tab and are cleared on refresh or with *Clear my data*.
- On Vercel, request bodies are limited to 4.5 MB, so PDFs between 4.5 MB and 5 MB are rejected
  there; the app then suggests pasting the text instead.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

Other scripts: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm start`.

## Environment variables

See [`.env.example`](.env.example). Both are **server-side only** — never prefix them with
`NEXT_PUBLIC_`, never commit them.

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | For AI follow-up questions | Anthropic API key from the Anthropic Console |
| `ANTHROPIC_MODEL` | No | Claude model for the questions; defaults to `claude-opus-5-5` |

- **Locally:** create `.env.local` in this folder (ignored by Git) with
  `ANTHROPIC_API_KEY=…`, then restart `npm run dev`.
- **On Vercel:** Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY` for
  Production (and Preview), mark it Sensitive, then redeploy.

Everything else works without a key; the questions screen then explains that AI questions aren't
set up yet.

## Deployment

The app is a standard Next.js 16 project and deploys to Vercel with no extra configuration.
The live prototype at <https://meritwing.vercel.app> is deployed this way with the Vercel CLI.

**From the Vercel dashboard (recommended):** sign in at <https://vercel.com>, choose
*Add New → Project*, import this GitHub repository, keep the detected Next.js settings, and click
*Deploy*. Later pushes to the repository deploy automatically.

**From the command line:**

```bash
npx vercel login
npx vercel --prod
```

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · unpdf for PDF text extraction ·
Anthropic TypeScript SDK with Zod-validated structured output for follow-up questions.

## Data sources

- Business schools: [NIRF India Rankings 2025: Management](https://www.nirfindia.org/Rankings/2025/ManagementRanking.html)
  (factual names and locations, with attribution) plus manual additions checked on official
  websites. Details and regeneration steps: [`data/README.md`](data/README.md).
- States and union territories: the 28 states and 8 union territories of India.

## Project structure

```
src/app/                      page, layout, the PDF extraction route and /api/clarify
src/components/               workspace, steps, searchable dropdown, resume preview
src/lib/                      validation, resume parsing and checks, preview builder
data/                         business-school sources and notes
scripts/build-datasets.mjs    rebuilds src/data/business-schools.json
```

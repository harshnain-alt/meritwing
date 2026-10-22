# Meritwing

**Your experience. Your next move.**

Meritwing helps business-school students turn what they personally did in a venture or project
into relevant internship application content — for operations, supply chain, growth, marketing
or any other function.

**Target user:** MBA, PGDM and other business-school students in India applying for internships,
who have real venture or project experience but find it hard to describe their own contribution.

**Live prototype:** <https://meritwing.vercel.app>

> **Prototype status:** the three-step onboarding, resume reading, AI follow-up questions, AI-written
> resume bullets for the project and the review screen work. A requirement-to-experience map and a
> suitability answer are **not built yet**, and the app never shows simulated AI output. The AI features
> need a Google Gemini API key on the server (see [Environment variables](#environment-variables));
> without one, the app explains that they aren't set up and lets the student continue.

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
  everything that was read; the original text is kept unchanged. Recognises common Indian resume
  headings (e.g. *Educational Qualifications*, *Internship Experience*, *Scholastic Achievements*,
  *Positions of Responsibility*) and the bullet symbols PDFs often produce; summary or objective
  text is listed under *Lines we couldn't place*.
- **Searchable dropdowns** for State / Union Territory (all 36) and business school (129
  institutions from NIRF 2025 plus verified additions, with free entry for any other school).
- **AI follow-up questions** after step 3 (*A few quick questions*): Google Gemini reads the project
  description, what the student personally did, any results, the resume sections and the job
  description, and asks **at most three** short questions about the student's own contribution —
  or none when nothing important is missing. Each question has an *I don't know / Skip* option;
  numbers are never required. Answers are shown back as an editable summary, kept separate from
  notes labelled *AI interpretation*, which are never added to the student's facts. If the student
  edits their information afterwards, the questions are marked *Outdated* and can be refreshed
  (earlier answers are sent along so questions aren't repeated). Failures show Retry where it can
  help, and the student can always continue without questions.
- **Draft workspace** after the questions: a notice saying exactly which parts come from AI, fact checks where
  the resume and the answers disagree, a summary with Edit links, and a **resume layout preview**
  built from the student's own wording, labelled *Unconfirmed* until they confirm the facts.
- **AI resume bullets** for the project entry, available once the student has confirmed their facts:
  Gemini rewords the confirmed project details, results and follow-up answers into up to five bullets
  for the target role, most relevant first. Each bullet cites the facts it is based on (shown under
  *Based on*) and is marked *Your own work* or *Team achievement*; results the student marked as shared
  are always team bullets. Without numbers, bullets stay qualitative. The server then **drops any bullet
  containing a number, capitalised name or tool, common tool word (e.g. "dashboard") or leadership
  claim ("led", "supervised") that isn't in the student's own facts**, and tells the student what was
  removed. The resume and job description are background only, so a skill listed on the resume (e.g.
  Excel) is never claimed for the project. Nothing reaches the resume until the student reviews, edits
  or excludes bullets and chooses *Add to my resume*; they can switch back to their own wording at any
  time. If their facts or answers change afterwards, the bullets are marked *Outdated* and the resume
  shows their own wording until they write them again or keep them.
- **Copy as text** copies the preview as plain text, and **Download PDF** saves a resume-only A4
  PDF of it, generated in the browser: real, selectable text; every line wrapped inside the
  margins; a section heading never left alone at the bottom of a page, and each bullet kept on one
  page. Characters the standard PDF fonts can't show (for example ₹ or Devanagari) are replaced
  (₹ becomes "Rs.") and the student is told which ones. Both use exactly what the preview shows,
  including any AI bullets the student added and edited.
- **Clear my data** removes everything entered and read in the session.
- Responsive layout that works on mobile.

## Unfinished or not yet built

- **Requirement-to-experience map and suitability answer** — *not implemented. Nothing in the app
  simulates them.*
- AI bullets cover the **project entry only**. Resume experience lines are shown in the student's own
  words, so some read like notes.
- The bullet checks catch invented numbers, names, common tool words and leadership claims, but not
  every possible overstatement (for example a stronger verb for the same task). That is why the
  student reviews every bullet; their own edits aren't checked.
- Resume and job-description extraction use simple rules, so unusual layouts may need manual
  correction (every extracted value is editable).
- No accounts or saved progress: refreshing the page clears everything, by design for now.
- No Word export. The PDF uses standard fonts, so non-Latin scripts such as Devanagari can't be
  shown in it yet (they appear on screen and in Copy as text).

## How resume information is processed

- **Pasted text** stays in the browser tab. It is not sent anywhere.
- **Uploaded PDFs** are sent to the app's own server route (`/api/resume/extract`), which checks
  the size (max 5 MB) and that the file really is a PDF, extracts the text in memory with
  [unpdf](https://github.com/unjs/unpdf) (Mozilla pdf.js), and returns it. The file is **not
  saved** to disk or storage, and neither the file nor its text is logged.
- **AI follow-up questions** send, from the app's server to the configured AI provider (Google Gemini by default; requests set `store: false`, so the interaction isn't saved for later retrieval through the API): the resume's
  education, experience, skills and additional sections, the project details, any results and the
  job description. The student's **name, email and phone are not sent**; email addresses and phone
  numbers inside the text are replaced with placeholders first. The API key stays on the server,
  and neither the request nor the response is logged (only an error type and status on failure).
  Without a configured key, nothing is sent. **On the Gemini free tier, Google's terms allow it to
  use submitted content and responses to improve its products, and human reviewers may read them**;
  Step 3 tells students this before they continue. A paid Gemini project (billing enabled) is not used
  for product improvement.
- **AI resume bullets** send the same information plus the student's answered follow-up questions,
  under the same rules: no name or contact details, nothing logged, and only when the student asks
  for bullets after confirming their facts.
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

See [`.env.example`](.env.example). All are **server-side only** — never prefix them with
`NEXT_PUBLIC_`, never commit them.

| Variable | Required | Purpose |
|---|---|---|
| `AI_PROVIDER` | No | `gemini` (default) or `anthropic`. Only the selected provider is called; there is no fallback |
| `GEMINI_API_KEY` | For Gemini | API key from Google AI Studio |
| `GEMINI_MODEL` | No | Gemini model for the questions and bullets; defaults to `gemini-3.8-flash`, which has a free tier. `gemini-3.5-flash-lite` is a free-tier alternative if the daily free quota runs out |
| `ANTHROPIC_API_KEY` | Only if `AI_PROVIDER=anthropic` | Anthropic API key; the account needs API credit |
| `ANTHROPIC_MODEL` | No | Claude model when using Anthropic; defaults to `claude-opus-5-5` |

- **Locally:** create `.env.local` in this folder (ignored by Git) with
  `GEMINI_API_KEY=…`, then restart `npm run dev`.
- **On Vercel:** Project → Settings → Environment Variables → add `GEMINI_API_KEY` (and `GEMINI_MODEL` only if you change the model) for
  Production (and Preview), mark it Sensitive, then redeploy.

Everything else works without a key; the questions screen and the bullets panel then explain that
AI isn't set up yet, or why the provider rejected the request (for example an invalid key, a used-up
free quota or a busy model), and let the student continue. Requests are never retried automatically.

### Switching AI provider

The follow-up questions and the resume bullets use AI, and all provider-specific code lives in
`src/lib/ai/providers/`. Each feature's prompt, output shape (a Zod schema) and server-side checks
are provider-neutral: `src/lib/ai/clarifyPrompt.ts` (at most three new questions) and
`src/lib/ai/bulletsPrompt.ts` (up to five bullets, with the grounding checks). Both API routes share
`src/lib/ai/route.ts`.

To add another provider:

1. Install that provider's official SDK.
2. Create `src/lib/ai/providers/<name>.ts` exporting a `ProviderFactory` (see
   `src/lib/ai/provider.ts`): read its key and model from environment variables, return a setup
   error when they're missing, and implement `generate`: call the model with the request's system
   prompt and student data, and return output that validates against the request's Zod `schema`
   (use the provider's structured-output feature where it has one). Translate its SDK errors into
   `ProviderError`s.
3. Register it in `src/lib/ai/index.ts`, add its variable names to `.env.example`, and set
   `AI_PROVIDER=<name>`.

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
jsPDF for resume PDF download (loaded only when used) ·
Google Gen AI SDK (`@google/genai`, Interactions API) and the Anthropic TypeScript SDK behind a provider
interface, with Zod-validated structured output for follow-up questions and resume bullets.

## Data sources

- Business schools: [NIRF India Rankings 2025: Management](https://www.nirfindia.org/Rankings/2025/ManagementRanking.html)
  (factual names and locations, with attribution) plus manual additions checked on official
  websites. Details and regeneration steps: [`data/README.md`](data/README.md).
- States and union territories: the 28 states and 8 union territories of India.

## Project structure

```
src/app/                      page, layout, the PDF extraction route, /api/clarify and /api/bullets
src/components/               workspace, steps, bullets panel, searchable dropdown, resume preview
src/lib/                      validation, resume parsing and checks, preview builder, bullet facts
src/lib/ai/                   AI provider interface, shared route handling, prompts, checks, providers/
data/                         business-school sources and notes
scripts/build-datasets.mjs    rebuilds src/data/business-schools.json
```

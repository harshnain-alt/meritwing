# Meritwing

**Your experience. Your next move.**

Meritwing helps business-school students find current openings that fit what they have actually
done in a venture or project, then tailor their resume for the one they choose — for operations,
supply chain, growth, marketing or any other function.

**Target user:** MBA, PGDM and other business-school students in India looking for internships or
full-time roles, who have real venture or project experience but find it hard to describe their own
contribution.

**Live prototype:** <https://meritwing.vercel.app>

> **Prototype status:** resume reading, the venture step, a confirmed candidate profile, job
> preferences, real openings from employer careers boards with transparent matching, AI follow-up
> questions, AI-written resume bullets and the review screen work. Job coverage is limited to the
> employer boards listed in [Job sources](#job-sources); it is not every job online. The app never
> shows simulated jobs or AI output. The AI features need a Google Gemini API key on the server (see
> [Environment variables](#environment-variables)); without one, the app explains that they aren't
> set up and lets the student continue with their own words.

## What works today

- **Landing page** with the animated winged-tiger mark, what Meritwing does, the five steps and what
  it won't do; *Start with your resume* opens step 1. Nothing is stored, so a refresh returns here.
- **Five-stage flow**, with progress, Back/Continue and inputs kept between steps:
  1. **Resume** — full name, plus upload a resume (PDF), paste resume text, or continue
     without a resume. Optional *Additional details*: email, phone, State / Union Territory,
     business school, programme and graduation year.
  2. **Your venture** — venture or project name, what it was about, and what you personally did.
     Optional results, with whether they were yours or shared with the team.
  3. **Profile** — Gemini proposes short profile items from the resume and venture details, each
     showing the exact words it came from. The server drops items whose quoted words aren't in the
     student's text or that add to them (numbers, tools, leadership, changed quantities, or more than
     one new word). The student edits, removes or adds items and confirms them. If AI isn't available
     they can use their own lines unchanged. Then the student chooses job preferences: internship,
     full-time or either; roles (operations, supply chain & procurement, growth, marketing, sales,
     strategy, product, finance, analytics, people, customer success); cities or anywhere in India; and
     on-site or remote. Preferences are pre-filled only when the student's own text states them, with
     the words shown.
  4. **Jobs** — a job board: a compact profile summary with *Edit profile*; search (title, company
     or keyword) and filters for role, location, internship/full-time and on-site/remote, which
     search again straight away; and clean cards with title, company, location, work arrangement,
     employment type, stated experience, salary only when the board states it, posting date, a
     one-line reason it matches, and three buttons. **Apply now** opens the employer's application
     page (Lever) or job page (Greenhouse, where applications are made) in a new tab; Meritwing never
     submits anything. **View details** opens a panel with why it matches (the evidence, plus AI fit
     notes prepared on opening), missing qualifications, responsibilities and requirements in the
     employer's own words, and the source. **Tailor my resume** uses that job's description in the
     resume workflow below. Openings come from the employer boards, filtered by plain rules on each listing's
     own words (see [How matching works](#how-matching-works)). Each opening shows role, company,
     location, employment type and workplace (or "not stated"), posting date when the board gives one,
     retrieval time, and links to the original posting and application. For the first openings,
     Gemini explains *why it may fit* — each reason cites a confirmed profile item and quotes the
     listing — and lists requirements quoted from the listing that the profile doesn't show. No scores
     or percentages. The page says which boards were searched, how many listings each rule left out,
     and which sources weren't searched. When nothing matches it says so and never widens the search
     on its own.
  5. **Tailor** — choosing an opening fills the job description with the employer's own text
     (credited and linked), then the existing follow-up questions, draft review, AI bullets, Copy as
     text and Download PDF work as before. *Paste a job description instead* keeps the original route
     for a job found elsewhere, and choosing a listing never silently replaces a description the
     student typed.
- **Resume reading** (no AI): text is extracted from text-based PDFs up to 5 MB, sorted into
  sections by simple rules, and used to fill empty details (never overwriting what the student
  typed). Scanned or unreadable PDFs fall back to pasting text. Students can check and edit
  everything that was read; the original text is kept unchanged. Recognises common Indian resume
  headings (e.g. *Educational Qualifications*, *Internship Experience*, *Scholastic Achievements*,
  *Positions of Responsibility*) and the bullet symbols PDFs often produce; summary or objective
  text is listed under *Lines we couldn't place*.
- **Searchable dropdowns** for State / Union Territory (all 36) and business school (129
  institutions from NIRF 2025 plus verified additions, with free entry for any other school).
- **AI follow-up questions** after the job description (*A few quick questions*): Google Gemini reads the project
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
  claim ("led", "supervised") that isn't in the student's own facts**, or that **changes their meaning**:
  a number attached to a different thing ("quotes from three wholesalers each month" written as "three
  monthly price quotes"), a frequency the facts don't state, a widened scope ("placed orders" written as
  "placed every order") or an ownership claim ("independently") the student didn't make. The student is
  told what was removed. The resume and job description are background only, so a skill listed on the resume (e.g.
  Excel) is never claimed for the project. Nothing reaches the resume until the student reviews, edits
  or excludes bullets and chooses *Add to my resume*; they can switch back to their own wording at any
  time. If their facts or answers change afterwards, the bullets are marked *Outdated* and the resume
  shows their own wording until they write them again or keep them.
- **One resume layout for the preview, the PDF and printing** (`src/lib/resume/layout.ts`): every
  line is positioned on an A4 page in points, measured with the PDF font's own character widths. The
  preview draws those positions as A4 pages (with *Actual size* / *Fit to width*), the PDF draws the
  same positions with jsPDF, and printing the page (Ctrl+P) prints only those pages, so what the
  student sees is what they download. Layout: centred name and contact line (email, phone and links
  are clickable in the PDF), uppercase section headings with a rule, organisation or degree in bold
  with its dates right-aligned to the margin, wrapped bullets with a hanging indent, and empty
  sections left out. Lines that PDF text extraction broke off a bullet ("…and engineering" / "teams")
  are joined back. Long content flows onto more pages, numbered *Page X of Y*; a section heading is
  never left alone at the bottom of a page, a short entry moves to the next page whole instead of
  splitting after one bullet, and text is never shrunk to fit.
- **Copy as text** copies the preview as plain text, and **Download PDF** creates a resume-only A4
  PDF of it, generated in the browser: real, selectable text with nothing of the app on it. Characters the standard PDF fonts can't show (for example ₹ or Devanagari) are replaced
  (₹ becomes "Rs.") and the student is told which ones. Both use exactly what the preview shows,
  including any AI bullets the student added and edited. A page can't tell whether the browser
  actually saved a download, so after creating the PDF the app says it is ready and keeps a
  *Save the PDF* link until the preview changes; if the PDF code fails to load or the PDF can't be
  created, it says which, with *Try again*, and nothing the student entered is lost.
- **Clear my data** removes everything entered and read in the session.
- **Why this fits** on every job card: a button showing how many profile items matched and how much
  is missing expands the card to list the student's own matching items (with where they wrote them and
  what the role also involves) and the evidence the listing asks for that their confirmed profile
  doesn't show. It uses the same rule-based checks as the ranking, not AI, and the same list appears
  under *Missing qualifications* in the details panel.
- Responsive layout that works on mobile.
- **Dark theme (navy)**: navy background and surfaces, white text and electric-blue accents, with
  every text colour at least 4.5:1 against its background. The resume preview stays a white A4 page.
- **Motion**: the landing mark's wings unfold once, then it floats and beats its wings gently; the
  header mark is still apart from a single wingbeat on hover. Elsewhere motion is brief and one-time
  (step headings, job cards, the details panel, a small lift on card hover), and nothing moves
  continuously around job results. With the system's *reduce motion* setting, all of it is off.
  The mark is an original SVG drawn in code (`src/components/brand/tigerSvg.ts`), a first version.

## Job sources

Meritwing reads the **public careers boards** of the employers in
[`src/data/employers.json`](src/data/employers.json), through the documented, key-free
[Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) and
[Lever Postings API](https://github.com/lever/postings-api). These APIs list only published
openings, and openings whose Greenhouse application deadline has passed are left out. Boards are
read by the app's server and cached for 20 minutes; nothing about the student is sent to them.

**Connected (checked 22 Oct 2026, each had India-based openings):** Meesho, CRED, Zeta, FamPay,
Mindtickle and Pocket FM (Lever); Groww, InMobi, Glance, Druva, and the Indian offices of Stripe,
Agoda, Airbnb, Deliveroo, Coinbase and Figma (Greenhouse). **Listed but disabled:** Paytm (Lever),
whose board took over 50 seconds to download.

**To add an employer:** find the board token in its careers URL (`boards.greenhouse.io/<token>` or
`jobs.lever.co/<token>`), check that `https://boards-api.greenhouse.io/v1/boards/<token>/jobs` or
`https://api.lever.co/v0/postings/<token>?mode=json` returns its jobs, and add an entry to
`employers.json`. Set `enabled` to `false` with a `disabledReason` to keep it listed but not searched.

**Not connected:**

| Source | Why | What enabling it would need |
|---|---|---|
| Adzuna API | No credentials, and Adzuna's documentation doesn't confirm India support | An Adzuna developer key (free tier is for evaluation; commercial use needs a licence), then a check that `/jobs/in/` returns Indian listings |
| LinkedIn via Apify | The app has no Apify token. Actors that read public LinkedIn job listings without a login exist (e.g. `curious_coder/linkedin-jobs-scraper`, about $0.001–0.002 per job; Apify's free plan includes $5 of monthly credit), but runs take longer than a page request and LinkedIn's terms restrict automated collection | An Apify API token on the server, a spending limit, background runs with cached results, and a decision on LinkedIn's terms. LinkedIn logins are never requested |
| Naukri, Internshala, Unstop, Indeed | No permitted public API (Naukri's terms prohibit scraping) | — |

## How matching works

Every rule is a plain check on the employer's own words, applied in this order, and the page counts
how many listings each rule left out:

1. **India-based:** a location naming India, an Indian state or a major Indian city.
2. **Open:** not past a stated application deadline.
3. **Type:** *internship* when the title or the employer's employment type says intern; *full-time*
   when the employer says full time, permanent or trainee. Listings that state neither are shown for
   full-time searches, labelled "Type not stated".
4. **Function:** one of the chosen functions' keywords in the job title (ranked first) or team name,
   e.g. operations: "operations", "fulfilment", "last mile"; supply chain: "procurement",
   "logistics", "sourcing". Phrases such as "people operations" don't count as operations. The full
   keyword lists are in [`src/lib/jobs/taxonomy.ts`](src/lib/jobs/taxonomy.ts).
5. **Workplace:** remote-only searches need a remote listing; on-site searches leave remote ones out.
6. **Location:** a chosen city (with aliases such as Bangalore, Gurugram), or anywhere in India.
   Listings naming no city are left out unless the student chooses to include them.
7. **Level:** technical or specialist titles (engineer, designer, editor…) and senior titles (senior,
   lead, head, director…) are left out; "Chief of Staff" is kept.
8. **Duplicates:** the same company, title and location (or the same link) appear once.

### How results are ranked

The filters above stay strict; ranking only orders the openings that passed them. Each opening is
compared with the student's **confirmed own-work profile items** (resume lines and their own venture
contributions and results). An item is *linked* to an opening when the role's own text shares a
responsibility or skill area with it (from a stated vocabulary in
[`src/lib/jobs/evidence.ts`](src/lib/jobs/evidence.ts), e.g. suppliers and procurement, logistics,
campaigns, content), or when an AI fit note cites it. These never count as evidence:

- what the venture was about (its industry or team), and an employer's name in a job line;
- skills the student only lists (shown instead as "you list it, but your profile doesn't show you
  using it");
- generic shared words alone (reporting, coordination, processes, planning, pricing);
- company text: "About us" style sections, and sentences an employer repeats across its listings.

Order: openings linked to two or more items first; those linked to fewer are labelled **Exploratory
match** and follow. Within each group, openings that don't ask for more years of experience than the
profile's dated roles show come first, then more linked items, then more shared areas; ties keep the
search order (title names the interest first, then newest). The page states this rule; there are no
scores or percentages. Every card shows the linked items with the shared areas, and what the listing
asks for that the profile doesn't show: an experience requirement above the profile, skills it names,
and (with AI fit notes) quoted requirements. Fit notes come from Gemini and are labelled
*AI interpretation*; every reason must cite a confirmed profile item and quote at least four words of
the listing, and every unmet requirement must be quoted from the listing, or the server drops it.
AI fit notes are prepared when the student opens an opening's details, not for every result.

## Unfinished or not yet built

- **Job coverage** is limited to the employer boards above, mostly technology and consumer
  companies. Internships are scarce on them: on 22 Oct 2026 only about five India-based internships
  were listed across all boards, none in operations, supply chain, growth or marketing. Most Indian
  business-school internships are posted on LinkedIn, Naukri, Internshala, Unstop or campus portals,
  which aren't connected.
- Many Greenhouse boards don't state employment type or workplace; the app says "not stated" rather
  than guessing.
- AI bullets cover the **project entry only**. Resume experience lines are shown in the student's own
  words, so some read like notes.
- The bullet checks are word-based rules. They catch invented numbers, names, common tool words,
  leadership and ownership claims, and changes to quantities, frequency and scope, but not every
  possible overstatement (for example a stronger verb for the same task), and they can occasionally
  remove a fair rewording (for example a synonym for the thing a number counts). That is why the
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
- **Profile reading** sends the resume sections and venture details; **fit notes** send only the
  confirmed profile items and the public listings. Same rules: no name or contact details, nothing
  logged.
- **Job searches** send nothing about the student anywhere: the server downloads the employers'
  public boards and filters them itself, using only the chosen preferences.
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

Other scripts: `npm test` (regression checks for the bullet rules; no AI requests), `npm run lint`,
`npx tsc --noEmit`, `npm run build`, `npm start`.

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
are provider-neutral: `src/lib/ai/clarifyPrompt.ts` (at most three new questions),
`src/lib/ai/bulletsPrompt.ts` (up to five bullets, with the grounding checks), `profilePrompt.ts`
(profile items with quoted evidence) and `matchPrompt.ts` (fit notes and unmet requirements). The AI
routes share `src/lib/ai/route.ts`.

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
src/app/                      page, layout, the PDF extraction route, /api/profile, /api/jobs/search,
                              /api/jobs/explain, /api/clarify and /api/bullets
src/data/employers.json       the employer careers boards searched for jobs (configurable)
src/lib/jobs/                 board readers, matching rules and filters, job types
src/components/               app shell, landing, workspace, steps, bullets panel, searchable dropdown, resume preview
src/components/brand/         the winged-tiger mark
src/lib/                      validation, resume parsing and checks, preview builder, bullet facts
src/lib/ai/                   AI provider interface, shared route handling, prompts, checks, providers/
src/lib/resume/               shared resume layout (preview, PDF, print) and line clean-up
data/                         business-school sources and notes
scripts/build-datasets.mjs    rebuilds src/data/business-schools.json
scripts/build-font-metrics.mjs  rebuilds src/lib/resume/helvetica-metrics.json from jsPDF's font
```

"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { bulletsForResume, NO_BULLETS, toWritten, type BulletsState } from "@/components/steps/BulletsPanel";
import { DraftView } from "@/components/steps/DraftView";
import { ExperienceStep } from "@/components/steps/ExperienceStep";
import { InternshipStep } from "@/components/steps/InternshipStep";
import { JobsView, NO_JOBS, type JobsState } from "@/components/steps/JobsView";
import { NO_PROFILE, ProfileView, type PreferenceErrors, type ProfileState } from "@/components/steps/ProfileView";
import { NO_CLARIFY, QuestionsView, type Answer, type ClarifyState } from "@/components/steps/QuestionsView";
import { StartStep } from "@/components/steps/StartStep";
import {
  DRAFT_VIEW,
  JOBS_VIEW,
  PROFILE_VIEW,
  QUESTIONS_VIEW,
  emptyApplication,
  hasErrors,
  validateExperience,
  validateInternship,
  validatePasteText,
  validateStart,
  type AboutData,
  type ApplicationData,
  type CheckChoice,
  type ResumeData,
  type ResumeSections,
  type StepId,
  type View,
} from "@/lib/application";
import { bulletFacts, bulletsFingerprint, bulletsOverLimit, buildBulletsInput, type BulletsInput } from "@/lib/bullets";
import {
  buildClarifyInput,
  CLARIFY_LIMITS,
  clarifyFingerprint,
  overLimit,
  type ClarifyError,
  type ClarifyInput,
} from "@/lib/clarify";
import type { JobExplanation } from "@/lib/jobs/explain";
import { rankJobs } from "@/lib/jobs/rank";
import type { JobListing, JobPreferences, JobSearchResult } from "@/lib/jobs/types";
import { suggestJobDetails } from "@/lib/jobParser";
import {
  buildProfileInput,
  EMPTY_PREFERENCES,
  profileFingerprint,
  profileFromOwnWords,
  type ProfileFact,
  type ProfileResult,
} from "@/lib/profile";
import { computeChecks, unresolvedChecks, type ResumeCheck } from "@/lib/resumeChecks";
import { detailsFromResume } from "@/lib/resumeExtract";
import { parseResumeText } from "@/lib/resumeParser";
import { buildPreview } from "@/lib/resumePreview";

const COPY: Record<View, { eyebrow: string; title: string; intro: string }> = {
  1: {
    eyebrow: "Step 1 of 5",
    title: "Let’s start",
    intro: "Add your name and resume. We’ll fill in what we can from it, so you don’t type it twice.",
  },
  2: {
    eyebrow: "Step 2 of 5",
    title: "What did you do?",
    intro: "Tell us about your venture or project in your own words: what it was, what you personally did, and any results.",
  },
  profile: {
    eyebrow: "Step 3 of 5",
    title: "Confirm your profile",
    intro: "Check what we read about you, then tell us what kind of role you’re looking for.",
  },
  jobs: {
    eyebrow: "Step 4 of 5",
    title: "Jobs for you",
    intro: "Current openings from employer careers boards, ranked by evidence from your profile. Apply on the employer’s site, or tailor your resume first.",
  },
  3: {
    eyebrow: "Step 5 of 5 · Tailor",
    title: "Check the job description",
    intro: "This is the job you’ll tailor your resume for. Check the description, or paste one you found elsewhere.",
  },
  questions: {
    eyebrow: "Tailor · Follow-up",
    title: "A few quick questions",
    intro: "These help us understand your own part in the project. Answer what you can; numbers are optional.",
  },
  draft: {
    eyebrow: "Tailor · Your draft",
    title: "Your draft workspace",
    intro: "Check your facts beside the preview. Edit anything that isn’t right.",
  },
};

// Validation keys whose element to focus differs from the key.
const FOCUS_TARGET: Record<string, string> = { resume: "resumeOptions" };

const noopSubscribe = () => () => {};

type Attempted = Record<StepId, boolean>;
const NOT_ATTEMPTED: Attempted = { 1: false, 2: false, 3: false };

/** Follow-up questions the student answered, earliest first. Skipped and blank ones are left out. */
function answeredFollowUps(clarify: ClarifyState): BulletsInput["followUps"] {
  const latest = (clarify.result?.questions ?? []).map((q) => {
    const a = clarify.answers[q.id];
    return { question: q.question, answer: a && !a.skipped ? a.text.trim() : "" };
  });
  return [...clarify.asked.map((a) => ({ question: a.question, answer: a.answer?.trim() ?? "" })), ...latest].filter((f) => f.answer);
}

const BACK: Record<View, View> = { 1: 1, 2: 1, profile: 2, jobs: PROFILE_VIEW, 3: JOBS_VIEW, questions: 3, draft: QUESTIONS_VIEW };

/** What still needs choosing on the profile step before jobs can be searched. */
function preferenceErrors(profile: ProfileState, confirmedFacts: ProfileFact[], prefs: JobPreferences): PreferenceErrors {
  const e: PreferenceErrors = {};
  if (profile.status !== "ready") e.confirm = "Your profile isn’t ready yet. Wait for it, or use your own words.";
  else if (!confirmedFacts.length && profile.confirmed) e.facts = "Keep or add at least one profile item.";
  else if (!profile.confirmed) e.confirm = "Confirm your profile items.";
  if (!prefs.employmentType) e.employmentType = "Choose internship, full-time or either.";
  if (!prefs.roles.length) e.roles = "Choose at least one role.";
  if (!prefs.locations.length) e.locations = "Choose at least one location, or anywhere in India.";
  if (!prefs.workplace) e.workplace = "Choose on-site, remote or either.";
  return e;
}

/** Undo details that were filled from a resume and haven't been edited since. */
function withoutFilled(about: AboutData, filled: ResumeData["filled"]): AboutData {
  const next = { ...about };
  for (const [key, value] of Object.entries(filled) as [keyof AboutData, string][]) {
    if (next[key] === value) next[key] = "";
  }
  return next;
}

export function Workspace() {
  const [data, setData] = useState<ApplicationData>(emptyApplication);
  const [view, setView] = useState<View>(1);
  // Errors only show for a step after the student has tried to continue from it,
  // then update live as they type.
  const [attempted, setAttempted] = useState<Attempted>(NOT_ATTEMPTED);
  const [reachedDraft, setReachedDraft] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);
  // Remounts the steps on Clear my data, which also aborts any upload in flight.
  const [resetKey, setResetKey] = useState(0);
  // Buttons stay disabled until React has hydrated, so the form can never be
  // submitted natively by the browser.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [clarify, setClarify] = useState<ClarifyState>(NO_CLARIFY);
  // Guards against duplicate question requests from repeated clicks.
  const clarifyBusy = useRef(false);
  const clarifyAbort = useRef<AbortController | null>(null);
  const [bullets, setBullets] = useState<BulletsState>(NO_BULLETS);
  const bulletsBusy = useRef(false);
  const bulletsAbort = useRef<AbortController | null>(null);
  const [profile, setProfile] = useState<ProfileState>(NO_PROFILE);
  const [prefs, setPrefs] = useState<JobPreferences>(EMPTY_PREFERENCES);
  const [prefsAttempted, setPrefsAttempted] = useState(false);
  const [jobs, setJobs] = useState<JobsState>(NO_JOBS);
  const [explainError, setExplainError] = useState<ClarifyError | null>(null);
  // The opening the student chose, and the description it filled in, so their own edits are never replaced silently.
  const [selectedJob, setSelectedJob] = useState<{ job: JobListing; description: string } | null>(null);
  // Views the student has reached, so the progress bar can link back to them.
  const [visited, setVisited] = useState<View[]>([1]);
  // One controller for every profile, search and explanation request, so Clear my data can stop them all.
  const requests = useRef(new Set<AbortController>());
  const searchSeq = useRef(0);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  const checks = useMemo(() => computeChecks(data), [data]);
  const unresolved = unresolvedChecks(data, checks).length;
  const currentFingerprint = useMemo(() => clarifyFingerprint(buildClarifyInput(data)), [data]);
  // Questions prepared from information that has since changed.
  const clarifyOutdated = clarify.status === "ready" && clarify.fingerprint !== currentFingerprint;
  const bulletsInput = useMemo(() => buildBulletsInput(data, answeredFollowUps(clarify)), [data, clarify]);
  const currentBulletsFingerprint = useMemo(() => bulletsFingerprint(bulletsInput), [bulletsInput]);
  // Bullets written from facts or answers that have since changed.
  const bulletsOutdated = Boolean(bullets.written) && bullets.written!.fingerprint !== currentBulletsFingerprint;
  const projectBullets = bulletsForResume(bullets, currentBulletsFingerprint);
  const preview = useMemo(() => buildPreview(data, checks, projectBullets), [data, checks, projectBullets]);

  const profileInput = useMemo(() => buildProfileInput(data), [data]);
  const currentProfileFingerprint = useMemo(() => profileFingerprint(profileInput), [profileInput]);
  const profileOutdated = profile.status === "ready" && profile.fingerprint !== currentProfileFingerprint;
  const confirmedFacts = useMemo(
    () => (profile.confirmed ? profile.facts.filter((f) => f.text.trim()).map((f) => ({ ...f, text: f.text.trim() })) : []),
    [profile],
  );
  const factsKey = JSON.stringify(confirmedFacts.map((f) => [f.id, f.text]));
  const prefsKey = JSON.stringify(prefs);
  const jobsOutdated = jobs.status === "ready" && jobs.prefsKey !== prefsKey;
  const explanationsOutdated = Object.keys(jobs.explanations).length > 0 && jobs.factsKey !== factsKey;
  // Fit notes only count towards the ranking while they belong to the current confirmed profile.
  const ranked = useMemo(() => {
    const notes = jobs.factsKey === factsKey
      ? Object.fromEntries(Object.entries(jobs.explanations).flatMap(([id, e]) => (e.status === "ready" ? [[id, e.value]] : [])))
      : {};
    // The search time stands in for "now" (dates like "Jun 2024 - Present"), keeping rendering free of the clock.
    return jobs.result ? rankJobs(jobs.result.jobs, confirmedFacts, notes, new Date(jobs.result.searchedAt)) : [];
  }, [jobs, confirmedFacts, factsKey]);
  const prefErrors = preferenceErrors(profile, confirmedFacts, prefs);
  const hasOwnDescription = Boolean(data.internship.description.trim()) && data.internship.description !== selectedJob?.description;

  const stepErrors = {
    1: validateStart(data.about, data.resume),
    2: validateExperience(data.experience),
    3: validateInternship(data.internship),
  };
  const visibleErrors = <S extends StepId>(s: S) => (attempted[s] ? stepErrors[s] : ({} as (typeof stepErrors)[S]));

  function update<S extends keyof ApplicationData>(
    section: S,
    patch: Partial<ApplicationData[S]> | ((prev: ApplicationData[S]) => Partial<ApplicationData[S]>),
  ) {
    setClearedNotice(false);
    // Any change after confirming means the student must confirm again.
    setConfirmed(false);
    setData((prev) => {
      const next = typeof patch === "function" ? patch(prev[section]) : patch;
      return { ...prev, [section]: { ...prev[section], ...next } };
    });
  }

  /** Reads resume text and fills only empty details from it; never overwrites what the student typed. */
  function applyResumeText(text: string, source: NonNullable<ResumeData["source"]>) {
    setClearedNotice(false);
    setConfirmed(false);
    setData((prev) => {
      const about = withoutFilled(prev.about, prev.resume.filled);
      const proposed = parseResumeText(text);
      const filled: ResumeData["filled"] = {};
      for (const [key, value] of Object.entries(detailsFromResume(proposed)) as [keyof AboutData, string][]) {
        if (value && !about[key].trim()) {
          about[key] = value;
          filled[key] = value;
        }
      }
      return {
        ...prev,
        about,
        resume: {
          ...prev.resume,
          choice: source.kind === "pdf" ? "upload" : "paste",
          source,
          original: text,
          proposed,
          resolutions: {},
          filled,
        },
      };
    });
  }

  function removeResume(keepPasteDraft = false) {
    setConfirmed(false);
    setData((prev) => ({
      ...prev,
      about: withoutFilled(prev.about, prev.resume.filled),
      resume: {
        ...prev.resume,
        source: null,
        original: "",
        proposed: null,
        resolutions: {},
        filled: {},
        pasteDraft: keepPasteDraft ? prev.resume.pasteDraft : "",
      },
    }));
  }

  function focusFirstError(errors: object) {
    const first = Object.keys(errors)[0];
    // Wait for the render, so collapsed sections that contain the error have opened.
    setTimeout(() => document.getElementById(FOCUS_TARGET[first] ?? first)?.focus(), 0);
  }

  function goTo(next: View) {
    if (next === DRAFT_VIEW) setReachedDraft(true);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
    setView(next);
  }

  /** Runs one request with an abort controller that Clear my data can cancel. */
  async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: { result?: unknown; error?: { message?: string } } | null } | null> {
    const controller = new AbortController();
    requests.current.add(controller);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      return { ok: false, status: 0, json: null };
    } finally {
      requests.current.delete(controller);
    }
  }

  /** Reads the candidate profile from the resume and venture details with AI. */
  async function requestProfile() {
    if (profile.status === "loading") return;
    const fingerprint = currentProfileFingerprint;
    setProfile((p) => ({ ...p, status: "loading", error: null }));
    const res = await postJson("/api/profile", profileInput);
    if (!res) return;
    const result = res.json?.result as ProfileResult | undefined;
    if (!res.ok || !result) {
      const error = (res.json?.error as ClarifyError | undefined) ?? {
        code: "unavailable",
        retryable: true,
        message: res.status === 0 ? "We couldn't reach the server. Check your connection and try again." : "Something went wrong. Try again.",
      };
      setProfile((p) => ({ ...p, status: "error", error }));
      return;
    }
    setProfile({ status: "ready", fingerprint, facts: result.facts, suggestedRoles: result.suggestedRoles, found: result.found, removed: result.removed, ownWords: false, confirmed: false, error: null });
    // Fill only preferences the student hasn't chosen, and only from what their text states.
    setPrefs((p) => ({
      ...p,
      employmentType: p.employmentType || result.found.employmentType?.value || "",
      locations: p.locations.length ? p.locations : (result.found.locations?.values ?? []),
      workplace: p.workplace || result.found.workplace?.value || "",
    }));
  }

  function useOwnWords() {
    setProfile({ ...NO_PROFILE, status: "ready", fingerprint: currentProfileFingerprint, facts: profileFromOwnWords(data), ownWords: true });
  }

  function openProfile() {
    goTo(PROFILE_VIEW);
    if (profile.status === "idle") void requestProfile();
  }

  /**
   * Searches the employer boards with exactly the student's preferences. Earlier results stay on
   * screen while it runs, and AI fit notes already prepared are kept. Only the latest search counts.
   */
  async function runSearch(searchPrefs: JobPreferences = prefs) {
    const key = JSON.stringify(searchPrefs);
    const seq = ++searchSeq.current;
    setExplainError(null);
    setJobs((j) => ({ ...j, status: "loading", prefsKey: key, error: null }));
    const res = await postJson("/api/jobs/search", searchPrefs);
    if (!res || seq !== searchSeq.current) return;
    const result = res.json?.result as JobSearchResult | undefined;
    if (!res.ok || !result) {
      setJobs((j) => ({ ...j, status: "error", error: res.json?.error?.message ?? "The job boards couldn't be searched. Check your connection and try again." }));
      return;
    }
    setJobs((j) => ({ ...j, status: "ready", prefsKey: key, result }));
  }

  /** Filters on the jobs page search straight away (after a short pause), but only with complete preferences. */
  function changeFilters(patch: Partial<JobPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (filterTimer.current) clearTimeout(filterTimer.current);
    if (!next.roles.length || !next.locations.length || !next.employmentType || !next.workplace) return;
    filterTimer.current = setTimeout(() => void runSearch(next), 450);
  }

  /** Asks AI how the confirmed profile relates to these openings. */
  async function explain(targets: JobListing[], result: JobSearchResult | null = jobs.result) {
    if (!targets.length || !result) return;
    if (!confirmedFacts.length) {
      const message = "Confirm at least one profile item first (Edit profile).";
      setExplainError({ code: "invalid_input", retryable: false, message });
      setJobs((j) => ({ ...j, explanations: { ...j.explanations, ...Object.fromEntries(targets.map((t) => [t.id, { status: "error" as const, message }])) } }));
      return;
    }
    setExplainError(null);
    const key = factsKey;
    setJobs((j) => ({
      ...j,
      factsKey: key,
      // Notes made for a different profile are dropped rather than mixed with new ones.
      explanations: { ...(j.factsKey === key ? j.explanations : {}), ...Object.fromEntries(targets.map((t) => [t.id, { status: "loading" as const }])) },
    }));
    const res = await postJson("/api/jobs/explain", {
      // Own work only; venture context and education aren't evidence, and listed skills are marked as such.
      facts: confirmedFacts
        .filter((f) => f.basis === "own" && f.kind !== "education")
        .slice(0, 20)
        .map((f) => ({ id: f.id, text: (f.kind === "skill" ? `Listed skill (not shown in use): ${f.text}` : f.text).slice(0, 300) })),
      jobs: targets.map((t) => ({ id: t.id, title: t.title, company: t.company, description: t.description.slice(0, 4000) })),
    });
    if (!res) return;
    const value = res.json?.result as Record<string, JobExplanation> | undefined;
    if (!res.ok || !value) {
      const message = res.json?.error?.message ?? "Something went wrong. Try again.";
      setExplainError((res.json?.error as ClarifyError | undefined) ?? { code: "unavailable", retryable: true, message });
      setJobs((j) => ({ ...j, explanations: { ...j.explanations, ...Object.fromEntries(targets.map((t) => [t.id, { status: "error" as const, message }])) } }));
      return;
    }
    setJobs((j) =>
      j.factsKey !== key
        ? j
        : {
            ...j,
            explanations: {
              ...j.explanations,
              ...Object.fromEntries(targets.map((t) => [t.id, value[t.id] ? { status: "ready" as const, value: value[t.id] } : { status: "error" as const, message: "No notes were returned." }])),
            },
          },
    );
  }

  /** Uses the chosen opening's own description for tailoring. */
  function selectJob(job: JobListing) {
    const description = job.description.trim();
    setSelectedJob({ job, description });
    update("internship", { description, title: job.title, company: job.company, suggestedTitle: job.title, suggestedCompany: job.company });
    goTo(3);
  }

  /** Validates the given step; shows its errors if it fails. */
  function check(step: StepId, resumeOverride?: ResumeData): boolean {
    const errors = step === 1 ? validateStart(data.about, resumeOverride ?? data.resume) : stepErrors[step];
    if (!hasErrors(errors)) return true;
    setAttempted((prev) => ({ ...prev, [step]: true }));
    if (view !== step) setView(step);
    focusFirstError(errors);
    return false;
  }

  /** Step 1: pasted text that hasn't been read yet is read on Continue. */
  function prepareStart(): ResumeData {
    const r = data.resume;
    if (!r.original && r.choice === "paste" && !validatePasteText(r.pasteDraft)) {
      applyResumeText(r.pasteDraft.trim(), { kind: "paste" });
      return { ...r, original: r.pasteDraft.trim() };
    }
    return r;
  }

  /** Asks the server for follow-up questions. Earlier questions are sent so they aren't repeated. */
  async function requestClarify() {
    if (clarifyBusy.current) return;
    // Questions from earlier rounds: for the model (all of them) and for the summary (answered or skipped).
    const lastRound = (clarify.result?.questions ?? []).map((q) => {
      const a = clarify.answers[q.id];
      return { question: q.question, answer: a && !a.skipped && a.text.trim() ? a.text.trim() : null, touched: Boolean(a) };
    });
    const asked = [
      ...clarify.asked,
      ...lastRound.filter((q) => q.touched).map(({ question, answer }) => ({ question, answer })),
    ];
    const previous: ClarifyInput["previous"] = [
      ...clarify.asked,
      ...lastRound.map(({ question, answer }) => ({ question, answer })),
    ].slice(-CLARIFY_LIMITS.previous);

    const input = buildClarifyInput(data, previous);
    const fingerprint = clarifyFingerprint(input);
    const tooLong = overLimit(input);
    if (tooLong) {
      setClarify((c) => ({ ...c, status: "error", fingerprint, error: { code: "too_long", message: tooLong, retryable: false } }));
      return;
    }

    clarifyBusy.current = true;
    const controller = new AbortController();
    clarifyAbort.current = controller;
    setClarify((c) => ({ ...c, status: "loading", fingerprint, error: null }));
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.result) {
        const error: ClarifyError = json?.error ?? {
          code: "unavailable",
          retryable: true,
          message: res.status === 504 ? "The AI service took too long to answer. Try again." : "Something went wrong. Try again.",
        };
        setClarify((c) => ({ ...c, status: "error", error }));
        return;
      }
      setClarify({ status: "ready", fingerprint, result: json.result, answers: {}, error: null, asked });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setClarify((c) => ({
        ...c,
        status: "error",
        error: { code: "unavailable", retryable: true, message: "We couldn't reach the server. Check your connection and try again." },
      }));
    } finally {
      if (clarifyAbort.current === controller) {
        clarifyAbort.current = null;
        clarifyBusy.current = false;
      }
    }
  }

  /** Asks the server for resume bullets written only from the confirmed facts and answers. */
  async function requestBullets() {
    if (bulletsBusy.current || !confirmed) return;
    const input = bulletsInput;
    const fingerprint = currentBulletsFingerprint;
    const tooLong = bulletsOverLimit(input);
    if (tooLong) {
      setBullets((b) => ({ ...b, error: { code: "too_long", message: tooLong, retryable: false } }));
      return;
    }

    bulletsBusy.current = true;
    const controller = new AbortController();
    bulletsAbort.current = controller;
    setBullets((b) => ({ ...b, loading: true, error: null }));
    try {
      const res = await fetch("/api/bullets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.result) {
        const error: ClarifyError = json?.error ?? {
          code: "unavailable",
          retryable: true,
          message: res.status === 504 ? "The AI service took too long to answer. Try again." : "Something went wrong. Try again.",
        };
        setBullets((b) => ({ ...b, loading: false, error }));
        return;
      }
      // New bullets always need reviewing before they reach the resume.
      setBullets({
        loading: false,
        error: null,
        written: toWritten(json.result, fingerprint, bulletFacts(input), input.project.resultsOwnership === "shared"),
        added: false,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setBullets((b) => ({
        ...b,
        loading: false,
        error: { code: "unavailable", retryable: true, message: "We couldn't reach the server. Check your connection and try again." },
      }));
    } finally {
      if (bulletsAbort.current === controller) {
        bulletsAbort.current = null;
        bulletsBusy.current = false;
      }
    }
  }

  /** Opens the questions screen, fetching questions unless current ones still fit the information. */
  function openQuestions() {
    goTo(QUESTIONS_VIEW);
    const current = clarify.status === "ready" && clarify.fingerprint === currentFingerprint;
    if (clarify.status !== "loading" && !current) void requestClarify();
  }

  function setAnswer(id: string, answer: Answer) {
    setConfirmed(false);
    setClarify((c) => ({ ...c, answers: { ...c.answers, [id]: answer } }));
  }

  function setEarlierAnswer(index: number, answer: string | null) {
    setConfirmed(false);
    setClarify((c) => ({ ...c, asked: c.asked.map((a, i) => (i === index ? { ...a, answer } : a)) }));
  }

  function handleContinue() {
    if (view === DRAFT_VIEW || view === JOBS_VIEW) return;
    if (view === QUESTIONS_VIEW) {
      if (clarify.status !== "loading") goTo(DRAFT_VIEW);
      return;
    }
    if (view === PROFILE_VIEW) {
      setPrefsAttempted(true);
      const first = Object.keys(prefErrors)[0];
      if (first) {
        const target = first === "confirm" || first === "facts" ? (profile.status === "ready" ? "profile-confirm" : "profile-heading") : first;
        setTimeout(() => document.getElementById(target)?.focus(), 0);
        return;
      }
      goTo(JOBS_VIEW);
      if (jobs.status !== "loading" && (jobs.status !== "ready" || jobsOutdated)) void runSearch();
      return;
    }
    const resume = view === 1 ? prepareStart() : undefined;
    if (!check(view, resume)) return;
    if (view === 3) openQuestions();
    else if (view === 2) openProfile();
    else goTo(2);
  }

  function handleBack() {
    setView(BACK[view]);
  }

  function handleReturnToDraft() {
    // Only shown on the steps, never on the draft view itself.
    const current = view as StepId;
    const resume = current === 1 ? prepareStart() : undefined;
    if (!check(current, resume)) return;
    for (const step of [1, 2, 3] as StepId[]) if (step !== current && !check(step)) return;
    goTo(DRAFT_VIEW);
  }

  function handleContinueWithout() {
    const resume: ResumeData = { ...data.resume, choice: "none" };
    update("resume", { choice: "none" });
    if (check(1, resume)) goTo(2);
  }

  function handleClear() {
    clarifyAbort.current?.abort();
    clarifyAbort.current = null;
    clarifyBusy.current = false;
    setClarify(NO_CLARIFY);
    bulletsAbort.current?.abort();
    bulletsAbort.current = null;
    bulletsBusy.current = false;
    setBullets(NO_BULLETS);
    requests.current.forEach((c) => c.abort());
    requests.current.clear();
    setProfile(NO_PROFILE);
    setPrefs(EMPTY_PREFERENCES);
    setPrefsAttempted(false);
    setJobs(NO_JOBS);
    setExplainError(null);
    setSelectedJob(null);
    setVisited([1]);
    setData(emptyApplication);
    setAttempted(NOT_ATTEMPTED);
    setConfirmed(false);
    setReachedDraft(false);
    setConfirmingClear(false);
    setClearedNotice(true);
    setResetKey((k) => k + 1);
    if (view === 1) {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    } else {
      setView(1);
    }
  }

  const copy = COPY[view];
  const primaryLabel =
    view === PROFILE_VIEW
      ? "Find matching jobs"
      : view === 3
      ? "Create my application draft"
      : view === QUESTIONS_VIEW
        ? clarify.status === "error"
          ? "Continue without questions"
          : "Continue to draft"
        : "Continue";

  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${view === DRAFT_VIEW ? "max-w-6xl" : view === JOBS_VIEW ? "max-w-4xl" : "max-w-2xl"}`}>
      <div className={`pt-6 sm:pt-8 ${view === DRAFT_VIEW || view === JOBS_VIEW ? "max-w-2xl" : ""}`}>
        <StepIndicator
          current={view}
          onSelect={setView}
          reachable={(step) => visited.includes(step) || (step === 3 && (visited.includes(QUESTIONS_VIEW) || visited.includes(DRAFT_VIEW)))}
        />
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">{copy.eyebrow}</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink focus:outline-none sm:text-[2.125rem]"
          >
            {copy.title}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">{copy.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingClear(true)}
          className="-ml-2 self-start whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-muted underline decoration-line-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:-mr-2 sm:ml-0 sm:self-auto"
        >
          Clear my data
        </button>
      </div>

      {confirmingClear && (
        <div
          role="alertdialog"
          aria-labelledby="clear-title"
          aria-describedby="clear-desc"
          className="mt-5 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4"
        >
          <p id="clear-title" className="font-semibold text-ink">
            Clear everything you&apos;ve entered?
          </p>
          <p id="clear-desc" className="mt-0.5 text-sm text-ink-soft">
            This removes all your answers, your resume text and everything read from it. It can&apos;t be undone.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClear}
              autoFocus
              className="rounded-lg bg-danger px-3.5 py-2 text-sm font-semibold text-white hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              Yes, clear my data
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div role="status">
        {clearedNotice && (
          <p className="mt-5 rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-ink">Your data has been cleared.</p>
        )}
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        className="mt-8"
      >
        {view === 1 && (
          <StartStep
            key={resetKey}
            about={data.about}
            resume={data.resume}
            errors={visibleErrors(1)}
            onAbout={(f, v) => update("about", { [f]: v })}
            onResumeMode={(choice) => update("resume", { choice })}
            onPasteDraft={(pasteDraft) => update("resume", { pasteDraft })}
            onReadPaste={() => {
              const error = validatePasteText(data.resume.pasteDraft);
              if (!error) applyResumeText(data.resume.pasteDraft.trim(), { kind: "paste" });
              return error;
            }}
            onExtracted={(text, fileName, pages) => applyResumeText(text, { kind: "pdf", fileName, pages })}
            onRemoveResume={removeResume}
            onProposedChange={(field: keyof ResumeSections, value: string) =>
              update("resume", (prev) => ({ proposed: prev.proposed && { ...prev.proposed, [field]: value } }))
            }
            onContinueWithout={handleContinueWithout}
          />
        )}
        {view === 2 && (
          <ExperienceStep
            data={data.experience}
            errors={visibleErrors(2)}
            onChange={(f, v) => update("experience", { [f]: v })}
          />
        )}
        {view === PROFILE_VIEW && (
          <ProfileView
            profile={profile}
            outdated={profileOutdated}
            prefs={prefs}
            errors={prefsAttempted ? prefErrors : {}}
            onRetry={() => void requestProfile()}
            onUseOwnWords={useOwnWords}
            onFact={(id, text) => setProfile((p) => ({ ...p, confirmed: false, facts: p.facts.map((f) => (f.id === id ? { ...f, text } : f)) }))}
            onRemoveFact={(id) => setProfile((p) => ({ ...p, confirmed: false, facts: p.facts.filter((f) => f.id !== id) }))}
            onAddFact={() =>
              setProfile((p) => {
                const n = 1 + Math.max(0, ...p.facts.filter((f) => f.id.startsWith("S")).map((f) => Number(f.id.slice(1))));
                return { ...p, confirmed: false, facts: [...p.facts, { id: `S${n}`, text: "", evidence: "", source: "student", kind: "experience", basis: "own" }] };
              })
            }
            onConfirm={(c) => setProfile((p) => ({ ...p, confirmed: c }))}
            onPrefs={(patch) => setPrefs((p) => ({ ...p, ...patch }))}
            onSkipSearch={() => goTo(3)}
          />
        )}
        {view === JOBS_VIEW && (
          <JobsView
            jobs={jobs}
            ranked={ranked}
            prefs={prefs}
            prefsError={
              !prefs.roles.length ? "Choose at least one role to search." : !prefs.locations.length ? "Choose at least one location to search." : null
            }
            profile={{
              name: data.about.fullName.trim(),
              education: [data.about.school, data.about.programme].map((s) => s.trim()).filter(Boolean).join(", "),
              items: confirmedFacts,
            }}
            explanationsOutdated={explanationsOutdated}
            selectedJobId={selectedJob?.job.id ?? null}
            hasOwnDescription={hasOwnDescription}
            explainError={explainError}
            onPrefs={changeFilters}
            onSearch={() => void runSearch()}
            onExplain={(ids) => void explain((jobs.result?.jobs ?? []).filter((j) => ids.includes(j.id)))}
            onSelect={selectJob}
            onEditProfile={() => setView(PROFILE_VIEW)}
            onPasteOwn={() => goTo(3)}
          />
        )}
        {view === 3 && (
          <InternshipStep
            source={selectedJob && data.internship.description === selectedJob.description ? selectedJob.job : null}
            data={data.internship}
            errors={visibleErrors(3)}
            onDescription={(description) =>
              update("internship", (prev) => {
                const suggested = suggestJobDetails(description);
                return {
                  description,
                  // Only replace values the student hasn't changed themselves.
                  title: prev.title === prev.suggestedTitle ? suggested.title : prev.title,
                  company: prev.company === prev.suggestedCompany ? suggested.company : prev.company,
                  suggestedTitle: suggested.title,
                  suggestedCompany: suggested.company,
                };
              })
            }
            onChange={(f, v) => update("internship", { [f]: v })}
          />
        )}
        {view === QUESTIONS_VIEW && (
          <QuestionsView
            clarify={clarify}
            outdated={clarifyOutdated}
            onAnswer={setAnswer}
            onRetry={() => void requestClarify()}
            onEdit={setView}
          />
        )}
        {view === DRAFT_VIEW && (
          <DraftView
            data={data}
            checks={checks}
            unresolved={unresolved}
            preview={preview}
            confirmed={confirmed}
            onConfirm={setConfirmed}
            onResolve={(check: ResumeCheck, choice: CheckChoice) =>
              update("resume", (prev) => ({
                resolutions: { ...prev.resolutions, [check.id]: { choice, signature: check.signature } },
              }))
            }
            onEdit={setView}
            clarify={clarify}
            clarifyOutdated={clarifyOutdated}
            onAnswer={setAnswer}
            onEarlierAnswer={setEarlierAnswer}
            onRefreshQuestions={openQuestions}
            bullets={bullets}
            bulletsOutdated={bulletsOutdated}
            aiBulletsInPreview={projectBullets !== null}
            onWriteBullets={() => void requestBullets()}
            onKeepBullets={() =>
              setBullets((b) => (b.written ? { ...b, written: { ...b.written, fingerprint: currentBulletsFingerprint } } : b))
            }
            onBulletsChange={setBullets}
          />
        )}

        <div
          className={`mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 ${
            view === DRAFT_VIEW ? "max-w-2xl" : ""
          }`}
        >
          {view !== 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {view !== DRAFT_VIEW && view !== JOBS_VIEW && (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {reachedDraft && typeof view === "number" && view !== 3 && (
                <button
                  type="button"
                  disabled={!hydrated}
                  onClick={handleReturnToDraft}
                  className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Return to draft
                </button>
              )}
              <button
                type="submit"
                disabled={!hydrated || (view === QUESTIONS_VIEW && clarify.status === "loading")}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-accent-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {primaryLabel}
              </button>
            </div>
          )}
        </div>
      </form>

      <p className="mt-8 text-center text-xs text-faint">
        Your answers stay in this browser tab and aren&apos;t saved. Refreshing the page clears them.
        PDF uploads are read on our server in memory and not stored.
      </p>
    </div>
  );
}

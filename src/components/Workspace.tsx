"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { bulletsForResume, NO_BULLETS, toWritten, type BulletsState } from "@/components/steps/BulletsPanel";
import { DraftView } from "@/components/steps/DraftView";
import { ExperienceStep } from "@/components/steps/ExperienceStep";
import { InternshipStep } from "@/components/steps/InternshipStep";
import { NO_CLARIFY, QuestionsView, type Answer, type ClarifyState } from "@/components/steps/QuestionsView";
import { StartStep } from "@/components/steps/StartStep";
import {
  DRAFT_VIEW,
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
import { suggestJobDetails } from "@/lib/jobParser";
import { computeChecks, unresolvedChecks, type ResumeCheck } from "@/lib/resumeChecks";
import { detailsFromResume } from "@/lib/resumeExtract";
import { parseResumeText } from "@/lib/resumeParser";
import { buildPreview } from "@/lib/resumePreview";

const COPY: Record<View, { eyebrow: string; title: string; intro: string }> = {
  1: {
    eyebrow: "Step 1 of 3",
    title: "Let’s start",
    intro: "Add your name and resume. We’ll fill in what we can from it, so you don’t type it twice.",
  },
  2: {
    eyebrow: "Step 2 of 3",
    title: "What did you do?",
    intro: "Tell us in your own words. We’ll help organise it.",
  },
  3: {
    eyebrow: "Step 3 of 3",
    title: "Which internship?",
    intro: "Paste the description of the internship you want. We’ll pick out the title and company.",
  },
  questions: {
    eyebrow: "Follow-up",
    title: "A few quick questions",
    intro: "These help us understand your own part in the project. Answer what you can; numbers are optional.",
  },
  draft: {
    eyebrow: "Your draft",
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
    setView(next);
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
    if (view === DRAFT_VIEW) return;
    if (view === QUESTIONS_VIEW) {
      if (clarify.status !== "loading") goTo(DRAFT_VIEW);
      return;
    }
    const resume = view === 1 ? prepareStart() : undefined;
    if (!check(view, resume)) return;
    if (view === 3) openQuestions();
    else goTo((view + 1) as StepId);
  }

  function handleBack() {
    setView(view === DRAFT_VIEW ? QUESTIONS_VIEW : view === QUESTIONS_VIEW ? 3 : ((view - 1) as StepId));
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
    view === 3
      ? "Create my application draft"
      : view === QUESTIONS_VIEW
        ? clarify.status === "error"
          ? "Continue without questions"
          : "Continue to draft"
        : "Continue";

  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${view === DRAFT_VIEW ? "max-w-6xl" : "max-w-2xl"}`}>
      <div className={`pt-6 sm:pt-8 ${view === DRAFT_VIEW ? "max-w-2xl" : ""}`}>
        <StepIndicator current={view} onSelect={setView} />
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
        {view === 3 && (
          <InternshipStep
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
          {view !== DRAFT_VIEW && (
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

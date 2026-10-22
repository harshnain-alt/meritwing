import type { ReactNode } from "react";
import { ErrorText } from "@/components/Field";
import type { ClarifyError, ClarifyResult, RelevantPoint } from "@/lib/clarify";
import type { StepId } from "@/lib/application";

export type Answer = { text: string; skipped: boolean };

export type ClarifyState = {
  status: "idle" | "loading" | "ready" | "error";
  /** Fingerprint of the information the current questions (or request) were based on. */
  fingerprint: string;
  result: ClarifyResult | null;
  answers: Record<string, Answer>;
  error: ClarifyError | null;
  /** Earlier follow-ups, kept when questions are refreshed; answer null means skipped. */
  asked: { question: string; answer: string | null }[];
};

export const NO_CLARIFY: ClarifyState = {
  status: "idle",
  fingerprint: "",
  result: null,
  answers: {},
  error: null,
  asked: [],
};

type QuestionsViewProps = {
  clarify: ClarifyState;
  outdated: boolean;
  onAnswer: (id: string, answer: Answer) => void;
  onRetry: () => void;
  onEdit: (step: StepId) => void;
};

/** "A few quick questions": loading, errors, the questions, or a note that none are needed. */
export function QuestionsView({ clarify, outdated, onAnswer, onRetry, onEdit }: QuestionsViewProps) {
  if (clarify.status === "loading" || clarify.status === "idle") {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-6">
        <span aria-hidden="true" className="size-6 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        <div>
          <p className="font-semibold text-ink">Finding the details that matter</p>
          <p className="mt-0.5 text-sm text-muted">Comparing your experience with the internship. This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (clarify.status === "error" && clarify.error) {
    return <ClarifyErrorPanel error={clarify.error} onRetry={onRetry} onEdit={onEdit} />;
  }

  const result = clarify.result!;
  return (
    <div className="space-y-6">
      {outdated && <OutdatedNotice onRefresh={onRetry} />}

      {result.questions.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-5">
          <p className="font-semibold text-ink">No questions needed</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            What you wrote already covers the details that matter for this internship. Continue to your draft.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {result.questions.map((q, i) => {
            const answer = clarify.answers[q.id] ?? { text: "", skipped: false };
            return (
              <li key={q.id} className="rounded-xl border border-line bg-surface px-5 py-4">
                <label htmlFor={`answer-${q.id}`} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Question {i + 1}</span>
                  <span className="mt-1 block text-[15px] font-semibold leading-snug text-ink">{q.question}</span>
                </label>
                {q.why && (
                  <p id={`why-${q.id}`} className="mt-1 text-sm text-muted">
                    Why we ask: {q.why}
                  </p>
                )}
                <textarea
                  id={`answer-${q.id}`}
                  rows={3}
                  value={answer.text}
                  disabled={answer.skipped}
                  aria-describedby={q.why ? `why-${q.id}` : undefined}
                  placeholder={answer.skipped ? "Skipped" : "Your answer, in your own words"}
                  onChange={(e) => onAnswer(q.id, { text: e.target.value, skipped: false })}
                  className="mt-3 block w-full resize-y rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-faint shadow-xs hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:bg-canvas disabled:text-faint"
                />
                <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={answer.skipped}
                    onChange={(e) => onAnswer(q.id, { text: answer.text, skipped: e.target.checked })}
                    className="size-4 rounded accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  I don&apos;t know / Skip
                </label>
              </li>
            );
          })}
        </ol>
      )}

      <RelevantNotes points={result.relevant} />
    </div>
  );
}

export function OutdatedNotice({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        <span className="font-semibold">Outdated.</span> Your information changed after these questions were
        prepared, so they may no longer fit.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="shrink-0 rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Refresh questions
      </button>
    </div>
  );
}

/** The model's reading of the match. Always labelled as an interpretation and never saved as a fact. */
export function RelevantNotes({ points }: { points: RelevantPoint[] }) {
  if (!points.length) return null;
  return (
    <section aria-labelledby="relevant-heading" className="rounded-xl border border-dashed border-line-strong bg-canvas px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="relevant-heading" className="text-sm font-semibold text-ink">
          What Meritwing noticed
        </h2>
        <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-ink-soft">AI interpretation</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Not added to your profile. It may be wrong; only your own answers count as facts.
      </p>
      <ul className="mt-3 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="text-sm text-ink-soft">
            <span className="font-medium text-ink">{p.roleNeed}</span> — {p.evidence}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClarifyErrorPanel({ error, onRetry, onEdit }: { error: ClarifyError; onRetry: () => void; onEdit: (step: StepId) => void }) {
  const setup = error.code === "not_configured" || error.code === "auth";
  return (
    <div role="alert" className="space-y-4 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4">
      <div>
        <p className="font-semibold text-ink">
          {setup ? "AI questions aren't available yet" : "We couldn't prepare your questions"}
        </p>
        <ErrorText id="clarify">{error.message}</ErrorText>
        <p className="mt-2 text-sm text-ink-soft">
          Your information is safe. You can continue to your draft without questions, or try again later.
        </p>
      </div>

      {setup && (
        <details className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          <summary className="cursor-pointer font-semibold text-ink">Setup steps for the site owner</summary>
          <SetupSteps />
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        {error.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Retry
          </button>
        )}
        {error.code === "too_long" && (
          <button
            type="button"
            onClick={() => onEdit(3)}
            className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Edit my information
          </button>
        )}
      </div>
    </div>
  );
}

function SetupSteps(): ReactNode {
  const code = "rounded bg-canvas px-1 py-0.5 font-mono text-[13px] text-ink";
  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="font-semibold text-ink">Running locally</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>
            In the <span className={code}>meritwing</span> folder, create a file named{" "}
            <span className={code}>.env.local</span> (it is ignored by Git).
          </li>
          <li>
            Add the line <span className={code}>ANTHROPIC_API_KEY=</span> followed by your key from the Anthropic
            Console. Optionally add <span className={code}>ANTHROPIC_MODEL=</span> to choose a model.
          </li>
          <li>
            Stop and restart <span className={code}>npm run dev</span>.
          </li>
        </ol>
      </div>
      <div>
        <p className="font-semibold text-ink">On Vercel</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Open the meritwing project → Settings → Environment Variables.</li>
          <li>
            Add <span className={code}>ANTHROPIC_API_KEY</span> for Production (and Preview if you use it). Mark it
            Sensitive.
          </li>
          <li>Redeploy the latest deployment so the new variable is used.</li>
        </ol>
      </div>
      <p>Never paste the key into a chat, a commit or browser code.</p>
    </div>
  );
}

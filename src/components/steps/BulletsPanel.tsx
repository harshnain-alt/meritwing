import type { BulletFact, BulletsResult, ResumeBullet } from "@/lib/bullets";
import type { ClarifyError } from "@/lib/clarify";

export type DraftBullet = ResumeBullet & { included: boolean; original: string };

export type WrittenBullets = {
  /** Fingerprint of the facts the bullets were written from. */
  fingerprint: string;
  facts: BulletFact[];
  /** Whether the student marked their results as shared with the team. */
  teamResults: boolean;
  items: DraftBullet[];
  removed: number;
  removedTerms: string[];
};

export type BulletsState = {
  loading: boolean;
  error: ClarifyError | null;
  written: WrittenBullets | null;
  /** The student chose to put the included bullets in their resume. */
  added: boolean;
};

export const NO_BULLETS: BulletsState = { loading: false, error: null, written: null, added: false };

export function toWritten(result: BulletsResult, fingerprint: string, facts: BulletFact[], teamResults: boolean): WrittenBullets {
  return {
    fingerprint,
    facts,
    teamResults,
    items: result.bullets.map((b) => ({ ...b, included: true, original: b.text })),
    removed: result.removed,
    removedTerms: result.removedTerms,
  };
}

/** The bullets that go into the resume, or null to use the student's own wording. */
export function bulletsForResume(state: BulletsState, currentFingerprint: string): string[] | null {
  const w = state.written;
  if (!state.added || !w || w.fingerprint !== currentFingerprint) return null;
  const texts = w.items.filter((i) => i.included && i.text.trim()).map((i) => i.text.replace(/\s+/g, " ").trim());
  return texts.length ? texts : null;
}

type BulletsPanelProps = {
  state: BulletsState;
  outdated: boolean;
  confirmed: boolean;
  projectName: string;
  role: string;
  onWrite: () => void;
  /** Keeps outdated bullets after the student has checked them against their changed facts. */
  onKeep: () => void;
  onChange: (update: (state: BulletsState) => BulletsState) => void;
};

const button =
  "rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary =
  "rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-fill-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * AI-written bullets for the project entry. The student reviews, edits and chooses bullets
 * here; nothing reaches the resume until they add them.
 */
export function BulletsPanel({ state, outdated, confirmed, projectName, role, onWrite, onKeep, onChange }: BulletsPanelProps) {
  const w = state.written;
  const included = w?.items.filter((i) => i.included && i.text.trim()).length ?? 0;
  const inResume = state.added && !outdated && included > 0;

  const setItem = (id: string, patch: Partial<DraftBullet>) =>
    onChange((s) => (s.written ? { ...s, written: { ...s.written, items: s.written.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } } : s));

  return (
    <section aria-labelledby="bullets-heading" aria-busy={state.loading} className="space-y-4 rounded-xl border border-line bg-surface px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="bullets-heading" className="font-semibold text-ink">
            Resume bullets for {projectName || "your project"}
          </h3>
          <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-ink-soft">AI-written</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          AI rewords your confirmed facts and follow-up answers as bullets for {role}. It can&apos;t add anything: a
          bullet with a number, tool, name or claim you didn&apos;t give, or one that changes a quantity, how often
          or who did it, is removed. Review and edit each one before adding it.
        </p>
      </div>

      {!w && !state.loading && (
        <div className="space-y-2">
          <button type="button" onClick={onWrite} disabled={!confirmed} className={primary}>
            Write bullets with AI
          </button>
          {!confirmed && <p className="text-sm text-ink">Confirm your facts above first. Bullets only use confirmed facts.</p>}
        </div>
      )}

      {state.loading && (
        <div role="status" className="flex items-center gap-3 text-sm text-ink">
          <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          Writing bullets from your facts. This usually takes a few seconds.
        </div>
      )}

      {state.error && !state.loading && (
        <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm">
          <p className="font-semibold text-ink">We couldn&apos;t write bullets</p>
          <p className="mt-0.5 text-ink-soft">{state.error.message}</p>
          <p className="mt-1 text-ink-soft">Your resume still uses your own wording.</p>
          {state.error.retryable && confirmed && (
            <button type="button" onClick={onWrite} className={`mt-2 ${button}`}>
              Try again
            </button>
          )}
        </div>
      )}

      {w && !state.loading && (
        <>
          {outdated && (
            <div role="status" className="space-y-2 rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-ink">
              <p>
                <span className="font-semibold">Outdated.</span> Your facts changed after these bullets were written
                {state.added ? ", so your resume shows your own wording again" : ""}. Write them again, or check them
                and keep them.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onWrite} disabled={!confirmed} className={button}>
                  Write again
                </button>
                <button type="button" onClick={onKeep} className={button}>
                  Keep these bullets
                </button>
              </div>
              {!confirmed && <p className="text-xs text-muted">Confirm your facts above to write them again.</p>}
            </div>
          )}

          {w.removed > 0 && (
            <p className="text-sm text-ink-soft">
              {w.removed === 1 ? "One suggested bullet was" : `${w.removed} suggested bullets were`} removed because{" "}
              {w.removed === 1 ? "it" : "they"} added details that aren&apos;t in your facts or changed what your facts
              say
              {w.removedTerms.length ? ` (${w.removedTerms.map((t) => `“${t}”`).join(", ")})` : ""}.
            </p>
          )}

          {w.items.length === 0 ? (
            <p className="text-sm text-ink">
              No bullets could be written from your facts without adding details, so your resume keeps your own
              wording. Adding more about what you personally did may help.
            </p>
          ) : (
            <ol className="space-y-4">
              {w.items.map((item, index) => (
                <li key={item.id} className={`rounded-lg border px-4 py-3 ${item.included ? "border-line" : "border-dashed border-line bg-canvas"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(e) => setItem(item.id, { included: e.target.checked })}
                        className="size-4 rounded accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      />
                      Use bullet {index + 1}
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.kind === "team" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
                      }`}
                    >
                      {item.kind === "team" ? "Team achievement" : "Your own work"}
                    </span>
                  </div>
                  <textarea
                    aria-label={`Bullet ${index + 1}`}
                    // Grows with the text where field-sizing is supported; elsewhere rows estimates a
                    // phone-width line, so a whole bullet is visible without scrolling inside the box.
                    rows={Math.min(6, Math.max(2, Math.ceil(item.text.length / 34)))}
                    value={item.text}
                    disabled={!item.included}
                    onChange={(e) => setItem(item.id, { text: e.target.value })}
                    className="mt-2 block min-h-16 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink [field-sizing:content] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:bg-canvas disabled:text-faint"
                  />
                  <Sources ids={item.sources} facts={w.facts} teamResults={w.teamResults} />
                  {item.text !== item.original && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      Edited by you.
                      <button
                        type="button"
                        onClick={() => setItem(item.id, { text: item.original })}
                        className="font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Undo my edits
                      </button>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {w.items.length > 0 && (
            <div className="space-y-2 border-t border-line pt-3">
              <div role="status" className="text-sm">
                {inResume ? (
                  <p className="text-ink">
                    Added to your resume preview. Copy as text and Download PDF use the same bullets, including your
                    edits.
                  </p>
                ) : (
                  <p className="text-muted">Not in your resume yet. Your preview uses your own wording.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {state.added ? (
                  <button type="button" onClick={() => onChange((s) => ({ ...s, added: false }))} className={button}>
                    Use my own wording instead
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange((s) => ({ ...s, added: true }))}
                    disabled={included === 0 || outdated}
                    className={primary}
                  >
                    {included === 1 ? "Add this bullet to my resume" : `Add ${included} bullets to my resume`}
                  </button>
                )}
                {!outdated && (
                  <button type="button" onClick={onWrite} disabled={!confirmed} className={button}>
                    Write again
                  </button>
                )}
              </div>
              <p className="text-xs text-muted">Your own edits aren&apos;t checked automatically. Keep every bullet true.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const FACT_LABEL = { context: "About the project", personal: "What you did", result: "Results", answer: "Your answer" } as const;

function Sources({ ids, facts, teamResults }: { ids: string[]; facts: BulletFact[]; teamResults: boolean }) {
  const cited = ids.map((id) => facts.find((f) => f.id === id)).filter((f): f is BulletFact => Boolean(f));
  if (!cited.length) return null;
  return (
    <details className="mt-1.5 text-xs text-muted">
      <summary className="cursor-pointer font-medium text-ink-soft">Based on {cited.length === 1 ? "1 fact" : `${cited.length} facts`}</summary>
      <ul className="mt-1 space-y-1">
        {cited.map((f) => (
          <li key={f.id}>
            <span className="font-semibold text-ink-soft">
              {FACT_LABEL[f.kind]}
              {f.kind === "result" && teamResults ? " (team)" : ""}:
            </span>{" "}
            “{f.text.length > 160 ? `${f.text.slice(0, 157)}…` : f.text}”
          </li>
        ))}
      </ul>
    </details>
  );
}

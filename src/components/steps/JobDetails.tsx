import { useEffect, useRef, type ReactNode } from "react";
import { ApplyLink, Badge, fmtTime, matchLine, TailorButton, TYPE_LABEL, WORKPLACE_LABEL, type ExplanationState } from "@/components/steps/JobsView";
import type { RankedJob } from "@/lib/jobs/rank";
import { jobSections } from "@/lib/jobs/sections";
import type { JobListing } from "@/lib/jobs/types";

type JobDetailsProps = {
  rank: RankedJob;
  explanation?: ExplanationState;
  selected: boolean;
  hasOwnDescription: boolean;
  onClose: () => void;
  onExplain: () => void;
  onSelect: (job: JobListing) => void;
};

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

/** A readable panel with the full analysis for one opening. Dialog: Escape closes, focus stays inside. */
export function JobDetails({ rank, explanation, selected, hasOwnDescription, onClose, onExplain, onSelect }: JobDetailsProps) {
  const { job, evidence } = rank;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sections = jobSections(job.description);
  const ai = explanation?.status === "ready" ? explanation.value : null;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary, input")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  const missing = [
    ...(evidence.experience?.gap
      ? [`Asks for ${evidence.experience.requiredYears}+ years of experience; your profile shows ${evidence.experience.profileMonths ? `about ${evidence.experience.profileMonths} months of dated work` : "no dated work experience"}.`]
      : []),
    ...evidence.skillsNotShown.map((s) => `${cap(s)} is named in the listing but not shown in your profile.`),
    ...evidence.listedOnly.map((s) => `${cap(s)}: you list it, but your profile doesn't show you using it.`),
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden="true" onClick={onClose} className="mw-fade absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        className="mw-panel relative flex h-full w-full flex-col border-line-strong bg-surface shadow-2xl sm:max-w-xl sm:border-l"
      >
        <header className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="details-title" className="text-lg font-semibold leading-snug text-ink">
                {job.title}
              </h2>
              <p className="mt-0.5 text-[15px] text-ink-soft">{job.company}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close job details"
              className="-mr-1 rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rank.exploratory && <Badge tone="amber">Exploratory match</Badge>}
            {selected && <Badge tone="cobalt">Selected</Badge>}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <TailorButton job={job} hasOwnDescription={hasOwnDescription} onSelect={onSelect} />
            <ApplyLink job={job} />
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 text-[15px] leading-relaxed">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row label="Location" value={job.locations.join("; ") || "Not stated"} />
            <Row label="Work arrangement" value={WORKPLACE_LABEL[job.workplace]} />
            <Row label="Employment type" value={`${TYPE_LABEL[job.employmentType]}${job.employmentTypeText && job.employmentType !== "not-stated" ? ` (“${job.employmentTypeText}”)` : ""}`} />
            {job.experience && <Row label="Experience" value={`${job.experience}, as the listing states`} />}
            {job.salary && <Row label="Salary" value={`${job.salary} (as stated by ${job.company})`} />}
            <Row label={job.source.platform === "Greenhouse" ? "First published" : "Posted"} value={job.postedAt ? new Date(job.postedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not given"} />
          </dl>

          <Section title="Why it matches you">
            <p className="text-ink-soft">{matchLine(rank)}</p>
            {evidence.linked.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {evidence.linked.map((l) => (
                  <li key={l.factId} className="text-sm text-ink-soft">
                    <span className="text-ink">“{l.factText}”</span> — the role also involves {l.terms.join(", ")}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 rounded-lg bg-canvas px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ink">AI fit notes</p>
                <Badge tone="grey">AI interpretation</Badge>
              </div>
              {!explanation && (
                <button type="button" onClick={onExplain} className="mt-1 font-semibold text-accent underline underline-offset-2">
                  Prepare AI fit notes
                </button>
              )}
              {explanation?.status === "loading" && <p className="mt-1 text-muted">Comparing your profile with this listing…</p>}
              {explanation?.status === "error" && (
                <p className="mt-1 text-danger">
                  Couldn&apos;t prepare notes: {explanation.message}{" "}
                  <button type="button" onClick={onExplain} className="font-semibold text-accent underline underline-offset-2">
                    Try again
                  </button>
                </p>
              )}
              {ai?.noDescription && <p className="mt-1 text-ink-soft">The employer&apos;s board gave no description to compare.</p>}
              {ai && !ai.noDescription && (
                ai.fits.length === 0 ? (
                  <p className="mt-1 text-ink-soft">No clear link between your confirmed profile and this listing.</p>
                ) : (
                  <ul className="mt-1.5 space-y-2">
                    {ai.fits.map((f, i) => (
                      <li key={i} className="text-ink-soft">
                        <span className="text-ink">{f.reason}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          Your profile: “{f.factText}” · Listing: “{f.jobQuote}”
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </Section>

          <Section title="Missing qualifications">
            {missing.length === 0 && !(ai && ai.gaps.length) ? (
              <p className="text-ink-soft">
                None found by our checks{ai ? " or the AI notes" : ""}. Read the requirements below to be sure.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
                {ai?.gaps.map((g) => (
                  <li key={g}>
                    “{g}” <span className="text-xs text-muted">(quoted from the listing; AI reading)</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {sections.responsibilities.length > 0 && (
            <Section title="Responsibilities">
              <List items={sections.responsibilities} />
            </Section>
          )}
          {sections.requirements.length > 0 && (
            <Section title="Requirements">
              <List items={sections.requirements} />
            </Section>
          )}
          {(sections.responsibilities.length === 0 || sections.requirements.length === 0) && job.description && (
            <Section title="Full description">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-accent">Show the employer&apos;s full text</summary>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{job.description}</p>
              </details>
            </Section>
          )}

          <Section title="Matches your preferences">
            <ul className="space-y-0.5 text-sm text-ink-soft">
              {job.criteria.map((c) => (
                <li key={c.label}>
                  <span className="font-medium text-ink">{c.label}:</span> {c.detail}
                </li>
              ))}
            </ul>
          </Section>

          <p className="border-t border-line pt-4 text-xs text-muted">
            From {job.company}&apos;s {job.source.platform} careers board, retrieved {fmtTime(job.retrievedAt)}.{" "}
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
              View the original posting
            </a>
            . Applications are made on the employer&apos;s site; Meritwing doesn&apos;t submit anything.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-ink-soft">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </>
  );
}

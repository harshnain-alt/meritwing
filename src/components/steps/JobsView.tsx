import { useState } from "react";
import type { ClarifyError } from "@/lib/clarify";
import type { JobExplanation } from "@/lib/jobs/explain";
import { RANKING_RULE, type RankedJob } from "@/lib/jobs/rank";
import { ANYWHERE_IN_INDIA, CITIES, FUNCTIONS } from "@/lib/jobs/taxonomy";
import { NOT_CONNECTED, type JobListing, type JobPreferences, type JobSearchResult } from "@/lib/jobs/types";

export type ExplanationState = { status: "loading" } | { status: "ready"; value: JobExplanation } | { status: "error"; message: string };

export type JobsState = {
  status: "idle" | "loading" | "ready" | "error";
  /** The preferences the results were searched with. */
  prefsKey: string;
  result: JobSearchResult | null;
  error: string | null;
  /** By job id; only valid for the confirmed facts in factsKey. */
  explanations: Record<string, ExplanationState>;
  factsKey: string;
};

export const NO_JOBS: JobsState = { status: "idle", prefsKey: "", result: null, error: null, explanations: {}, factsKey: "" };
// Three listings take about 30 seconds to explain; more risks the AI request's time limit.
export const EXPLAIN_BATCH = 3;

type JobsViewProps = {
  jobs: JobsState;
  /** The openings in evidence order, with the evidence for each. */
  ranked: RankedJob[];
  prefs: JobPreferences;
  /** Preferences changed after these results were found. */
  outdated: boolean;
  /** Explanations were made for different profile facts. */
  explanationsOutdated: boolean;
  selectedJobId: string | null;
  /** The student typed or pasted their own job description earlier. */
  hasOwnDescription: boolean;
  onSearch: () => void;
  onExplain: (ids: string[]) => void;
  onSelect: (job: JobListing) => void;
  onEditPreferences: () => void;
  onPasteOwn: () => void;
  onIncludeCityNotStated: () => void;
  explainError: ClarifyError | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const TYPE_LABEL = { internship: "Internship", "full-time": "Full-time", "not-stated": "Type not stated" } as const;
const WORKPLACE_LABEL = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote", "not-stated": "Workplace not stated" } as const;

export function summarisePreferences(p: JobPreferences): string {
  const type = p.employmentType === "either" ? "Internships and full-time" : p.employmentType === "internship" ? "Internships" : "Full-time roles";
  const roles = FUNCTIONS.filter((f) => p.roles.includes(f.id)).map((f) => f.label).join(", ");
  const where = p.locations.includes(ANYWHERE_IN_INDIA) ? "anywhere in India" : CITIES.filter((c) => p.locations.includes(c.id)).map((c) => c.label).join(", ");
  const workplace = p.workplace === "remote" ? "remote only" : p.workplace === "onsite" ? "on-site or hybrid" : "on-site or remote";
  return `${type} · ${roles} · ${where} · ${workplace}`;
}

/** Real openings from the employer boards searched, with transparent match criteria. */
export function JobsView(props: JobsViewProps) {
  const { jobs, ranked, prefs, outdated, explanationsOutdated, onSearch, onExplain, onEditPreferences, onPasteOwn, explainError } = props;
  const result = jobs.result;
  const unexplained = ranked.filter((r) => !jobs.explanations[r.job.id]).map((r) => r.job.id);
  const exploratory = ranked.filter((r) => r.exploratory).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Searching for</p>
          <p className="mt-0.5 text-[15px] text-ink">{summarisePreferences(prefs)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEditPreferences} className={secondary}>
            Change preferences
          </button>
          <button type="button" onClick={onPasteOwn} className={secondary}>
            Paste a job description instead
          </button>
        </div>
      </div>

      {outdated && jobs.status !== "loading" && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold">Outdated.</span> Your preferences changed after this search.
          </p>
          <button type="button" onClick={onSearch} className={secondary}>
            Search again
          </button>
        </div>
      )}

      {(jobs.status === "loading" || jobs.status === "idle") && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-5 text-sm text-ink">
          <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          Searching employer job boards. This can take up to half a minute.
        </div>
      )}

      {jobs.status === "error" && (
        <div role="alert" className="space-y-2 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm">
          <p className="font-semibold text-ink">The search didn&apos;t complete</p>
          <p className="text-ink-soft">{jobs.error}</p>
          <button type="button" onClick={onSearch} className={secondary}>
            Try again
          </button>
        </div>
      )}

      {jobs.status === "ready" && result && (
        <>
          <SourcesPanel result={result} />

          {result.jobs.length === 0 ? (
            <NoResults {...props} result={result} />
          ) : (
            <>
              <div className="space-y-1.5 text-sm text-muted">
                <p className="text-ink">
                  {result.counts.shown} {result.counts.shown === 1 ? "opening matches" : "openings match"} your type, role,
                  location and workplace choices{result.counts.shown === 40 ? " (showing the first 40)" : ""}
                  {exploratory > 0 && `; ${exploratory} of them ${exploratory === 1 ? "is an exploratory match" : "are exploratory matches"} with limited evidence in your profile`}.
                </p>
                <p>{RANKING_RULE}</p>
              </div>
              {explanationsOutdated && (
                <p role="status" className="text-sm text-ink">
                  Your profile changed, so the fit notes below are outdated.{" "}
                  <button type="button" onClick={() => onExplain(ranked.slice(0, EXPLAIN_BATCH).map((r) => r.job.id))} className="font-semibold text-accent underline underline-offset-2">
                    Explain again
                  </button>
                </p>
              )}
              {explainError && (
                <p role="alert" className="text-sm text-danger">
                  Fit notes couldn&apos;t be prepared: {explainError.message}
                </p>
              )}
              <ol className="space-y-4">
                {ranked.map((r) => (
                  <JobCard key={r.job.id} job={r.job} rank={r} {...props} />
                ))}
              </ol>
              {unexplained.length > 0 && (
                <button type="button" onClick={() => onExplain(unexplained.slice(0, EXPLAIN_BATCH))} className={secondary}>
                  Get AI fit notes for the next {Math.min(EXPLAIN_BATCH, unexplained.length)}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SourcesPanel({ result }: { result: JobSearchResult }) {
  const searched = result.sources.filter((s) => s.status !== "disabled");
  const ok = searched.filter((s) => s.status === "ok");
  const notRead = searched.filter((s) => s.status !== "ok");
  const c = result.counts;
  const removed: [number, string][] = [
    [c.outsideIndia, "outside India"],
    [c.closed, "past their application deadline"],
    [c.wrongType, "a different type of role"],
    [c.otherFunctions, "other functions"],
    [c.specialist, "technical or specialist roles"],
    [c.workplace, "a different workplace (remote or on-site)"],
    [c.otherLocations, "other Indian cities"],
    [c.cityNotStated, "India-based with no city stated"],
    [c.tooSenior, "senior roles"],
    [c.duplicates, "duplicates"],
  ];
  return (
    <details className="rounded-xl border border-line bg-surface px-5 py-4 text-sm">
      <summary className="cursor-pointer font-semibold text-ink">
        Searched {ok.length} employer job {ok.length === 1 ? "board" : "boards"} on {fmtTime(result.searchedAt)}
        {notRead.length > 0 && ` (${notRead.length} couldn't be read)`}
      </summary>
      <div className="mt-3 space-y-3 text-ink-soft">
        <p>
          These are the public careers boards of the employers below (Greenhouse and Lever). This is not every job online:
          openings posted only on LinkedIn, Naukri, Internshala or company sites without these boards aren&apos;t included.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {searched.map((s) => (
            <li key={s.employer}>
              <a href={s.boardUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
                {s.employer}
              </a>{" "}
              ({s.platform}):{" "}
              {s.status === "ok" ? `${s.inIndia} in India, ${s.matched} matched` : <span className="text-danger">{s.note}</span>}
            </li>
          ))}
        </ul>
        <p>
          Of {c.fetched.toLocaleString("en-IN")} open listings, {removed.filter(([n]) => n > 0).map(([n, why]) => `${n.toLocaleString("en-IN")} ${why}`).join(", ")} were left out.
        </p>
        <div>
          <p className="font-medium text-ink">Not searched</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.sources
              .filter((s) => s.status === "disabled")
              .map((s) => (
                <li key={s.employer}>
                  {s.employer} ({s.platform}): {s.note}
                </li>
              ))}
            {NOT_CONNECTED.map((s) => (
              <li key={s.name}>
                {s.name}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function NoResults({ result, prefs, onEditPreferences, onPasteOwn, onIncludeCityNotStated }: JobsViewProps & { result: JobSearchResult }) {
  const c = result.counts;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface px-5 py-5">
      <p className="font-semibold text-ink">No current openings match all your preferences</p>
      <p className="text-[15px] text-ink-soft">
        We haven&apos;t widened your search. {c.wrongType > 0 && prefs.employmentType === "internship" && "Few employers on these boards list internships in India right now. "}
        You can change your preferences, or paste a job description you found elsewhere.
      </p>
      <div className="flex flex-wrap gap-2">
        {c.cityNotStated > 0 && !prefs.includeCityNotStated && (
          <button type="button" onClick={onIncludeCityNotStated} className={secondary}>
            Include {c.cityNotStated} India-based {c.cityNotStated === 1 ? "role" : "roles"} with no city stated
          </button>
        )}
        <button type="button" onClick={onEditPreferences} className={secondary}>
          Change preferences
        </button>
        <button type="button" onClick={onPasteOwn} className={secondary}>
          Paste a job description instead
        </button>
      </div>
    </div>
  );
}

function JobCard({ job, rank, jobs, selectedJobId, hasOwnDescription, onSelect, onExplain }: JobsViewProps & { job: JobListing; rank: RankedJob }) {
  const [confirming, setConfirming] = useState(false);
  const explanation = jobs.explanations[job.id];
  const selected = selectedJobId === job.id;
  const choose = () => {
    if (hasOwnDescription && !confirming) setConfirming(true);
    else onSelect(job);
  };

  return (
    <li className={`rounded-xl border bg-surface px-5 py-4 ${selected ? "border-accent" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[17px] font-semibold leading-snug text-ink">{job.title}</h3>
          <p className="mt-0.5 text-[15px] text-ink-soft">{job.company}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rank.exploratory && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Exploratory match</span>
          )}
          {selected && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">Selected</span>}
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Info label="Location" value={job.locations.join("; ") || "Not stated"} />
        <Info
          label="Type"
          value={`${TYPE_LABEL[job.employmentType]}${job.employmentTypeText && job.employmentType !== "not-stated" ? ` (“${job.employmentTypeText}”)` : ""} · ${WORKPLACE_LABEL[job.workplace]}`}
        />
        <Info label={job.source.platform === "Greenhouse" ? "First published" : "Posted"} value={job.postedAt ? fmtDate(job.postedAt) : "Not given by the employer"} />
        <Info label="Retrieved" value={fmtTime(job.retrievedAt)} />
      </dl>

      <p className="mt-2 text-sm">
        <a href={job.url} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
          Original posting
        </a>
        {job.applyUrl !== job.url && (
          <>
            {" · "}
            <a href={job.applyUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
              Apply
            </a>
          </>
        )}
        <span className="text-muted"> · {job.company}&apos;s {job.source.platform} careers board</span>
      </p>

      <EvidenceBlock rank={rank} />

      <div className="mt-3 rounded-lg bg-canvas px-4 py-3 text-sm">
        <p className="font-semibold text-ink">Matches your preferences</p>
        <ul className="mt-1 space-y-0.5 text-ink-soft">
          {job.criteria.map((c) => (
            <li key={c.label}>
              <span className="font-medium text-ink">{c.label}:</span> {c.detail}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 text-sm">
        {!explanation && (
          <button type="button" onClick={() => onExplain([job.id])} className="font-semibold text-accent underline underline-offset-2">
            Get AI fit notes for this listing
          </button>
        )}
        {explanation?.status === "loading" && <p className="text-muted">Comparing your profile with this listing…</p>}
        {explanation?.status === "error" && (
          <p className="text-danger">
            Fit notes couldn&apos;t be prepared: {explanation.message}{" "}
            <button type="button" onClick={() => onExplain([job.id])} className="font-semibold text-accent underline underline-offset-2">
              Try again
            </button>
          </p>
        )}
        {explanation?.status === "ready" && <Explanation value={explanation.value} />}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {confirming ? (
          <>
            <p className="text-sm text-ink">This replaces the job description you entered earlier.</p>
            <button type="button" onClick={() => onSelect(job)} className={primary}>
              Replace and continue
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={secondary}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={choose} className={primary}>
            Tailor my resume for this job
          </button>
        )}
      </div>
    </li>
  );
}

/** The rule-based evidence behind the ranking: linked own-work items and what isn't shown. */
function EvidenceBlock({ rank }: { rank: RankedJob }) {
  const { evidence, linkedCount, exploratory } = rank;
  const exp = evidence.experience;
  const missing = [
    ...(exp?.gap
      ? [`Asks for ${exp.requiredYears}+ years of experience; your profile shows ${exp.profileMonths ? `about ${exp.profileMonths} months of dated work` : "no dated work experience"}.`]
      : []),
    ...evidence.skillsNotShown.map((s) => `${s[0].toUpperCase()}${s.slice(1)}: named in the listing, not shown in your profile.`),
    ...evidence.listedOnly.map((s) => `${s[0].toUpperCase()}${s.slice(1)}: you list it, but your profile doesn't show you using it.`),
  ];
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line px-4 py-3 text-sm">
      <p className="font-semibold text-ink">
        Evidence from your profile{" "}
        <span className="font-normal text-muted">
          · linked to {linkedCount} of your own-work {linkedCount === 1 ? "item" : "items"}
          {exploratory ? " (exploratory: limited evidence)" : ""}
        </span>
      </p>
      {evidence.linked.length === 0 ? (
        <p className="text-ink-soft">None of your own-work items share responsibility or skill words with this listing.</p>
      ) : (
        <ul className="space-y-1 text-ink-soft">
          {evidence.linked.map((l) => (
            <li key={l.factId}>
              “{l.factText}” <span className="text-muted">— the listing also mentions {l.terms.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <div>
          <p className="font-medium text-ink">Not shown in your profile</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-ink-soft">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Explanation({ value }: { value: JobExplanation }) {
  if (value.noDescription) return <p className="text-muted">The employer&apos;s board gave no description, so your profile couldn&apos;t be compared with it.</p>;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink">Why it may fit</p>
          <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-ink-soft">AI interpretation</span>
        </div>
        {value.fits.length === 0 ? (
          <p className="mt-1 text-ink-soft">No clear link between your confirmed profile and this listing.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {value.fits.map((f, i) => (
              <li key={i} className="text-ink-soft">
                <span className="text-ink">{f.reason}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Your profile: “{f.factText}” · Listing: “{f.jobQuote}”
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-semibold text-ink">Asked for, but not shown in your profile</p>
        {value.gaps.length === 0 ? (
          <p className="mt-1 text-ink-soft">None identified from the listing.</p>
        ) : (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
            {value.gaps.map((g) => (
              <li key={g}>“{g}”</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted">
          Each item is quoted from the listing; that your profile doesn&apos;t show it is the AI&apos;s reading. If you have
          this experience, add it to your profile.
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

const primary =
  "rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondary =
  "rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { JobDetails } from "@/components/steps/JobDetails";
import type { ClarifyError } from "@/lib/clarify";
import { GENERIC_LABELS } from "@/lib/jobs/evidence";
import type { JobExplanation } from "@/lib/jobs/explain";
import { fitBreakdown } from "@/lib/jobs/fit";
import { RANKING_RULE, type RankedJob } from "@/lib/jobs/rank";
import { ANYWHERE_IN_INDIA, CITIES, FUNCTIONS } from "@/lib/jobs/taxonomy";
import { NOT_CONNECTED, type JobListing, type JobPreferences, type JobSearchResult } from "@/lib/jobs/types";
import type { ProfileFact } from "@/lib/profile";

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

export type ProfileSummary = { name: string; education: string; items: ProfileFact[] };

type JobsViewProps = {
  jobs: JobsState;
  /** The openings in evidence order, with the evidence for each. */
  ranked: RankedJob[];
  prefs: JobPreferences;
  /** Why the current filters can't be searched (e.g. no role chosen), or null. */
  prefsError: string | null;
  profile: ProfileSummary;
  /** Explanations were made for different profile facts. */
  explanationsOutdated: boolean;
  selectedJobId: string | null;
  /** The student typed or pasted their own job description earlier. */
  hasOwnDescription: boolean;
  explainError: ClarifyError | null;
  onPrefs: (patch: Partial<JobPreferences>) => void;
  onSearch: () => void;
  onExplain: (ids: string[]) => void;
  onSelect: (job: JobListing) => void;
  onEditProfile: () => void;
  onPasteOwn: () => void;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const TYPE_LABEL = { internship: "Internship", "full-time": "Full-time", "not-stated": "Type not stated" } as const;
export const WORKPLACE_LABEL = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote", "not-stated": "Workplace not stated" } as const;

/** Short, plain summary of why an opening ranks where it does. */
export function matchLine(r: RankedJob): string {
  if (r.linkedCount === 0) return "Exploratory: none of your profile items relate directly to this role yet.";
  const areas = [...new Set(r.evidence.linked.flatMap((l) => l.terms))].filter((t) => !GENERIC_LABELS.has(t)).slice(0, 3);
  const items = `${r.linkedCount} of your profile ${r.linkedCount === 1 ? "item relates" : "items relate"} to this role`;
  return `${r.exploratory ? "Exploratory: " : ""}${items}${areas.length ? `: ${areas.join(", ")}` : ""}.`;
}

/** The job board: profile summary, filters, ranked openings and a details panel. */
export function JobsView(props: JobsViewProps) {
  const { jobs, ranked, prefs, prefsError, onPrefs, onSearch, onPasteOwn, explanationsOutdated, explainError, onExplain } = props;
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const result = jobs.result;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = ranked.filter((r) => {
    const hay = `${r.job.title} ${r.job.company} ${r.job.description}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const open = ranked.find((r) => r.job.id === openId) ?? null;
  const editFilters = () => {
    filtersRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    filtersRef.current?.querySelector<HTMLElement>("summary, input, button")?.focus({ preventScroll: true });
  };
  const openDetails = (job: JobListing) => {
    setOpenId(job.id);
    // Fit notes are prepared when a student looks at a job, not for every result.
    if (!jobs.explanations[job.id]) onExplain([job.id]);
  };

  return (
    <div className="space-y-5">
      <ProfileCard {...props} />

      <div ref={filtersRef} className="scroll-mt-4">
        <FilterBar prefs={prefs} query={query} onQuery={setQuery} onPrefs={onPrefs} />
        {prefsError && <p className="mt-2 text-sm text-danger">{prefsError}</p>}
      </div>

      {jobs.status === "error" && (
        <div role="alert" className="space-y-2 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm">
          <p className="font-semibold text-ink">The search didn&apos;t complete</p>
          <p className="text-ink-soft">{jobs.error}</p>
          <button type="button" onClick={onSearch} className={secondary}>
            Try again
          </button>
        </div>
      )}

      {(jobs.status === "idle" || (jobs.status === "loading" && !result)) && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-5 text-sm text-ink">
          <Spinner />
          Searching employer job boards. This can take up to half a minute.
        </div>
      )}

      {result && jobs.status !== "error" && (
        <section aria-labelledby="results-heading" aria-busy={jobs.status === "loading"} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id="results-heading" className="text-[15px] font-semibold text-ink">
              {words.length ? `${shown.length} of ${ranked.length} openings match “${query.trim()}”` : `${ranked.length} ${ranked.length === 1 ? "opening" : "openings"}`}
              {ranked.length > 0 && <span className="font-normal text-muted"> · ranked by evidence from your profile</span>}
            </h2>
            <div role="status" className="flex items-center gap-2 text-sm text-muted">
              {jobs.status === "loading" ? (
                <>
                  <Spinner small /> Updating results…
                </>
              ) : (
                <>Updated {fmtTime(result.searchedAt)}</>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Disclosure label="How ranking works">
              <p>{RANKING_RULE}</p>
            </Disclosure>
            <Disclosure label={`Sources searched (${result.sources.filter((s) => s.status === "ok").length} employer boards)`}>
              <SourcesDetail result={result} />
            </Disclosure>
          </div>

          {explanationsOutdated && (
            <p role="status" className="text-sm text-ink">
              Your profile changed, so earlier AI fit notes no longer count. Open a job&apos;s details to prepare new ones.
            </p>
          )}
          {explainError && !open && (
            <p role="alert" className="text-sm text-danger">
              AI fit notes couldn&apos;t be prepared: {explainError.message}
            </p>
          )}

          {ranked.length === 0 ? (
            <NoResults {...props} result={result} onEditFilters={editFilters} />
          ) : (
            <>
              {ranked.length < 5 && (
                <div role="status" className="rounded-xl border border-warn-line bg-warn-soft px-5 py-4 text-sm text-ink">
                  <p className="font-semibold">Only {ranked.length} {ranked.length === 1 ? "opening matches" : "openings match"} your filters right now</p>
                  <p className="mt-1 text-ink-soft">
                    We searched {result.sources.filter((s) => s.status === "ok").length} employer careers boards and haven&apos;t widened your
                    filters. Most Indian internships are posted on sites we can&apos;t search yet (LinkedIn, Naukri, Internshala, Unstop).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={editFilters} className={secondary}>
                      Edit preferences
                    </button>
                    <button type="button" onClick={onPasteOwn} className={secondary}>
                      Paste a job description instead
                    </button>
                  </div>
                </div>
              )}
              {shown.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface px-5 py-5 text-sm">
                  <p className="font-semibold text-ink">No openings match “{query.trim()}”</p>
                  <button type="button" onClick={() => setQuery("")} className={`mt-3 ${secondary}`}>
                    Clear search
                  </button>
                </div>
              ) : (
                <ol className={`space-y-3 ${jobs.status === "loading" ? "opacity-60" : ""}`}>
                  {shown.map((r, i) => (
                    <JobCard key={r.job.id} index={i} rank={r} {...props} onDetails={() => openDetails(r.job)} />
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      )}

      {open && (
        <JobDetails
          rank={open}
          explanation={jobs.explanations[open.job.id]}
          selected={props.selectedJobId === open.job.id}
          hasOwnDescription={props.hasOwnDescription}
          onClose={() => setOpenId(null)}
          onExplain={() => onExplain([open.job.id])}
          onSelect={props.onSelect}
        />
      )}
    </div>
  );
}

function ProfileCard({ profile, onEditProfile }: JobsViewProps) {
  const own = profile.items.filter((f) => f.basis === "own" && f.kind !== "education");
  return (
    <section aria-labelledby="profile-summary" className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 id="profile-summary" className="text-[15px] font-semibold text-ink">
          {profile.name || "Your profile"}
          {profile.education && <span className="font-normal text-muted"> · {profile.education}</span>}
        </h2>
        <p className="mt-0.5 truncate text-sm text-ink-soft">
          {own.length} confirmed {own.length === 1 ? "item" : "items"}
          {own.length > 0 && `: ${own.slice(0, 2).map((f) => f.text).join(" · ")}${own.length > 2 ? ` · +${own.length - 2} more` : ""}`}
        </p>
      </div>
      <button type="button" onClick={onEditProfile} className={`${secondary} shrink-0 self-start sm:self-auto`}>
        Edit profile
      </button>
    </section>
  );
}

function FilterBar({ prefs, query, onQuery, onPrefs }: { prefs: JobPreferences; query: string; onQuery: (q: string) => void; onPrefs: JobsViewProps["onPrefs"] }) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const roleLabel = prefs.roles.length === 0 ? "Choose roles" : prefs.roles.length === 1 ? FUNCTIONS.find((f) => f.id === prefs.roles[0])?.label : `${prefs.roles.length} roles`;
  const anywhere = prefs.locations.includes(ANYWHERE_IN_INDIA);
  const cities = CITIES.filter((c) => prefs.locations.includes(c.id)).map((c) => c.label);
  const locationLabel = anywhere ? "Anywhere in India" : cities.length === 0 ? "Choose locations" : cities.length <= 2 ? cities.join(", ") : `${cities.length} cities`;

  return (
    <div role="search" aria-label="Search and filter jobs" className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search jobs by title, company or keyword</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-faint">
            <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.83l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 8.5 3Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search title, company or keyword"
            className="block w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Dropdown label="Role" value={roleLabel ?? ""}>
            {FUNCTIONS.map((f) => (
              <Check key={f.id} label={f.label} checked={prefs.roles.includes(f.id)} onChange={() => onPrefs({ roles: toggle(prefs.roles, f.id) })} />
            ))}
          </Dropdown>
          <Dropdown label="Location" value={locationLabel}>
            <Check label="Anywhere in India" checked={anywhere} onChange={() => onPrefs({ locations: toggle(prefs.locations, ANYWHERE_IN_INDIA) })} />
            <div className="my-1 border-t border-line" />
            {CITIES.map((c) => (
              <Check key={c.id} label={c.label} checked={prefs.locations.includes(c.id)} onChange={() => onPrefs({ locations: toggle(prefs.locations, c.id) })} />
            ))}
            <div className="my-1 border-t border-line" />
            <Check
              label="Also show India roles with no city stated"
              checked={prefs.includeCityNotStated}
              onChange={() => onPrefs({ includeCityNotStated: !prefs.includeCityNotStated })}
            />
          </Dropdown>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Segmented
          label="Type"
          value={prefs.employmentType}
          options={[["internship", "Internship"], ["full-time", "Full-time"], ["either", "Both"]]}
          onChange={(v) => onPrefs({ employmentType: v as JobPreferences["employmentType"] })}
        />
        <Segmented
          label="Work arrangement"
          value={prefs.workplace}
          options={[["onsite", "On-site / hybrid"], ["remote", "Remote"], ["any", "Any"]]}
          onChange={(v) => onPrefs({ workplace: v as JobPreferences["workplace"] })}
        />
      </div>
    </div>
  );
}

function Dropdown({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  // Close when the student clicks elsewhere or presses Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <details ref={ref} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span className="text-muted">{label}:</span>
        <span className="max-w-[11rem] truncate font-medium">{value}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-muted transition group-open:rotate-180">
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </summary>
      <div className="absolute left-0 z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 shadow-lg">{children}</div>
    </details>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-canvas">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded accent-accent" />
      {label}
    </label>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-sm text-muted">
        {label}
      </span>
      <div className="inline-flex rounded-lg border border-line-strong bg-canvas p-0.5">
        {options.map(([v, text]) => (
          <label
            key={v}
            className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-soft has-[:checked]:bg-surface has-[:checked]:font-semibold has-[:checked]:text-ink has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={label} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function JobCard({ index, rank, profile, selectedJobId, hasOwnDescription, onSelect, onDetails }: JobsViewProps & { index: number; rank: RankedJob; onDetails: () => void }) {
  const { job } = rank;
  const selected = selectedJobId === job.id;
  const facts = [
    job.locations.length ? `${job.locations[0]}${job.locations.length > 1 ? ` +${job.locations.length - 1}` : ""}` : "Location not stated",
    WORKPLACE_LABEL[job.workplace],
    TYPE_LABEL[job.employmentType],
    job.experience ? `${job.experience}' experience` : null,
    job.salary,
    job.postedAt ? `Posted ${fmtDate(job.postedAt)}` : null,
  ].filter(Boolean) as string[];

  return (
    // Cards fade in once when they appear (a short stagger for the first few), never continuously.
    <li
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className={`mw-card mw-rise rounded-xl border bg-surface px-4 py-4 sm:px-5 ${selected ? "border-accent ring-1 ring-accent" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug text-ink">{job.title}</h3>
          <p className="mt-0.5 text-[15px] text-ink-soft">{job.company}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {rank.exploratory && <Badge tone="amber">Exploratory</Badge>}
          {selected && <Badge tone="cobalt">Selected</Badge>}
        </div>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Job facts">
        {facts.map((f) => (
          <li key={f} className="rounded-md bg-canvas px-2 py-1 text-[13px] text-ink-soft">
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-soft">
        <span className="font-medium text-ink">Why it matches: </span>
        {matchLine(rank)}
      </p>
      <WhyThisFits rank={rank} facts={profile.items} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <TailorButton job={job} hasOwnDescription={hasOwnDescription} onSelect={onSelect} />
        <ApplyLink job={job} />
        <button type="button" onClick={onDetails} className={ghost}>
          View details
        </button>
      </div>
    </li>
  );
}

/**
 * "Why this fits": expands in the card to show the student's own items that match the listing,
 * and what the listing asks for that their confirmed profile doesn't show. Rule-based, not AI.
 */
function WhyThisFits({ rank, facts }: { rank: RankedJob; facts: ProfileFact[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { matched, missing } = fitBreakdown(rank.evidence, facts);
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-ml-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Why this fits{" "}
        <span className="font-medium text-muted">
          · {matched.length} matched, {missing.length} missing
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 fill-current transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </button>
      <div id={id} role="region" aria-label={`Why ${rank.job.title} fits`} hidden={!open} className="mw-expand">
        <div className="mt-2 grid gap-x-6 gap-y-4 rounded-xl border border-line bg-canvas/60 px-4 py-3.5 sm:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Your experience that fits</h4>
            {matched.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">None of your confirmed profile items relate directly to this role yet.</p>
            ) : (
              <ul className="mt-2.5 space-y-3">
                {matched.map((m) => (
                  <li key={m.factId} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 fill-accent">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                    </svg>
                    <div>
                      <q className="text-ink">{m.text}</q>
                      <span className="mt-0.5 block text-[13px] text-muted">
                        {m.source ? `${m.source} · ` : ""}the role also involves {m.terms.join(", ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Missing evidence</h4>
            {missing.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">None found by our checks. Read the requirements to be sure.</p>
            ) : (
              <ul className="mt-2.5 space-y-2.5">
                {missing.map((m) => (
                  <li key={m} className="grid grid-cols-[18px_1fr] gap-2 text-sm text-ink-soft">
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 fill-none stroke-muted" strokeWidth="1.6" strokeDasharray="3 2.4">
                      <circle cx="10" cy="10" r="6.5" />
                    </svg>
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-line pt-2.5 text-[13px] text-muted sm:col-span-2">
            Compared with your confirmed profile by simple rules, not AI. Add a missing item to your profile only if it&apos;s true.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Opens the employer's application (or job page) in a new tab. Never claims anything was submitted. */
export function ApplyLink({ job }: { job: JobListing }) {
  const direct = job.applyUrl !== job.url;
  return (
    <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className={`${outline} inline-flex items-center justify-center gap-1.5`}>
      Apply now
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
        <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.29a1 1 0 1 0 1.42 1.42L15 6.41V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
        <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
      </svg>
      <span className="sr-only">
        {direct ? ` on ${job.company}'s application page` : ` on ${job.company}'s job page`} (opens in a new tab)
      </span>
    </a>
  );
}

/** Uses this job's description in the resume workflow, asking first if it would replace one the student typed. */
export function TailorButton({ job, hasOwnDescription, onSelect }: { job: JobListing; hasOwnDescription: boolean; onSelect: (job: JobListing) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div role="group" aria-label="Replace your job description?" className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
        <span className="text-ink">This replaces the job description you entered.</span>
        <button type="button" onClick={() => onSelect(job)} className={primary}>
          Replace and continue
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={ghost}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={() => (hasOwnDescription ? setConfirming(true) : onSelect(job))} className={primary}>
      Tailor my resume
    </button>
  );
}

export function Badge({ tone, children }: { tone: "amber" | "cobalt" | "grey"; children: ReactNode }) {
  const cls = tone === "amber" ? "bg-warn-soft text-warn" : tone === "cobalt" ? "bg-accent-soft text-accent" : "bg-line text-ink-soft";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group w-full sm:w-auto">
      <summary className="cursor-pointer list-none font-medium text-accent underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-90">›</span>
      </summary>
      <div className="mt-2 max-w-3xl rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}

function SourcesDetail({ result }: { result: JobSearchResult }) {
  const searched = result.sources.filter((s) => s.status !== "disabled");
  const c = result.counts;
  const removed: [number, string][] = [
    [c.outsideIndia, "outside India"],
    [c.closed, "past their application deadline"],
    [c.wrongType, "a different type of role"],
    [c.otherFunctions, "other functions"],
    [c.specialist, "technical or specialist roles"],
    [c.workplace, "a different work arrangement"],
    [c.otherLocations, "other Indian cities"],
    [c.cityNotStated, "India-based with no city stated"],
    [c.tooSenior, "senior roles"],
    [c.duplicates, "duplicates"],
  ];
  return (
    <div className="space-y-3">
      <p>
        The public careers boards of these employers (Greenhouse and Lever), searched {fmtTime(result.searchedAt)}. This is not
        every job online.
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {searched.map((s) => (
          <li key={s.employer}>
            <a href={s.boardUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-2">
              {s.employer}
            </a>{" "}
            — {s.status === "ok" ? `${s.inIndia} in India, ${s.matched} matched` : <span className="text-danger">{s.note}</span>}
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
                {s.employer}: {s.note}
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
  );
}

function NoResults({ result, prefs, onPrefs, onPasteOwn, onEditFilters }: JobsViewProps & { result: JobSearchResult; onEditFilters: () => void }) {
  const c = result.counts;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface px-5 py-5">
      <p className="font-semibold text-ink">No current openings match your filters</p>
      <p className="text-[15px] text-ink-soft">
        We searched {result.sources.filter((s) => s.status === "ok").length} employer careers boards and haven&apos;t widened your filters.
        {c.wrongType > 0 && prefs.employmentType === "internship" && " Few of these employers list internships in India right now; most are posted on sites we can't search yet."}
      </p>
      <div className="flex flex-wrap gap-2">
        {c.cityNotStated > 0 && !prefs.includeCityNotStated && (
          <button type="button" onClick={() => onPrefs({ includeCityNotStated: true })} className={secondary}>
            Include {c.cityNotStated} India-based {c.cityNotStated === 1 ? "role" : "roles"} with no city stated
          </button>
        )}
        <button type="button" onClick={onEditFilters} className={secondary}>
          Edit preferences
        </button>
        <button type="button" onClick={onPasteOwn} className={secondary}>
          Paste a job description instead
        </button>
      </div>
    </div>
  );
}

function Spinner({ small }: { small?: boolean }) {
  return <span aria-hidden="true" className={`${small ? "size-3.5" : "size-5"} shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent`} />;
}

const base = "rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const primary = `${base} bg-accent-fill text-white hover:bg-accent-fill-hover`;
export const outline = `${base} border border-accent text-accent hover:bg-accent-soft`;
export const ghost = `${base} text-ink hover:bg-canvas`;
export const secondary = `${base} border border-line-strong bg-surface text-ink hover:bg-canvas`;

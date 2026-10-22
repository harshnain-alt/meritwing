import type { ReactNode } from "react";
import { Checkbox, ErrorText } from "@/components/Field";
import type { ClarifyError } from "@/lib/clarify";
import { ANYWHERE_IN_INDIA, CITIES, FUNCTIONS } from "@/lib/jobs/taxonomy";
import type { JobPreferences } from "@/lib/jobs/types";
import type { FoundPreferences, ProfileFact } from "@/lib/profile";

export type ProfileState = {
  status: "idle" | "loading" | "ready" | "error";
  /** Fingerprint of the resume and venture details the profile was read from. */
  fingerprint: string;
  facts: ProfileFact[];
  suggestedRoles: { id: string; reason: string }[];
  found: FoundPreferences;
  /** Facts the server dropped because they weren't supported by the student's text. */
  removed: number;
  /** Built from the student's own lines because AI wasn't available or they chose it. */
  ownWords: boolean;
  confirmed: boolean;
  error: ClarifyError | null;
};

export const NO_PROFILE: ProfileState = {
  status: "idle",
  fingerprint: "",
  facts: [],
  suggestedRoles: [],
  found: {},
  removed: 0,
  ownWords: false,
  confirmed: false,
  error: null,
};

export type PreferenceErrors = Partial<Record<"facts" | "confirm" | "employmentType" | "roles" | "locations" | "workplace", string>>;

type ProfileViewProps = {
  profile: ProfileState;
  outdated: boolean;
  prefs: JobPreferences;
  errors: PreferenceErrors;
  onRetry: () => void;
  onUseOwnWords: () => void;
  onFact: (id: string, text: string) => void;
  onRemoveFact: (id: string) => void;
  onAddFact: () => void;
  onConfirm: (confirmed: boolean) => void;
  onPrefs: (patch: Partial<JobPreferences>) => void;
  /** Goes straight to pasting a job description, skipping the job search. */
  onSkipSearch: () => void;
};

const SOURCE_LABEL = { resume: "From your resume", venture: "From your venture details", student: "Added by you" } as const;
const chip =
  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

/** Step: confirm the candidate profile, then choose job preferences. */
export function ProfileView({ profile, outdated, prefs, errors, onRetry, onUseOwnWords, onFact, onRemoveFact, onAddFact, onConfirm, onPrefs, onSkipSearch }: ProfileViewProps) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const found = profile.found;

  return (
    <div className="space-y-8">
      <section aria-labelledby="profile-heading" className="space-y-4">
        <div>
          <h2 id="profile-heading" tabIndex={-1} className="font-display text-xl font-semibold text-ink focus:outline-none">
            Your profile
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            What we read from your resume and venture details. Matching only uses what you confirm here, so edit or
            remove anything that isn&apos;t right.
          </p>
          {profile.status !== "ready" && <ErrorText id="profile-status">{errors.confirm}</ErrorText>}
        </div>

        {(profile.status === "loading" || profile.status === "idle") && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-5 py-5 text-sm text-ink">
            <span aria-hidden="true" className="size-5 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
            Reading your resume and venture details. This usually takes a few seconds.
          </div>
        )}

        {profile.status === "error" && profile.error && (
          <div role="alert" className="space-y-3 rounded-xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm">
            <div>
              <p className="font-semibold text-ink">We couldn&apos;t read your profile with AI</p>
              <p className="mt-0.5 text-ink-soft">{profile.error.message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onUseOwnWords} className={primary}>
                Use my own words as the profile
              </button>
              {profile.error.retryable && (
                <button type="button" onClick={onRetry} className={secondary}>
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {profile.status === "ready" && (
          <div className="space-y-3">
            {outdated && (
              <div role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <span className="font-semibold">Outdated.</span> Your resume or venture details changed after this
                  profile was read.
                </p>
                <button type="button" onClick={onRetry} className={secondary}>
                  Read again
                </button>
              </div>
            )}
            <p className="text-xs text-muted">
              {profile.ownWords
                ? "Built from your own lines, unchanged."
                : "Suggested by AI from your own words. Each item shows the words it came from."}
              {profile.removed > 0 &&
                ` ${profile.removed} suggested ${profile.removed === 1 ? "item was" : "items were"} left out because ${profile.removed === 1 ? "it" : "they"} added to what you wrote.`}
            </p>
            {profile.facts.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">No profile items yet. Add what you&apos;d like employers to know.</p>
            ) : (
              <ul className="space-y-3">
                {profile.facts.map((f, i) => (
                  <li key={f.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {f.basis === "context" ? "About your venture (not counted as your own work)" : SOURCE_LABEL[f.source]}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveFact(f.id)}
                        aria-label={`Remove profile item ${i + 1}`}
                        className="rounded-md px-2 py-0.5 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      aria-label={`Profile item ${i + 1}`}
                      rows={Math.min(4, Math.max(1, Math.ceil(f.text.length / 60)))}
                      value={f.text}
                      onChange={(e) => onFact(f.id, e.target.value)}
                      className="mt-1.5 block w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink [field-sizing:content] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                    />
                    {f.evidence && f.evidence !== f.text && <p className="mt-1.5 text-xs text-muted">Your words: “{f.evidence}”</p>}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onAddFact} className={secondary}>
              Add an item
            </button>
            <ErrorText id="facts">{errors.facts}</ErrorText>
            <div className="rounded-xl border border-line bg-surface px-5 py-4">
              <Checkbox
                id="profile-confirm"
                checked={profile.confirmed}
                onChange={onConfirm}
                label="These items are accurate. Use them to explain how jobs match."
                error={errors.confirm}
              />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="prefs-heading" className="space-y-6">
        <div>
          <h2 id="prefs-heading" className="font-display text-xl font-semibold text-ink">
            What are you looking for?
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            We search only what you choose. If few openings match, we&apos;ll say so rather than widen your search.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Already have a job in mind?{" "}
            <button type="button" onClick={onSkipSearch} className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Skip the search and paste its description
            </button>
          </p>
        </div>

        <Group id="employmentType" legend="Type of role" hint={found.employmentType && <Found quote={found.employmentType.quote} />} error={errors.employmentType}>
          {([["internship", "Internship"], ["full-time", "Full-time"], ["either", "Either"]] as const).map(([value, label]) => (
            <label key={value} className={chip}>
              <input type="radio" name="employmentType" className="sr-only" checked={prefs.employmentType === value} onChange={() => onPrefs({ employmentType: value })} />
              {label}
            </label>
          ))}
        </Group>

        <Group id="roles" legend="Roles you're interested in" hint="Choose one or more." error={errors.roles}>
          {FUNCTIONS.map((f) => {
            const suggested = profile.suggestedRoles.find((s) => s.id === f.id);
            return (
              <label key={f.id} className={chip} title={suggested ? `Suggested: ${suggested.reason}` : undefined}>
                <input type="checkbox" className="sr-only" checked={prefs.roles.includes(f.id)} onChange={() => onPrefs({ roles: toggle(prefs.roles, f.id) })} />
                {f.label}
                {suggested && <span className="rounded-full bg-line px-1.5 text-[11px] font-semibold text-ink-soft">Suggested</span>}
              </label>
            );
          })}
        </Group>
        {profile.suggestedRoles.length > 0 && (
          <ul className="-mt-3 space-y-0.5 text-xs text-muted">
            {profile.suggestedRoles.map((s) => (
              <li key={s.id}>
                Suggested {FUNCTIONS.find((f) => f.id === s.id)?.label}: {s.reason}
              </li>
            ))}
          </ul>
        )}

        <Group id="locations" legend="Where in India" hint={found.locations ? <Found quote={found.locations.quote} /> : "Choose cities, or anywhere in India."} error={errors.locations}>
          {[{ id: ANYWHERE_IN_INDIA, label: "Anywhere in India" }, ...CITIES].map((c) => (
            <label key={c.id} className={chip}>
              <input type="checkbox" className="sr-only" checked={prefs.locations.includes(c.id)} onChange={() => onPrefs({ locations: toggle(prefs.locations, c.id) })} />
              {c.label}
            </label>
          ))}
        </Group>

        <Group id="workplace" legend="On-site or remote" hint={found.workplace && <Found quote={found.workplace.quote} />} error={errors.workplace}>
          {([["onsite", "On-site or hybrid"], ["remote", "Remote only"], ["any", "Either"]] as const).map(([value, label]) => (
            <label key={value} className={chip}>
              <input type="radio" name="workplace" className="sr-only" checked={prefs.workplace === value} onChange={() => onPrefs({ workplace: value })} />
              {label}
            </label>
          ))}
        </Group>
      </section>

      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-ink">About the AI features:</span> to read your profile and explain job
        matches, Meritwing sends your resume sections, venture details and confirmed profile to Google Gemini. Your name,
        email and phone are not sent. On Gemini&apos;s free tier, Google may use what is sent to improve its products, and
        people may review it. Job boards receive nothing about you: Meritwing reads their public listings and filters
        them on its own server.
      </p>
    </div>
  );
}

const primary =
  "rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const secondary =
  "rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Found({ quote }: { quote: string }) {
  return <>Found in your text: “{quote}”. Change it if it&apos;s wrong.</>;
}

function Group({ id, legend, hint, error, children }: { id: string; legend: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <fieldset id={id} tabIndex={-1} className="focus:outline-none">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
      <ErrorText id={id}>{error}</ErrorText>
    </fieldset>
  );
}

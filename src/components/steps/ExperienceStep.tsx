"use client";

import { useEffect, useRef, useState } from "react";
import { controlState, ErrorText, Field } from "@/components/Field";
import { entryOf, type ExperienceData, type FieldErrors, type VentureBullet, type VentureEntry } from "@/lib/application";
import { answersKey, bulletText, draftVentureEntry, unsupportedDetails } from "@/lib/ventureEntry";

type ExperienceStepProps = {
  data: ExperienceData;
  errors: FieldErrors<ExperienceData>;
  onChange: (patch: Partial<ExperienceData>) => void;
  /** The resume's own lines about this venture, if it already mentions it. */
  resumeMention: string | null;
};

const input =
  "block w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-faint shadow-xs transition-colors focus:outline-none focus:ring-3 [field-sizing:content]";
const secondary =
  "rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-raise disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primary =
  "rounded-lg bg-accent-fill px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-fill-hover disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * "Your venture": three questions, then an Experience entry drafted from the answers only. The
 * student reviews and edits it, then adds it to their resume (adding again updates it).
 */
export function ExperienceStep({ data, errors, onChange, resumeMention }: ExperienceStepProps) {
  const [needAnswers, setNeedAnswers] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<string | null>(null);
  const draft = data.draft;
  const answered = Boolean(data.projectName.trim() && data.about.trim() && data.personal.trim());
  const answersChanged = Boolean(draft && draft.from !== answersKey(data));
  const added = Boolean(data.entry && draft && JSON.stringify(entryOf(draft)) === JSON.stringify(data.entry));

  // After adding or removing a bullet, move focus to where the student is working.
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function draftEntry() {
    if (!answered) {
      setNeedAnswers(true);
      const first = (["projectName", "about", "personal"] as const).find((k) => !data[k].trim());
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setNeedAnswers(false);
    setNotice(null);
    onChange({ draft: { ...draftVentureEntry(data), from: answersKey(data) } });
    setTimeout(() => reviewRef.current?.focus(), 0);
  }

  function edit(next: VentureEntry) {
    setNotice(null);
    onChange({ draft: { ...next, from: draft!.from } });
  }

  function addToResume() {
    if (!draft) return;
    const clean: VentureEntry = {
      heading: draft.heading.trim(),
      description: draft.description.trim(),
      bullets: draft.bullets.map((b) => ({ ...b, text: b.text.trim() })).filter((b) => b.text),
    };
    if (!clean.heading) {
      document.getElementById("venture-heading")?.focus();
      return;
    }
    const updating = Boolean(data.entry);
    onChange({ entry: clean, draft: { ...clean, from: draft.from } });
    setNotice(`${updating ? "Updated" : "Added"} “${clean.heading}” under Experience. Your other resume entries are unchanged.`);
  }

  const setBullet = (i: number, patch: Partial<VentureBullet>) =>
    draft && edit({ ...draft, bullets: draft.bullets.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-7">
      <p className="text-[15px] text-muted">
        Answer in your own words. Numbers, dates or results are welcome if they&apos;re true, but none are needed.
      </p>
      <Field
        id="projectName"
        label="Venture name"
        placeholder="What is your venture called?"
        value={data.projectName}
        onChange={(v) => onChange({ projectName: v })}
        error={errors.projectName}
      />
      <Field
        id="about"
        label="What does the venture do?"
        placeholder="Briefly describe the product or service and its customers."
        multiline
        rows={3}
        value={data.about}
        onChange={(v) => onChange({ about: v })}
        error={errors.about}
      />
      <Field
        id="personal"
        label="What did you personally do?"
        hint="Write “I…” for your own work and “we…” for what the team did together. One action per sentence or line works best."
        placeholder="Describe your responsibilities and actions in your own words."
        multiline
        rows={6}
        value={data.personal}
        onChange={(v) => onChange({ personal: v })}
        error={errors.personal}
      />

      {!draft ? (
        <section aria-labelledby="entry-heading" className="rounded-xl border border-line bg-surface px-5 py-4">
          <h2 id="entry-heading" className="font-semibold text-ink">
            Your Experience entry
          </h2>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll turn your answers into an entry for the Experience section of your resume, using only what you wrote. You
            can edit it before it&apos;s added.
          </p>
          <button id="entry" type="button" onClick={draftEntry} className={`mt-3 ${primary}`}>
            Draft my Experience entry
          </button>
          {needAnswers && !answered && <ErrorText id="entry-answers">Answer the three questions above first.</ErrorText>}
          <ErrorText id="entry">{answered ? errors.entry : undefined}</ErrorText>
        </section>
      ) : (
        <section aria-labelledby="venture-review" className="space-y-5 rounded-xl border border-line bg-surface px-5 py-5">
          <div>
            <h2 id="venture-review" ref={reviewRef} tabIndex={-1} className="text-lg font-semibold tracking-tight text-ink focus:outline-none">
              Review your Experience entry
            </h2>
            <p className="mt-1 text-sm text-muted">
              Drafted from your three answers only. Edit anything; nothing reaches your resume until you add it.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
              {[
                "Venture name as the heading, your description as the summary.",
                "Bullets from what you personally did, in your words. “We…” sentences become team results.",
                "No job title, dates, numbers, tools, results or leadership added.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0 fill-accent">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {answersChanged && (
            <div role="status" className="flex flex-col gap-2 rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
              <p>Your answers have changed since this draft.</p>
              <button type="button" onClick={draftEntry} className={`${secondary} shrink-0 py-1.5`}>
                Redraft from my answers
              </button>
            </div>
          )}

          <div>
            <label htmlFor="venture-heading" className="text-sm font-semibold text-ink">
              Heading
            </label>
            <input
              id="venture-heading"
              value={draft.heading}
              onChange={(e) => edit({ ...draft, heading: e.target.value })}
              className={`mt-1.5 ${input} ${controlState(!draft.heading.trim())}`}
            />
            <Flag id="venture-heading" text={draft.heading} answers={data} />
          </div>
          <div>
            <label htmlFor="venture-description" className="text-sm font-semibold text-ink">
              Description
            </label>
            <textarea
              id="venture-description"
              rows={2}
              value={draft.description}
              onChange={(e) => edit({ ...draft, description: e.target.value })}
              className={`mt-1.5 resize-none ${input} ${controlState(false)}`}
            />
            <Flag id="venture-description" text={draft.description} answers={data} />
          </div>

          <div>
            <p id="venture-bullets" className="text-sm font-semibold text-ink">
              Bullets
            </p>
            <ul aria-labelledby="venture-bullets" className="mt-2 space-y-3">
              {draft.bullets.map((b, i) => (
                <li key={i} className="rounded-lg border border-line bg-canvas/60 p-3">
                  <label htmlFor={`venture-bullet-${i}`} className="sr-only">
                    Bullet {i + 1}
                  </label>
                  <textarea
                    id={`venture-bullet-${i}`}
                    rows={1}
                    value={b.text}
                    onChange={(e) => setBullet(i, { text: e.target.value })}
                    className={`resize-none ${input} ${controlState(false)}`}
                  />
                  <Flag id={`venture-bullet-${i}`} text={b.text} answers={data} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <fieldset className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5 text-[13px]">
                      <legend className="sr-only">Bullet {i + 1} is</legend>
                      {(
                        [
                          ["own", "Your work"],
                          ["team", "Team result"],
                        ] as const
                      ).map(([kind, label]) => (
                        <label
                          key={kind}
                          className="cursor-pointer rounded-md px-2.5 py-1 text-ink-soft has-[:checked]:bg-raise has-[:checked]:font-semibold has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            name={`venture-kind-${i}`}
                            checked={b.kind === kind}
                            onChange={() => setBullet(i, { kind })}
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      type="button"
                      aria-label={`Remove bullet ${i + 1}`}
                      onClick={() => {
                        const bullets = draft.bullets.filter((_, j) => j !== i);
                        focusNext.current = bullets.length ? `venture-bullet-${Math.min(i, bullets.length - 1)}` : "venture-add-bullet";
                        edit({ ...draft, bullets });
                      }}
                      className="rounded-md px-2 py-1 text-[13px] text-muted hover:bg-raise hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              id="venture-add-bullet"
              type="button"
              onClick={() => {
                focusNext.current = `venture-bullet-${draft.bullets.length}`;
                edit({ ...draft, bullets: [...draft.bullets, { text: "", kind: "own" }] });
              }}
              className="mt-2 rounded-md px-1.5 py-1 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              + Add a bullet
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">On your resume</p>
            <EntryPreview entry={draft} />
          </div>

          {resumeMention && (
            <p className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-ink">
              Your resume already mentions this venture. Your entry replaces those lines, so it appears once. You can choose
              which version to keep when you review your draft.
            </p>
          )}
          <div role="status">
            {notice && <p className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-ink">{notice}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-muted">{added ? "In your resume, under Experience." : "Your other resume entries stay as they are."}</p>
            <button id="entry" type="button" onClick={addToResume} disabled={added} className={primary}>
              {added ? "Added to your resume" : data.entry ? "Update the entry in my resume" : "Add to my resume"}
            </button>
          </div>
          <ErrorText id="entry">{added ? undefined : errors.entry}</ErrorText>
        </section>
      )}
    </div>
  );
}

/** A soft note when an edit adds details the answers don't contain. Never blocks. */
function Flag({ id, text, answers }: { id: string; text: string; answers: ExperienceData }) {
  const words = unsupportedDetails(text, answers);
  if (!words.length) return null;
  return (
    <p id={`${id}-flag`} className="mt-1.5 text-[13px] text-warn">
      {words.map((w) => `“${w}”`).join(", ")} {words.length === 1 ? "isn't" : "aren't"} in your answers. Keep{" "}
      {words.length === 1 ? "it" : "them"} only if true.
    </p>
  );
}

/** The entry as it will read on the resume, in the resume's own style. */
function EntryPreview({ entry }: { entry: VentureEntry }) {
  const bullets = entry.bullets.filter((b) => b.text.trim());
  return (
    <div className="mt-2 rounded-lg bg-white px-5 py-4 font-[Helvetica,Arial,sans-serif] text-[13px] leading-snug text-[#1b1c1e]">
      <p className="font-bold">{entry.heading.trim() || "Heading"}</p>
      {entry.description.trim() && <p className="text-[#3a3d42]">{entry.description.trim()}</p>}
      {bullets.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {bullets.map((b, i) => (
            <li key={i}>{bulletText({ ...b, text: b.text.trim() })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

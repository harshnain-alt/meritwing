import type { ReactNode } from "react";
import { Checkbox } from "@/components/Field";
import { ResumePreview } from "@/components/ResumePreview";
import {
  ATTRIBUTION_OPTIONS,
  type ApplicationData,
  type CheckChoice,
  type StepId,
} from "@/lib/application";
import { choiceFor, type ResumeCheck } from "@/lib/resumeChecks";
import type { ResumePreviewModel } from "@/lib/resumePreview";

type DraftViewProps = {
  data: ApplicationData;
  checks: ResumeCheck[];
  unresolved: number;
  preview: ResumePreviewModel;
  confirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
  onResolve: (check: ResumeCheck, choice: CheckChoice) => void;
  onEdit: (step: StepId) => void;
};

/**
 * Shown after the three steps. Drafting is not connected yet, so this shows only the
 * student's own information, with fact checks beside a layout preview of their wording.
 */
export function DraftView({ data, checks, unresolved, preview, confirmed, onConfirm, onResolve, onEdit }: DraftViewProps) {
  const { about, experience, resume, internship } = data;
  const role = [internship.title.trim(), internship.company.trim()].filter(Boolean).join(" at ") || "this internship";
  const decisions = checks.filter((c) => c.needsDecision);
  const attribution = ATTRIBUTION_OPTIONS.find((o) => o.value === experience.resultsAttribution)?.label ?? "";
  const resumeSource =
    resume.source?.kind === "pdf"
      ? `${resume.source.fileName} (uploaded)`
      : resume.source?.kind === "paste"
        ? "Pasted text"
        : "No resume — working from your answers";

  return (
    <div className="space-y-8">
      <div role="status" className="flex gap-3 rounded-xl border border-accent/20 bg-accent-soft px-5 py-4">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 fill-accent">
          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm1 8.25H9v-5h2v5Z" />
        </svg>
        <div>
          <p className="font-semibold text-ink">Drafting isn&apos;t connected yet</p>
          <p className="mt-0.5 text-[15px] text-ink-soft">
            Nothing here has been written or changed by AI. When drafting is connected, Meritwing will match your
            experience to {role}, ask at most three short questions only if essential facts are missing (you can
            answer &ldquo;I don&apos;t know&rdquo; or skip), and give you editable application content.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <section aria-labelledby="facts-heading" className="space-y-4">
            <div>
              <h2 id="facts-heading" className="font-display text-xl font-semibold text-ink">
                Check your facts
              </h2>
              <p className="mt-1 text-[15px] text-muted">
                Your draft will only use what you confirm here. Edit anything that isn&apos;t right.
              </p>
            </div>

            {decisions.map((check) => (
              <CheckCard
                key={check.id}
                check={check}
                resolution={data.resume.resolutions[check.id]?.signature === check.signature ? choiceFor(data, check) : undefined}
                onResolve={(choice) => onResolve(check, choice)}
              />
            ))}

            <SummaryCard title="You" onEdit={() => onEdit(1)}>
              <Item label="Name" value={about.fullName} />
              <Item label="Contact" value={[about.email, about.phone].filter(Boolean).join(" · ")} />
              <Item label="State / Union Territory" value={about.state} />
              <Item
                label="Education"
                value={[about.school, [about.programme, about.gradYear].filter(Boolean).join(", ")].filter(Boolean).join(" — ")}
              />
              <Item label="Resume" value={resumeSource} />
            </SummaryCard>

            <SummaryCard title="What you did" onEdit={() => onEdit(2)}>
              <Item label="Project or venture" value={experience.projectName} />
              <Item label="What it was about" value={experience.about} />
              <Item label="What you personally did" value={experience.personal} />
              <Item label="Results" value={experience.results} />
              {experience.results.trim() && <Item label="Whose results" value={attribution} />}
            </SummaryCard>

            <SummaryCard title="Internship" onEdit={() => onEdit(3)}>
              <Item label="Title" value={internship.title} />
              <Item label="Company" value={internship.company} />
              <Item label="Description" value={internship.description} clamp />
            </SummaryCard>

            <div className="rounded-xl border border-line bg-surface px-5 py-4">
              {unresolved > 0 ? (
                <p className="text-sm text-ink">
                  {unresolved === 1 ? "One item above needs" : `${unresolved} items above need`} your decision before you
                  can confirm.
                </p>
              ) : (
                <Checkbox
                  id="confirm"
                  checked={confirmed}
                  onChange={onConfirm}
                  label="I've checked these facts. They're accurate, and results are attributed the way I described."
                />
              )}
            </div>
          </section>
        </div>

        <section aria-labelledby="preview-heading" className="space-y-3 lg:sticky lg:top-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 id="preview-heading" className="font-display text-xl font-semibold text-ink">
              Resume layout preview
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                confirmed ? "bg-accent-soft text-accent" : "bg-amber-100 text-amber-900"
              }`}
            >
              {confirmed ? "Facts confirmed by you" : "Unconfirmed"}
            </span>
          </div>
          <p className="text-sm text-muted">
            Your own wording arranged as a resume. It is not AI-written, so some lines may read like notes.
            Empty sections are left out.
          </p>
          <div className="rounded-xl bg-[#ece8e1] px-2 py-5 sm:px-6 sm:py-8">
            <ResumePreview model={preview} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="rounded-md px-2 py-1 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Edit
        </button>
      </header>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  );
}

function Item({ label, value, clamp }: { label: string; value: string; clamp?: boolean }) {
  const text = value.trim();
  return (
    <div className="grid gap-0.5 px-5 py-3 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0">
        {text ? (
          <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink ${clamp ? "line-clamp-4" : ""}`}>
            {text}
          </p>
        ) : (
          <span className="text-[15px] italic text-faint">Not provided</span>
        )}
      </dd>
    </div>
  );
}

function CheckCard({
  check,
  resolution,
  onResolve,
}: {
  check: ResumeCheck;
  resolution?: CheckChoice;
  onResolve: (choice: CheckChoice) => void;
}) {
  const unresolved = !resolution;
  return (
    <div className={`rounded-xl border bg-surface ${unresolved ? "border-amber-300" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h3 className="font-semibold text-ink">{check.title}</h3>
          <p className="mt-0.5 text-sm text-muted">{check.explanation}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            unresolved ? "bg-amber-100 text-amber-900" : "bg-accent-soft text-accent"
          }`}
        >
          {unresolved ? "Needs decision" : "Resolved"}
        </span>
      </div>
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <Version label="What you entered" text={check.answersValue} />
        <Version label="Your resume" text={check.resumeValue} />
      </div>
      {check.differences.length > 0 && (
        <ul className="space-y-1 border-t border-line px-5 py-3 text-sm text-ink-soft">
          {check.differences.map((d) => (
            <li key={d} className="flex gap-2">
              <span aria-hidden="true" className="text-amber-700">
                •
              </span>
              {d}
            </li>
          ))}
        </ul>
      )}
      <fieldset className="border-t border-line px-5 py-4">
        <legend className="sr-only">Which version should be used for {check.title}?</legend>
        <div className="flex flex-col gap-2.5">
          {(["answers", "resume"] as const).map((choice) => (
            <label key={choice} className="inline-flex cursor-pointer items-start gap-2.5 text-[15px] text-ink">
              <input
                type="radio"
                name={`check-${check.id}`}
                checked={resolution === choice}
                onChange={() => onResolve(choice)}
                className="mt-1 size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              {choice === "answers" ? check.answersOption : check.resumeOption}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function Version({ label, text }: { label: string; text: string }) {
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}

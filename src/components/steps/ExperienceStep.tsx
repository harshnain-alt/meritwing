"use client";

import { useState } from "react";
import { ChoiceGroup, Field } from "@/components/Field";
import { ATTRIBUTION_OPTIONS, type ExperienceData, type FieldErrors } from "@/lib/application";

type ExperienceStepProps = {
  data: ExperienceData;
  errors: FieldErrors<ExperienceData>;
  onChange: <K extends keyof ExperienceData>(field: K, value: ExperienceData[K]) => void;
};

export function ExperienceStep({ data, errors, onChange }: ExperienceStepProps) {
  const [userOpen, setUserOpen] = useState(false);
  const resultsOpen = userOpen || Boolean(data.results.trim()) || Boolean(errors.resultsAttribution);

  return (
    <div className="space-y-7">
      <Field
        id="projectName"
        label="Project or venture name"
        placeholder="e.g. Campus Refill Co., Supplier onboarding study for Acme Foods"
        value={data.projectName}
        onChange={(v) => onChange("projectName", v)}
        error={errors.projectName}
      />
      <Field
        id="about"
        label="What was the project about?"
        hint="One or two sentences on what it did and for whom."
        multiline
        rows={3}
        value={data.about}
        onChange={(v) => onChange("about", v)}
        error={errors.about}
      />
      <Field
        id="personal"
        label="What did you personally do?"
        hint="Describe your contribution separately from the team’s work. Short notes or a list are fine."
        multiline
        rows={8}
        value={data.personal}
        onChange={(v) => onChange("personal", v)}
        error={errors.personal}
      />

      <section className="rounded-xl border border-line bg-surface">
        <button
          type="button"
          aria-expanded={resultsOpen}
          aria-controls="results-section"
          onClick={() => setUserOpen(!resultsOpen)}
          disabled={Boolean(data.results.trim()) && resultsOpen}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
        >
          <span>
            <span className="block text-sm font-semibold text-ink">
              Results or achievements you can support{" "}
              <span className="ml-1 text-xs font-medium text-muted">Optional</span>
            </span>
            <span className="block text-xs text-muted">No numbers? A clear description of your work is enough.</span>
          </span>
          {!(data.results.trim() && resultsOpen) && (
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className={`size-4 shrink-0 fill-muted transition-transform ${resultsOpen ? "rotate-180" : ""}`}
            >
              <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          )}
        </button>
        {resultsOpen && (
          <div id="results-section" className="space-y-6 border-t border-line px-4 pb-5 pt-4">
            <Field
              id="results"
              label="Results or achievements"
              optional
              hint="e.g. “Pilot ran for one semester in two dorms” or “Report adopted by the client team”."
              multiline
              rows={3}
              value={data.results}
              onChange={(v) => onChange("results", v)}
              error={errors.results}
            />
            {data.results.trim() && (
              <ChoiceGroup
                id="resultsAttribution"
                label="Were these results yours or shared with the team?"
                hint="We'll only present results as yours if you say they were."
                options={ATTRIBUTION_OPTIONS}
                value={data.resultsAttribution}
                onChange={(v) => onChange("resultsAttribution", v)}
                error={errors.resultsAttribution}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

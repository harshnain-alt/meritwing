import { Field } from "@/components/Field";
import type { FieldErrors, InternshipData } from "@/lib/application";
import type { JobListing } from "@/lib/jobs/types";

type InternshipStepProps = {
  /** The opening this description came from, while it is unedited. */
  source?: JobListing | null;
  data: InternshipData;
  errors: FieldErrors<InternshipData>;
  onDescription: (value: string) => void;
  onChange: (field: "title" | "company", value: string) => void;
};

export function InternshipStep({ source, data, errors, onDescription, onChange }: InternshipStepProps) {
  const found = (field: "title" | "company") => {
    const suggested = field === "title" ? data.suggestedTitle : data.suggestedCompany;
    if (data[field] && data[field] === suggested) return "Found in the description. Edit it if it's wrong.";
    if (!data[field] && data.description.trim()) return "We couldn't find this in the description. Add it if you know it.";
    return undefined;
  };

  return (
    <div className="space-y-7">
      {source && (
        <div role="status" className="rounded-xl border border-accent/20 bg-accent-soft px-5 py-4 text-[15px] text-ink">
          <p>
            <span className="font-semibold">{source.title}</span> at {source.company}, from {source.company}&apos;s{" "}
            {source.source.platform} careers board, retrieved{" "}
            {new Date(source.retrievedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.{" "}
            <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-accent underline underline-offset-2">
              Original posting
            </a>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {data.description.trim()
              ? "The description below is the employer's own text. Check it before continuing."
              : "The board didn't include a description. Copy it from the original posting and paste it below."}
          </p>
        </div>
      )}
      <Field
        id="description"
        label="Full internship or job description"
        hint="Paste the whole posting, including responsibilities and requirements. Any function works."
        multiline
        rows={14}
        placeholder="Paste the job description here…"
        value={data.description}
        onChange={onDescription}
        error={errors.description}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="title"
          label="Internship title"
          optional
          placeholder="Filled in from the description"
          hint={found("title")}
          value={data.title}
          onChange={(v) => onChange("title", v)}
          error={errors.title}
        />
        <Field
          id="company"
          label="Company"
          optional
          placeholder="Filled in from the description"
          hint={found("company")}
          value={data.company}
          onChange={(v) => onChange("company", v)}
          error={errors.company}
        />
      </div>
      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-ink">About the AI features:</span> for the optional AI-written bullets,
        Meritwing sends your venture entry, your resume sections and this job description to Google Gemini. Your
        name, email and phone are not sent. On Gemini&apos;s free tier, Google may use what is sent to improve its
        products, and people may review it, so leave out anything sensitive. You can skip them and still use
        everything else.
      </p>
    </div>
  );
}

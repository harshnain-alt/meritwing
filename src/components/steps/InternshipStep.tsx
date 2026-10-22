import { Field } from "@/components/Field";
import type { FieldErrors, InternshipData } from "@/lib/application";

type InternshipStepProps = {
  data: InternshipData;
  errors: FieldErrors<InternshipData>;
  onDescription: (value: string) => void;
  onChange: (field: "title" | "company", value: string) => void;
};

export function InternshipStep({ data, errors, onDescription, onChange }: InternshipStepProps) {
  const found = (field: "title" | "company") => {
    const suggested = field === "title" ? data.suggestedTitle : data.suggestedCompany;
    if (data[field] && data[field] === suggested) return "Found in the description. Edit it if it's wrong.";
    if (!data[field] && data.description.trim()) return "We couldn't find this in the description. Add it if you know it.";
    return undefined;
  };

  return (
    <div className="space-y-7">
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
        <span className="font-semibold text-ink">About the AI features:</span> for the follow-up questions and the
        optional AI-written bullets, Meritwing sends your project details, your follow-up answers, your resume
        sections and this job description to Google Gemini. Your name, email and phone are not sent. On
        Gemini&apos;s free tier, Google may use what is sent to improve its products, and people may review it, so
        leave out anything sensitive. You can skip both and still use everything else.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorText, Field, SelectField } from "@/components/Field";
import { SearchSelect } from "@/components/SearchSelect";
import {
  ADDITIONAL_FIELDS,
  GRAD_YEARS,
  type AboutData,
  type ResumeData,
  type ResumeSections,
  type StartErrors,
} from "@/lib/application";
import { SCHOOL_OPTIONS, STATE_OPTIONS } from "@/lib/options";

const MAX_BYTES = 5 * 1024 * 1024;

type StartStepProps = {
  about: AboutData;
  resume: ResumeData;
  errors: StartErrors;
  onAbout: (field: keyof AboutData, value: string) => void;
  onResumeMode: (mode: "upload" | "paste") => void;
  onPasteDraft: (text: string) => void;
  onReadPaste: () => string | undefined;
  onExtracted: (text: string, fileName: string, pages: number) => void;
  onRemoveResume: (keepPasteDraft?: boolean) => void;
  onProposedChange: (field: keyof ResumeSections, value: string) => void;
  onContinueWithout: () => void;
};

export function StartStep(props: StartStepProps) {
  const { about, resume, errors, onAbout } = props;
  const upload = usePdfUpload(props.onExtracted);

  return (
    <div className="space-y-9">
      <Field
        id="fullName"
        label="Full name"
        autoComplete="name"
        hint={filledHint(resume, about, "fullName")}
        value={about.fullName}
        onChange={(v) => onAbout("fullName", v)}
        error={errors.fullName}
      />

      <section id="resumeOptions" tabIndex={-1} aria-labelledby="resume-heading" className="space-y-4 focus:outline-none">
        <div>
          <h2 id="resume-heading" className="text-sm font-semibold text-ink">
            Your resume
          </h2>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll pick out your contact, education and experience details so you don&apos;t type them again.
          </p>
        </div>
        {resume.original && resume.proposed ? (
          <ResumeAdded {...props} upload={upload} />
        ) : (
          <ResumeInput {...props} upload={upload} />
        )}
        <ErrorText id="resumeOptions">{errors.resume}</ErrorText>
      </section>

      <AdditionalDetails {...props} />
    </div>
  );
}

/* ---------- Resume: adding one ---------- */

type Upload = ReturnType<typeof usePdfUpload>;

function usePdfUpload(onExtracted: StartStepProps["onExtracted"]) {
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string>();
  const controllerRef = useRef<AbortController | null>(null);

  // Abort an upload in flight if the step goes away (navigation or Clear my data).
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return setError("This isn't a PDF file. Upload a PDF, or paste your resume text instead.");
    if (file.size > MAX_BYTES)
      return setError("This file is larger than 5 MB. Upload a smaller PDF, or paste your resume text instead.");

    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("uploading");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/resume/extract", { method: "POST", body, signal: controller.signal });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          json?.error?.message ??
            (res.status === 413
              ? "This file is too large for the server to accept. Paste your resume text instead."
              : "We couldn't read this PDF. Paste your resume text instead."),
        );
        return;
      }
      onExtracted(json.text, file.name, json.pages);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("The upload failed. Check your connection and try again, or paste your resume text instead.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setStatus("idle");
      }
    }
  }

  return { status, error, setError, handleFile };
}

function FileInput({ id, upload, children, className }: { id: string; upload: Upload; children: ReactNode; className: string }) {
  return (
    <>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="peer sr-only"
        disabled={upload.status === "uploading"}
        aria-describedby="resumeFile-hint resumeFile-error"
        onChange={(e) => {
          void upload.handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={`${className} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          upload.status === "uploading" ? "pointer-events-none opacity-70" : ""
        }`}
      >
        {children}
      </label>
    </>
  );
}

function ResumeInput({ resume, upload, onResumeMode, onPasteDraft, onReadPaste, onContinueWithout }: StartStepProps & { upload: Upload }) {
  const mode = resume.choice === "paste" ? "paste" : "upload";
  const [pasteError, setPasteError] = useState<string>();

  return (
    <div className="space-y-4">
      <div role="group" aria-label="How to add your resume" className="grid grid-cols-2 gap-1 rounded-lg bg-line/60 p-1">
        {(["upload", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onResumeMode(m)}
            className={`rounded-md px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              mode === m ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
            }`}
          >
            {m === "upload" ? "Upload resume" : "Paste resume text"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div className="space-y-3">
          <div
            className={`rounded-xl border border-dashed bg-surface px-5 py-7 text-center ${
              upload.error ? "border-danger" : "border-line-strong"
            }`}
          >
            <FileInput
              id="resumeFile"
              upload={upload}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-accent-strong"
            >
              {upload.status === "uploading" ? "Reading your PDF…" : "Choose PDF file"}
            </FileInput>
            <p id="resumeFile-hint" className="mt-3 text-sm text-muted">
              Text-based PDF, up to 5 MB. Scanned images can&apos;t be read.
            </p>
            <p role="status" className="sr-only">
              {upload.status === "uploading" ? "Reading your PDF" : ""}
            </p>
          </div>
          {upload.error && (
            <div className="rounded-lg bg-danger-soft px-4 py-3">
              <ErrorText id="resumeFile">{upload.error}</ErrorText>
              <button
                type="button"
                onClick={() => {
                  upload.setError(undefined);
                  onResumeMode("paste");
                }}
                className="mt-2 text-sm font-semibold text-accent underline underline-offset-4 hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Paste resume text instead
              </button>
            </div>
          )}
          <p className="text-xs text-muted">
            Your PDF is sent to Meritwing&apos;s server only to extract its text. It&apos;s processed in memory and
            not saved, and no AI service sees it at this step.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Field
            id="pasteDraft"
            label="Resume text"
            multiline
            rows={8}
            placeholder="Paste your resume here…"
            value={resume.pasteDraft}
            onChange={(v) => {
              setPasteError(undefined);
              onPasteDraft(v);
            }}
            error={pasteError}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Pasted text stays in this browser tab.</p>
            <button
              type="button"
              onClick={() => setPasteError(onReadPaste())}
              className="rounded-lg border border-accent bg-surface px-3.5 py-2 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Read my resume
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4">
        <button
          type="button"
          onClick={onContinueWithout}
          className="rounded-md py-1 text-sm font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Continue without a resume
        </button>
        <span className="text-sm text-muted">
          {resume.choice === "none" ? "You chose this earlier. You can still add one here." : "We'll work from your answers."}
        </span>
      </div>
    </div>
  );
}

/* ---------- Resume: added ---------- */

function ResumeAdded({ about, resume, upload, onRemoveResume, onResumeMode, onProposedChange }: StartStepProps & { upload: Upload }) {
  const proposed = resume.proposed!;
  const source = resume.source;
  const lineCount = (text: string) => text.split("\n").filter((l) => l.trim()).length;
  const found: { label: string; value: string }[] = [
    { label: "Name", value: proposed.name },
    { label: "Email", value: proposed.email },
    { label: "Phone", value: proposed.phone },
    {
      label: "Education",
      value: resume.filled.school === about.school && about.school ? about.school : plural(lineCount(proposed.education), "line"),
    },
    { label: "Experience", value: plural(lineCount(proposed.experience), "line") },
    { label: "Skills", value: plural(lineCount(proposed.skills), "line") },
  ];

  const buttonClass =
    "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-canvas";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent">
              {source?.kind === "pdf" ? "PDF" : "TXT"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {source?.kind === "pdf" ? source.fileName : "Pasted resume text"}
              </p>
              <p className="text-sm text-muted">
                {source?.kind === "pdf"
                  ? `${plural(source.pages, "page")} · read successfully`
                  : `${resume.original.length.toLocaleString()} characters · read successfully`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {source?.kind === "pdf" ? (
              <FileInput id="resumeReplace" upload={upload} className={buttonClass}>
                {upload.status === "uploading" ? "Reading…" : "Replace"}
              </FileInput>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onRemoveResume(true);
                  onResumeMode("paste");
                }}
                className={`${buttonClass} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
              >
                Edit text
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemoveResume()}
              className={`${buttonClass} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
            >
              Remove
            </button>
          </div>
        </div>
        {upload.error && (
          <div className="border-t border-line px-4 py-3">
            <ErrorText id="resumeReplace">{upload.error}</ErrorText>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line px-4 py-3.5 sm:grid-cols-3">
          {found.map((f) => {
            const ok = Boolean(f.value) && f.value !== "0 lines";
            return (
              <div key={f.label} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span aria-hidden="true" className={ok ? "text-accent" : "text-faint"}>
                    {ok ? "✓" : "–"}
                  </span>
                  {f.label}
                </dt>
                <dd className={`truncate text-sm ${ok ? "text-ink" : "italic text-faint"}`}>{ok ? f.value : "Not found"}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold text-ink">Check or edit what we read</span>
            <span className="block text-xs text-muted">Sorted with simple rules, not AI. Nothing has been reworded.</span>
          </span>
          <span className="text-sm font-semibold text-accent">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="space-y-5 border-t border-line px-4 py-4">
          <p className="text-sm text-muted">
            Move anything that landed in the wrong section. These edits only affect your draft; your original
            resume text is kept unchanged.
          </p>
          {SECTION_FIELDS.map((f) => (
            <Field
              key={f.key}
              id={`resume-${f.key}`}
              label={f.label}
              optional
              hint={f.hint}
              multiline
              rows={f.rows}
              placeholder="Nothing found for this section."
              value={proposed[f.key]}
              onChange={(v) => onProposedChange(f.key, v)}
            />
          ))}
          <div>
            <p className="text-sm font-semibold text-ink">Original resume text</p>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas px-3.5 py-3 font-sans text-sm leading-relaxed text-ink-soft">
              {resume.original}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

const SECTION_FIELDS: { key: keyof ResumeSections; label: string; hint?: string; rows: number }[] = [
  { key: "education", label: "Education", rows: 4 },
  { key: "experience", label: "Experience, ventures and projects", rows: 7 },
  { key: "skills", label: "Skills", rows: 3 },
  { key: "additional", label: "Additional achievements or responsibilities", rows: 3 },
  {
    key: "unsorted",
    label: "Lines we couldn't place",
    hint: "Not included in your draft. Move anything important into a section above.",
    rows: 2,
  },
];

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

function filledHint(resume: ResumeData, about: AboutData, key: keyof AboutData) {
  return about[key] && resume.filled[key] === about[key] ? "Filled from your resume. Check it's right." : undefined;
}

/* ---------- Additional details ---------- */

function AdditionalDetails({ about, resume, errors, onAbout }: StartStepProps) {
  const [userOpen, setUserOpen] = useState(false);
  const hasError = ADDITIONAL_FIELDS.some((f) => errors[f]);
  const open = userOpen || hasError;
  const filledCount = ADDITIONAL_FIELDS.filter((f) => about[f] && resume.filled[f] === about[f]).length;
  const enteredCount = ADDITIONAL_FIELDS.filter((f) => about[f].trim()).length;
  const hint = (key: keyof AboutData) => filledHint(resume, about, key);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="additional-details"
        onClick={() => setUserOpen(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span>
          <span className="block text-sm font-semibold text-ink">
            Additional details <span className="ml-1 text-xs font-medium text-muted">Optional</span>
          </span>
          <span className="block text-xs text-muted">
            Contact, education and location
            {enteredCount > 0 && ` · ${enteredCount} of ${ADDITIONAL_FIELDS.length} added`}
            {filledCount > 0 && ` (${filledCount} from your resume)`}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`size-4 shrink-0 fill-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open && (
        <div id="additional-details" className="space-y-6 border-t border-line px-4 pb-5 pt-4">
          <p className="text-sm text-muted">Leave anything blank that you&apos;d rather not share. You can edit these later.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              id="email"
              label="Email"
              optional
              type="email"
              inputMode="email"
              autoComplete="email"
              hint={hint("email")}
              value={about.email}
              onChange={(v) => onAbout("email", v)}
              error={errors.email}
            />
            <Field
              id="phone"
              label="Phone"
              optional
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint={hint("phone")}
              value={about.phone}
              onChange={(v) => onAbout("phone", v)}
              error={errors.phone}
            />
          </div>
          <SearchSelect
            id="state"
            label="State / Union Territory"
            optional
            hint={hint("state")}
            placeholder="Select your state or union territory"
            searchPlaceholder="Search states and union territories"
            noun="states and union territories"
            options={STATE_OPTIONS}
            maxResults={STATE_OPTIONS.length}
            allowCustom={false}
            value={about.state}
            onChange={(v) => onAbout("state", v)}
            error={errors.state}
          />
          <SearchSelect
            id="school"
            label="Business school"
            optional
            hint={hint("school")}
            placeholder="Select your business school"
            searchPlaceholder="Search by name, abbreviation or city"
            noun="institutions"
            options={SCHOOL_OPTIONS}
            maxResults={SCHOOL_OPTIONS.length}
            footer="NIRF 2025 Management rankings plus a few verified additions. Not every school is listed."
            value={about.school}
            onChange={(v) => onAbout("school", v)}
            error={errors.school}
          />
          <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
            <Field
              id="programme"
              label="Programme"
              optional
              placeholder="e.g. MBA, PGDM, PGP"
              hint={hint("programme")}
              value={about.programme}
              onChange={(v) => onAbout("programme", v)}
              error={errors.programme}
            />
            <SelectField
              id="gradYear"
              label="Graduation year"
              optional
              hint={hint("gradYear")}
              options={GRAD_YEARS}
              value={about.gradYear}
              onChange={(v) => onAbout("gradYear", v)}
              error={errors.gradYear}
            />
          </div>
        </div>
      )}
    </section>
  );
}

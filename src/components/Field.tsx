import type { ReactNode } from "react";

type BaseProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

type TextProps = BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoComplete?: string;
  className?: string;
} & ({ multiline?: false } | { multiline: true; rows?: number });

const controlBase =
  "block w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-faint shadow-xs transition-colors focus:outline-none focus:ring-3";
export const controlState = (invalid: boolean) =>
  invalid
    ? "border-danger focus:border-danger focus:ring-danger/15"
    : "border-line hover:border-line-strong focus:border-accent focus:ring-accent/15";

function describedBy(id: string, hint: unknown, error: unknown) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function FieldLabel({ htmlFor, label, optional, as = "label", id }: {
  htmlFor?: string;
  label: string;
  optional?: boolean;
  as?: "label" | "legend" | "span";
  id?: string;
}) {
  const content = (
    <>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {optional && <span className="ml-2 text-xs font-medium text-muted">Optional</span>}
    </>
  );
  if (as === "legend") return <legend className="mb-0.5">{content}</legend>;
  if (as === "span") return <span id={id} className="block">{content}</span>;
  return (
    <label htmlFor={htmlFor} className="block">
      {content}
    </label>
  );
}

export function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
      {children}
    </p>
  );
}

export function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 fill-current">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.25a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V5A.75.75 0 0 1 8 4.25Zm0 7.25a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function Field(props: TextProps) {
  const { id, label, value, onChange, error, hint, optional, placeholder } = props;
  // No `name` attributes on purpose: if the form were ever submitted natively
  // (e.g. before hydration), no personal data could end up in the URL.
  const shared = {
    id,
    value,
    placeholder,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy(id, hint, error),
    "aria-required": !optional,
    className: `${controlBase} ${controlState(Boolean(error))}`,
  };

  return (
    <div className={props.className}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      {hint && <Hint id={id}>{hint}</Hint>}
      <div className="mt-2">
        {props.multiline ? (
          <textarea
            {...shared}
            rows={props.rows ?? 4}
            onChange={(e) => onChange(e.target.value)}
            className={`${shared.className} resize-y`}
          />
        ) : (
          <input
            {...shared}
            type={props.type ?? "text"}
            inputMode={props.inputMode}
            autoComplete={props.autoComplete}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
      <ErrorText id={id}>{error}</ErrorText>
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  error,
  hint,
  optional,
  className,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      {hint && <Hint id={id}>{hint}</Hint>}
      <div className="mt-2">
        <Select
          id={id}
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          invalid={Boolean(error)}
          describedBy={describedBy(id, hint, error)}
          required={!optional}
        />
      </div>
      <ErrorText id={id}>{error}</ErrorText>
    </div>
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  describedBy,
  required,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-required={required}
        aria-label={ariaLabel}
        className={`${controlBase} ${controlState(Boolean(invalid))} appearance-none pr-10 ${value ? "" : "text-faint"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} className="text-ink">
              {opt.label}
            </option>
          );
        })}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 fill-muted"
      >
        <path d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  optional,
  columns = 1,
}: BaseProps & {
  value: T | "";
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
  columns?: 1 | 2 | 3;
}) {
  const grid = columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={describedBy(id, hint, error)} className="focus:outline-none">
      <FieldLabel as="legend" label={label} optional={optional} />
      {hint && <Hint id={id}>{hint}</Hint>}
      <div className={`mt-2 grid gap-2.5 ${grid}`}>
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-surface px-3.5 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-accent/25 ${
                checked
                  ? "border-accent bg-accent-soft/60"
                  : error
                    ? "border-danger"
                    : "border-line hover:border-line-strong"
              }`}
            >
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 size-4 shrink-0 accent-accent focus:outline-none"
              />
              <span>
                <span className="block text-[15px] font-medium text-ink">{opt.label}</span>
                {opt.hint && <span className="mt-0.5 block text-sm text-muted">{opt.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <ErrorText id={id}>{error}</ErrorText>
    </fieldset>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  error,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="inline-flex cursor-pointer items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 rounded accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <span className="text-[15px] text-ink">{label}</span>
      </label>
      <ErrorText id={id}>{error}</ErrorText>
    </div>
  );
}

export function SectionHeading({ id, title, description }: { id?: string; title: string; description?: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-xl font-semibold text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorText } from "@/components/Field";
import { CONTACT_LIMITS } from "@/lib/contact";

type Fields = "name" | "email" | "message";
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; acknowledged: boolean } | { kind: "error"; message: string };

const input =
  "block w-full rounded-lg border bg-canvas/60 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-faint transition-colors focus:outline-none focus:ring-3";
const state = (invalid: boolean) =>
  invalid ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line-strong hover:border-faint/60 focus:border-accent focus:ring-accent/15";

/** "Ask us a question": saved to the database, the owner is emailed, and the sender gets a confirmation. */
export function ContactSection() {
  const [values, setValues] = useState({ name: "", email: "", message: "", website: "" });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Once sent, move focus to the confirmation so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (status.kind === "sent") doneRef.current?.focus();
  }, [status.kind]);

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (k !== "website") setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;
    const local: Partial<Record<Fields, string>> = {};
    if (!values.name.trim()) local.name = "Enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) local.email = "Enter a valid email address.";
    if (!values.message.trim()) local.message = "Write your question or message.";
    if (Object.keys(local).length) {
      setErrors(local);
      formRef.current?.querySelector<HTMLElement>(`#contact-${Object.keys(local)[0]}`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const fields = (json?.error?.fields ?? {}) as Partial<Record<Fields, string>>;
        setErrors(fields);
        setStatus({ kind: "error", message: json?.error?.message ?? "We couldn't send your message. Please try again." });
        const first = Object.keys(fields)[0];
        if (first) formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus();
        return;
      }
      setStatus({ kind: "sent", acknowledged: Boolean(json?.acknowledged) });
      setValues({ name: "", email: "", message: "", website: "" });
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 border-t border-line py-16 sm:py-18">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
        <div data-reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-accent">Contact</p>
          <h2 id="contact-title" className="mt-2 text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold leading-tight tracking-tight text-ink">
            Ask us a question
          </h2>
          <p className="mt-3 max-w-md text-muted">
            Questions about Meritwing, your venture or the job board? Send us a message and we&apos;ll reply by email.
          </p>
          <p className="mt-4 max-w-md text-sm text-muted">
            We save your name, email and message so we can reply, and send you a confirmation email. We don&apos;t add you to any list.
          </p>
        </div>

        <div data-reveal className="rounded-xl border border-line bg-surface px-5 py-5 sm:px-6 sm:py-6">
          {status.kind === "sent" ? (
            <div ref={doneRef} tabIndex={-1} role="status" className="space-y-3 focus:outline-none">
              <p className="text-[17px] font-semibold text-ink">Thanks, your message is on its way.</p>
              <p className="text-ink-soft">
                {status.acknowledged
                  ? "We've sent a confirmation to your email and will reply there."
                  : "We've received it and will reply by email. The confirmation email couldn't be sent just now."}
              </p>
              <button
                type="button"
                onClick={() => setStatus({ kind: "idle" })}
                className="rounded-md py-1 text-sm font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form ref={formRef} noValidate onSubmit={submit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="text-sm font-semibold text-ink">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    autoComplete="name"
                    maxLength={CONTACT_LIMITS.name}
                    value={values.name}
                    onChange={set("name")}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                    className={`mt-1.5 ${input} ${state(Boolean(errors.name))}`}
                  />
                  <ErrorText id="contact-name">{errors.name}</ErrorText>
                </div>
                <div>
                  <label htmlFor="contact-email" className="text-sm font-semibold text-ink">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={CONTACT_LIMITS.email}
                    value={values.email}
                    onChange={set("email")}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                    className={`mt-1.5 ${input} ${state(Boolean(errors.email))}`}
                  />
                  <ErrorText id="contact-email">{errors.email}</ErrorText>
                </div>
              </div>
              <div>
                <label htmlFor="contact-message" className="text-sm font-semibold text-ink">
                  Your question
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  maxLength={CONTACT_LIMITS.message}
                  value={values.message}
                  onChange={set("message")}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                  className={`mt-1.5 resize-y ${input} ${state(Boolean(errors.message))}`}
                />
                <ErrorText id="contact-message">{errors.message}</ErrorText>
              </div>
              {/* Hidden from people and screen readers; bots that fill it in are ignored. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
              </div>
              <div role="status" aria-live="polite">
                {status.kind === "error" && <p className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-ink">{status.message}</p>}
              </div>
              <button
                type="submit"
                disabled={status.kind === "sending"}
                className="mw-glow inline-flex min-h-11 items-center rounded-lg bg-accent-fill px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-fill-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {status.kind === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

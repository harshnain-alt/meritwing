import nodemailer, { type Transporter } from "nodemailer";
import { acknowledgementEmail, ownerEmail, type ContactMessage, type ContactSteps } from "@/lib/contact";

/*
 * Server-only: where contact messages go. Supabase stores each one as a row (through its REST
 * API with the public key, so Row-Level Security decides what that key may do: insert only).
 * Email goes through Gmail with an app password, or Resend when a Resend key and a verified
 * sender are set. Keys come from server environment variables and never reach the browser.
 */

type Mailer = { send: (mail: { to: string; subject: string; text: string; html: string; replyTo?: string }) => Promise<void> };

export type ContactConfig =
  | { ok: true; supabaseUrl: string; supabaseKey: string; ownerEmail: string; mailer: "gmail" | "resend" }
  | { ok: false; missing: string[] };

export function contactConfig(env: NodeJS.ProcessEnv = process.env): ContactConfig {
  const missing: string[] = [];
  const need = (name: string) => {
    const v = env[name]?.trim();
    if (!v) missing.push(name);
    return v ?? "";
  };
  const supabaseUrl = need("SUPABASE_URL").replace(/\/+$/, "");
  const supabaseKey = need("SUPABASE_ANON_KEY");
  const owner = need("CONTACT_OWNER_EMAIL");
  const resend = Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM?.trim());
  if (!resend) {
    need("GMAIL_USER");
    need("GMAIL_APP_PASSWORD");
  }
  return missing.length ? { ok: false, missing } : { ok: true, supabaseUrl, supabaseKey, ownerEmail: owner, mailer: resend ? "resend" : "gmail" };
}

class DeliveryError extends Error {
  constructor(name: string, readonly code: number | string) {
    super(name);
    this.name = name;
  }
}

/** One row in public.contact_messages. The public key may only insert, so nothing is read back. */
async function saveToSupabase(url: string, key: string, m: ContactMessage) {
  // New publishable keys (sb_publishable_…) go in the apikey header only; legacy anon keys are JWTs.
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/contact_messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: m.name, email: m.email, message: m.message }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new DeliveryError("SupabaseInsertError", res.status);
}

let gmail: Transporter | null = null;
function gmailMailer(env: NodeJS.ProcessEnv): Mailer {
  const user = env.GMAIL_USER!.trim();
  // App passwords are shown in groups of four; spaces are not part of the password.
  const pass = env.GMAIL_APP_PASSWORD!.replace(/\s+/g, "");
  const port = Number(env.SMTP_PORT ?? 465);
  gmail ??= nodemailer.createTransport({
    host: env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return {
    async send(mail) {
      await gmail!.sendMail({ from: { name: "Meritwing", address: user }, ...mail });
    },
  };
}

function resendMailer(env: NodeJS.ProcessEnv): Mailer {
  return {
    async send(mail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.RESEND_FROM!.trim(), to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html, reply_to: mail.replyTo }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new DeliveryError("ResendError", res.status);
    },
  };
}

/** The real steps for handleContact, from a complete configuration. */
export function contactSteps(config: Extract<ContactConfig, { ok: true }>, env: NodeJS.ProcessEnv = process.env): ContactSteps {
  const mailer = config.mailer === "resend" ? resendMailer(env) : gmailMailer(env);
  return {
    save: (m) => saveToSupabase(config.supabaseUrl, config.supabaseKey, m),
    notifyOwner: (m) => mailer.send({ to: config.ownerEmail, ...ownerEmail(m, new Date()) }),
    acknowledge: (m) => mailer.send({ to: m.email, ...acknowledgementEmail(m) }),
  };
}

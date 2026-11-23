import { z } from "zod";

/*
 * The landing page's contact form: what a submission must look like, and what happens to it.
 * A message is saved to Supabase first (that's the record); then the owner is notified and the
 * sender gets an automatic acknowledgement. The steps are passed in, so the flow is testable
 * without a database or an email account.
 */

export const CONTACT_LIMITS = { name: 100, email: 254, message: 2000 } as const;

export const ContactInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(CONTACT_LIMITS.name, "Your name is too long."),
  email: z
    .string()
    .trim()
    .max(CONTACT_LIMITS.email, "That email address is too long.")
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address."),
  message: z.string().trim().min(1, "Write your question or message.").max(CONTACT_LIMITS.message, "Your message is too long (2,000 characters at most)."),
  /** A field people never see; bots that fill it in are ignored. */
  website: z.string().optional(),
});
export type ContactMessage = { name: string; email: string; message: string };

export type ContactSteps = {
  save: (m: ContactMessage) => Promise<void>;
  notifyOwner: (m: ContactMessage) => Promise<void>;
  acknowledge: (m: ContactMessage) => Promise<void>;
};

export type ContactResult =
  | { status: 200; body: { saved: true; acknowledged: boolean } }
  | { status: 400 | 502; body: { error: { message: string; fields?: Partial<Record<"name" | "email" | "message", string>> } } };

export async function handleContact(body: unknown, steps: ContactSteps, log: (line: string) => void = console.error): Promise<ContactResult> {
  const parsed = ContactInput.safeParse(body);
  if (!parsed.success) {
    const fields: Partial<Record<"name" | "email" | "message", string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "email" || key === "message") && !fields[key]) fields[key] = issue.message;
    }
    return { status: 400, body: { error: { message: "Check the highlighted fields.", fields } } };
  }
  const { website, ...message } = parsed.data;
  // Bots fill in the hidden field: answer as if it worked, and store or send nothing.
  if (website?.trim()) return { status: 200, body: { saved: true, acknowledged: true } };

  try {
    await steps.save(message);
  } catch (err) {
    log(`[contact] save failed: ${errorName(err)}`);
    return { status: 502, body: { error: { message: "We couldn't send your message just now. Please try again in a minute." } } };
  }

  // The message is saved; the emails are best effort and never undo that.
  const [owner, ack] = await Promise.allSettled([steps.notifyOwner(message), steps.acknowledge(message)]);
  if (owner.status === "rejected") log(`[contact] owner notification failed: ${errorName(owner.reason)}`);
  if (ack.status === "rejected") log(`[contact] acknowledgement failed: ${errorName(ack.reason)}`);
  return { status: 200, body: { saved: true, acknowledged: ack.status === "fulfilled" } };
}

/** Only the error type is logged, never the message, name or email. */
const errorName = (err: unknown) => (err instanceof Error ? `${err.name}${"code" in err ? ` (${String(err.code)})` : ""}` : "UnknownError");

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The owner's notification: everything submitted, with replies going straight to the sender. */
export function ownerEmail(m: ContactMessage, receivedAt: Date) {
  const when = receivedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const text = `New message from the Meritwing contact form\n\nName: ${m.name}\nEmail: ${m.email}\nReceived: ${when} IST\n\n${m.message}\n\nReply to this email to answer ${m.name}. The message is also saved in Supabase (contact_messages).`;
  const html = `<p>New message from the Meritwing contact form</p>
<p><b>Name:</b> ${escapeHtml(m.name)}<br><b>Email:</b> ${escapeHtml(m.email)}<br><b>Received:</b> ${escapeHtml(when)} IST</p>
<p style="white-space:pre-wrap;border-left:3px solid #2563eb;padding-left:12px">${escapeHtml(m.message)}</p>
<p style="color:#555">Reply to this email to answer ${escapeHtml(m.name)}. The message is also saved in Supabase (contact_messages).</p>`;
  return { subject: `New question from ${m.name} via Meritwing`, text, html, replyTo: m.email };
}

/**
 * The sender's acknowledgement. It goes to an address anyone can type, so it repeats nothing they
 * wrote except a plain first name: the form can't be used to send someone else arbitrary text.
 */
export function acknowledgementEmail(m: ContactMessage) {
  const first = m.name.split(/\s+/)[0].replace(/[^\p{L}\p{M}'-]/gu, "").slice(0, 40);
  const greeting = first ? `Hi ${first},` : "Hi,";
  const text = `${greeting}\n\nThanks for getting in touch with Meritwing. We've received your message and will reply to this email address.\n\nYou don't need to do anything else. If you didn't send this, you can ignore this email.\n\nMeritwing\nhttps://meritwing.vercel.app`;
  const html = `<p>${escapeHtml(greeting)}</p>
<p>Thanks for getting in touch with Meritwing. We've received your message and will reply to this email address.</p>
<p>You don't need to do anything else. If you didn't send this, you can ignore this email.</p>
<p>Meritwing<br><a href="https://meritwing.vercel.app">meritwing.vercel.app</a></p>`;
  return { subject: "We've received your message · Meritwing", text, html };
}

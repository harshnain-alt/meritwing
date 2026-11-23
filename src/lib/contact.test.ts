import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { acknowledgementEmail, handleContact, ownerEmail, type ContactMessage, type ContactSteps } from "@/lib/contact";
import { contactConfig } from "@/lib/contactDelivery";

/* The contact form's flow and emails. All data here is fictional. */

const MESSAGE = { name: "Riya Test Sharma", email: "riya@example.com", message: "Does Meritwing work for marketing roles too?" };

function recorder(fail: Partial<Record<keyof ContactSteps, boolean>> = {}) {
  const calls: string[] = [];
  const step = (name: keyof ContactSteps) => async (m: ContactMessage) => {
    calls.push(`${name}:${m.email}`);
    if (fail[name]) throw new Error(`${name} failed`);
  };
  return { calls, steps: { save: step("save"), notifyOwner: step("notifyOwner"), acknowledge: step("acknowledge") } };
}
const quiet = () => {};

describe("handleContact", () => {
  test("saves the message, then notifies the owner and acknowledges the sender", async () => {
    const r = recorder();
    const result = await handleContact({ ...MESSAGE, website: "" }, r.steps, quiet);
    assert.deepEqual(result, { status: 200, body: { saved: true, acknowledged: true } });
    assert.equal(r.calls[0], "save:riya@example.com");
    assert.deepEqual(r.calls.slice(1).sort(), ["acknowledge:riya@example.com", "notifyOwner:riya@example.com"]);
  });

  test("trims input and rejects missing or invalid fields with a message for each", async () => {
    const r = recorder();
    const result = await handleContact({ name: "  ", email: "not-an-email", message: "" }, r.steps, quiet);
    assert.equal(result.status, 400);
    assert.deepEqual(Object.keys((result.body as { error: { fields: object } }).error.fields).sort(), ["email", "message", "name"]);
    assert.deepEqual(r.calls, []);
  });

  test("stores and sends nothing when the hidden field is filled in by a bot", async () => {
    const r = recorder();
    const result = await handleContact({ ...MESSAGE, website: "https://spam.example" }, r.steps, quiet);
    assert.equal(result.status, 200);
    assert.deepEqual(r.calls, []);
  });

  test("sends no emails if the message can't be saved", async () => {
    const r = recorder({ save: true });
    const logs: string[] = [];
    const result = await handleContact(MESSAGE, r.steps, (l) => logs.push(l));
    assert.equal(result.status, 502);
    assert.deepEqual(r.calls, ["save:riya@example.com"]);
    assert.ok(logs.every((l) => !l.includes("riya") && !l.includes("marketing")), "logs carry no personal data");
  });

  test("keeps a saved message when an email fails, and says whether the sender was acknowledged", async () => {
    const r = recorder({ acknowledge: true });
    const result = await handleContact(MESSAGE, r.steps, quiet);
    assert.deepEqual(result, { status: 200, body: { saved: true, acknowledged: false } });
  });
});

describe("emails", () => {
  test("the owner gets the full message, with replies going to the sender", () => {
    const mail = ownerEmail({ ...MESSAGE, message: "Hi <b>there</b>" }, new Date("2026-11-23T06:30:00Z"));
    assert.equal(mail.replyTo, "riya@example.com");
    assert.match(mail.subject, /Riya Test Sharma/);
    assert.match(mail.text, /Hi <b>there<\/b>/);
    assert.match(mail.html, /Hi &lt;b&gt;there&lt;\/b&gt;/);
    assert.match(mail.text, /12:00 pm IST|12:00 PM IST/i);
  });

  test("the acknowledgement repeats nothing the sender typed except a plain first name", () => {
    const mail = acknowledgementEmail({ name: "Win$ big at http://x.example", email: "a@b.co", message: "Buy now http://spam.example" });
    assert.doesNotMatch(mail.text + mail.html, /spam\.example|x\.example|Buy now|\$/);
    assert.match(acknowledgementEmail(MESSAGE).text, /^Hi Riya,/);
  });
});

describe("contactConfig", () => {
  const base = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "k", CONTACT_OWNER_EMAIL: "o@example.com" };

  test("names what's missing", () => {
    const c = contactConfig({} as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(c.ok ? [] : c.missing, ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CONTACT_OWNER_EMAIL", "GMAIL_USER", "GMAIL_APP_PASSWORD"]);
  });

  test("uses Gmail by default and Resend when its key and sender are set", () => {
    const gmail = contactConfig({ ...base, GMAIL_USER: "g@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" } as unknown as NodeJS.ProcessEnv);
    assert.deepEqual(gmail, { ok: true, supabaseUrl: "https://x.supabase.co", supabaseKey: "k", ownerEmail: "o@example.com", mailer: "gmail" });
    const resend = contactConfig({ ...base, RESEND_API_KEY: "re_x", RESEND_FROM: "Meritwing <hi@example.com>" } as unknown as NodeJS.ProcessEnv);
    assert.equal(resend.ok && resend.mailer, "resend");
  });
});

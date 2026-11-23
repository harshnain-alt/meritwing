import { handleContact } from "@/lib/contact";
import { contactConfig, contactSteps } from "@/lib/contactDelivery";

/*
 * POST /api/contact: the landing page's contact form. Saves the message to Supabase, emails the
 * owner and sends the sender an acknowledgement. Only error types are logged, never content.
 */

const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
// Best effort on serverless (each instance keeps its own count), enough to stop casual flooding.
const recent = new Map<string, number[]>();

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const config = contactConfig();
  if (!config.ok) {
    console.error(`[contact] not configured: missing ${config.missing.join(", ")}`);
    return reply(503, { error: { message: "The contact form isn't set up yet. Please try again later." } });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return reply(413, { error: { message: "Your message is too long." } });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    return reply(429, { error: { message: "You've sent several messages just now. Please wait a few minutes and try again." } });
  }
  recent.set(ip, [...times, now]);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: { message: "The form couldn't be read. Please try again." } });
  }
  const result = await handleContact(body, contactSteps(config));
  return reply(result.status, result.body);
}

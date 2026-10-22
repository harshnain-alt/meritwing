import { z } from "zod";
import { searchJobs } from "@/lib/jobs/search";
import { ANYWHERE_IN_INDIA, CITIES, FUNCTIONS } from "@/lib/jobs/taxonomy";

/*
 * Searches the configured employer job boards for openings that match the student's
 * preferences. Only the preferences are received; no resume or personal details. The boards
 * are public, so no keys are involved.
 */

export const maxDuration = 60;

const Preferences = z.object({
  employmentType: z.enum(["internship", "full-time", "either"]),
  roles: z.array(z.enum(FUNCTIONS.map((f) => f.id) as [string, ...string[]])).min(1).max(FUNCTIONS.length),
  locations: z.array(z.enum([ANYWHERE_IN_INDIA, ...CITIES.map((c) => c.id)] as [string, ...string[]])).min(1).max(CITIES.length + 1),
  workplace: z.enum(["onsite", "remote", "any"]),
  includeCityNotStated: z.boolean(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { message: "The request couldn't be read. Please try again." } }, { status: 400 });
  }
  const prefs = Preferences.safeParse(body);
  if (!prefs.success) {
    return Response.json({ error: { message: "Choose a job type, at least one role and at least one location." } }, { status: 400 });
  }
  const result = await searchJobs(prefs.data);
  const failed = result.sources.filter((s) => s.status === "failed" || s.status === "timed-out");
  if (failed.length) console.error(`[jobs] boards not read: ${failed.map((s) => `${s.employer} (${s.status})`).join(", ")}`);
  return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
}

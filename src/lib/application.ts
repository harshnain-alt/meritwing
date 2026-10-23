import { isIndianRegion } from "@/lib/states";

/** Step 1. Only the name is asked up front; the rest is optional "Additional details". */
export type AboutData = {
  fullName: string;
  email: string;
  phone: string;
  /** Indian state or union territory, from INDIAN_REGIONS. */
  state: string;
  school: string;
  programme: string;
  gradYear: string;
};

export type ResultsAttribution = "" | "individual" | "shared" | "mixed";

/** A bullet of the venture's Experience entry: the student's own work, or something the team did together. */
export type VentureBullet = { text: string; kind: "own" | "team" };

/** The venture as an Experience entry on the resume, drafted from the three answers and edited by the student. */
export type VentureEntry = { heading: string; description: string; bullets: VentureBullet[] };

/**
 * Step 2, "Your venture": three answers in the student's own words, the Experience entry drafted
 * from them (being reviewed), and the version the student added to their resume.
 */
export type ExperienceData = {
  /** The venture's name. */
  projectName: string;
  /** What the venture does: the product or service and its customers. */
  about: string;
  /** What the student personally did. */
  personal: string;
  /** The entry under review; `from` identifies the answers it was drafted from. */
  draft: (VentureEntry & { from: string }) | null;
  /** The entry the student added to their resume. */
  entry: VentureEntry | null;
};

/** Sections proposed from the resume. Editable; the original text is kept separately. */
export type ResumeSections = {
  name: string;
  email: string;
  phone: string;
  education: string;
  experience: string;
  skills: string;
  additional: string;
  unsorted: string;
};

export type ResumeChoice = "" | "upload" | "paste" | "none";

export type CheckChoice = "answers" | "resume";

export type CheckResolution = {
  choice: CheckChoice;
  /** The values the student compared; a resolution only counts while these still match. */
  signature: string;
};

export type ResumeData = {
  choice: ResumeChoice;
  pasteDraft: string;
  source: null | { kind: "pdf"; fileName: string; pages: number } | { kind: "paste" };
  /** Exactly what was extracted or pasted. Never edited. */
  original: string;
  proposed: ResumeSections | null;
  resolutions: Record<string, CheckResolution>;
  /** About fields that were empty and filled from the resume, with the value used. */
  filled: Partial<Record<keyof AboutData, string>>;
};

/** Step 3. Title and company are suggested from the description and stay editable. */
export type InternshipData = {
  description: string;
  title: string;
  company: string;
  /** Last values suggested from the description, so edits by the student are never overwritten. */
  suggestedTitle: string;
  suggestedCompany: string;
};

export type ApplicationData = {
  about: AboutData;
  experience: ExperienceData;
  resume: ResumeData;
  internship: InternshipData;
};

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const emptyApplication: ApplicationData = {
  about: {
    fullName: "",
    email: "",
    phone: "",
    state: "",
    school: "",
    programme: "",
    gradYear: "",
  },
  experience: {
    projectName: "",
    about: "",
    personal: "",
    draft: null,
    entry: null,
  },
  resume: {
    choice: "",
    pasteDraft: "",
    source: null,
    original: "",
    proposed: null,
    resolutions: {},
    filled: {},
  },
  internship: {
    description: "",
    title: "",
    company: "",
    suggestedTitle: "",
    suggestedCompany: "",
  },
};

/** The steps with forms that are validated: resume, venture, and the job description to tailor for. */
export const STEPS = [
  { id: 1, label: "Resume" },
  { id: 2, label: "Your venture" },
  { id: 3, label: "Job description" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/**
 * Resume and venture, then the confirmed profile and preferences, matching jobs, the chosen
 * job's description, and the draft view where facts are checked.
 */
export type View = StepId | "profile" | "jobs" | "draft";

export const PROFILE_VIEW = "profile";
export const JOBS_VIEW = "jobs";
export const DRAFT_VIEW = "draft";

/** The progress bar: each stage and the views it covers, in order. */
export const PROGRESS: { id: View; label: string; covers: View[] }[] = [
  { id: 1, label: "Resume", covers: [1] },
  { id: 2, label: "Your venture", covers: [2] },
  { id: PROFILE_VIEW, label: "Profile", covers: [PROFILE_VIEW] },
  { id: JOBS_VIEW, label: "Jobs", covers: [JOBS_VIEW] },
  { id: 3, label: "Tailor", covers: [3, DRAFT_VIEW] },
];

// Fixed range keeps the page free of the current date, so it prerenders identically.
export const GRAD_YEARS = Array.from({ length: 2034 - 2018 + 1 }, (_, i) => String(2018 + i));

/* ---------- Validation ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESUME_MIN = 50;
const DESCRIPTION_MIN = 100;

function required(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

function compact<T>(errors: Partial<Record<keyof T, string | undefined>>): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  ) as FieldErrors<T>;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export type StartErrors = FieldErrors<AboutData> & { resume?: string };

/** Fields inside the optional "Additional details" section. */
export const ADDITIONAL_FIELDS: (keyof AboutData)[] = ["email", "phone", "state", "school", "programme", "gradYear"];

export function validateStart(about: AboutData, resume: ResumeData): StartErrors {
  const digits = about.phone.replace(/\D/g, "");
  let resumeError: string | undefined;
  if (!resume.original && resume.choice !== "none") {
    if (resume.choice === "paste" && resume.pasteDraft.trim()) {
      resumeError = validatePasteText(resume.pasteDraft);
    } else {
      resumeError =
        resume.choice === "paste"
          ? "Paste your resume text, or continue without a resume."
          : "Upload your resume, paste it, or continue without a resume.";
    }
  }
  return compact<AboutData & { resume: string }>({
    fullName: required(about.fullName, "Enter your full name."),
    resume: resumeError,
    email:
      about.email.trim() && !EMAIL_RE.test(about.email.trim())
        ? "Enter a valid email address, or leave this blank."
        : undefined,
    phone:
      about.phone.trim() && (digits.length < 7 || digits.length > 15 || /[^\d\s+().-]/.test(about.phone))
        ? "Enter a valid phone number, or leave this blank."
        : undefined,
    // Never accept a leftover city or typed value as a state; ask again instead.
    state:
      about.state.trim() && !isIndianRegion(about.state)
        ? "Select your state or union territory from the list."
        : undefined,
  });
}

export function validatePasteText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return "Paste your resume text first.";
  if (trimmed.length < RESUME_MIN)
    return `This looks too short for a resume. Paste at least ${RESUME_MIN} characters (currently ${trimmed.length}).`;
  return undefined;
}

export function validateExperience(d: ExperienceData): FieldErrors<ExperienceData> {
  const answered = d.projectName.trim() && d.about.trim() && d.personal.trim();
  const edited = d.entry && d.draft && JSON.stringify(entryOf(d.draft)) !== JSON.stringify(d.entry);
  return compact<ExperienceData>({
    projectName: required(d.projectName, "Add your venture's name."),
    about: required(d.about, "Say what the venture does."),
    personal: required(d.personal, "Describe what you personally did."),
    entry: !answered
      ? undefined
      : !d.draft && !d.entry
        ? "Draft your Experience entry, then review it and add it to your resume."
        : !d.entry
          ? "Review your Experience entry and add it to your resume."
          : edited
            ? "You've edited the entry since adding it. Update it in your resume first."
            : undefined,
  });
}

/** The entry without the draft's bookkeeping. */
export const entryOf = ({ heading, description, bullets }: VentureEntry): VentureEntry => ({ heading, description, bullets });

export function validateInternship(d: InternshipData): FieldErrors<InternshipData> {
  const description = d.description.trim();
  return compact<InternshipData>({
    description: !description
      ? "Paste the full job description."
      : description.length < DESCRIPTION_MIN
        ? `This looks incomplete. Paste the full description, at least ${DESCRIPTION_MIN} characters (currently ${description.length}).`
        : undefined,
  });
}

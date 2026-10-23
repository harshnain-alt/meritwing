"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { WingedTiger } from "@/components/brand/WingedTiger";

const STEPS: [string, string][] = [
  ["Resume", "Upload a PDF or paste text. It's read with simple rules, not AI, and nothing is reworded."],
  ["Your venture", "Three short answers: its name, what it does and what you personally did. We draft an Experience entry you can edit."],
  ["Profile", "Confirm a profile drawn from your resume and venture, then set role, location and work preferences."],
  ["Jobs for you", "Current openings from employer careers boards, ranked by evidence from your confirmed profile."],
  ["Tailor", "Check your resume for an opening, edit anything, and download a resume-only PDF."],
];

const PRINCIPLES: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "No invented facts",
    text: "Suggested bullets can't add a number, tool, name or claim you didn't state. Anything that does is removed, and you review every bullet.",
    icon: <path d="M10 1.5a.75.75 0 0 1 .38.1l6.5 3.75a.75.75 0 0 1 .37.65v3.5c0 4.24-2.73 7.36-6.97 8.95a.75.75 0 0 1-.53 0C5.48 16.86 2.75 13.74 2.75 9.5V6c0-.27.14-.51.37-.65l6.5-3.75A.75.75 0 0 1 10 1.5Zm3.03 6.22a.75.75 0 0 0-1.06-1.06L9 9.63 8.03 8.66a.75.75 0 1 0-1.06 1.06l1.5 1.5c.3.3.77.3 1.06 0l3.5-3.5Z" />,
  },
  {
    title: "You apply on the employer's page",
    text: "Apply now opens the employer's own application page. Meritwing never submits anything for you.",
    icon: <path d="M11 3.75A.75.75 0 0 1 11.75 3h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22h-2.69A.75.75 0 0 1 11 3.75ZM4.5 6.5A.5.5 0 0 0 4 7v8.5c0 .28.22.5.5.5H13a.5.5 0 0 0 .5-.5V11a.75.75 0 0 1 1.5 0v4.5a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2H9a.75.75 0 0 1 0 1.5H4.5Z" />,
  },
  {
    title: "Nothing kept after you leave",
    text: "Your answers stay in your browser tab. Uploaded PDFs are read in memory on our server and not stored.",
    icon: <path d="M10 1a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 7V5.5a3 3 0 1 0-6 0V8h6Z" />,
  },
];

const card = "mw-card rounded-2xl border border-line bg-surface";
const primaryLg =
  "mw-glow inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-fill px-6 py-3 text-[15px] font-semibold text-white hover:bg-accent-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The landing page: the brand, what Meritwing does, the five steps, and what it won't do. */
export function Landing({ onStart }: { onStart: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Sections fade in once as they scroll into view (only once the script runs, so they're never hidden without it).
  useEffect(() => {
    const root = ref.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("mw-reveal-on");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el, i) => {
      el.style.transitionDelay = `${(i % 5) * 60}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <section aria-labelledby="hero-title" className="mw-hero relative overflow-hidden pb-18 pt-10 text-center sm:pt-14">
        <div className="mw-enter relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 sm:px-6">
          <div className="flex flex-col items-center">
            <WingedTiger variant="hero" className="w-[min(300px,68vw)]" />
            <h1 id="hero-title" className="-mt-1 font-display text-[clamp(3.25rem,9vw,5.75rem)] font-semibold leading-none tracking-tight text-ink">
              Merit<span className="text-accent">wing</span>
            </h1>
          </div>
          <p className="mt-4 text-[clamp(1.125rem,2.4vw,1.375rem)] font-medium text-ink-soft">Your experience. Your next move.</p>
          <p className="mt-4 max-w-xl text-base text-muted">
            Turn what you&apos;ve actually done into a resume for a real opening. Meritwing reads your resume and venture, finds current
            openings on employer careers boards, and helps you tailor your resume in your own words.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onStart} className={primaryLg}>
              Start with your resume
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-current">
                <path d="M3 10a.75.75 0 0 1 .75-.75h10.64l-4.2-3.96a.75.75 0 1 1 1.03-1.09l5.5 5.25a.75.75 0 0 1 0 1.09l-5.5 5.25a.75.75 0 1 1-1.03-1.09l4.2-3.95H3.75A.75.75 0 0 1 3 10Z" />
              </svg>
            </button>
            <a
              href="#how"
              className="inline-flex min-h-12 items-center rounded-xl border border-line-strong bg-raise px-6 py-3 text-[15px] font-semibold text-ink hover:border-faint/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-[13px] text-muted">No account needed. Your answers stay in this browser tab.</p>
        </div>
      </section>

      <section id="how" aria-labelledby="how-title" className="scroll-mt-16 border-t border-line py-16 sm:py-18">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div data-reveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">How it works</p>
            <h2 id="how-title" className="mt-2 text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold leading-tight tracking-tight text-ink">
              Five steps, from your resume to a tailored application
            </h2>
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([title, text], i) => (
              <li key={title} data-reveal className={`${card} p-5`}>
                <span className="inline-grid size-[30px] place-items-center rounded-full border border-accent/55 bg-accent-soft text-[13px] font-semibold text-accent">
                  {i + 1}
                </span>
                <h3 className="mt-3.5 font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="principles" aria-labelledby="principles-title" className="scroll-mt-16 border-t border-line py-16 sm:py-18">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div data-reveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">What we won&apos;t do</p>
            <h2 id="principles-title" className="mt-2 text-[clamp(1.625rem,3.4vw,2.125rem)] font-semibold leading-tight tracking-tight text-ink">
              Built to keep your resume honest
            </h2>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <article key={p.title} data-reveal className={`${card} p-6`}>
                <span aria-hidden="true" className="grid size-9 place-items-center rounded-[10px] bg-accent-soft text-accent">
                  <svg viewBox="0 0 20 20" className="size-[18px] fill-current">
                    {p.icon}
                  </svg>
                </span>
                <h3 className="mt-3.5 font-semibold text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="border-t border-line px-4 py-16 text-center sm:py-18">
        <div data-reveal>
          <h2 id="cta-title" className="text-[clamp(1.5rem,3vw,1.875rem)] font-semibold tracking-tight text-ink">
            Start with what you&apos;ve already done
          </h2>
          <p className="mx-auto mt-2.5 max-w-lg text-muted">Bring your resume, or paste it, and confirm a profile before you see any openings.</p>
          <button type="button" onClick={onStart} className={`${primaryLg} mt-6`}>
            Start with your resume
          </button>
        </div>
      </section>

      <footer className="border-t border-line px-4 py-6 text-center text-[13px] text-muted sm:px-6">
        Meritwing · for business-school students in India
      </footer>
    </div>
  );
}

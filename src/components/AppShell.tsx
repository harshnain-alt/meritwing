"use client";

import { useState } from "react";
import { WingedTiger } from "@/components/brand/WingedTiger";
import { Landing } from "@/components/Landing";
import { Workspace } from "@/components/Workspace";

/*
 * The page: header, then the landing page until the student starts, then the five-step workspace.
 * Nothing is stored, so a refresh shows the landing page again, as it clears the workspace.
 */
export function AppShell() {
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    // Move to the first step's heading, as a page change would.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent-fill px-3.5 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
          <div className="brand flex items-center gap-2.5">
            <WingedTiger variant="nav" className="w-11 shrink-0" />
            <p className="font-display text-[22px] font-semibold leading-none tracking-tight text-ink">
              Merit<span className="text-accent">wing</span>
            </p>
          </div>
          {started ? (
            <p className="hidden text-sm text-muted sm:block">Your experience. Your next move.</p>
          ) : (
            <nav aria-label="Landing page" className="flex items-center gap-5 text-sm">
              <a href="#how" className="hidden text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:inline">
                How it works
              </a>
              <a href="#principles" className="hidden text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:inline">
                What we won&apos;t do
              </a>
              <button
                type="button"
                onClick={start}
                className="mw-glow rounded-lg bg-accent-fill px-4 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-accent-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Find my opportunities
              </button>
            </nav>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {started ? <Workspace /> : <Landing onStart={start} />}
      </main>
    </>
  );
}

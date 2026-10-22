import { Workspace } from "@/components/Workspace";

export default function Home() {
  return (
    <>
      <header className="border-b border-line bg-canvas/90">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-4 sm:px-6">
          <p className="font-display text-xl font-semibold tracking-tight text-ink">
            Merit<span className="text-accent">wing</span>
          </p>
          <p className="text-sm text-muted">Your experience. Your next move.</p>
        </div>
      </header>
      <main className="flex-1">
        <Workspace />
      </main>
    </>
  );
}

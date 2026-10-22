import { PROGRESS, type View } from "@/lib/application";

type StepIndicatorProps = {
  current: View;
  onSelect: (step: View) => void;
  /** Stages the student can open (they have been reached before). */
  reachable: (step: View) => boolean;
};

export function StepIndicator({ current, onSelect, reachable }: StepIndicatorProps) {
  const currentIndex = PROGRESS.findIndex((p) => p.covers.includes(current));
  return (
    <nav aria-label="Progress">
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {PROGRESS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const content = (
            <>
              <span className={`block h-1 rounded-full ${isCurrent || isDone ? "bg-accent" : "bg-line"}`} />
              <span
                className={`mt-2 block text-[11px] leading-tight sm:text-[13px] ${
                  isCurrent ? "font-semibold text-ink" : isDone ? "font-medium text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
              <span className="sr-only">{isDone ? " (completed)" : isCurrent ? " (current step)" : ""}</span>
            </>
          );

          return (
            <li key={String(step.id)}>
              {!isCurrent && (isDone || reachable(step.id)) ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="block w-full rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`Go to step ${index + 1}: ${step.label}`}
                >
                  {content}
                </button>
              ) : (
                <div className="py-1" aria-current={isCurrent ? "step" : undefined}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

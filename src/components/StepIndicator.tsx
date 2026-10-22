import { STEPS, type View } from "@/lib/application";

type StepIndicatorProps = {
  /** 1–3 for the steps; the questions and draft views show every step as done. */
  current: View;
  onSelect: (step: View) => void;
};

export function StepIndicator({ current, onSelect }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((step) => {
          const isCurrent = step.id === current;
          const isDone = typeof current !== "number" || step.id < current;
          const content = (
            <>
              <span className={`block h-1 rounded-full ${isCurrent || isDone ? "bg-accent" : "bg-line"}`} />
              <span
                className={`mt-2 block text-xs leading-tight sm:text-[13px] ${
                  isCurrent ? "font-semibold text-ink" : isDone ? "font-medium text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
              <span className="sr-only">{isDone ? " (completed)" : isCurrent ? " (current step)" : ""}</span>
            </>
          );

          return (
            <li key={step.id}>
              {isDone ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="block w-full rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`Go back to step ${step.id}: ${step.label}`}
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

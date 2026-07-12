import React from "react";

export interface StepDotsProps {
  /** Total number of steps. */
  total: number;
  /** 1-based index of the current step. */
  current: number;
  /** Number of completed steps (defaults to current - 1). */
  completed?: number;
  className?: string;
  label?: string;
}

/**
 * Progress dots: completed = gold, current = royal, upcoming = neutral grey.
 * State is exposed to assistive tech per dot, so it is never color-only.
 */
export function StepDots({
  total,
  current,
  completed,
  className,
  label = "Progress",
}: StepDotsProps) {
  const done = completed ?? Math.max(0, current - 1);

  return (
    <div
      className={["vstepdots", className].filter(Boolean).join(" ")}
      role="list"
      aria-label={`${label}: step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const stepN = i + 1;
        const isDone = stepN <= done;
        const isCurrent = !isDone && stepN === current;
        const stateLabel = isDone ? "completed" : isCurrent ? "current" : "upcoming";
        const cls =
          "vstepdots__dot" +
          (isDone
            ? " vstepdots__dot--done"
            : isCurrent
            ? " vstepdots__dot--current"
            : "");
        return (
          <span
            key={i}
            role="listitem"
            aria-label={`Step ${stepN}: ${stateLabel}`}
            className={cls}
          />
        );
      })}
    </div>
  );
}

export default StepDots;

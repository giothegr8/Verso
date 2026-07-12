import React from "react";

export type ChipState = "default" | "selected" | "earned" | "disabled";

export interface ChipProps
  extends React.HTMLAttributes<HTMLElement> {
  state?: ChipState;
  as?: "span" | "button";
}

/**
 * Quiet dark-glass pill. Selected = low-opacity royal tint + royal rim (never a
 * solid blue fill). Earned = gold rim + gold text (never a solid gold fill).
 */
export function Chip({
  state = "default",
  as = "span",
  className,
  children,
  ...rest
}: ChipProps) {
  const cls = [
    "vchip",
    state !== "default" ? `vchip--${state}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (as === "button") {
    return (
      <button
        type="button"
        className={cls}
        disabled={state === "disabled"}
        aria-pressed={state === "selected" || undefined}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

export default Chip;

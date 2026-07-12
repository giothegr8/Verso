import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Show the leading status dot (translation-badge style). */
  dot?: boolean;
  /** Render the dot muted (inactive translation). */
  dotMuted?: boolean;
}

/**
 * Quiet dark-glass capsule. Translation badges use a small status dot + text,
 * never a bright filled capsule (no magenta, purple, teal, solid royal or gold).
 */
export function Badge({
  dot = true,
  dotMuted = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={["vbadge", className].filter(Boolean).join(" ")} {...rest}>
      {dot && (
        <span
          className={`vbadge__dot${dotMuted ? " vbadge__dot--muted" : ""}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;

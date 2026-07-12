import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "earned"
  | "destructive"
  | "text";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Announced to assistive tech while loading. */
  loadingLabel?: string;
  leftIcon?: React.ReactNode;
}

/**
 * Dark-glass control. Every non-text variant keeps a translucent glass surface
 * with a restrained rim/glow — never a solid saturated fill.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      loading = false,
      loadingLabel = "Loading",
      leftIcon,
      type,
      disabled,
      className,
      children,
      ...rest
    },
    ref
  ) {
    const classes = ["vbtn", `vbtn--${variant}`, loading ? "is-loading" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <span className="vbtn__spinner" aria-hidden="true" />}
        {loading && <span className="sr-only">{loadingLabel}</span>}
        {!loading && leftIcon}
        {children}
      </button>
    );
  }
);

export default Button;

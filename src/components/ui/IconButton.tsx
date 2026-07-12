import React from "react";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name — icon buttons have no visible text. */
  label: string;
  icon: React.ReactNode;
}

/**
 * 44×44 dark-glass circular control. Gains a royal rim on hover/focus; never a
 * solid blue circle.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, icon, type, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={["vicon-btn", className].filter(Boolean).join(" ")}
        aria-label={label}
        {...rest}
      >
        {icon}
      </button>
    );
  }
);

export default IconButton;

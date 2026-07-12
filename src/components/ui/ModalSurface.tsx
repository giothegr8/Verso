import React from "react";

export interface ModalSurfaceProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Called when the scrim (outside the panel) is clicked. */
  onClose?: () => void;
  /** id of the panel's heading, for aria-labelledby. */
  labelledBy?: string;
  /** id of the panel's description, for aria-describedby. */
  describedBy?: string;
  panelClassName?: string;
}

/**
 * Reusable modal surface only (not migrated onto any page in Phase 1).
 * Mobile: bottom sheet (top corners radius 24, max-height 88vh, internal scroll).
 * Tablet/desktop: centered dialog, max-width 360, radius 24. Scrim rgba(8,11,16,.60).
 */
export function ModalSurface({
  onClose,
  labelledBy,
  describedBy,
  panelClassName,
  className,
  children,
  ...rest
}: ModalSurfaceProps) {
  return (
    <div
      className={["vmodal-scrim", className].filter(Boolean).join(" ")}
      onClick={
        onClose
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        className={["vmodal-panel", panelClassName].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}

export default ModalSurface;

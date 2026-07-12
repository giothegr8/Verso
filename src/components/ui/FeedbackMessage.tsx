import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

export type FeedbackTone = "success" | "warning" | "error" | "info";

const TONE_ICON: Record<FeedbackTone, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

export interface FeedbackMessageProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  /** Override the default tone icon. State is always icon + text (never color-only). */
  icon?: React.ReactNode;
}

/**
 * Restrained dark surface + tinted rim carrying an icon and text. Success/
 * warning/error/info map to green/gold/crimson/royal. Never color alone.
 */
export function FeedbackMessage({
  tone = "info",
  icon,
  className,
  children,
  ...rest
}: FeedbackMessageProps) {
  const ToneIcon = TONE_ICON[tone];
  return (
    <div
      className={["vmsg", `vmsg--${tone}`, className].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : "status"}
      {...rest}
    >
      <span className="vmsg__icon" aria-hidden="true">
        {icon ?? <ToneIcon size={18} strokeWidth={1.8} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

export default FeedbackMessage;

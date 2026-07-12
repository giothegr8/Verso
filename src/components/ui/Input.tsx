import React from "react";

export type InputState = "default" | "active" | "error" | "success" | "disabled";
export type MessageTone = "error" | "success" | "warning" | "info";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  state?: InputState;
  leadingIcon?: React.ReactNode;
  /** Paired message text. Always shown with an icon so state is never color-only. */
  message?: string;
  messageIcon?: React.ReactNode;
  messageTone?: MessageTone;
  wrapperClassName?: string;
}

/**
 * Dark-glass pill input. Royal caret; royal rim + focus ring when active;
 * crimson rim on error; gold rim on earned success. No saturated blue interior.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      state = "default",
      leadingIcon,
      message,
      messageIcon,
      messageTone,
      wrapperClassName,
      className,
      disabled,
      id,
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || state === "disabled";
    const fieldCls = [
      "vfield",
      state === "active" ? "is-active" : "",
      state === "error" ? "is-error" : "",
      state === "success" ? "is-success" : "",
      isDisabled ? "is-disabled" : "",
      wrapperClassName,
    ]
      .filter(Boolean)
      .join(" ");

    const tone: MessageTone =
      messageTone ??
      (state === "error" ? "error" : state === "success" ? "success" : "info");
    const msgId = message && id ? `${id}-msg` : undefined;

    return (
      <div>
        <div className={fieldCls}>
          {leadingIcon && (
            <span className="vfield__icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={className}
            disabled={isDisabled}
            aria-invalid={state === "error" || undefined}
            aria-describedby={msgId}
            {...rest}
          />
        </div>
        {message && (
          <div
            id={msgId}
            className={`vmsg vmsg--${tone}`}
            style={{ marginTop: 8 }}
            role={tone === "error" ? "alert" : "status"}
          >
            {messageIcon && (
              <span className="vmsg__icon" aria-hidden="true">
                {messageIcon}
              </span>
            )}
            <span>{message}</span>
          </div>
        )}
      </div>
    );
  }
);

export default Input;

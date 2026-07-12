/// <reference types="vite/client" />
import React from "react";

// The Dawn mark — canonical handoff assets (copied verbatim, never redrawn).
// Colored symbol preserves the gold sunrise + royal book; the small-nav variant
// carries heavier strokes for legibility at 24–32px; monochrome drives white mode.
import symbolMark from "../assets/brand/logo/verso-dawn-symbol.svg";
import smallNavMark from "../assets/brand/logo/verso-dawn-small-nav.svg";
import monochromeMark from "../assets/brand/logo/verso-dawn-monochrome.svg";

interface VersoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "app" | "onboarding";
  mode?: "standard" | "white";
}

// Below 32px the fine rays disappear, so sm/md use the small-nav variant
// (per logo-usage.md); lg/xl use the full symbol.
const SIZES: Record<
  NonNullable<VersoLogoProps["size"]>,
  { mark: number; text: string; smallNav: boolean }
> = {
  sm: { mark: 22, text: "1.35rem", smallNav: true },
  // md renders the full-detail Dawn symbol at exactly 32px (the main app header):
  // the sunrise rays must stay visible, so it never uses the ray-less small-nav mark.
  md: { mark: 32, text: "1.75rem", smallNav: false },
  lg: { mark: 34, text: "2.25rem", smallNav: false },
  xl: { mark: 52, text: "3rem", smallNav: false },
};

export default function VersoLogo({
  size = "md",
  showText = true,
  variant = "app",
  mode = "standard",
}: VersoLogoProps) {
  const s = SIZES[size];
  const isOnboarding = variant === "onboarding";
  const isWhite = mode === "white";
  const coloredSrc = s.smallNav ? smallNavMark : symbolMark;
  // When the wordmark is visible the mark is decorative; otherwise it names the app.
  const markDecorative = showText;

  const mark = isWhite ? (
    <span
      className="vbrand-icon"
      role={markDecorative ? undefined : "img"}
      aria-hidden={markDecorative || undefined}
      aria-label={markDecorative ? undefined : "Verso"}
      style={{
        width: s.mark,
        height: s.mark,
        color: "#FFFFFF",
        WebkitMaskImage: `url("${monochromeMark}")`,
        maskImage: `url("${monochromeMark}")`,
      }}
    />
  ) : (
    <img
      src={coloredSrc}
      alt={markDecorative ? "" : "Verso"}
      aria-hidden={markDecorative || undefined}
      width={s.mark}
      height={s.mark}
      draggable={false}
      style={{
        display: "block",
        filter:
          "drop-shadow(0 0 10px rgba(232,179,75,0.35)) drop-shadow(0 0 7px rgba(76,199,154,0.22))",
      }}
    />
  );

  return (
    <div
      className={`flex ${
        isOnboarding ? "flex-col gap-4" : "flex-row gap-3"
      } items-center`}
    >
      {mark}
      {showText && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: s.text,
            letterSpacing: "0.01em",
            lineHeight: 1,
            color: isWhite ? "#FFFFFF" : "var(--cool-white)",
          }}
        >
          Verso
        </span>
      )}
    </div>
  );
}

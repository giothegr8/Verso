import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * PHASE 4A — THE REVIEW-COMPLETION SMILEY.
 *
 * A small, elegant, soft-green mark that draws itself once when a review
 * finalizes. This is NOT the deferred Phase 8 magical celebration: no energy
 * buildup, no treble-clef curl, no confetti, no screen-filling burst.
 *
 * Drawing order is fixed and accelerating:
 *   1. first eye   (slowest entrance)
 *   2. second eye  (slightly faster)
 *   3. mouth       (faster)
 *   4. circle      (fastest segment)
 * The closing circle triggers ONE soft pop of light, then the whole mark
 * settles into a slow breathing glow.
 *
 * FLAWLESS EASTER EGG. Only a run with both stages correct, no wrong
 * submissions, no Clues and no exhaustion winks: one eye becomes a wink, a
 * small Ember Gold star appears, and the wink morphs smoothly back. The trigger
 * is deterministic but never explained in visible copy.
 *
 * REPLAY. `play` is read ONCE at mount, so a rerender, a focus change, a
 * navigation back to the completed session, a reload after finalization or a
 * midnight rollover all render the settled end state instead of redrawing.
 *
 * ACCESSIBILITY. Purely decorative: the whole figure is aria-hidden, and the
 * Review completion screen always carries readable outcome text beside it.
 */

const TEAL = "#3E8F7B";
const TEAL_SOFT = "#4FA88F";
const EMBER = "#E8B34B";

const SMILEY_STYLE = `
.vrs-root { position: relative; display: inline-flex; }
.vrs-svg { display: block; overflow: visible; }
.vrs-part { transform-box: fill-box; transform-origin: center; }

@keyframes vrs-eye-in {
  from { opacity: 0; transform: scale(0.35); }
  60%  { opacity: 1; transform: scale(1.12); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes vrs-draw {
  from { stroke-dashoffset: var(--vrs-len); }
  to   { stroke-dashoffset: 0; }
}
@keyframes vrs-flash {
  0%   { opacity: 0;    transform: scale(0.72); }
  30%  { opacity: 0.5;  transform: scale(1.05); }
  100% { opacity: 0;    transform: scale(1.30); }
}
@keyframes vrs-breathe {
  0%, 100% { opacity: 0.30; }
  50%      { opacity: 0.58; }
}
@keyframes vrs-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes vrs-wink-dot {
  0%   { opacity: 1; }
  12%  { opacity: 0; }
  72%  { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes vrs-wink-arc {
  0%   { opacity: 0; }
  12%  { opacity: 1; }
  72%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes vrs-star {
  0%   { opacity: 0; transform: scale(0.3) rotate(-18deg); }
  25%  { opacity: 1; transform: scale(1.08) rotate(0deg); }
  70%  { opacity: 1; transform: scale(1) rotate(0deg); }
  100% { opacity: 0; transform: scale(0.72) rotate(10deg); }
}

/* ---- animated run ---- */
.vrs-anim .vrs-eye-1 { opacity: 0; animation: vrs-eye-in 720ms cubic-bezier(.22,.9,.3,1) 60ms forwards; }
.vrs-anim .vrs-eye-2 { opacity: 0; animation: vrs-eye-in 520ms cubic-bezier(.22,.9,.3,1) 800ms forwards; }
.vrs-anim .vrs-mouth { stroke-dasharray: var(--vrs-len); stroke-dashoffset: var(--vrs-len); animation: vrs-draw 380ms cubic-bezier(.4,0,.25,1) 1340ms forwards; }
.vrs-anim .vrs-ring  { stroke-dasharray: var(--vrs-len); stroke-dashoffset: var(--vrs-len); animation: vrs-draw 300ms cubic-bezier(.45,0,.2,1) 1760ms forwards; }
.vrs-anim .vrs-flash { opacity: 0; animation: vrs-flash 460ms ease-out 2040ms 1 both; }
.vrs-anim .vrs-glow  { opacity: 0; animation: vrs-fade-in 500ms ease-out 2200ms forwards, vrs-breathe 4600ms ease-in-out 2700ms infinite; }
.vrs-anim .vrs-wink-dot { animation: vrs-wink-dot 1500ms ease-in-out 2560ms 1 both; }
.vrs-anim .vrs-wink-arc { opacity: 0; animation: vrs-wink-arc 1500ms ease-in-out 2560ms 1 both; }
.vrs-anim .vrs-star     { opacity: 0; animation: vrs-star 1400ms ease-out 2660ms 1 both; }

/* ---- settled end state (no drawing: replay, or motion already spent) ---- */
.vrs-settled .vrs-eye-1,
.vrs-settled .vrs-eye-2 { opacity: 1; }
.vrs-settled .vrs-mouth,
.vrs-settled .vrs-ring  { stroke-dashoffset: 0; }
.vrs-settled .vrs-flash { opacity: 0; }
.vrs-settled .vrs-glow  { opacity: 0.42; animation: vrs-breathe 4600ms ease-in-out 0ms infinite; }
.vrs-settled .vrs-wink-dot { opacity: 1; }
.vrs-settled .vrs-wink-arc { opacity: 0; }
.vrs-settled .vrs-star     { opacity: 0; }

/* ---- reduced motion: brief opacity only, one restrained finishing glow,
        no continuous breathing, and the flawless state is communicated by a
        STABLE wink + star rather than a rapid morph ---- */
.vrs-reduced .vrs-eye-1,
.vrs-reduced .vrs-eye-2,
.vrs-reduced .vrs-mouth,
.vrs-reduced .vrs-ring { opacity: 1; transition: opacity 200ms linear; }
.vrs-reduced .vrs-mouth,
.vrs-reduced .vrs-ring { stroke-dashoffset: 0; }
.vrs-reduced .vrs-flash { opacity: 0; }
.vrs-reduced .vrs-glow  { opacity: 0.40; animation: none; }
.vrs-reduced .vrs-wink-dot { opacity: 1; }
.vrs-reduced .vrs-wink-arc { opacity: 0; }
.vrs-reduced .vrs-star     { opacity: 0; }
.vrs-reduced.vrs-flawless .vrs-wink-dot { opacity: 0; }
.vrs-reduced.vrs-flawless .vrs-wink-arc { opacity: 1; }
.vrs-reduced.vrs-flawless .vrs-star     { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .vrs-root .vrs-glow { animation: none !important; opacity: 0.40; }
  .vrs-root .vrs-flash { animation: none !important; opacity: 0 !important; }
}
`;

/** Path lengths, hardcoded so no measurement is needed before first paint. */
const MOUTH_LEN = 78;
const RING_LEN = 290;

interface ReviewSmileyProps {
  /** Flawless run: both stages correct, no wrong submissions, no Clues, no exhaustion. */
  flawless: boolean;
  /** Draw the sequence. Read once at mount and never re-read. */
  play: boolean;
  /** Fired once after a drawing run begins, so the parent can latch it spent. */
  onPlayed?: () => void;
  size?: number;
}

export default function ReviewSmiley({ flawless, play, onPlayed, size = 132 }: ReviewSmileyProps) {
  const prefersReduced = useReducedMotion();

  // Read `play` exactly once. The parent latches `smileyPlayed` immediately
  // afterwards; capturing here keeps that write from cutting the run short.
  const [shouldAnimate] = useState(() => play === true && prefersReduced !== true);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (notifiedRef.current) return;
    if (!play) return;
    notifiedRef.current = true;
    onPlayed?.();
    // `play` and `onPlayed` are intentionally the only inputs: this fires once
    // per mounted completion, never on rerender.
  }, [play, onPlayed]);

  const mode = prefersReduced ? "vrs-reduced" : shouldAnimate ? "vrs-anim" : "vrs-settled";

  return (
    <span
      className={`vrs-root ${mode}${flawless ? " vrs-flawless" : ""}`}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <style>{SMILEY_STYLE}</style>
      <svg
        className="vrs-svg"
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        focusable="false"
        aria-hidden="true"
      >
        {/* Soft settled halo — the breathing glow, never a screen flash. */}
        <circle
          className="vrs-part vrs-glow"
          cx="60"
          cy="60"
          r="47"
          fill="none"
          stroke={TEAL_SOFT}
          strokeWidth="10"
          style={{ filter: "blur(9px)" }}
        />

        {/* One soft pop of light when the circle closes. */}
        <circle
          className="vrs-part vrs-flash"
          cx="60"
          cy="60"
          r="44"
          fill={TEAL_SOFT}
          opacity="0"
          style={{ filter: "blur(11px)" }}
        />

        {/* 1. first eye */}
        <circle className="vrs-part vrs-eye-1" cx="45" cy="49" r="5.2" fill={TEAL} />

        {/* 2. second eye — the one that winks on a flawless run */}
        <circle className="vrs-part vrs-eye-2 vrs-wink-dot" cx="75" cy="49" r="5.2" fill={TEAL} />
        <path
          className="vrs-part vrs-eye-2 vrs-wink-arc"
          d="M68.6 50.6 Q75 44.4 81.4 50.6"
          stroke={TEAL}
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Ember Gold accent for the flawless wink */}
        <path
          className="vrs-part vrs-star"
          d="M90 30 L92.1 35.9 L98 38 L92.1 40.1 L90 46 L87.9 40.1 L82 38 L87.9 35.9 Z"
          fill={EMBER}
        />

        {/* 3. mouth */}
        <path
          className="vrs-part vrs-mouth"
          d="M41 70 Q60 87 79 70"
          stroke={TEAL}
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
          style={{ "--vrs-len": `${MOUTH_LEN}` } as React.CSSProperties}
        />

        {/* 4. enclosing circle */}
        <circle
          className="vrs-part vrs-ring"
          cx="60"
          cy="60"
          r="46"
          stroke={TEAL}
          strokeWidth="2.6"
          fill="none"
          style={{ "--vrs-len": `${RING_LEN}`, transform: "rotate(-90deg)" } as React.CSSProperties}
        />
      </svg>
    </span>
  );
}

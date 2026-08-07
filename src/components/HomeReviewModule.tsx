import React, { useMemo } from "react";
import { AppState } from "../types";
import { QueueRow, scopeLanguages, selectReviewQueue } from "../utils/reviewQueue";
import { parseIso } from "../utils/reviewSchedule";
import { formatLocalizedReference } from "../utils/verseUtils";
import { relativeDueLabel, reviewCopy } from "../data/reviewCopy";

/**
 * PHASE 4A — THE HOME REVIEW CARD.
 *
 * A sibling of the Tip card, not a dashboard. It borrows that card's exact
 * grammar — the same Deep Slate surface, the same hairline border, the same
 * 18px radius and padding, the same centred illustration on the left, and the
 * same title-over-description hierarchy on the right — so the two read as one
 * family rather than as a coach card sitting next to a queue widget.
 *
 * Earlier iterations drifted: repeated droplet bullets beside every reference,
 * uppercase display copy, reference typography borrowed from the Review screen,
 * and a permanent green glow no other Home card carried. All of that is gone.
 * What remains is one illustration, one sentence-case title, and up to two
 * quiet references.
 *
 * COLOUR. Verdant Teal marks Review's identity — the eyebrow, the numeral, the
 * ripple line, and the hover/focus/press emphasis — but never as a resting
 * glow. The droplet alone borrows the cool `--dusk` cyan-blue: it is a literal
 * water cue, not a claim that Review is a Paths-coloured section. At rest the
 * card is neutral dark glass with a neutral border, exactly like the Tip card.
 */

const EYEBROW =
  "font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em]";

const VERDANT = "#3E8F7B";
/** Restrained Verdant glow — hover, focus and press ONLY, never at rest. */
const VERDANT_GLOW =
  "inset 0 0 14px rgba(62,143,123,0.10), 0 0 18px -4px rgba(62,143,123,0.28)";

/** Home previews at most this many due passages; the screen shows the rest. */
const HOME_PREVIEW_LIMIT = 2;

/**
 * THE TENDING ILLUSTRATION.
 *
 * One droplet descending toward one short ripple line — the same visual
 * footprint as the Tip card's sprout, vertically centred beside the text.
 * Deliberately not a sprout, seedling, flower or bloom: the Tip card directly
 * below already carries a plant, and two plants would compete. No watering can,
 * basket, shovel or flowerpot; no enclosing circle; no filled illustration.
 *
 * The droplet strokes the locked `--dusk` cyan-blue via the token rather than a
 * copied hex, so it follows the design system if that value moves; `--dusk` is
 * documented as an atmospheric colour that is never a fill, and a thin stroke
 * respects that. The ripple line is Verdant, keeping Review's identity in the
 * mark itself.
 *
 * MOTION. One entrance, once: the droplet settles a few pixels and the ripple
 * brightens. There is a single illustration now, so nothing cascades and no row
 * animation delays reading.
 */
const TENDING_STYLE = `
.vtend { display: inline-flex; flex: 0 0 auto; }
.vtend-part { transform-box: fill-box; transform-origin: center; }

@keyframes vtend-settle {
  0%   { transform: translateY(-3px); opacity: 0.38; }
  62%  { transform: translateY(0.5px); opacity: 1; }
  100% { transform: translateY(0);     opacity: 1; }
}
@keyframes vtend-ripple {
  0%   { opacity: 0.32; }
  55%  { opacity: 1; }
  100% { opacity: 0.7; }
}

.vtend-drop   { animation: vtend-settle 620ms cubic-bezier(.32,.85,.4,1) 140ms 1 both; }
.vtend-ground { animation: vtend-ripple 620ms ease-out 400ms 1 both; }

@media (prefers-reduced-motion: reduce) {
  .vtend-drop,
  .vtend-ground {
    animation: none !important;
    transform: none !important;
    opacity: 1;
  }
  .vtend-ground { opacity: 0.7; }
}
`;

function TendingIllustration({ size = 34 }: { size?: number }) {
  return (
    <span className="vtend" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 34 34"
        fill="none"
        focusable="false"
        aria-hidden="true"
      >
        <path
          className="vtend-part vtend-drop"
          d="M17 5C17 5 10.8 12.4 10.8 16.5a6.2 6.2 0 0 0 12.4 0C23.2 12.4 17 5 17 5Z"
          stroke="var(--dusk)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          className="vtend-part vtend-ground"
          d="M7.6 28.4C11.2 30.2 22.8 30.2 26.4 28.4"
          stroke={VERDANT}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

interface HomeReviewModuleProps {
  state: AppState;
  /** Supplied by the app's controlled refresh, never a live ticking clock. */
  nowMs: number;
  onOpenReview: () => void;
}

export default function HomeReviewModule({ state, nowMs, onOpenReview }: HomeReviewModuleProps) {
  const isEs = state.primaryLanguage === "es";
  const lang = isEs ? "es" : "en";

  const queue = useMemo(() => selectReviewQueue(state, nowMs), [state, nowMs]);

  // No acquired passage yet: show nothing rather than an empty module.
  if (queue.totalAcquired === 0) return null;

  /**
   * DATA-DRIVEN BILINGUAL REFERENCES.
   *
   * The passage's SAVED REVIEW SCOPE decides what is shown; the interface
   * language decides the order. A passage learned in one language is never
   * dressed up as bilingual merely because the app supports both:
   *
   *   bilingual, English UI -> "Hebrews / Hebreos 11:1"
   *   bilingual, Spanish UI -> "Hebreos / Hebrews 11:1"
   *   English-only          -> "Hebrews 11:1"   (either interface)
   *   Spanish-only          -> "Hebreos 11:1"   (either interface)
   */
  const referenceFor = (row: QueueRow) =>
    formatLocalizedReference(
      row.passage.verse.book,
      row.passage.verse.chapter,
      row.passage.verse.verse,
      scopeLanguages(row.scope, isEs ? "es" : "en")
    );

  const hasDue = queue.totalDue > 0;
  // The existing deterministic queue order, sliced — never a second Home rule.
  const previewRows = queue.due.slice(0, HOME_PREVIEW_LIMIT);
  const remaining = queue.totalDue - previewRows.length;

  /**
   * The Tip card's surface, verbatim, wrapped in a real button.
   *
   * At rest: neutral hairline border, neutral dark glass, NO glow. Verdant
   * arrives only on hover, keyboard focus or press. The hover glow is a utility
   * class rather than an inline box-shadow ON PURPOSE — the unlayered
   * :focus-visible rule outranks every layer but NOT an inline style, so an
   * inline shadow would silently delete the keyboard focus ring. `--v-glow`
   * lets the ring and the Verdant glow compose on focus.
   */
  const cardClass =
    "w-full bg-deep-slate border border-(--line) rounded-[18px] p-[18px] md:p-6 " +
    "flex items-center gap-3.5 text-left min-h-11 " +
    "transition-colors duration-200 " +
    "hover:border-[rgba(62,143,123,0.55)] " +
    "hover:shadow-[inset_0_0_14px_rgba(62,143,123,0.10),0_0_18px_-4px_rgba(62,143,123,0.28)] " +
    "focus-visible:border-[rgba(62,143,123,0.55)] " +
    "active:border-[rgba(62,143,123,0.75)]";

  return (
    <section className="flex flex-col gap-2.5">
      <style>{TENDING_STYLE}</style>

      <h2 className={EYEBROW} style={{ color: VERDANT }}>
        {reviewCopy.title(lang)}
      </h2>

      <button
        id="home-review-control"
        type="button"
        onClick={onOpenReview}
        aria-label={reviewCopy.openReviewLabel(lang)}
        className={cardClass}
        style={{ "--v-glow": VERDANT_GLOW } as React.CSSProperties}
      >
        {/* Always present, in every state. The droplet and ripple represent
            ongoing care, not an overdue alarm — a caught-up garden is still a
            tended one, so hiding it there made the card read as a different
            kind of thing. No substitute icon is used for the empty state. */}
        <TendingIllustration />

        <span className="flex-1 min-w-0 flex flex-col gap-1">
          {hasDue ? (
            <>
              {/* Title — the Tip title's exact role: Hanken 15px semibold Cool
                  White, sentence case. Only the numeral carries Verdant, and
                  the full title is never display-size Fraunces. */}
              <span className="font-hanken text-[15px] font-semibold text-cool-white leading-snug break-words">
                <span style={{ color: VERDANT }}>{queue.totalDue}</span>{" "}
                {reviewCopy.toTendPhrase(queue.totalDue, lang)}
              </span>

              {/* References — the Tip description's treatment, subordinate to
                  the title, one per line, no bullets, nothing truncated. */}
              <span className="font-hanken text-base text-cold-grey leading-snug flex flex-col gap-0.5">
                {previewRows.map(row => (
                  <span key={row.passage.passageKey} className="min-w-0 break-words">
                    {referenceFor(row)}
                  </span>
                ))}

                {remaining > 0 && (
                  <span className="text-faint">{reviewCopy.moreCount(remaining, lang)}</span>
                )}
              </span>
            </>
          ) : (
            <>
              {/* Caught up. Same neutral card family and the same tending
                  illustration as the due state — no streak, badge or trophy. */}
              <span className="font-hanken text-[15px] font-semibold text-cool-white leading-snug break-words">
                {reviewCopy.caughtUpTitle(lang)}
              </span>

              {queue.nextUpcoming && (
                <span className="font-hanken text-base text-cold-grey leading-snug min-w-0 break-words">
                  {reviewCopy.nextUpPrefix(lang)}{" "}
                  {referenceFor(queue.nextUpcoming)}
                  {" · "}
                  {relativeDueLabel(
                    parseIso(queue.nextUpcoming.record.nextReviewAt, nowMs),
                    nowMs,
                    lang
                  )}
                </span>
              )}
            </>
          )}
        </span>
      </button>
    </section>
  );
}

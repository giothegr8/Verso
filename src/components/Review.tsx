import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { AppState, MemorizeLanguage, ReviewScope, ReviewSource } from "../types";
import {
  AcquiredPassage,
  QueueRow,
  collectAcquiredPassages,
  daysOverdue,
  scopeLanguages,
  selectReviewQueue,
} from "../utils/reviewQueue";
import { parseIso } from "../utils/reviewSchedule";
import { formatLocalizedReference } from "../utils/verseUtils";
import {
  dueNowLabel,
  masteryLabel,
  reasonLabel,
  relativeDueLabel,
  reviewCopy,
} from "../data/reviewCopy";
import { BrandIcon, Button } from "./ui";
import ReviewSmiley from "./ReviewSmiley";

/**
 * PHASE 4A — THE REVIEW SCREEN.
 *
 * Reached from the compact Home module; deliberately NOT a permanent
 * navigation tab in this phase. It consumes the single queue calculation and
 * adds no scheduling logic of its own.
 *
 * There is no drag-to-reorder, no snooze, no permanent dismissal, no filters
 * and no numeric priority score — the order is explained in words, not ranked
 * with a number.
 */

const CARD = "bg-deep-slate border border-(--line) rounded-[18px] p-[18px] md:p-6";
/**
 * Upcoming cards carry two short lines and one action row, so the full card
 * padding left a visible pocket beneath the actions at 375x667. Same surface,
 * same radius, same restrained border — just wrapped closer to its content.
 * Due rows keep `CARD` untouched.
 */
const UPCOMING_CARD = "bg-deep-slate border border-(--line) rounded-[18px] p-[14px] md:p-4";
const EYEBROW =
  "font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] text-faint";
/** Section P: Fraunces owns references and meaningful numerals. */
const ROW_REF = "font-fraunces text-[1.05rem] font-medium text-cool-white leading-snug break-words";

/**
 * PRODUCT-FAMILY ACCENT. Review belongs to the Memorize family, so it inherits
 * the locked Memorize Verdant Teal identity rather than the shell's Royal.
 * Applied exactly as Memorize applies it to its own section eyebrow.
 *
 * Verdant marks IDENTITY only — the section label, the highlighted numeral and
 * the primary control. Passage cards stay neutral dark glass, body copy stays
 * Cool White / Cold Grey, rose stays reserved for real difficulty, and Ember
 * stays reserved for earned gold. Nothing here is green merely because it can
 * be, and colour is never the only indicator of a state.
 */
const VERDANT = "#3E8F7B";
/** Restrained Verdant glow for the primary control's focus-ring composition. */
const VERDANT_GLOW =
  "inset 0 0 14px rgba(62,143,123,0.14), 0 0 18px -4px rgba(62,143,123,0.34)";

/** Mobile-first due-queue cap. Each `Show 5 more` reveals the next five. */
const PAGE_SIZE = 5;

interface ReviewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  /** Controlled clock: refreshed at defined moments, never second by second. */
  nowMs: number;
  onLaunchReview: (
    passageKey: string,
    source: ReviewSource,
    practiceLanguage?: MemorizeLanguage
  ) => void;
  onGoHome: () => void;
  /** Recomputes eligibility; called once when this screen opens. */
  onRefresh: () => void;
}

export default function Review({
  state,
  setState,
  nowMs,
  onLaunchReview,
  onGoHome,
  onRefresh,
}: ReviewProps) {
  const isEs = state.primaryLanguage === "es";
  const lang: "es" | "en" = isEs ? "es" : "en";

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  // THE ONE bilingual choice. It carries the row AND the source it was opened
  // from, so a single modal serves every entry point. Session-scoped only —
  // there is deliberately no "remember this" affordance; a permanent scope
  // setting belongs to passage settings in a later phase.
  const [practiceChoice, setPracticeChoice] =
    useState<{ row: QueueRow; source: ReviewSource } | null>(null);
  const practiceRow = practiceChoice?.row ?? null;
  const practiceTriggerRef = useRef<HTMLElement | null>(null);
  const practiceDialogRef = useRef<HTMLDivElement | null>(null);

  const openPracticeChoice = (
    row: QueueRow,
    source: ReviewSource,
    trigger: HTMLElement | null
  ) => {
    practiceTriggerRef.current = trigger;
    setPracticeChoice({ row, source });
  };

  /**
   * THE ONE LAUNCH ROUTER — used by every entry point.
   *
   * A monolingual passage has nothing to choose, so it launches directly. A
   * bilingual passage always opens the same choice first, because "review this"
   * could mean either language or both. `source` distinguishes a due review
   * ("queue") from early practice ("practice"); it is carried into the modal so
   * "Practice both" resolves correctly for either case.
   */
  const routeLaunch = (
    row: QueueRow,
    source: ReviewSource,
    trigger: HTMLElement | null
  ) => {
    if (row.scope === "bilingual") {
      openPracticeChoice(row, source, trigger);
      return;
    }
    onLaunchReview(row.passage.passageKey, source);
  };

  /** Compact plain-text action: no pill, no border, no fill, no glow. The 44px
   *  target is preserved by padding, and the negative margin reclaims only the
   *  visual height so the card can wrap closely around its content. */
  const COMPACT_ACTION =
    "shrink-0 min-h-11 py-2 -my-2 font-hanken text-[11px] font-semibold uppercase " +
    "tracking-widest text-royal-soft hover:text-cool-white transition-colors";
  const closePracticeChoice = () => {
    setPracticeChoice(null);
    // Focus returns to the control that opened the dialog.
    const trigger = practiceTriggerRef.current;
    practiceTriggerRef.current = null;
    if (trigger) requestAnimationFrame(() => trigger.focus());
  };

  // Move focus into the dialog when it opens, and close it on Escape.
  useEffect(() => {
    if (!practiceRow) return;
    const node = practiceDialogRef.current;
    const first = node?.querySelector<HTMLButtonElement>("button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePracticeChoice();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [practiceRow]);

  // Section T: refresh queue eligibility when the Review screen opens. Once.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    onRefresh();
  }, [onRefresh]);

  const queue = useMemo(() => selectReviewQueue(state, nowMs), [state, nowMs]);

  /**
   * The SAVED SCOPE decides which references are shown; the interface language
   * decides their order. A monolingual passage never shows both languages
   * merely because the app supports bilingual mode.
   */
  const referenceForScope = (passage: AcquiredPassage, scope: ReviewScope) =>
    formatLocalizedReference(
      passage.verse.book,
      passage.verse.chapter,
      passage.verse.verse,
      scopeLanguages(scope, isEs ? "es" : "en")
    );
  const referenceForPassage = (passage: AcquiredPassage) =>
    referenceForScope(passage, passage.learnedScope);
  const referenceFor = (row: QueueRow) => referenceForScope(row.passage, row.scope);

  const scopeLabelFor = (row: QueueRow) => reviewCopy.scopeLabel(row.scope, lang);

  /**
   * THE ONE ROW-TIMING RULE.
   *
   * A row is classified due and labelled from the SAME captured `nowMs`, so
   * the two can never disagree. Anything at or past its due instant reads
   * "Time To Tend"; only a genuinely future instant gets relative wording.
   *
   * The earlier defect lived here: an already-overdue row was routed into the
   * future-relative formatter, whose `Math.max(0, dueMs - nowMs)` clamp and
   * one-minute floor turned every past instant into "in 1 minute".
   */
  const rowTimingLabel = (row: QueueRow) => {
    const dueMs = parseIso(row.record.nextReviewAt, nowMs);
    if (dueMs <= nowMs) return dueNowLabel(lang);
    return relativeDueLabel(dueMs, nowMs, lang);
  };

  const completion = state.lastReviewCompletion || null;

  // -------------------------------------------------------------------------
  // Completion screen
  // -------------------------------------------------------------------------
  if (completion) {
    // Resolve the reference from the FULL acquired set, not from the rendered
    // queue: a just-finalized passage is usually neither due nor inside the
    // five-row Upcoming slice, and the completion screen must still show its
    // localized reference rather than the raw canonical key.
    const finishedPassage =
      collectAcquiredPassages(state).find(p => p.passageKey === completion.passageKey) || null;

    const reference = finishedPassage
      ? referenceForPassage(finishedPassage)
      : completion.passageKey;

    const markSmileyPlayed = () => {
      setState(s => {
        const current = s.lastReviewCompletion;
        if (!current || current.sessionId !== completion.sessionId) return s;
        if (current.smileyPlayed) return s;
        return { ...s, lastReviewCompletion: { ...current, smileyPlayed: true } };
      });
    };

    const clearCompletion = () => {
      setState(s => (s.lastReviewCompletion ? { ...s, lastReviewCompletion: null } : s));
    };

    // The REFRESHED queue: the completed passage has already finalized, so its
    // record now carries a future due time and it only reappears here if it is
    // genuinely still due. `queue.next` is the same deterministic top-priority
    // row the rest of the feature uses — no completion-specific ordering.
    const hasNext = queue.totalDue > 0;
    const isPractice = completion.isPractice === true;
    const practiceLang: MemorizeLanguage = completion.practiceLanguage === "es" ? "es" : "en";
    const outcomeLines = isPractice
      ? {
          line1: reviewCopy.practicedInLanguage(practiceLang, lang),
          line2: reviewCopy.bilingualStillWaiting(lang),
        }
      : reviewCopy.completionOutcomeLines(completion.outcome, lang);

    return (
      // One connected vertical composition. The uniform 28px gaps and 32px
      // padding left empty islands at short mobile heights; the card and the
      // actions now sit noticeably closer to the copy they belong to, with no
      // justify-between, no min-height and no spacer elements.
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[620px] mx-auto flex flex-col items-center gap-5 py-6 text-center"
      >
        <ReviewSmiley
          // A practice session never advanced mastery, so it never shows the
          // flawless wink or the Ember Gold star — the same settled smile only.
          flawless={!isPractice && completion.flawless}
          play={!completion.smileyPlayed}
          onPlayed={markSmileyPlayed}
        />

        <div className="flex flex-col gap-2 px-2">
          <h1 className="font-fraunces text-[1.9rem] sm:text-[2.2rem] font-medium text-cool-white leading-tight">
            {isPractice
              ? reviewCopy.practiceCompleteTitle(lang)
              : reviewCopy.completionTitle(lang)}
          </h1>
          <p className="font-fraunces text-[1.15rem] text-cool-white/90 leading-snug break-words">
            {reference}
          </p>
          {/* Two centred blocks, no terminal periods — never a run-on
              paragraph and never a single mixed-alignment sentence. */}
          <div className="flex flex-col gap-1 mt-1">
            <p className="font-hanken text-[15px] text-cool-white leading-relaxed max-w-sm mx-auto">
              {outcomeLines.line1}
            </p>
            <p className="font-hanken text-[15px] text-cold-grey leading-relaxed max-w-sm mx-auto">
              {outcomeLines.line2}
            </p>
          </div>
        </div>

        {/* ONE information card, and its content depends on what the user can
            actually do next. No mastery label, no exact date, no clock time,
            and never a raw administrative list of scheduling metadata.
            A practice session shows no card at all: nothing was scheduled, and
            the outcome copy already says the bilingual review is still waiting
            — an UP NEXT card pointing back at the same passage would only
            restate the primary action beneath it. */}
        {!isPractice && (
        <div className={`${CARD} w-full flex flex-col gap-2 text-left`}>
          {hasNext && queue.next ? (
            <>
              {/* Something is ready RIGHT NOW, so the card points at it rather
                  than at when the finished passage returns — telling someone to
                  "come back later" while another passage waits is confusing. */}
              <p className={EYEBROW}>{reviewCopy.upNextEyebrow(lang)}</p>
              <p className="font-fraunces text-[1.05rem] font-medium text-cool-white leading-snug break-words">
                {referenceFor(queue.next)}
              </p>
              <p role="status" className="font-hanken text-[13px] text-cold-grey">
                {reviewCopy.stillDue(queue.totalDue, lang)}
              </p>
            </>
          ) : (
            <>
              {/* Nothing else is waiting, so the card explains when THIS passage
                  comes back — as a safely rounded relative duration read from
                  the exact persisted timestamp, which is never modified. */}
              <p className={EYEBROW}>{reviewCopy.caughtUpTitle(lang)}</p>
              <p role="status" className="font-hanken text-[13px] text-cold-grey">
                {reviewCopy.completionReturnLabel(
                  parseIso(completion.nextReviewAt, nowMs),
                  nowMs,
                  lang
                )}
              </p>
            </>
          )}
        </div>
        )}

        <div className="w-full flex flex-col gap-3 px-2">
          {isPractice ? (
            <>
              {/* Starts the NORMAL saved-scope review. Rendering this screen
                  scheduled nothing and finalized nothing — the bilingual record
                  is untouched and the passage is still due. */}
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  const key = completion.passageKey;
                  clearCompletion();
                  onLaunchReview(key, "queue");
                }}
              >
                {reviewCopy.completeBilingualReview(lang)}
              </Button>
              <Button variant="secondary" className="w-full" onClick={clearCompletion}>
                {reviewCopy.backToReview(lang)}
              </Button>
            </>
          ) : hasNext ? (
            <>
              <Button
                variant="primary"
                className="w-full"
                // Same routing rule as the queue screen: a bilingual next
                // passage opens the choice modal rather than launching.
                onClick={e => {
                  const next = queue.next;
                  if (!next) return;
                  clearCompletion();
                  routeLaunch(next, "queue", e.currentTarget);
                }}
              >
                {reviewCopy.reviewNext(lang)}
              </Button>
              <Button variant="secondary" className="w-full" onClick={clearCompletion}>
                {reviewCopy.backToReview(lang)}
              </Button>
            </>
          ) : (
            // Nothing is due any more, so the primary action returns to the
            // caught-up Review state rather than pretending there is a next one.
            <Button variant="primary" className="w-full" onClick={clearCompletion}>
              {reviewCopy.backToReview(lang)}
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state — no acquired passages at all
  // -------------------------------------------------------------------------
  if (queue.totalAcquired === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[620px] mx-auto flex flex-col gap-6"
      >
        <h1 className={EYEBROW} style={{ color: VERDANT }}>
          {reviewCopy.title(lang)}
        </h1>
        <div className={`${CARD} flex flex-col gap-5`}>
          <p className="font-fraunces text-[1.35rem] font-medium text-cool-white leading-snug">
            {reviewCopy.emptyNoPassagesTitle(lang)}
          </p>
          <Button
            variant="primary"
            className="w-full sm:w-auto sm:self-start"
            leftIcon={<BrandIcon name="ui-search" size={16} />}
            onClick={onGoHome}
          >
            {reviewCopy.emptyNoPassagesAction(lang)}
          </Button>
        </div>
      </motion.div>
    );
  }

  const visibleDue = queue.due.slice(0, visibleCount);
  const hasMore = queue.due.length > visibleDue.length;

  // -------------------------------------------------------------------------
  // Queue
  // -------------------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-[620px] mx-auto flex flex-col gap-6 md:gap-7"
    >
      {/* HEADER — exactly one due-count statement.
          Order: eyebrow, compact due count, then the passage cards. The former
          large Fraunces hero heading restated the very count the compact line
          already carries, so it is gone rather than restyled. */}
      <header className="flex flex-col gap-1.5">
        <h1 className={EYEBROW} style={{ color: VERDANT }}>
          {reviewCopy.title(lang)}
        </h1>

        {/* Verso's highlighted-count language: the numeral alone is accented
            and a step larger (Fraunces); the words stay Hanken on the existing
            restrained tracked label. Compact — never a second page title. */}
        <p className="flex items-baseline gap-1.5">
          <span
            className="font-fraunces text-[15px] font-medium leading-none"
            style={{ color: VERDANT }}
          >
            {queue.totalDue}
          </span>
          <span className="font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] leading-none text-cold-grey">
            {reviewCopy.dueCountWords(queue.totalDue, lang)}
          </span>
        </p>

        {/* Next scheduled passage, only when it adds something the caught-up
            card below is not already saying. */}
        {queue.totalDue > 0 && queue.nextUpcoming && (
          <p role="status" className="font-hanken text-[13px] text-cold-grey">
            {reviewCopy.nextUpAt(
              relativeDueLabel(
                parseIso(queue.nextUpcoming.record.nextReviewAt, nowMs),
                nowMs,
                lang
              ),
              lang
            )}
          </p>
        )}
      </header>

      {/* Due queue — directly beneath the header, per the approved order. */}
      {visibleDue.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
            {visibleDue.map(row => {
              const reference = referenceFor(row);
              const overdue = daysOverdue(row.record, nowMs);
              const reason = reasonLabel(row.record, overdue, lang);
              const mastery = masteryLabel(row.record.reviewLevel, lang);
              return (
                <li key={row.passage.passageKey}>
                  <button
                    type="button"
                    onClick={e => routeLaunch(row, "queue", e.currentTarget)}
                    aria-label={reviewCopy.reviewRowLabel(reference, reason, mastery, lang)}
                    className={`${CARD} w-full min-h-11 text-left flex flex-col gap-2 transition-colors hover:border-(--rim-royal)`}
                  >
                    <span className={ROW_REF}>{reference}</span>
                    {/* The due reason was removed from here: the card already
                        states it in the bottom TIME TO TEND label, and saying it
                        twice made the card read as two competing messages. It
                        survives in the row's accessible name below.
                        The mastery segment carries its OWN trailing separator,
                        so a level with no label (level zero has none) drops the
                        pair together and leaves no doubled or dangling dot:
                          level 0  ->  "English review"
                          level 1+ ->  "Taking root · Bilingual review" */}
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-hanken text-[12px] text-cold-grey">
                      {mastery && (
                        <>
                          <span>{mastery}</span>
                          <span aria-hidden="true" className="text-faint">·</span>
                        </>
                      )}
                      <span>{scopeLabelFor(row)}</span>
                    </span>
                    <span className="font-hanken text-[11px] uppercase tracking-[0.18em] text-faint">
                      {rowTimingLabel(row)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <Button
              variant="text"
              className="self-start text-[11px] uppercase tracking-widest"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            >
              {reviewCopy.showMore(lang)}
            </Button>
          )}
        </section>
      )}

      {/* PRIMARY ACTION — below every rendered due card and below Show more,
          immediately before Upcoming. Restrained glass, never sticky, never
          duplicated at the top, never a saturated fill. When nothing is due it
          is replaced in this same slot by the caught-up card, because a
          "Review next" that cannot launch anything would be a dead control. */}
      {queue.totalDue > 0 && queue.next ? (
        // Dark-glass interior from `vbtn--secondary` with a restrained Verdant
        // rim, glow and label layered on as Tailwind utilities. The glow is a
        // utility rather than an inline box-shadow ON PURPOSE: the unlayered
        // :focus-visible rule outranks every layer but NOT an inline style, so
        // an inline box-shadow here would silently delete the keyboard focus
        // ring. `--v-glow` is passed inline so the ring composes with the glow.
        <Button
          id="review-next-primary"
          variant="secondary"
          className="w-full sm:w-auto sm:self-start border-[rgba(62,143,123,0.55)] text-[#3E8F7B] shadow-[inset_0_0_14px_rgba(62,143,123,0.14),0_0_18px_-4px_rgba(62,143,123,0.34)] hover:border-[rgba(62,143,123,0.85)]"
          style={{ "--v-glow": VERDANT_GLOW } as React.CSSProperties}
          leftIcon={<BrandIcon name="ui-memorize" size={16} />}
          // Reads the saved scope of the ACTUAL highest-priority due row, so a
          // bilingual next passage opens the same choice modal for that exact
          // passage. No reordering, no second routing system.
          onClick={e => routeLaunch(queue.next!, "queue", e.currentTarget)}
        >
          {reviewCopy.reviewNext(lang)}
        </Button>
      ) : (
        <div className={`${CARD} flex flex-col gap-4`}>
          <p className="font-fraunces text-[1.35rem] font-medium text-cool-white leading-snug">
            {reviewCopy.caughtUpTitle(lang)}
          </p>
          {/* Message and action share one compact row, so the action sits
              close to what it acts on rather than as a detached full-width
              block beneath it. */}
          {queue.nextUpcoming && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 font-hanken text-[14px] text-cold-grey leading-relaxed">
                {reviewCopy.caughtUpBody(
                  referenceFor(queue.nextUpcoming),
                  relativeDueLabel(
                    parseIso(queue.nextUpcoming.record.nextReviewAt, nowMs),
                    nowMs,
                    lang
                  ),
                  lang
                )}
              </p>
              <button
                type="button"
                onClick={e => routeLaunch(queue.nextUpcoming!, "practice", e.currentTarget)}
                className={COMPACT_ACTION}
              >
                {reviewCopy.practiceNow(lang)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upcoming — collapsed, visually and logically separate from the queue */}
      {queue.upcoming.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setUpcomingOpen(o => !o)}
            aria-expanded={upcomingOpen}
            aria-controls="review-upcoming-list"
            className="min-h-11 flex items-center justify-between gap-3 text-left"
          >
            <span className={EYEBROW}>{reviewCopy.upcoming(lang)}</span>
            <span className="font-hanken text-[11px] uppercase tracking-widest text-royal-soft">
              {upcomingOpen ? (isEs ? "ocultar" : "hide") : (isEs ? "ver" : "show")}
            </span>
          </button>

          {upcomingOpen && (
            <ul id="review-upcoming-list" className="flex flex-col gap-2.5 list-none p-0 m-0">
              {queue.upcoming.map(row => {
                const reference = referenceFor(row);
                const when = relativeDueLabel(
                  parseIso(row.record.nextReviewAt, nowMs),
                  nowMs,
                  lang
                );
                return (
                  <li key={row.passage.passageKey} className={`${UPCOMING_CARD} flex flex-col gap-1.5`}>
                    <span className={ROW_REF}>{reference}</span>
                    {/* Scope and timing only. The mastery description was
                        removed: it competed with the two facts that actually
                        decide whether to practise now, and `reviewLevel` is
                        still persisted and still shown on due rows. */}
                    {/* ONE compact footer row: metadata left, the single
                        practice action right. Wraps cleanly at narrow widths
                        without truncating the scope or the timing. */}
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 font-hanken text-[12px] text-cold-grey">
                        {scopeLabelFor(row)} · {when}
                      </span>
                      <button
                        type="button"
                        aria-label={reviewCopy.practiceRowLabel(reference, when, lang)}
                        onClick={e => routeLaunch(row, "practice", e.currentTarget)}
                        className={COMPACT_ACTION}
                      >
                        {reviewCopy.practiceNow(lang)}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* SINGLE-LANGUAGE PRACTICE CHOICE.
          Compact dark glass on the app's existing modal vocabulary — no new
          package, no routing framework. Semantic buttons, an accessible title,
          Escape to close, focus moved in on open and restored to the trigger on
          close, and readable text rather than colour alone. The choice applies
          to THIS session only: there is no "remember this" affordance, because
          a permanent scope setting is deliberately deferred. */}
      {practiceChoice && practiceRow && (() => {
        const source = practiceChoice.source;
        return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-[rgba(8,11,16,0.60)] backdrop-blur-[3px]"
            onClick={closePracticeChoice}
            aria-hidden="true"
          />
          <div
            ref={practiceDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-practice-title"
            aria-describedby="review-practice-body"
            className="relative z-10 w-full max-w-sm bg-deep-slate border border-(--line) rounded-[24px] shadow-verso-modal p-6 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <h2
                id="review-practice-title"
                className="font-fraunces text-[1.25rem] font-medium text-cool-white leading-snug"
              >
                {reviewCopy.chooseHowToPractice(lang)}
              </h2>
              <p
                id="review-practice-body"
                className="font-hanken text-[14px] text-cold-grey leading-relaxed"
              >
                {reviewCopy.practiceChoiceBody(lang)}
              </p>
              {/* The passage being chosen for, centred beneath the supporting
                  sentence so the two options below read as a pair. */}
              <p className="text-center font-fraunces text-[1rem] text-cool-white/90 leading-snug break-words">
                {referenceForScope(practiceRow.passage, "bilingual")}
              </p>
            </div>

            {/* Fixed order: English only, Spanish only, both, cancel.
                The two "only" options run SUBSET practice, which can never
                satisfy the bilingual due review; "both" runs the ordinary full
                bilingual early-practice path with no practice language, so it
                keeps its existing behaviour unchanged. */}
            <div className="flex flex-col gap-2.5">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const key = practiceRow.passage.passageKey;
                  setPracticeChoice(null);
                  practiceTriggerRef.current = null;
                  onLaunchReview(key, "practice", "en");
                }}
              >
                {reviewCopy.practiceEnglishOnly(lang)}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const key = practiceRow.passage.passageKey;
                  setPracticeChoice(null);
                  practiceTriggerRef.current = null;
                  onLaunchReview(key, "practice", "es");
                }}
              >
                {reviewCopy.practiceSpanishOnly(lang)}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const key = practiceRow.passage.passageKey;
                  setPracticeChoice(null);
                  practiceTriggerRef.current = null;
                  // A DUE bilingual passage runs its normal qualifying review;
                  // an Upcoming or caught-up one runs full bilingual early
                  // practice. Either way no practice language is passed, so the
                  // session covers both languages — and `wasDueAtStart`, captured
                  // from the row's real due state, still governs anti-farming.
                  onLaunchReview(key, source);
                }}
              >
                {reviewCopy.practiceBoth(lang)}
              </Button>
              <Button variant="text" className="w-full" onClick={closePracticeChoice}>
                {reviewCopy.cancel(lang)}
              </Button>
            </div>
          </div>
        </div>
        );
      })()}
    </motion.div>
  );
}

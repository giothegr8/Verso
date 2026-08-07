import { ReviewOutcome, ReviewRecord, ReviewScope, UnresolvedStage } from "../types";

/**
 * PHASE 4A — THE PURE SCHEDULING ENGINE.
 *
 * Every function in this file is pure: same inputs, same output, no React, no
 * storage, no `Date` mutation, no reads of the ambient clock. The caller
 * supplies `now` / `completedAt` as an epoch millisecond value, which is what
 * makes the whole engine inspectable without a test runner (none exists in this
 * repository, and Phase 4A is forbidden from installing one).
 *
 * DAYLIGHT SAVING. Intervals are fixed millisecond durations added to an
 * ABSOLUTE epoch instant. Nothing here constructs a calendar day, sets a field
 * on a Date, or crosses a local-midnight boundary, so a DST shift cannot make a
 * "12 hour" interval 11 or 13 hours. Local-timezone rendering happens only in
 * the copy layer, never in this math.
 */

export const MIN_REVIEW_LEVEL = 0;
export const MAX_REVIEW_LEVEL = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The eight approved durations. Nothing schedules outside this set. */
export const REVIEW_INTERVALS_MS = {
  fourHours: 4 * HOUR_MS,
  twelveHours: 12 * HOUR_MS,
  oneDay: DAY_MS,
  threeDays: 3 * DAY_MS,
  sevenDays: 7 * DAY_MS,
  fourteenDays: 14 * DAY_MS,
  thirtyDays: 30 * DAY_MS,
  sixtyDays: 60 * DAY_MS,
} as const;

/**
 * Interval owned by each mastery level, applied on a clean success that lands
 * ON the level. Level 0 never schedules from this table: a level-0 passage is
 * immediately due and can only leave 0 by advancing to 1.
 */
export const LEVEL_INTERVAL_MS: Record<number, number> = {
  1: REVIEW_INTERVALS_MS.oneDay,
  2: REVIEW_INTERVALS_MS.threeDays,
  3: REVIEW_INTERVALS_MS.sevenDays,
  4: REVIEW_INTERVALS_MS.fourteenDays,
  5: REVIEW_INTERVALS_MS.thirtyDays,
};

/** A clean success while ALREADY at the top level stays at 5 and waits 60 days. */
export const LEVEL_FIVE_REPEAT_MS = REVIEW_INTERVALS_MS.sixtyDays;

/** Coerces any persisted value into the legal 0-5 range. */
export function clampReviewLevel(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_REVIEW_LEVEL;
  const floored = Math.floor(n);
  if (floored < MIN_REVIEW_LEVEL) return MIN_REVIEW_LEVEL;
  if (floored > MAX_REVIEW_LEVEL) return MAX_REVIEW_LEVEL;
  return floored;
}

/** Epoch ms -> timezone-safe ISO instant. */
export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * ISO -> epoch ms, with an explicit fallback. A malformed persisted timestamp
 * can never produce NaN arithmetic downstream.
 */
export function parseIso(value: string | null | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : fallbackMs;
}

/** True when the value is a parseable ISO instant. */
export function isValidIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export const REVIEW_OUTCOMES: ReviewOutcome[] = [
  "never_reviewed",
  "clean_success",
  "recovered_success",
  "recall_exhausted",
  "citation_exhausted",
  "both_exhausted",
  "incomplete",
];

export const UNRESOLVED_STAGES: UnresolvedStage[] = ["none", "recall", "citation", "both"];

export const REVIEW_SCOPES: ReviewScope[] = ["english", "spanish", "bilingual"];

/**
 * What one stage (Recall = Step 5, Citation = Step 6) actually did this session.
 * `wrongSubmissions` counts CONFIRMED incorrect submissions only, and
 * `cluesUsed` counts Clues taken — neither consumes the other's meaning.
 */
export interface StageOutcome {
  /** Finished correctly. */
  completed: boolean;
  /** All three attempts spent; canonical answer revealed. */
  exhausted: boolean;
  wrongSubmissions: number;
  cluesUsed: number;
}

export interface SessionOutcome {
  recall: StageOutcome;
  citation: StageOutcome;
}

export interface ClassifiedOutcome {
  outcome: ReviewOutcome;
  unresolvedStage: UnresolvedStage;
  /**
   * Both stages correct, no wrong submission, no Clue, no exhaustion. This is
   * the deterministic trigger for the completion wink; it is never announced in
   * visible copy.
   */
  flawless: boolean;
}

/** A stage is resolved once it is either completed or exhausted. */
export function isStageResolved(stage: StageOutcome): boolean {
  return stage.completed || stage.exhausted;
}

/**
 * A review may only finalize once BOTH stages are resolved. Anything else is an
 * abandoned session, which writes no review result at all.
 */
export function isSessionResolved(outcome: SessionOutcome): boolean {
  return isStageResolved(outcome.recall) && isStageResolved(outcome.citation);
}

function stageHadDifficulty(stage: StageOutcome): boolean {
  return stage.wrongSubmissions > 0 || stage.cluesUsed > 0;
}

/**
 * Maps the raw session facts onto the approved outcome vocabulary. Exhaustion
 * dominates: a stage that ran out of attempts is never reported as "recovered".
 */
export function classifySessionOutcome(outcome: SessionOutcome): ClassifiedOutcome {
  const recallExhausted = outcome.recall.exhausted;
  const citationExhausted = outcome.citation.exhausted;

  if (recallExhausted && citationExhausted) {
    return { outcome: "both_exhausted", unresolvedStage: "both", flawless: false };
  }
  if (recallExhausted) {
    return { outcome: "recall_exhausted", unresolvedStage: "recall", flawless: false };
  }
  if (citationExhausted) {
    return { outcome: "citation_exhausted", unresolvedStage: "citation", flawless: false };
  }

  const recallHard = stageHadDifficulty(outcome.recall);
  const citationHard = stageHadDifficulty(outcome.citation);

  if (!recallHard && !citationHard) {
    // A clean success clears any prior unresolved difficulty: an old failure
    // must not punish a passage forever once it has genuinely recovered.
    return { outcome: "clean_success", unresolvedStage: "none", flawless: true };
  }

  return {
    outcome: "recovered_success",
    unresolvedStage: recallHard && citationHard ? "both" : recallHard ? "recall" : "citation",
    flawless: false,
  };
}

export interface ReviewUpdateInput {
  record: ReviewRecord;
  classified: ClassifiedOutcome;
  completedAtMs: number;
  /**
   * Captured at the MOMENT the session began, never recomputed at completion.
   * When false the session is voluntary early practice and cannot farm mastery.
   */
  wasDueAtStart: boolean;
}

/**
 * The one place a review record's level and due time change.
 *
 * EARLY PRACTICE (`wasDueAtStart === false`):
 *   - a success cannot advance the level;
 *   - a success cannot move `nextReviewAt` further into the future;
 *   - a clean early success still clears difficulty and updates the outcome;
 *   - a failure MAY bring the passage forward, so failure takes the EARLIER of
 *     the existing due time and the new one.
 */
export function computeReviewUpdate(input: ReviewUpdateInput): ReviewRecord {
  const { record, classified, completedAtMs, wasDueAtStart } = input;
  const level = clampReviewLevel(record.reviewLevel);
  const existingDueMs = parseIso(record.nextReviewAt, completedAtMs);

  let nextLevel = level;
  let dueMs: number;

  /** Failure may pull a review forward, never push it back. */
  const bringForward = (candidateMs: number) =>
    wasDueAtStart ? candidateMs : Math.min(existingDueMs, candidateMs);

  switch (classified.outcome) {
    case "clean_success": {
      if (!wasDueAtStart) {
        // Voluntary early practice: mastery and timing both stand still.
        nextLevel = level;
        dueMs = existingDueMs;
        break;
      }
      if (level >= MAX_REVIEW_LEVEL) {
        nextLevel = MAX_REVIEW_LEVEL;
        dueMs = completedAtMs + LEVEL_FIVE_REPEAT_MS;
        break;
      }
      nextLevel = clampReviewLevel(level + 1);
      dueMs = completedAtMs + (LEVEL_INTERVAL_MS[nextLevel] ?? REVIEW_INTERVALS_MS.oneDay);
      break;
    }

    case "recovered_success": {
      nextLevel = level;
      dueMs = bringForward(completedAtMs + REVIEW_INTERVALS_MS.oneDay);
      break;
    }

    case "recall_exhausted":
    case "citation_exhausted": {
      nextLevel = Math.max(MIN_REVIEW_LEVEL, level - 1);
      dueMs = bringForward(completedAtMs + REVIEW_INTERVALS_MS.twelveHours);
      break;
    }

    case "both_exhausted": {
      nextLevel = MIN_REVIEW_LEVEL;
      dueMs = bringForward(completedAtMs + REVIEW_INTERVALS_MS.fourHours);
      break;
    }

    default:
      // `never_reviewed` and `incomplete` never reach this function: an
      // unresolved session writes no review result and leaves the schedule
      // exactly as it was.
      return record;
  }

  return {
    ...record,
    reviewLevel: nextLevel,
    nextReviewAt: toIso(dueMs),
    lastReviewedAt: toIso(completedAtMs),
    lastOutcome: classified.outcome,
    unresolvedStage: classified.unresolvedStage,
  };
}

/**
 * Repairs a persisted record in place-safe fashion (never throws, never drops
 * the passage). Malformed levels clamp, malformed timestamps fall back, unknown
 * enum values reset to their neutral member.
 */
export function sanitizeReviewRecord(
  raw: Partial<ReviewRecord> | null | undefined,
  passageKey: string,
  fallbackMs: number
): ReviewRecord {
  const acquiredAt = isValidIso(raw?.acquiredAt) ? (raw!.acquiredAt as string) : toIso(fallbackMs);
  const nextReviewAt = isValidIso(raw?.nextReviewAt) ? (raw!.nextReviewAt as string) : acquiredAt;
  const lastReviewedAt = isValidIso(raw?.lastReviewedAt) ? (raw!.lastReviewedAt as string) : null;
  const lastOutcome = REVIEW_OUTCOMES.includes(raw?.lastOutcome as ReviewOutcome)
    ? (raw!.lastOutcome as ReviewOutcome)
    : "never_reviewed";
  const unresolvedStage = UNRESOLVED_STAGES.includes(raw?.unresolvedStage as UnresolvedStage)
    ? (raw!.unresolvedStage as UnresolvedStage)
    : "none";

  // A malformed scope is dropped rather than guessed: lazy initialization
  // re-derives it from how the passage was genuinely learned.
  const reviewScope = REVIEW_SCOPES.includes(raw?.reviewScope as ReviewScope)
    ? (raw!.reviewScope as ReviewScope)
    : undefined;

  return {
    passageKey,
    reviewLevel: clampReviewLevel(raw?.reviewLevel),
    nextReviewAt,
    lastReviewedAt,
    lastOutcome,
    unresolvedStage,
    acquiredAt,
    reviewScope,
    verseId: typeof raw?.verseId === "string" ? raw.verseId : undefined,
    lastFinalizedSessionId:
      typeof raw?.lastFinalizedSessionId === "string" ? raw.lastFinalizedSessionId : null,
  };
}

/** A brand-new record for a passage that has just been acquired. */
export function createReviewRecord(
  passageKey: string,
  acquiredAtMs: number,
  verseId?: string,
  reviewScope?: ReviewScope
): ReviewRecord {
  const acquiredAt = toIso(acquiredAtMs);
  return {
    passageKey,
    reviewLevel: MIN_REVIEW_LEVEL,
    reviewScope,
    // A first acquisition makes the first POST-acquisition review immediately
    // due. The acquisition session itself is never counted as that review.
    nextReviewAt: acquiredAt,
    lastReviewedAt: null,
    lastOutcome: "never_reviewed",
    unresolvedStage: "none",
    acquiredAt,
    verseId,
    lastFinalizedSessionId: null,
  };
}

import { LucideIcon } from "lucide-react";

export type Translation = "KJV" | "NIV" | "NASB" | "RVR1960" | "NVI" | "NBLA";

export interface TranslationDetail {
  id: Translation;
  name: string;
  label: string;
}

export const TRANSLATION_DETAILS: Record<Translation, TranslationDetail> = {
  KJV: { id: "KJV", name: "King James Version", label: "KJV" },
  NIV: { id: "NIV", name: "New International Version", label: "NIV" },
  NASB: { id: "NASB", name: "New American Standard Bible", label: "NASB" },
  RVR1960: { id: "RVR1960", name: "Reina Valera 1960", label: "RVR" },
  NVI: { id: "NVI", name: "Nueva Versión Internacional", label: "NVI" },
  NBLA: { id: "NBLA", name: "Nueva Biblia de las Américas", label: "NBLA" },
};

export type TranslationPair = {
  es: Translation;
  en: Translation;
};

export const TRANSLATION_PAIRS: TranslationPair[] = [
  { es: "RVR1960", en: "KJV" },
  { es: "NVI", en: "NIV" },
  { es: "NBLA", en: "NASB" },
];

export type LanguageMode = "es" | "en" | "both";
export type MemorizeLanguage = "es" | "en";
export const ACTIVE_ATTEMPT_SCHEMA_VERSION = 2;
export const MEMORIZE_TYPING_STATE_SCHEMA_VERSION = 2;
export const REVIEW_SCHEMA_VERSION = 1;

// Where a share originated, used to choose the provenance/footer line.
export type ShareSource = "daily" | "custom" | "saved";

// One resolved verse block inside a share snapshot. Each block is fully
// pre-resolved: it never derives its translation from global Settings.
export interface ShareBlock {
  language: "es" | "en";
  translation: Translation;      // translation abbreviation/id (e.g. "NIV")
  label: string;                 // translation display label (e.g. "New International Version")
  bibleId?: string;              // upstream Bible ID, when available
  text: string;                  // verse body for this exact translation
}

// Immutable, source-aware snapshot consumed by ShareModal. All displayed
// content (reference, body, label, language, footer) comes from this object so
// the modal never re-derives the translation from global Settings after opening.
export interface ShareSnapshot {
  source: ShareSource;
  book: string;                  // raw book string (for filename / localization)
  chapter: number;
  verse: number;
  refLang: "es" | "en";          // language used to localize the reference
  reference: string;             // fully localized reference, e.g. "Genesis 2:1"
  blocks: ShareBlock[];          // only completed/selected versions, in display order
  footer: string;                // already-localized provenance line
}

export interface Verse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: {
    en: Record<Translation, string>;
    es: Record<Translation, string>;
  };
  copyright?: string;
  source?: string;
  addedAt?: string; // ISO date string
  preferredTranslation?: Translation; // Used for custom verse overrides
}

export interface UserProgress {
  totalMemorized: number;
  currentStreak: number;
  bestStreak: number;
  completedVerses: string[]; // IDs
  completionCounts?: Record<string, number>; // IDs -> count (combined lifetime total; drives growth/fruit)
  // Per-language completion counts, recorded from the actually-completed
  // language(s) at completion time. Begins accruing from this implementation
  // onward; absent for older saved records (treated as empty).
  completionsByLanguage?: Record<string, { en: number; es: number }>; // verseId -> { en, es }
  // Per-translation completion counts, keyed by the Translation actually used
  // for each completed language. Translation keys may be partial.
  completionsByTranslation?: Record<string, Partial<Record<Translation, number>>>; // verseId -> { translation -> count }
  // Last language mode genuinely completed for the verse ("en" | "es" | "both").
  lastCompletedLanguage?: Record<string, LanguageMode>; // verseId -> language mode
  // Last translation completed per language for the verse.
  lastCompletedTranslation?: Record<string, { es?: Translation; en?: Translation }>; // verseId -> { es, en }
  verseStages: Record<string, number>; // verseId -> currentStage
  lastPracticeDate: string | null; // ISO date string (YYYY-MM-DD) of last completion
  lastStreakDate: string | null; // ISO date string (YYYY-MM-DD) when streak was last incremented
  lastCompletedDailyVerseDate: string | null; // ISO date string (YYYY-MM-DD) of last VOTD completion
}

export interface PathDay {
  day: number;
  reference: string;
  contextNote?: string;
  status: "reference-only" | "full-text";
  title?: string;
  titleEs?: string;
  theme?: string;
  themeEs?: string;
  contextPassage?: string;
}

export interface CustomPathVerse {
  id: string;
  dayNumber: number;
  reference: string;
  translation?: Translation;
  bibleId?: string;
  text?: string;
  copyright?: string;
  source?: string;
  createdAt: string;
}

export interface CustomPath {
  id: string;
  type: "custom";
  title: string;
  description: string;
  language: "es" | "en";
  createdAt: string;
  updatedAt: string;
  verses: CustomPathVerse[];
}

export interface Path {
  id: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  duration: number; // in days
  verses: string[]; // Keep for compatibility during transition, will migrate to days
  days: PathDay[];
  cta: string;
  ctaEs: string;
}

export interface UserPathProgress {
  selectedPathId: string | null;
  currentDay: number; // 1-indexed (for the currently selected path)
  lastCompletedAt: string | null; // ISO date (YYYY-MM-DD)
  pathCompletedToday: boolean; // Whether today's verse is done
  completedPathIds: string[];
  previouslyCompletedPathIds?: string[];
  savedProgress: Record<string, {
    currentDay: number;
    completedDays: number[];
    shuffledDayOrder?: number[];
  }>;
}

export type TranslationMode = "default" | "custom";

export type DailyRhythm = "daily" | "weekly" | "path-based" | "loose";
export type IdentityAnchor = "returner" | "finisher" | "carrier" | "room-maker";
export type Blocker = "busy" | "forgetful" | "inconsistent" | "clueless" | "distracted" | "other";
export type ReminderPreference = "morning" | "midday" | "evening" | "bedtime" | "later";

export interface OnboardingProfile {
  dailyRhythm?: DailyRhythm;
  growthGoalLabel?: string;
  growthGoalSubline?: string;
  blocker?: Blocker;
  reminderPreference?: ReminderPreference;
}

export interface ReminderSettings {
  enabled: boolean;
  type: "notification";
  time: string; // "HH:mm"
  timezone: string;
}

export type ActiveVerseSource = "daily" | "extra" | "path" | "custom" | "saved";

export interface ReminderRotationState {
  lastType: 'goal' | 'blocker';
  goalIndices: number[]; // Shuffled indices 0-14
  blockerIndices: number[]; // Shuffled indices 0-14
  goalPointer: number;
  blockerPointer: number;
}

// ---------------------------------------------------------------------------
// PHASE 4A — SMART REVIEW QUEUE
//
// One review record per unique acquired passage, keyed by the canonical
// passage identity (see utils/reviewQueue.passageKeyForVerse). No hidden
// mastery scores, no SM-2 data, no AI scores, no popularity weights, no streak
// data and no monetization flags live here.
// ---------------------------------------------------------------------------

export type ReviewOutcome =
  | "never_reviewed"
  | "clean_success"
  | "recovered_success"
  | "recall_exhausted"
  | "citation_exhausted"
  | "both_exhausted"
  /**
   * Reserved by the domain vocabulary. The current architecture never writes
   * it: an abandoned session preserves its resumable state and records no
   * completed review at all, so no descriptive marker is required.
   */
  | "incomplete";

export type UnresolvedStage = "none" | "recall" | "citation" | "both";

/**
 * WHICH Scripture language(s) a passage's due review requires.
 *
 * Interface language and review language are separate concepts. Scope is
 * derived ONCE from how the passage was genuinely learned and then persisted;
 * changing the app's interface language never silently rewrites it.
 */
export type ReviewScope = "english" | "spanish" | "bilingual";

export interface ReviewRecord {
  /** Canonical passage identity, e.g. "HEB 11:1". */
  passageKey: string;
  /** Mastery level, 0-5 inclusive. */
  reviewLevel: number;
  /** Timezone-safe ISO instant. */
  nextReviewAt: string;
  /** Timezone-safe ISO instant, or null before the first completed review. */
  lastReviewedAt: string | null;
  lastOutcome: ReviewOutcome;
  unresolvedStage: UnresolvedStage;
  /**
   * Derived once at lazy initialization (verse.addedAt when present, otherwise
   * the moment of initialization) and then persisted, so the never-reviewed
   * tie-break stays stable. The repository stores no other per-passage
   * acquisition timestamp.
   */
  acquiredAt: string;
  /**
   * Which language(s) this passage's due review requires. Derived once from
   * how it was actually learned (per-language completion history, falling back
   * to validated acquired text) and then persisted. Optional so records written
   * before Phase 4A Correction 11 stay valid; lazy initialization backfills it.
   */
  reviewScope?: ReviewScope;
  /** Most recent verse id representing this passage; a launch hint only. */
  verseId?: string;
  /**
   * The one persisted exactly-once guard. A session id already recorded here
   * can never apply its result a second time — across rerenders, remounts,
   * route changes, reloads or a midnight rollover.
   */
  lastFinalizedSessionId?: string | null;
}

export type ReviewSource = "queue" | "practice";

/**
 * The lightweight active-review draft. Detailed Recall and Citation state is
 * NOT duplicated here: Step 5 and Step 6 keep their own existing persistence,
 * and the immutable Scripture snapshot stays on ActiveAttemptSnapshot.
 */
export interface ActiveReviewSession {
  schemaVersion?: number;
  sessionId: string;
  passageKey: string;
  verseId: string;
  /** ISO instant. */
  startedAt: string;
  source: ReviewSource;
  /** Captured when the session began; never recomputed at completion. */
  wasDueAtStart: boolean;
  currentStage: "recall" | "citation";
  /**
   * Set only for OPTIONAL SINGLE-LANGUAGE PRACTICE of a bilingual passage: the
   * one language this session runs. Absent for every normal review.
   */
  practiceLanguage?: MemorizeLanguage;
  /**
   * False for subset-language practice. Such a session can never satisfy the
   * bilingual due review: it must not clear it, advance mastery, postpone
   * `nextReviewAt`, or touch `unresolvedStage` / `lastOutcome`. Optional so
   * drafts written before this field stay valid; only an explicit `false`
   * disqualifies.
   */
  qualifiesAsReview?: boolean;
}

/** What the Review completion screen renders after a finalized session. */
export interface ReviewCompletionSummary {
  sessionId: string;
  passageKey: string;
  verseId: string;
  outcome: ReviewOutcome;
  /** Deterministic wink trigger: flawless Recall and Citation. */
  flawless: boolean;
  reviewLevel: number;
  /** ISO instant. */
  nextReviewAt: string;
  /** Latches true once the smiley has drawn, so it never replays. */
  smileyPlayed?: boolean;
  /**
   * True when this was subset-language practice rather than a due review. The
   * completion screen then says so plainly and NOTHING was scheduled: the
   * bilingual review is still waiting.
   */
  isPractice?: boolean;
  /** The single language a practice session ran in. */
  practiceLanguage?: MemorizeLanguage;
}

export interface AppState {
  primaryLanguage: "es" | "en";
  memorizeMode: LanguageMode;
  selectedTranslations: TranslationPair; 
  theme: "light" | "dark" | "system";
  onboarded: boolean;
  hasCompletedTour: boolean;
  savedVerses: string[]; // IDs
  customVerses: Verse[]; // User-added verses
  customPaths: CustomPath[];
  selectedVerseId: string | null;
  selectedCustomVerse: Verse | null; // Currently active custom verse
  activeSource: ActiveVerseSource;
  recentVerseIds: string[]; // History of verses seen recently
  lastVotdDate: string | null; // ISO date string (YYYY-MM-DD)
  progress: UserProgress;
  pathProgress: UserPathProgress;
  customPathProgress: UserPathProgress;
  reminders: ReminderSettings;
  onboardingProfile?: OnboardingProfile;
  reminderRotation?: ReminderRotationState;
  trialStartDate: string | null; // ISO date string
  isSubscribed: boolean;
  isLoadingAnotherVerse?: boolean;
  anotherVerseError?: string | null;
  loadingTranslations?: Record<string, boolean>;
  activeAttempt?: ActiveAttemptSnapshot | null;
  // --- Phase 4A Smart Review Queue -----------------------------------------
  // All optional and additive, so state persisted before Phase 4A stays valid
  // and no migration or schema-version bump is required.
  /** One record per unique acquired passage, keyed by canonical passageKey. */
  reviewRecords?: Record<string, ReviewRecord>;
  /** The single in-flight review draft, or null. */
  activeReview?: ActiveReviewSession | null;
  /** The last finalized review, consumed by the Review completion screen. */
  lastReviewCompletion?: ReviewCompletionSummary | null;
}

export interface ActiveAttemptSnapshot {
  schemaVersion?: number;
  attemptId?: string;
  verseId: string;
  reference: string;
  translations: TranslationPair;
  memorizeMode: LanguageMode;
  verse: Verse;
  source: ActiveVerseSource;
  pathId?: string | null;
  pathDay?: number | null;
  dayReference?: string | null;
  uiLanguage?: "es" | "en";
  languageOrder?: MemorizeLanguage[];
  currentPassIndex?: number;
  completedLanguages?: Partial<Record<MemorizeLanguage, boolean>>;
  cardsReady?: boolean;
  textComplete?: boolean;
  contextKey?: string;
  verseContentKey?: string;
  citationCorrect?: boolean;
  // --- Phase 3C Citation Step (Memorize Step 6) -----------------------------
  // All optional and additive, so attempts persisted before Phase 3C stay valid
  // and no schema-version bump / migration is required. Transient confirmation
  // and empty-input helper state are deliberately NOT persisted.
  /** True once the user has entered the Citation Step from the stage-6 handoff. */
  citationStarted?: boolean;
  /** In-progress citation drafts, exactly as typed. */
  citationDraftEs?: string;
  citationDraftEn?: string;
  /** Confirmed incorrect submissions used so far (0-3). */
  citationAttemptsUsed?: number;
  /** True once three attempts are spent: canonical reveal + acknowledgment pending. */
  citationExhausted?: boolean;
  /** Per-language submitted-review markers from the last confirmed submission. */
  citationWrongEs?: boolean;
  citationWrongEn?: boolean;
  // Latches to true once the attempt advances past Step 1 (stage >= 2). Used by
  // the challenge-in-progress guard so protection survives reviewing back to
  // Step 1. Optional/undefined for older saved attempts (treated as not started).
  started?: boolean;
  // --- Phase 4A review linkage ---------------------------------------------
  // All optional and additive; attempts persisted before Phase 4A stay valid.
  /** Canonical passage identity for this attempt, stamped at build time. */
  reviewPassageKey?: string;
  /**
   * Whether the passage was already due at the MOMENT this session began.
   * Captured once and never recomputed, so voluntary early practice can never
   * farm mastery and a session that crosses its own due time is judged by when
   * it started.
   */
  wasDueAtStart?: boolean;
  /** Set only for queue-driven Review sessions; absent for ordinary Memorize. */
  reviewSessionId?: string;
  reviewSource?: ReviewSource;
  /** Mirrors the review draft so a reload cannot change a session's language. */
  reviewPracticeLanguage?: MemorizeLanguage;
  /** Mirrors the draft's qualification; only an explicit `false` disqualifies. */
  reviewQualifies?: boolean;
  /** Latched once this session's review result has been applied exactly once. */
  reviewFinalized?: boolean;
  // Step 5 outcome facts, latched when the Recall stage concludes so they
  // survive the per-attempt localStorage cleanup and any later reload. Without
  // this latch a reload between Step 5 and Step 6 would lose the wrong-submission
  // and Clue counts that separate a clean success from a recovered one.
  recallWrongSubmissions?: number;
  recallCluesUsed?: number;
  recallExhausted?: boolean;
}

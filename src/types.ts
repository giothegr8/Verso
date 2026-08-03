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
}

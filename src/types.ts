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

export interface Verse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: {
    en: Record<Translation, string>;
    es: Record<Translation, string>;
  };
  source?: "daily" | "path" | "custom";
  addedAt?: string; // ISO date string
  preferredTranslation?: Translation; // Used for custom verse overrides
}

export interface UserProgress {
  totalMemorized: number;
  currentStreak: number;
  bestStreak: number;
  completedVerses: string[]; // IDs
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
  savedProgress: Record<string, {
    currentDay: number;
    completedDays: number[];
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
  selectedVerseId: string | null;
  selectedCustomVerse: Verse | null; // Currently active custom verse
  activeSource: ActiveVerseSource;
  recentVerseIds: string[]; // History of verses seen recently
  lastVotdDate: string | null; // ISO date string (YYYY-MM-DD)
  progress: UserProgress;
  pathProgress: UserPathProgress;
  reminders: ReminderSettings;
  onboardingProfile?: OnboardingProfile;
  reminderRotation?: ReminderRotationState;
  trialStartDate: string | null; // ISO date string
  isSubscribed: boolean;
}

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
  currentDay: number; // 1-indexed
  lastCompletedAt: string | null; // ISO date (YYYY-MM-DD)
  completedPathIds: string[];
}

export type TranslationMode = "default" | "custom";

export interface ReminderSettings {
  enabled: boolean;
  type: "notification";
  time: string; // "HH:mm"
  timezone: string;
}

export interface AppState {
  primaryLanguage: "es" | "en";
  memorizeMode: LanguageMode;
  selectedTranslations: TranslationPair; 
  theme: "light" | "dark" | "system";
  onboarded: boolean;
  hasCompletedTour: boolean;
  savedVerses: string[]; // IDs
  selectedVerseId: string | null;
  recentVerseIds: string[]; // History of verses seen recently
  lastVotdDate: string | null; // ISO date string (YYYY-MM-DD)
  progress: UserProgress;
  pathProgress: UserPathProgress;
  reminders: ReminderSettings;
  trialStartDate: string | null; // ISO date string
  isSubscribed: boolean;
}

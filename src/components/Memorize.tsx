import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ACTIVE_ATTEMPT_SCHEMA_VERSION,
  ActiveAttemptSnapshot,
  AppState,
  MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
  MemorizeLanguage,
  TRANSLATION_PAIRS,
  TRANSLATION_DETAILS,
  Translation,
  Verse
} from "../types";
import { loadVerseAndMerge } from "../services/bibleService";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Trophy, Sparkles, AlertCircle, Bookmark, Layers, BookOpen, Loader2 } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, removeAccents, validateVerseTranslation } from "../utils/verseUtils";
import CitationStep, { CitationPersistPatch, readCitationClueCount } from "./CitationStep";
import { passageKeyForVerse } from "../utils/reviewQueue";
import {
  SessionOutcome,
  classifySessionOutcome,
  computeReviewUpdate,
  createReviewRecord,
  sanitizeReviewRecord,
  toIso,
} from "../utils/reviewSchedule";
import { reviewCopy } from "../data/reviewCopy";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
  onAbandon?: () => void;
  tourStepId?: string | null;
  /** Phase 4A: a queue-driven Review session has finalized exactly once. */
  onReviewFinalized?: () => void;
}

const STAGES = [
  { id: 1, label: "Reading", es: "Lectura" },
  { id: 2, label: "", es: "" }, 
  { id: 3, label: "", es: "" }, 
  { id: 4, label: "Recall", es: "Recuerdo" },
  { id: 5, label: "Typing", es: "Escritura" },
];

type MemorizeTypingStateV2 = {
  schemaVersion: number;
  attemptId: string;
  currentPassIndex: number;
  currentStep: number;
  showHalfwayTransition: boolean;
  userInputEs: string[];
  userInputEn: string[];
  cursorIndexEs: number;
  cursorIndexEn: number;
  clueCountEs: number;
  clueCountEn: number;
  revealedIndicesEs: number[];
  revealedIndicesEn: number[];
  isWrongEs: boolean;
  isWrongEn: boolean;
  hasSubmittedEs: boolean;
  hasSubmittedEn: boolean;
  incorrectIndicesEs: number[];
  incorrectIndicesEn: number[];
  submittedWrongCharsEs: Record<number, string>;
  submittedWrongCharsEn: Record<number, string>;
  isCorrectEs: boolean;
  isCorrectEn: boolean;
  didFailFlowEs: boolean;
  didFailFlowEn: boolean;
};

// Home-aligned progress rail: five straight rounded segments, matching the
// segmented progress-bar vocabulary of the approved Home cards. The stages
// keep their semantic names in data attributes only — never rendered as icons.
// Decorative; the visible "Step N of 6" text in the header is the accessible
// equivalent.
// Six segments since Phase 3C: Citation is Step 6. Steps 1-5 keep their exact
// appearance and behaviour; only the segment count changed. The sixth segment
// is named for the step it represents — Citation — so no terminology other than
// the locked Citation/Cita name reaches the rendered DOM.
const STAGE_RAIL_STAGES = ["Seed", "Water", "Root", "Sprout", "Bloom", "Citation"] as const;

// =============================================================================
// PHASE 4A — REVIEW MODE IDENTITY.
//
// A Review session runs on the Memorize engine, so without a distinct identity
// it is indistinguishable from starting a fresh memorization. `REVIEW_ACCENT`
// replaces ordinary Memorize's Royal Blue on the ACTIVE-WORKSPACE accents only
// — the banner, the step indicator, the current progress segment, the Recall
// frame, the forward control, and the current Recall marker. Scripture,
// references, Composer text, empty rails, inactive segments, dark-glass
// surfaces, Ember Clues and corrective rose are all untouched, and ordinary
// Memorize keeps its Royal identity exactly as shipped.
// =============================================================================
const REVIEW_ACCENT = "#3E8F7B";

/**
 * THE AUTHORITATIVE REVIEW ENTRY STAGE.
 *
 * A review always opens in the Step 5 Recall Workspace. This constant is the
 * single source of that truth: it is never derived from `verseStages`, from a
 * persisted `currentStep`, from prior acquisition state, or from anything else
 * an ordinary Memorize session may have left behind.
 *
 * That derivation is exactly what failed. `verseStages` is ORDINARY-Memorize
 * progress: Review never writes it, and App's quit-challenge handler deletes
 * the entry unconditionally — even for a passage still in `completedVerses`.
 * With the entry absent, `verseStages[verse.id] || 1` produced 1, so a review
 * opened at Step 1 and played Steps 1-4.
 */
const REVIEW_ENTRY_STAGE = 5;

const StageProgressRail = ({ stage, accent }: { stage: number; accent?: string }) => (
  <div className="w-full max-w-[236px] md:max-w-[280px] flex items-center gap-1.5 md:gap-2">
    {STAGE_RAIL_STAGES.map((name, i) => {
      const milestone = i + 1;
      const status = milestone < stage ? "completed" : milestone === stage ? "current" : "upcoming";
      return (
        <span
          key={name}
          data-stage-name={name}
          className="flex-1 h-1 rounded-full"
          style={{
            // Completed → earned Ember Gold; current → Verdant Teal identity
            // with a restrained atmospheric halo (Royal in ordinary Memorize,
            // Verdant in Review mode); upcoming → Cold Grey at low opacity.
            background:
              status === "completed" ? "rgba(232,179,75,0.76)"
              : status === "current" ? "#3E8F7B"
              : "rgba(139,149,163,0.20)",
            boxShadow:
              status === "current"
                ? (accent ? "0 0 7px rgba(62,143,123,0.30)" : "0 0 7px rgba(91,120,255,0.22)")
              : status === "completed" ? "0 0 4px rgba(232,179,75,0.18)"
              : undefined,
          }}
        />
      );
    })}
  </div>
);

/**
 * The persistent Review-mode STATUS STRIP.
 *
 * A full-width dark-glass strip carrying ONE continuous, CENTRED sentence.
 * It replaced a two-level banner whose stacked label and subtitle competed with
 * the passage reference and the Step 5 instruction for the same attention —
 * three text layers saying overlapping things. Now a single quiet line names
 * the mode, and the left-aligned reference leads the content beneath it.
 *
 * WIDTH. `w-full` inside the header column resolves to the same edges as the
 * Recall workspace frame, the progress rail and the Citation workspace, so the
 * strip reads as a structured header element. A `fit-content` version was tried
 * and looked like an isolated floating label detached from those wider blocks.
 * The column's own max-width and gutters keep it off the viewport edges.
 *
 * `REVIEW MODE:` carries the Verdant emphasis; the remainder stays neutral, so
 * colour is never the only signal. At narrow widths the sentence wraps
 * naturally and every wrapped line stays centred. One soft rim/glow emphasis on
 * entry that settles immediately — no repeat, no scale, no movement, no screen
 * effect.
 */
const REVIEW_STRIP_STYLE = `
.vrevb {
  box-shadow: 0 0 10px -5px rgba(62,143,123,0.20), inset 0 0 10px rgba(62,143,123,0.06);
}
@keyframes vrevb-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(62,143,123,0), inset 0 0 0 rgba(62,143,123,0); }
  35%  { box-shadow: 0 0 14px -3px rgba(62,143,123,0.36), inset 0 0 12px rgba(62,143,123,0.13); }
  100% { box-shadow: 0 0 10px -5px rgba(62,143,123,0.20), inset 0 0 10px rgba(62,143,123,0.06); }
}
.vrevb-enter { animation: vrevb-pulse 900ms ease-out 80ms 1 both; }

@media (prefers-reduced-motion: reduce) {
  .vrevb-enter { animation: none !important; }
}
`;

export const ReviewModeStrip = ({ label, hint }: { label: string; hint: string }) => (
  <div
    className="vrevb vrevb-enter w-full rounded-[10px] px-3 py-1.5 border text-center"
    style={{ background: "rgba(15,20,27,0.58)", borderColor: "rgba(62,143,123,0.42)" }}
  >
    <style>{REVIEW_STRIP_STYLE}</style>
    {/* One sentence, wrapping naturally at narrow widths with every line
        centred — never a separate label line and supporting-copy line. */}
    <span className="font-hanken text-[12px] leading-snug text-cold-grey">
      <span className="font-semibold" style={{ color: REVIEW_ACCENT }}>{label}:</span>{" "}
      {hint}
    </span>
  </div>
);

// NOTE: The former single-typed-glyph geometry that painted each entered
// Step 5 character inside its canonical target slot was removed with the
// target-slot rendering model. User-entered glyphs now flow at their own
// natural proportional widths inside the Recall Composer; the Memory Map
// never displays typed text. See `renderRecallComposerBody`.

// THE ONE LETTER SET.
//
// Four walks convert canonical text into logical letter indices: the canonical
// cleaner (`getCleanLetters`), Clue's first-letter-per-word walk, the Memory
// Map slot walk, and the Recall Composer walk. They must agree on exactly which
// characters count as letters, or their indices name different slots.
//
// They did not. Clue's walk omitted `ü/Ü` while the cleaner counted them, so on
// any verse containing "ü" (e.g. RVR1960 Romans 5:5, "la esperanza no
// avergüenza") Clue's running index fell one behind the cleaner at the ü and
// stayed behind — revealing the wrong slots and writing the wrong canonical
// letter into them. Deriving every classifier from this one source is what
// keeps them aligned.
const LETTER_CLASS_SOURCE = "a-zA-ZáéíóúÁÉÍÓÚñÑüÜ";
// Non-global on purpose: `.test()` on a /g/ regex advances `lastIndex` between
// calls and would intermittently mis-classify a character.
const LETTER_RE = new RegExp(`[${LETTER_CLASS_SOURCE}]`);
// Global, but only ever handed to `String.replace`, which resets `lastIndex`.
const NON_LETTER_GLOBAL_RE = new RegExp(`[^${LETTER_CLASS_SOURCE}]`, "g");
const isLetterChar = (ch: string) => LETTER_RE.test(ch);

// THE CANONICAL DISPLAY-CASING LAW (Step 5 Recall Composer — DISPLAY ONLY).
//
// The Composer paints the user's own glyphs at their natural proportional
// Fraunces advances, and uppercase advances are wider than lowercase ones. A
// correct all-caps entry therefore overflowed its canonical row and wrapped
// again INSIDE it (the row's `break-words` emergency fallback), so the Composer
// stopped following the frozen canonical line map — while the Memory Map, and
// Arrow Up/Down which navigate the Map's logical cells, stayed on the canonical
// rows and could skip text that looked visually adjacent.
//
// The correction is a paint-time decision and nothing else: the canonical glyph
// at the SAME logical index decides only whether the entered glyph is shown
// uppercase or lowercase. Raw entered input is never touched — not in state,
// not in refs, not in persistence, not in validation (`handleCheck` keeps
// grading through `removeAccents` + `toLowerCase`, so it stays case- AND
// accent-insensitive). Casing is not accepted, rejected or graded here; it is
// only painted.
//
// Identity is preserved absolutely — a wrong letter stays wrong, an accent
// stays on its letter, and the canonical letter is NEVER substituted for what
// the user actually typed:
//
//   canonical `a`:  `A` -> `a`,  `X` -> `x`,  `Á` -> `á`
//   canonical `N`:  `n` -> `N`,  `x` -> `X`,  `ñ` -> `Ñ`
//
// Unicode-aware by construction: case is decided by asking the canonical glyph
// itself, never by an ASCII range test — so ñ/Ñ, ü/Ü and every accented vowel
// in THE ONE LETTER SET case correctly and one-to-one. Locale-INDEPENDENT
// casing only (`toUpperCase`/`toLowerCase`, never the `toLocale*` variants), so
// the same raw persisted input deterministically restores to the same display
// on reload regardless of browser locale. Digits and caseless glyphs have no
// case to match and pass through exactly as typed.
//
// ONE LOGICAL POSITION IN, ONE LOGICAL POSITION OUT. A conversion that would
// expand the glyph (`ß` -> `SS`, `ﬁ` -> `FI`, `İ` -> `i` + combining dot) is
// REFUSED and the raw glyph is painted as typed. Case conversion can therefore
// never add, remove or shift a logical index, move the cursor, or alter a Clue
// index, a review index or the persisted length.
const toCanonicalDisplayCase = (entered: string, canonical: string) => {
  if (!entered || !canonical) return entered;

  const canonicalUpper = canonical.toUpperCase();
  const canonicalLower = canonical.toLowerCase();
  // Caseless canonical glyph (digit, symbol, uncased script): no opinion.
  if (canonicalUpper === canonicalLower) return entered;

  const wantsUpper = canonical === canonicalUpper;
  // A canonical glyph that is neither its own uppercase nor its own lowercase
  // form (e.g. a titlecase digraph) also gets no opinion.
  if (!wantsUpper && canonical !== canonicalLower) return entered;

  const cased = wantsUpper ? entered.toUpperCase() : entered.toLowerCase();
  if (cased === entered) return entered;
  // Refuse expansion: the code-point count must be identical.
  if (Array.from(cased).length !== Array.from(entered).length) return entered;
  return cased;
};

// One-shot occupancy bloom. Scoped here because no CSS file is authorized.
// The 100% frame is deliberately identical to the settled occupied inline
// style, so when the animation retires the handoff is invisible. Keyframes
// outrank inline styles in the cascade, which is what lets the bloom paint over
// the settled colour for its single pass and then hand it straight back.
// One-shot occupancy bloom. The blooming element is always a settled OCCUPIED
// tile (empty→occupied), so its inline height (10px) and radius (2px) hold
// throughout — the keyframes animate only background/opacity/box-shadow, so the
// tile never reverts to a thin rail mid-animation. The 0% and 100% frames are
// deliberately identical to the settled occupied Royal tile's inline style, so
// when the animation retires (animationend → class removed) the handoff is
// invisible. Same 440ms one-shot duration/timing; reduced motion skips it.
const BEACON_STYLE = `
@keyframes verso-beacon-bloom {
  0%   { background: rgba(91,120,255,0.82); opacity: 0.82; box-shadow: 0 0 2px rgba(91,120,255,0.12), inset 0 1px 0 rgba(231,236,242,0.12); }
  35%  { background: rgba(143,162,255,0.96); opacity: 1; box-shadow: 0 0 12px rgba(91,120,255,0.46), 0 0 5px rgba(62,143,123,0.20), inset 0 1px 0 rgba(231,236,242,0.18); }
  45%  { background: rgba(143,162,255,0.96); opacity: 1; box-shadow: 0 0 12px rgba(91,120,255,0.46), 0 0 5px rgba(62,143,123,0.20), inset 0 1px 0 rgba(231,236,242,0.18); }
  100% { background: rgba(91,120,255,0.82); opacity: 1; box-shadow: 0 0 7px rgba(91,120,255,0.24), inset 0 1px 0 rgba(231,236,242,0.12); }
}
.verso-beacon-bloom { animation: verso-beacon-bloom 440ms ease-out 1 both; }
@media (prefers-reduced-motion: reduce) {
  .verso-beacon-bloom { animation: none; }
}
`;

// THE UNIFORM LOGICAL CELL BOARD (Step 5 Memory Map; CitationStep.tsx keeps
// its own mirrored constants for the independent Step 6 Reference Map).
// The board is a structural occupancy guide, not a proportional text
// silhouette: every logical letter/digit is one fixed-width cell, every
// intra-word gap is identical, and every inter-word gap is identical and
// visibly larger. NOTHING here derives from canonical or typed glyph widths.
//
// Since the canonical-line-map pass, the approved responsive clamp() values
// are resolved in JS during canonical-layout measurement (never during
// typing) so ONE global scale — taken from the densest canonical line — can
// shrink the whole board system consistently when a line would otherwise
// overflow the stage width.
const BOARD_CELL_H = "14px";
const BOARD_TILE_H = "10px";
const BOARD_BASE = {
  cell:  { min: 9,  vw: 0.027, max: 11 },
  intra: { min: 3,  vw: 0.009, max: 4 },
  inter: { min: 11, vw: 0.031, max: 15 },
} as const;

// One canonical responsive line map — measured from a hidden mirror of the
// Steps 1-4 proportional Scripture rendering — drives the line breaks of the
// Step 5 Memory Map and Recall Composer, so Steps 1-5 always show the passage
// arranged on the same lines. `lines` holds canonical word indices per
// rendered line; `board` holds the globally scaled Step-5 cell metrics.
type CanonicalLayout = {
  key: string;
  width: number;
  sig: string;
  lines: number[][];
  board: { cell: number; intra: number; inter: number };
};

// THE FAILED-TRANSLATION SENTINELS.
//
// `loadVerseAndMerge` (services/bibleService.ts) records a failed fetch by
// WRITING A SENTENCE INTO THE VERSE, so the structured failure is discarded at
// the source and the message becomes ordinary content that `validateVerseTranslation`
// happily accepts as Scripture. These are the two exact strings it emits.
//
// Matched EXACTLY (after trimming) and never as a keyword search, so genuine
// Scripture that happens to contain the word "error" is never rejected.
const FAILED_TRANSLATION_SENTINELS = [
  "Error al cargar la traducción en Español.",
  "Error loading English translation.",
];
const isFailedTranslationText = (text: string | null | undefined) => {
  if (!text) return false;
  const trimmed = text.trim();
  return FAILED_TRANSLATION_SENTINELS.some(sentinel => trimmed === sentinel);
};

// Interface language decides bilingual order. It never decides the CONTENT
// language of a stream — only which valid stream is shown first.
const getExpectedLanguageOrder = (
  mode: AppState["memorizeMode"],
  uiLanguage: AppState["primaryLanguage"]
): MemorizeLanguage[] => {
  if (mode === "both") return uiLanguage === "en" ? ["en", "es"] : ["es", "en"];
  return [mode];
};

const sameLanguageOrder = (a?: MemorizeLanguage[], b?: MemorizeLanguage[]) => {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((lang, idx) => lang === b[idx]);
};

const clampPassIndex = (idx: number, order: MemorizeLanguage[]) => {
  if (!Number.isInteger(idx) || idx < 0) return 0;
  return Math.min(idx, Math.max(order.length - 1, 0));
};

const getAttemptVerseContentKey = (attempt: ActiveAttemptSnapshot) => {
  return JSON.stringify({
    verseId: attempt.verse.id,
    book: attempt.verse.book,
    chapter: attempt.verse.chapter,
    verse: attempt.verse.verse,
    preferredTranslation: attempt.verse.preferredTranslation || "",
    source: attempt.verse.source || "",
    esTranslation: attempt.translations.es,
    enTranslation: attempt.translations.en,
    esText: attempt.verse.text?.es?.[attempt.translations.es] || "",
    enText: attempt.verse.text?.en?.[attempt.translations.en] || ""
  });
};

const getVerseContentKey = (verse: Verse, translations: AppState["selectedTranslations"]) => {
  return JSON.stringify({
    verseId: verse.id,
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    preferredTranslation: verse.preferredTranslation || "",
    source: verse.source || "",
    esTranslation: translations.es,
    enTranslation: translations.en,
    esText: verse.text?.es?.[translations.es] || "",
    enText: verse.text?.en?.[translations.en] || ""
  });
};

const createAttemptId = () => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall back below.
  }
  return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getContextKey = (
  state: AppState,
  source: AppState["activeSource"],
  verse: Verse,
  reference: string
) => {
  const pathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId || "";
  const pathDay = source === "path"
    ? state.pathProgress.selectedPathId
      ? state.pathProgress.currentDay
      : state.customPathProgress.selectedPathId
        ? state.customPathProgress.currentDay
        : ""
    : "";
  return JSON.stringify({
    source,
    verseId: verse.id,
    reference,
    pathId: source === "path" ? pathId : "",
    pathDay,
    dailyDate: source === "daily" ? (state.lastVotdDate || getLocalDateString()) : "",
    customId: source === "custom" ? verse.id : "",
    savedId: source === "saved" ? verse.id : ""
  });
};

const buildMemorizeAttemptSnapshot = (state: AppState, verse: Verse): ActiveAttemptSnapshot => {
  const source = state.activeSource || "saved";
  const reference = `${verse.book} ${verse.chapter}:${verse.verse}`;
  const languageOrder = getExpectedLanguageOrder(state.memorizeMode, state.primaryLanguage);
  return {
    schemaVersion: ACTIVE_ATTEMPT_SCHEMA_VERSION,
    attemptId: createAttemptId(),
    verseId: verse.id,
    reference,
    translations: { ...state.selectedTranslations },
    memorizeMode: state.memorizeMode,
    verse,
    source,
    pathId: state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId,
    pathDay: source === "path"
      ? state.pathProgress.selectedPathId
        ? state.pathProgress.currentDay
        : state.customPathProgress.currentDay
      : null,
    dayReference: source === "path" ? reference : null,
    uiLanguage: state.primaryLanguage,
    languageOrder,
    currentPassIndex: 0,
    completedLanguages: languageOrder.reduce<Partial<Record<MemorizeLanguage, boolean>>>((acc, lang) => {
      acc[lang] = false;
      return acc;
    }, {}),
    cardsReady: false,
    textComplete: false,
    contextKey: getContextKey(state, source, verse, reference),
    verseContentKey: getVerseContentKey(verse, state.selectedTranslations),
  };
};

const isValidMemorizeAttempt = (
  attempt: ActiveAttemptSnapshot | null | undefined,
  verseId?: string
): attempt is ActiveAttemptSnapshot => {
  if (!attempt || attempt.schemaVersion !== ACTIVE_ATTEMPT_SCHEMA_VERSION) return false;
  if (!attempt.attemptId || typeof attempt.attemptId !== "string") return false;
  if (verseId && attempt.verseId !== verseId) return false;
  if (!attempt.verse || attempt.verseId !== attempt.verse.id) return false;
  if (attempt.uiLanguage !== "es" && attempt.uiLanguage !== "en") return false;
  if (!attempt.translations?.es || !attempt.translations?.en) return false;
  if (!attempt.contextKey || !attempt.verseContentKey) return false;

  const expectedOrder = getExpectedLanguageOrder(attempt.memorizeMode, attempt.uiLanguage);
  if (!sameLanguageOrder(attempt.languageOrder, expectedOrder)) return false;
  if (attempt.verseContentKey !== getAttemptVerseContentKey(attempt)) return false;

  const passIndex = attempt.currentPassIndex ?? 0;
  return Number.isInteger(passIndex) && passIndex >= 0 && passIndex < expectedOrder.length;
};

const isValidTypingState = (
  raw: any,
  attemptId: string | null,
  order: MemorizeLanguage[]
): raw is MemorizeTypingStateV2 => {
  if (!attemptId || !raw || typeof raw !== "object") return false;
  if (raw.schemaVersion !== MEMORIZE_TYPING_STATE_SCHEMA_VERSION) return false;
  if (raw.attemptId !== attemptId) return false;
  if (!Number.isInteger(raw.currentStep) || raw.currentStep < 1 || raw.currentStep > 5) return false;
  if (!Number.isInteger(raw.currentPassIndex) || raw.currentPassIndex < 0 || raw.currentPassIndex >= order.length) return false;
  return true;
};

// `onGoToFlashcards` remains on the props interface for call-site compatibility
// but is no longer consumed: Phase 3C moved Citation into Step 6 of this flow,
// so Memorize never hands stage-6 acquisition off to Cards.
export default function Memorize({ state, setState, onComplete, onAbandon, tourStepId, onReviewFinalized }: MemorizeProps) {
  const today = getLocalDateString();
  const votd = getVerseByDate(today);
  
  // Path Logic for Fallback 
  const currentPathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId;
  const isCustomPath = !!state.customPaths.find(p => p.id === currentPathId);
  const selectedPath = isCustomPath 
    ? state.customPaths.find(p => p.id === currentPathId)
    : (state.pathProgress.selectedPathId ? (MOCK_VERSES.length > 0 ? null : null) : null); // We don't have PATHS available here easily, so we rely on AppState or similar

  // Helper to resolve the correct verse
  const getResolvedVerse = (): Verse => {
    // 0. Use the locked active attempt snapshot if present
    if (isValidMemorizeAttempt(state.activeAttempt) && state.activeAttempt.verse) {
      return state.activeAttempt.verse;
    }

    // 1. If explicitly custom
    if (state.activeSource === "custom" && state.selectedCustomVerse) {
      return state.selectedCustomVerse;
    }
    
    // 2. If explicit verse ID selected
    if (state.selectedVerseId) {
      const fromMock = MOCK_VERSES.find(v => v.id === state.selectedVerseId);
      const fromCustomList = state.customVerses.find(v => v.id === state.selectedVerseId);
      if (fromMock) return fromMock;
      if (fromCustomList) return fromCustomList;
      
      // Check in custom paths
      for (const p of state.customPaths) {
        const vData = p.verses.find(v => v.id === state.selectedVerseId);
        if (vData) {
          return {
            id: vData.id,
            book: vData.reference.split(' ').slice(0, -1).join(' '),
            chapter: parseInt(vData.reference.split(' ').pop()?.split(':')[0] || '1'),
            verse: parseInt(vData.reference.split(' ').pop()?.split(':')[1] || '1'),
            text: {
              es: { RVR1960: vData.text || "", NVI: vData.text || "", NBLA: vData.text || "", KJV: "", NIV: "", NASB: "" },
              en: { KJV: vData.text || "", NIV: vData.text || "", NASB: vData.text || "", RVR1960: "", NVI: "", NBLA: "" }
            },
            copyright: vData.copyright
          } as Verse;
        }
      }
    }
    
    // 3. Fallback for Path source
    if (state.activeSource === "path") {
      // In Memorize, we can't easily recalculate activePathVerse without access to all constants.
      // But App.tsx should have set state optimally.
      // If we are here and no ID is set, it means we are in a 'Path' flow.
      // We'll rely on the VOTD if all else fails, but ideally Home passed the ID or it's resolved.
    }

    return votd;
  };

  const verse = getResolvedVerse();
  const activeAttempt = isValidMemorizeAttempt(state.activeAttempt, verse.id) ? state.activeAttempt : null;

  // ==========================================================================
  // PHASE 4A — REVIEW MODE.
  //
  // A Review session is an attempt whose snapshot carries the review session id
  // that the persisted review draft names. Both must agree, so a stale draft or
  // a stale attempt can never put Memorize into review mode by itself.
  //
  // In review mode this component is TENDING an already-acquired passage, not
  // acquiring one: it must not append to savedVerses, must not touch
  // completedVerses or completionCounts, and must leave verseStages at 7.
  // ==========================================================================
  const reviewSession =
    state.activeReview && activeAttempt?.reviewSessionId === state.activeReview.sessionId
      ? state.activeReview
      : null;
  const isReviewMode = !!reviewSession;

  // ==========================================================================
  // THE CONTENT-INTEGRITY GATE.
  //
  // A failed translation must never become Scripture. Because bibleService
  // stores its failure as a sentence inside the verse (see the sentinels
  // above), the message would otherwise flow into Steps 1-5, the Citation
  // Step, the learned card, and Saved — graded, persisted and acquired as if
  // it were the passage.
  //
  // The failing language is not blanked; it is REMOVED from this attempt.
  // Every downstream consumer derives from `attemptLanguageOrder` and
  // `effectiveMemorizeMode` below, so the message has no path into any stream,
  // payload or record. Nothing here rewrites persisted storage: a restored
  // draft simply re-enters this same gate and re-reduces, so no Saved data,
  // completed passage or unrelated key is ever touched.
  // ==========================================================================
  const validatedVerse = getValidatedVerse(verse, state);
  const validatedPair = validatedVerse.activePair;
  const esError = validatedVerse.esError;
  const enError = validatedVerse.enError;

  const esTranslationFailed = isFailedTranslationText(verse?.text?.es?.[validatedPair.es]);
  const enTranslationFailed = isFailedTranslationText(verse?.text?.en?.[validatedPair.en]);

  // Usable iff the project's own validator accepts it AND it is not a
  // failed-translation sentinel. The validator is reused rather than replaced,
  // so "coming soon" placeholders keep behaving exactly as before.
  const usableTextFor = (lang: MemorizeLanguage): string | null => {
    const trans = lang === 'es' ? validatedPair.es : validatedPair.en;
    if (!validateVerseTranslation(verse, lang, trans).isValid) return null;
    const raw = verse.text[lang][trans] || "";
    return isFailedTranslationText(raw) ? null : raw;
  };

  const usableEsText = usableTextFor('es');
  const usableEnText = usableTextFor('en');
  // THE SESSION'S OWN MODE, from the immutable attempt snapshot rather than the
  // global preference. A Review runs the languages its SAVED SCOPE requires, so
  // a bilingual review still runs both passes while the user's global setting
  // says otherwise — without rewriting that setting. For an ordinary session
  // the two values are identical, so nothing changes there.
  const sessionMemorizeMode: AppState["memorizeMode"] =
    activeAttempt?.memorizeMode || state.memorizeMode;
  const requestedEs = sessionMemorizeMode === 'es' || sessionMemorizeMode === 'both';
  const requestedEn = sessionMemorizeMode === 'en' || sessionMemorizeMode === 'both';

  let resolvedEsText = requestedEs ? usableEsText : null;
  let resolvedEnText = requestedEn ? usableEnText : null;
  // Every requested language failed but the other one is genuinely valid: the
  // attempt continues in that language rather than collapsing. This is what
  // turns a failed Spanish fetch — even under a Spanish-only request — into a
  // real English-only attempt instead of nothing.
  if (!resolvedEsText && !resolvedEnText) {
    if (usableEnText) resolvedEnText = usableEnText;
    else if (usableEsText) resolvedEsText = usableEsText;
  }
  const esText = resolvedEsText;
  const enText = resolvedEnText;

  // Interface-language order first (unchanged), then availability removes any
  // language with no valid text. The both-null case is owned by the existing
  // "verse unavailable" guard further down.
  const requestedLanguageOrder = activeAttempt?.languageOrder && activeAttempt.languageOrder.length > 0
    ? activeAttempt.languageOrder
    : getExpectedLanguageOrder(sessionMemorizeMode, state.primaryLanguage);
  const availableLanguageOrder = requestedLanguageOrder.filter(lang => (lang === 'es' ? esText : enText));
  const rescueLanguageOrder: MemorizeLanguage[] = enText ? ['en'] : esText ? ['es'] : [];
  const attemptLanguageOrder = availableLanguageOrder.length > 0
    ? availableLanguageOrder
    : rescueLanguageOrder.length > 0
      ? rescueLanguageOrder
      : requestedLanguageOrder;

  // The mode this ATTEMPT actually runs in. `state.memorizeMode` stays the
  // user's global preference and is never mutated by a transport failure.
  const effectiveMemorizeMode: AppState["memorizeMode"] =
    attemptLanguageOrder.length > 1 ? 'both' : attemptLanguageOrder[0];

  // Which language dropped out — reported only when the attempt genuinely
  // continues in the other one, so the notice is never shown next to nothing.
  const unavailableNoticeLang: MemorizeLanguage | null =
    esTranslationFailed && !esText && !!enText ? 'es'
    : enTranslationFailed && !enText && !!esText ? 'en'
    : null;

  const attemptId = activeAttempt?.attemptId || null;
  const typingStateKey = attemptId ? `memorize_typing_state_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}` : null;

  const savedTypingState = useMemo(() => {
    if (!typingStateKey) return null;
    try {
      const stored = localStorage.getItem(typingStateKey);
      const parsed = stored ? JSON.parse(stored) : null;
      return isValidTypingState(parsed, attemptId, attemptLanguageOrder) ? parsed : null;
    } catch {
      return null;
    }
  }, [typingStateKey, attemptId, attemptLanguageOrder]);

  // Load missing verse text automatically on the fly
  useEffect(() => {
    if (!verse) return;
    
    const activePair = getCurrentTranslationPair(state);
    const mode = state.memorizeMode;
    
    let needsEs = false;
    let needsEn = false;
    
    if (mode === "es" || mode === "both") {
      const txt = verse.text.es[activePair.es];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEs = true;
      }
    }
    
    if (mode === "en" || mode === "both") {
      const txt = verse.text.en[activePair.en];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEn = true;
      }
    }
    
    if (needsEs || needsEn) {
      const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
      loadVerseAndMerge(ref, verse.id, state, setState);
    }
  }, [
    verse?.id,
    state.memorizeMode,
    state.selectedTranslations?.es,
    state.selectedTranslations?.en,
    state.activeSource
  ]);

  const globalVerseStage = state.progress.verseStages[verse.id] || 1;
  const [stage, setStage] = useState(() => {
    // A Review session opens in the Recall Workspace, full stop. It never
    // consults `verseStages` or a persisted `currentStep`, so no stale ordinary
    // Memorize progress, absent stage entry, prior acquisition state, hydration
    // order or remount can pull it back to Step 1.
    if (isReviewMode) return REVIEW_ENTRY_STAGE;
    return Math.min(5, savedTypingState?.currentStep || globalVerseStage);
  });
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(() => {
    let failed = false;
    try {
      failed = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    } catch {
      failed = false;
    }
    // Review resume reads the ATTEMPT, not `verseStages` (which a review never
    // writes): a reload after Recall finished must return to the Citation
    // handoff or the Citation Step, never to a blank Recall Workspace.
    if (isReviewMode) {
      return !!activeAttempt?.citationStarted || !!activeAttempt?.cardsReady || failed;
    }
    return (globalVerseStage === 6 && activeAttempt?.cardsReady === true) || failed;
  });
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  // Drives only the Recall Composer's focused rim/glow — never the input engine.
  const [inputFocused, setInputFocused] = useState(false);
  // Enter-submit confirmation. The ref carries the latest value into the
  // synchronous key stream (same rule as the cursor refs) so a fast second
  // Enter can never read a stale `false` and re-open instead of submitting.
  // Deliberately not persisted: no stale confirmation may survive a reload.
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const pendingSubmitRef = useRef(false);
  const setPendingSubmitLive = (v: boolean) => {
    pendingSubmitRef.current = v;
    setPendingSubmit(v);
  };
  const cancelPendingSubmit = () => {
    if (pendingSubmitRef.current) setPendingSubmitLive(false);
  };

  // Logical indices awaiting their one-shot occupancy bloom. Detection happens
  // in an effect below by diffing occupancy against the previous observation —
  // never in the key event path, so typing measures and schedules nothing.
  const [beaconIndicesEs, setBeaconIndicesEs] = useState<number[]>([]);
  const [beaconIndicesEn, setBeaconIndicesEn] = useState<number[]>([]);
  // `null` means "no baseline yet": that observation only records one and blooms
  // nothing. The recorded `len` matters as much as the occupancy — buffer
  // initialisation, a restore, and a verse/translation switch all resize the
  // array, and a resize is structural, never something the user typed. Together
  // with the identity check below, this is what stops restored persisted input
  // from replaying its blooms on load.
  const occupancyBaselineEsRef = useRef<{ len: number; occ: number[] } | null>(null);
  const occupancyBaselineEnRef = useRef<{ len: number; occ: number[] } | null>(null);
  const beaconIdentityRef = useRef<string>("");

  // Retired via animationend (see the rail segment), never a timer.
  const retireBeacon = (idx: number, lang: 'es' | 'en') => {
    if (lang === 'es') {
      setBeaconIndicesEs(cur => (cur.includes(idx) ? cur.filter(i => i !== idx) : cur));
    } else {
      setBeaconIndicesEn(cur => (cur.includes(idx) ? cur.filter(i => i !== idx) : cur));
    }
  };
  const [coachType, setCoachType] = useState<'encouragement' | 'suggestion' | 'tip'>('encouragement');
  const activePair = getCurrentTranslationPair(state);

  const attemptsKeyEs = attemptId ? `memorize_attempts_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}_es_${activePair?.es || 'RVR1960'}` : null;
  const attemptsKeyEn = attemptId ? `memorize_attempts_v${MEMORIZE_TYPING_STATE_SCHEMA_VERSION}_${attemptId}_en_${activePair?.en || 'KJV'}` : null;

  const [attemptsEs, setAttemptsEs] = useState(() => {
    if (!attemptsKeyEs) return 0;
    const stored = localStorage.getItem(attemptsKeyEs);
    return stored ? parseInt(stored) : 0;
  });
  const [attemptsEn, setAttemptsEn] = useState(() => {
    if (!attemptsKeyEn) return 0;
    const stored = localStorage.getItem(attemptsKeyEn);
    return stored ? parseInt(stored) : 0;
  });

  // Persist attempts to localStorage
  useEffect(() => {
    if (!attemptsKeyEs) return;
    localStorage.setItem(attemptsKeyEs, attemptsEs.toString());
  }, [attemptsEs, attemptsKeyEs]);

  useEffect(() => {
    if (!attemptsKeyEn) return;
    localStorage.setItem(attemptsKeyEn, attemptsEn.toString());
  }, [attemptsEn, attemptsKeyEn]);

  const [userInputEs, setUserInputEs] = useState<string[]>(() => savedTypingState?.userInputEs || []);
  const [userInputEn, setUserInputEn] = useState<string[]>(() => savedTypingState?.userInputEn || []);
  const [cursorIndexEs, setCursorIndexEs] = useState(() => savedTypingState?.cursorIndexEs || 0);
  const [cursorIndexEn, setCursorIndexEn] = useState(() => savedTypingState?.cursorIndexEn || 0);
  // Latest-value cursor refs for the synchronous event stream. Rapid keystrokes
  // and arrow presses can fire before React re-renders, so render-scope closures
  // go stale; every cursor write goes through the Live setters below so the ref
  // always carries the newest position and no event can act on an older one.
  const cursorIndexEsRef = useRef(savedTypingState?.cursorIndexEs || 0);
  const cursorIndexEnRef = useRef(savedTypingState?.cursorIndexEn || 0);
  const setCursorIndexEsLive = (v: number) => {
    cursorIndexEsRef.current = v;
    setCursorIndexEs(v);
  };
  const setCursorIndexEnLive = (v: number) => {
    cursorIndexEnRef.current = v;
    setCursorIndexEn(v);
  };
  const [clueCountEs, setClueCountEs] = useState(() => savedTypingState?.clueCountEs || 0);
  const [clueCountEn, setClueCountEn] = useState(() => savedTypingState?.clueCountEn || 0);
  const [revealedIndicesEs, setRevealedIndicesEs] = useState<number[]>(() => savedTypingState?.revealedIndicesEs || []);
  const [revealedIndicesEn, setRevealedIndicesEn] = useState<number[]>(() => savedTypingState?.revealedIndicesEn || []);
  const [isWrongEs, setIsWrongEs] = useState(() => savedTypingState?.isWrongEs || false);
  const [isWrongEn, setIsWrongEn] = useState(() => savedTypingState?.isWrongEn || false);
  const [hasSubmittedEs, setHasSubmittedEs] = useState(() => savedTypingState?.hasSubmittedEs || false);
  const [hasSubmittedEn, setHasSubmittedEn] = useState(() => savedTypingState?.hasSubmittedEn || false);
  const [incorrectIndicesEs, setIncorrectIndicesEs] = useState<number[]>(() => savedTypingState?.incorrectIndicesEs || []);
  const [incorrectIndicesEn, setIncorrectIndicesEn] = useState<number[]>(() => savedTypingState?.incorrectIndicesEn || []);
  const [submittedWrongCharsEs, setSubmittedWrongCharsEs] = useState<Record<number, string>>(() => savedTypingState?.submittedWrongCharsEs || {});
  const [submittedWrongCharsEn, setSubmittedWrongCharsEn] = useState<Record<number, string>>(() => savedTypingState?.submittedWrongCharsEn || {});
  const [isCorrectEs, setIsCorrectEs] = useState(() => savedTypingState?.isCorrectEs || false);
  const [isCorrectEn, setIsCorrectEn] = useState(() => savedTypingState?.isCorrectEn || false);
  const [didFailFlowEs, setDidFailFlowEs] = useState(() => savedTypingState?.didFailFlowEs || false);
  const [didFailFlowEn, setDidFailFlowEn] = useState(() => savedTypingState?.didFailFlowEn || false);
  const [sessionFailed, setSessionFailed] = useState(() => {
    try {
      return localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
    } catch {
      return false;
    }
  });
  const languageOrderKey = attemptLanguageOrder.join("|");
  const initialCurrentPassIndex = clampPassIndex(
    savedTypingState?.currentPassIndex ?? activeAttempt?.currentPassIndex ?? 0,
    attemptLanguageOrder
  );
  const shouldResumeHalfwayTransition =
    state.memorizeMode === "both" &&
    !!activeAttempt &&
    initialCurrentPassIndex < attemptLanguageOrder.length - 1 &&
    activeAttempt.completedLanguages?.[attemptLanguageOrder[initialCurrentPassIndex]] === true &&
    activeAttempt.cardsReady !== true;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showHalfwayTransition, setShowHalfwayTransition] = useState(() =>
    !!savedTypingState?.showHalfwayTransition || shouldResumeHalfwayTransition
  );
  const [currentPassIndex, setCurrentPassIndexState] = useState(() => initialCurrentPassIndex);
  const activeLanguage = attemptLanguageOrder[currentPassIndex] || attemptLanguageOrder[0] || "es";
  const bilingualPass = currentPassIndex + 1;
  const setCurrentPassIndex = (idx: number) => {
    setCurrentPassIndexState(clampPassIndex(idx, attemptLanguageOrder));
  };
  const setBilingualPass = (pass: number) => {
    setCurrentPassIndex(pass - 1);
  };
  const setActiveLanguage = (lang: MemorizeLanguage) => {
    const nextIndex = attemptLanguageOrder.indexOf(lang);
    setCurrentPassIndex(nextIndex === -1 ? 0 : nextIndex);
  };

  useEffect(() => {
    setCurrentPassIndexState(prev => clampPassIndex(prev, attemptLanguageOrder));
  }, [attemptId, languageOrderKey]);

  useEffect(() => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      if (s.activeAttempt.currentPassIndex === currentPassIndex) return s;
      return {
        ...s,
        activeAttempt: {
          ...s.activeAttempt,
          currentPassIndex,
        },
      };
    });
  }, [attemptId, currentPassIndex, setState]);

  const celebratedHalfwayRef = useRef<string>("");

  // Refs and helper to always hold the latest state values for non-reactive access in debounced save
  const stateRef = useRef({
    schemaVersion: MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
    attemptId: attemptId || "",
    currentPassIndex,
    currentStep: stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    hasSubmittedEs,
    hasSubmittedEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
  });

  // Keep stateRef up to date on every render
  stateRef.current = {
    schemaVersion: MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
    attemptId: attemptId || "",
    currentPassIndex,
    currentStep: stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    hasSubmittedEs,
    hasSubmittedEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
  };

  const saveStateImmediately = () => {
    if (!typingStateKey || !attemptId) return;
    try {
      localStorage.setItem(typingStateKey, JSON.stringify(stateRef.current));
    } catch (e) {
      console.warn("Failed to save typing state", e);
    }
  };

  // 1. Debounced save for the hot path (typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveStateImmediately();
    }, 800); // 800ms debounce
    return () => clearTimeout(timer);
  }, [
    typingStateKey,
    attemptId,
    currentPassIndex,
    stage,
    showHalfwayTransition,
    userInputEs,
    userInputEn,
    cursorIndexEs,
    cursorIndexEn,
    clueCountEs,
    clueCountEn,
    revealedIndicesEs,
    revealedIndicesEn,
    isWrongEs,
    isWrongEn,
    incorrectIndicesEs,
    incorrectIndicesEn,
    submittedWrongCharsEs,
    submittedWrongCharsEn,
  ]);

  // 2. Instantly save state on checkpoints, or on unmount
  useEffect(() => {
    saveStateImmediately();
  }, [
    stage,
    currentPassIndex,
    typingStateKey,
    attemptId,
    isCorrectEs,
    isCorrectEn,
    didFailFlowEs,
    didFailFlowEn,
    hasSubmittedEs,
    hasSubmittedEn,
    showHalfwayTransition,
  ]);

  useEffect(() => {
    return () => {
      saveStateImmediately();
    };
  }, [typingStateKey]);

  const attempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
  const isWrong = activeLanguage === 'es' ? isWrongEs : isWrongEn;
  const hasSubmitted = activeLanguage === 'es' ? hasSubmittedEs : hasSubmittedEn;
  const isCorrect = activeLanguage === 'es' ? isCorrectEs : isCorrectEn;
  const didFailFlow = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;

  const isEsDone = isCorrectEs || didFailFlowEs;
  const isEnDone = isCorrectEn || didFailFlowEn;
  // Completion is judged against the languages this attempt ACTUALLY runs, so a
  // language dropped for a failed translation can never hold the attempt open.
  const isStepComplete = effectiveMemorizeMode === 'both' ? (isEsDone && isEnDone) : (effectiveMemorizeMode === 'es' ? isEsDone : isEnDone);

  const isOverallSuccess = effectiveMemorizeMode === 'both'
    ? (isCorrectEs && isCorrectEn)
    : (effectiveMemorizeMode === 'es' ? isCorrectEs : isCorrectEn);

  const isAnyPartFailed = (effectiveMemorizeMode === 'both'
    ? (didFailFlowEs || didFailFlowEn)
    : (effectiveMemorizeMode === 'es' ? didFailFlowEs : didFailFlowEn)) || sessionFailed;

  // PHASE 4A. In an ordinary session an exhausted Recall genuinely blocks the
  // Citation Step: the passage cannot be acquired without the text. A Review
  // session acquires nothing, so the same block would leave the review
  // unfinishable and the `recall_exhausted` outcome unreachable. Review
  // therefore continues to Citation, and both stages resolve as the scheduling
  // contract requires.
  const recallBlocksCitation = isAnyPartFailed && !isReviewMode;

  // PHASE 4A — the Review-mode active-workspace accents. Each pair keeps the
  // ordinary Memorize value verbatim on the right, so a non-review session is
  // byte-identical to what shipped.
  const frameAccentClass = isReviewMode
    ? "border-[rgba(62,143,123,0.34)] shadow-[0_0_18px_rgba(62,143,123,0.09)]"
    : "border-[rgba(91,120,255,0.32)] shadow-[0_0_18px_rgba(91,120,255,0.08)]";
  const forwardAccentClass = isReviewMode
    ? "border-[rgba(62,143,123,0.55)] text-[#3E8F7B] shadow-[0_0_4px_rgba(62,143,123,0.30)]"
    : "border-(--rim-royal) text-royal shadow-[0_0_4px_rgba(91,120,255,0.30)]";
  const forwardFocusClass = isReviewMode
    ? "focus-visible:outline-[rgba(62,143,123,0.6)]"
    : "focus-visible:outline-[rgba(91,120,255,0.6)]";
  /** Halo behind the CURRENT Recall marker. Occupied tiles stay Royal (locked). */
  const currentTileShadow = isReviewMode
    ? "0 0 9px rgba(62,143,123,0.42), inset 0 1px 0 rgba(231,236,242,0.18)"
    : "0 0 9px rgba(91,120,255,0.38), inset 0 1px 0 rgba(231,236,242,0.18)";

  const activeClueCount = activeLanguage === 'es' ? clueCountEs : clueCountEn;
  const activeAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
  const activeDidFailFlow = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
  const activeIsCorrect = activeLanguage === 'es' ? isCorrectEs : isCorrectEn;

  const canShowClue =
    stage === 5 &&
    !isRevealed &&
    !activeIsCorrect &&
    !activeDidFailFlow &&
    activeAttempts < 3;

  const canUseClue =
    canShowClue &&
    activeClueCount < 1;

  const updateAttemptCompletion = (
    lang: MemorizeLanguage,
    options?: { cardsReady?: boolean; passIndex?: number }
  ) => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      const completedLanguages = {
        ...(s.activeAttempt.completedLanguages || {}),
        [lang]: true,
      };
      return {
        ...s,
        activeAttempt: {
          ...s.activeAttempt,
          completedLanguages,
          currentPassIndex: options?.passIndex ?? currentPassIndex,
          cardsReady: options?.cardsReady ? true : s.activeAttempt.cardsReady,
          textComplete: options?.cardsReady ? true : s.activeAttempt.textComplete,
        },
      };
    });
  };
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const mainActionRef = useRef<HTMLButtonElement>(null);
  const halfwayContinueRef = useRef<HTMLButtonElement>(null);
  const challengeCitationRef = useRef<HTMLButtonElement>(null);
  // Declared here (with the other refs) rather than beside the Citation helpers
  // below, because those live after this component's early returns and a hook
  // must never be called conditionally.
  const citationAcquiredRef = useRef(false);
  // PHASE 4A — in-session half of the exactly-once guard. The durable half is
  // `lastFinalizedSessionId` persisted on the review record itself, so a reload
  // or a remount can never apply the same review result twice.
  const reviewFinalizedRef = useRef(false);
  const isInputComposingRef = useRef(false);
  
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const cleanCacheRef = useRef<Record<string, string>>({});
  const getCleanLetters = (text: string | null | undefined) => {
    if (!text) return "";
    if (cleanCacheRef.current[text] !== undefined) {
      return cleanCacheRef.current[text];
    }
    const clean = text.replace(NON_LETTER_GLOBAL_RE, "");
    if (Object.keys(cleanCacheRef.current).length > 200) {
      cleanCacheRef.current = {};
    }
    cleanCacheRef.current[text] = clean;
    return clean;
  };

  // esText / enText / esError / enError / validatedPair are resolved by the
  // content-integrity gate near the top of this component, so no consumer can
  // read the raw, unsanitised translation text.
  const esTransToUse = validatedPair?.es || (state.selectedTranslations?.es || "RVR1960");
  const enTransToUse = validatedPair?.en || (state.selectedTranslations?.en || "KJV");
  const isEsLoading = !!(verse && state.loadingTranslations && state.loadingTranslations[`${verse.id}_${esTransToUse}`]);
  const isEnLoading = !!(verse && state.loadingTranslations && state.loadingTranslations[`${verse.id}_${enTransToUse}`]);

  const esTextCleanLen = useMemo(() => {
    return getCleanLetters(esText).length;
  }, [esText]);

  const enTextCleanLen = useMemo(() => {
    return getCleanLetters(enText).length;
  }, [enText]);

  const isEditable = (idx: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return false;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    const revealedIndices = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    return idx >= 0 && idx < cleanLen && !revealedIndices.includes(idx);
  };

  // THE ONE CURSOR LAW (Step 5).
  //
  // The logical cursor is a SLOT cursor: it may only occupy an editable letter
  // position, or the past-the-end sentinel `cleanLen` reached solely by typing
  // the final letter. It is never an "insertion boundary".
  //
  // This replaces the previous `isValidCursorIndex` rule, which also accepted
  // any position merely standing AFTER an editable letter (including
  // `cleanLen` and Clue-revealed indices). Those positions satisfied the
  // navigation/click rule but failed `insertTypedText`'s `isEditable(cursor)`
  // guard, so the cursor could rest somewhere that silently swallowed every
  // keystroke — the intermittent input lock. Navigation, clicks, Clue and
  // hydration now all route through editable-only helpers, so the position the
  // map beacon shows is always the position the next keystroke fills.

  const findPreviousEditableIndex = (cursorPosition: number, lang: 'es' | 'en') => {
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (isEditable(i, lang)) {
        return i;
      }
    }
    return -1;
  };

  const findNextEditableIndex = (cursorPosition: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return -1;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    for (let i = cursorPosition; i < cleanLen; i++) {
      if (isEditable(i, lang)) {
        return i;
      }
    }
    return -1;
  };

  // Snap an arbitrary position to the nearest EDITABLE slot (reading order
  // wins ties). Every click, Clue re-seat and hydration path goes through this,
  // so a cursor can never come to rest on a Clue letter or past the end.
  const getNearestCursorIndex = (p: number, lang: 'es' | 'en') => {
    const text = lang === 'es' ? esText : enText;
    if (!text) return 0;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    p = Math.max(0, Math.min(p, cleanLen));

    if (p < cleanLen && isEditable(p, lang)) return p;

    for (let dist = 1; dist <= cleanLen; dist++) {
      const fwd = p + dist;
      const back = p - dist;
      if (fwd < cleanLen && isEditable(fwd, lang)) return fwd;
      if (back >= 0 && isEditable(back, lang)) return back;
    }
    return 0;
  };

  interface WordGroup {
    wordIndex: number;
    wordText: string;
    cleanStartIndex: number;
    cleanEndIndex: number;
    editableIndices: number[];
  }

  const getWordGroups = (text: string | null | undefined, lang: 'es' | 'en'): WordGroup[] => {
    if (!text) return [];
    const words = text.split(" ");
    const groups: WordGroup[] = [];
    let cleanLetterAccumulator = 0;
    
    words.forEach((word, wordIndex) => {
      const wordStartIdx = cleanLetterAccumulator;
      const cleanWordLen = getCleanLetters(word).length;
      const cleanEndIdx = wordStartIdx + cleanWordLen;
      
      const editableIndices: number[] = [];
      for (let i = wordStartIdx; i < cleanEndIdx; i++) {
        if (isEditable(i, lang)) {
          editableIndices.push(i);
        }
      }
      
      groups.push({
        wordIndex,
        wordText: word,
        cleanStartIndex: wordStartIdx,
        cleanEndIndex: cleanEndIdx,
        editableIndices,
      });
      
      cleanLetterAccumulator += cleanWordLen;
    });
    
    return groups;
  };

  const findCurrentWordGroupIndex = (cursorIndex: number, groups: WordGroup[]): number => {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (cursorIndex >= g.cleanStartIndex && cursorIndex <= g.cleanEndIndex) {
        return i;
      }
    }
    return -1;
  };

  const findNextEditableWordStart = (cursorIndex: number, lang: 'es' | 'en'): number => {
    const text = lang === 'es' ? esText : enText;
    const groups = getWordGroups(text, lang);
    const currentGroupIdx = findCurrentWordGroupIndex(cursorIndex, groups);
    
    for (let i = currentGroupIdx + 1; i < groups.length; i++) {
      const g = groups[i];
      if (g.editableIndices.length > 0) {
        return g.editableIndices[0];
      }
    }
    return -1;
  };

  const findPreviousEditableWordStart = (cursorIndex: number, lang: 'es' | 'en'): number => {
    const text = lang === 'es' ? esText : enText;
    const groups = getWordGroups(text, lang);
    const currentGroupIdx = findCurrentWordGroupIndex(cursorIndex, groups);
    
    if (currentGroupIdx === -1) return -1;
    
    const currentGroup = groups[currentGroupIdx];
    const isAtStartOfWord = currentGroup.editableIndices.length > 0 && cursorIndex === currentGroup.editableIndices[0];
    const startIdx = isAtStartOfWord ? currentGroupIdx - 1 : currentGroupIdx;
    
    for (let i = startIdx; i >= 0; i--) {
      const g = groups[i];
      if (g.editableIndices.length > 0) {
        return g.editableIndices[0];
      }
    }
    return -1;
  };

  const lastConfigRef = useRef({
    selectedTranslationsEs: state.selectedTranslations.es,
    selectedTranslationsEn: state.selectedTranslations.en,
    memorizeMode: state.memorizeMode,
    verseId: verse.id,
    attemptId,
  });

  // Reset stage when verse, translations, or display mode changes
  useEffect(() => {
    const prevConfig = lastConfigRef.current;
    const contentConfigChanged =
      prevConfig.selectedTranslationsEs !== state.selectedTranslations.es ||
      prevConfig.selectedTranslationsEn !== state.selectedTranslations.en ||
      prevConfig.memorizeMode !== state.memorizeMode ||
      prevConfig.verseId !== verse.id;
    const attemptChanged = prevConfig.attemptId !== attemptId;

    if (contentConfigChanged || attemptChanged) {
      const dbStage = state.progress.verseStages[verse.id] || 1;
      // Same authoritative rule as the initializer: a Review session re-enters
      // at Step 5 regardless of what ordinary Memorize progress says.
      const nextStage = isReviewMode
        ? REVIEW_ENTRY_STAGE
        : activeAttempt
          ? Math.min(5, savedTypingState?.currentStep || dbStage)
          : 1;
      setStage(nextStage);
      setIsRevealed(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      if (activeAttempt) {
        setCurrentPassIndex(
          clampPassIndex(
            savedTypingState?.currentPassIndex ?? activeAttempt.currentPassIndex ?? 0,
            attemptLanguageOrder
          )
        );
        setShowHalfwayTransition(!!savedTypingState?.showHalfwayTransition || shouldResumeHalfwayTransition);
      } else {
        setCurrentPassIndex(0);
        setShowHalfwayTransition(false);
      }
      setIsAlmostDone(
        isReviewMode
          ? (!!activeAttempt?.citationStarted || !!activeAttempt?.cardsReady)
          : (dbStage === 6 && activeAttempt?.cardsReady === true)
      );
      
      // Preserve attempts if it's the same verse and translations
      if (prevConfig.verseId !== verse.id ||
          prevConfig.selectedTranslationsEs !== state.selectedTranslations.es ||
          prevConfig.selectedTranslationsEn !== state.selectedTranslations.en ||
          attemptChanged) {
        setAttemptsEs(0);
        setAttemptsEn(0);
      }
      
      setUserInputEs(savedTypingState?.userInputEs || []);
      setUserInputEn(savedTypingState?.userInputEn || []);
      setSubmittedWrongCharsEs(savedTypingState?.submittedWrongCharsEs || {});
      setSubmittedWrongCharsEn(savedTypingState?.submittedWrongCharsEn || {});
      setClueCountEs(savedTypingState?.clueCountEs || 0);
      setClueCountEn(savedTypingState?.clueCountEn || 0);
      setIsWrongEs(savedTypingState?.isWrongEs || false);
      setIsWrongEn(savedTypingState?.isWrongEn || false);
      setHasSubmittedEs(savedTypingState?.hasSubmittedEs || false);
      setHasSubmittedEn(savedTypingState?.hasSubmittedEn || false);
      setIncorrectIndicesEs(savedTypingState?.incorrectIndicesEs || []);
      setIncorrectIndicesEn(savedTypingState?.incorrectIndicesEn || []);
      setIsCorrectEs(savedTypingState?.isCorrectEs || false);
      setIsCorrectEn(savedTypingState?.isCorrectEn || false);
      setFeedback(null);
      setRevealedIndicesEs(savedTypingState?.revealedIndicesEs || []);
      setRevealedIndicesEn(savedTypingState?.revealedIndicesEn || []);
      setCursorIndexEsLive(savedTypingState?.cursorIndexEs || 0);
      setCursorIndexEnLive(savedTypingState?.cursorIndexEn || 0);
      
      lastConfigRef.current = {
        selectedTranslationsEs: state.selectedTranslations.es,
        selectedTranslationsEn: state.selectedTranslations.en,
        memorizeMode: state.memorizeMode,
        verseId: verse.id,
        attemptId,
      };
    }
  }, [verse.id, attemptId, state.selectedTranslations.es, state.selectedTranslations.en, state.memorizeMode, setState]);

  // Legacy/orphan transient stage state is not enough to reconstruct a safe
  // bilingual attempt. Preserve completed stage 7 records, but do not recreate an
  // active attempt without its v2 identity, language order, and completion state.
  // The cleanup is armed only after an attempt has been observed in this mounted
  // instance: restored progress is never cleared during the mount/hydration
  // cycle (a reload mid-attempt must always win), only on a genuine in-session
  // transition to an attempt-less state.
  const orphanCleanupArmedRef = useRef(false);
  useEffect(() => {
    if (state.activeAttempt) {
      orphanCleanupArmedRef.current = true;
      return;
    }
    if (!orphanCleanupArmedRef.current) return;
    const dbStage = state.progress.verseStages[verse.id];
    if (dbStage === undefined || dbStage < 2 || dbStage > 6) return;
    setState(s => {
      if (s.activeAttempt) return s;
      const liveStage = s.progress.verseStages[verse.id];
      if (liveStage === undefined || liveStage < 2 || liveStage > 6) return s;
      const nextStages = { ...s.progress.verseStages };
      delete nextStages[verse.id];
      return {
        ...s,
        progress: {
          ...s.progress,
          verseStages: nextStages,
        },
      };
    });
  }, [verse.id, state.activeAttempt, state.progress.verseStages, setState]);

  // Sync state with tour steps
  useEffect(() => {
    if (tourStepId === 'recall-challenge') {
      console.log("[Memorize Debug] Tour step 'recall-challenge' detected. Forcing Stage 5.");
      setStage(5);
      setIsRevealed(false);
      setHasSubmittedEs(false);
      setHasSubmittedEn(false);
      setIncorrectIndicesEs([]);
      setIncorrectIndicesEn([]);
      setSubmittedWrongCharsEs({});
      setSubmittedWrongCharsEn({});
      setIsCorrectEs(false);
      setIsCorrectEn(false);
    } else if (tourStepId === 'practice-mechanic' || tourStepId === 'nav-memorize-step') {
      console.log(`[Memorize Debug] Tour step '${tourStepId}' detected. Resetting to Stage 1.`);
      setStage(1);
      setIsRevealed(false);
    }
  }, [tourStepId]);

  // Sync input selection with cursorIndex
  useEffect(() => {
    if (stage === 5 && !isRevealed && !isAlmostDone && !isInputComposingRef.current && inputRef.current) {
      // For the stream-based input, we always want the cursor at the end (position 1 because value is " ")
      inputRef.current.setSelectionRange(1, 1);
    }
  }, [cursorIndexEs, cursorIndexEn, activeLanguage, stage, isRevealed, isAlmostDone]);

  // Initialize stage-specific content
  useEffect(() => {
    if (stage === 5) {
      if (esText && userInputEs.length === 0) {
        setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
      }
      if (enText && userInputEn.length === 0) {
        setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
      }
    }
  }, [stage, esText, enText, userInputEs.length, userInputEn.length]);

  // One-shot occupancy beacons. This diffs committed state — it is deliberately
  // outside the key event path, so entering a character schedules no timer,
  // measures no DOM and starts no rAF; typing just writes state as before and
  // this observes the result. Only empty -> occupied transitions are marked, so
  // moving the cursor, re-rendering, or clearing a slot bloom nothing, while
  // clearing and retyping a slot may bloom again. Correct and incorrect entries
  // are indistinguishable here: occupancy is a bare "something is stored" test
  // and nothing is ever compared against the canonical answer.
  useEffect(() => {
    // A different attempt/verse/translation is a structural change, never typing.
    const identity = `${attemptId || ""}|${verse.id}|${esTransToUse}|${enTransToUse}|${state.memorizeMode}`;
    const identityChanged = beaconIdentityRef.current !== identity;
    if (identityChanged) beaconIdentityRef.current = identity;

    const detect = (
      input: string[],
      revealed: number[],
      baselineRef: React.MutableRefObject<{ len: number; occ: number[] } | null>,
      setBeacons: React.Dispatch<React.SetStateAction<number[]>>
    ) => {
      const occ: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if ((input[i] || "").trim() !== "") occ.push(i);
      }
      const prev = baselineRef.current;
      baselineRef.current = { len: input.length, occ };

      // Record-only cases: first observation, a resized buffer, or a new
      // identity. Restored input lands through one of these and stays dark.
      if (!prev || identityChanged || prev.len !== input.length) return;

      const prevOccupied = new Set(prev.occ);
      // Clue letters are excluded: they are revealed, not entered, and render as
      // Ember glyphs rather than rail segments.
      const newly = occ.filter(i => !prevOccupied.has(i) && !revealed.includes(i));
      if (newly.length === 0) return;
      setBeacons(cur => {
        const add = newly.filter(i => !cur.includes(i));
        return add.length > 0 ? [...cur, ...add] : cur;
      });
    };

    detect(userInputEs, revealedIndicesEs, occupancyBaselineEsRef, setBeaconIndicesEs);
    detect(userInputEn, revealedIndicesEn, occupancyBaselineEnRef, setBeaconIndicesEn);
  }, [
    userInputEs,
    userInputEn,
    revealedIndicesEs,
    revealedIndicesEn,
    attemptId,
    verse.id,
    esTransToUse,
    enTransToUse,
    state.memorizeMode,
  ]);

  // A pending Enter confirmation belongs to one step, one language pass and one
  // attempt. Any transition retires it, so it can never carry a submit intent
  // into a context the user never armed it for. (Reload needs no handling: the
  // state is not persisted and simply starts closed.)
  useEffect(() => {
    setPendingSubmitLive(false);
  }, [stage, currentPassIndex, attemptId]);

  // ==========================================================================
  // THE CANONICAL LINE MAP. Steps 1-4's proportional Scripture layout is the
  // single layout authority. A hidden, aria-hidden, non-interactive mirror of
  // that exact rendering (same width, font, sizes, gaps, per-character slot
  // minimums) is measured to produce one ordered line map — which canonical
  // word indices share each rendered line — plus ONE global Step-5 board
  // scale derived from the densest line. Measured on verse / language /
  // translation / width / font-load changes only; never on keystrokes,
  // cursor moves, Clue use, or submission.
  // ==========================================================================
  const activeCanonicalText = activeLanguage === 'es' ? esText : enText;
  const canonicalLayoutKey = `${verse.id}|${activeLanguage}|${esTransToUse}|${enTransToUse}|${activeCanonicalText || ""}`;
  const [canonicalLayout, setCanonicalLayout] = useState<CanonicalLayout | null>(null);
  const canonicalMirrorRef = useRef<HTMLDivElement | null>(null);
  const canonicalMirrorRORef = useRef<ResizeObserver | null>(null);
  // Latest-value refs: the measurement function and the ResizeObserver
  // callback always read the current identity/text, never a stale closure.
  const canonicalKeyRef = useRef(canonicalLayoutKey);
  canonicalKeyRef.current = canonicalLayoutKey;
  const activeCanonicalTextRef = useRef(activeCanonicalText);
  activeCanonicalTextRef.current = activeCanonicalText;

  // THE FREEZE RULE (width hysteresis). For one layout identity, a measured
  // width within this many pixels of the frozen map's width is treated as THE
  // SAME width and cannot replace the map. This is what makes the line map
  // immune to every interaction state — including the indirect path QA hit:
  // Clue (or typing) grows the Composer, the page crosses the scroll
  // threshold, a classic scrollbar appears, and the stage narrows by the
  // scrollbar's ~15px. That is an interaction side-effect, not a layout
  // change. A genuine resize or rotation moves the width far beyond this
  // tolerance and remeasures normally.
  const CANONICAL_WIDTH_FREEZE_PX = 24;

  const measureCanonicalLayout = () => {
      const mirror = canonicalMirrorRef.current;
      const activeText = activeCanonicalTextRef.current;
      const layoutKey = canonicalKeyRef.current;
      if (!mirror || !activeText) return;
      const wordEls = Array.from(mirror.querySelectorAll<HTMLElement>("[data-mword]"));
      if (wordEls.length === 0) return;

      // Group canonical words into visual lines by rendered top position; the
      // small tolerance absorbs sub-pixel layout differences.
      const lines: number[][] = [];
      let prevTop: number | null = null;
      wordEls.forEach(el => {
        const top = el.offsetTop;
        const idx = Number(el.dataset.mword || "0");
        if (prevTop === null || Math.abs(top - prevTop) > 4) {
          lines.push([idx]);
          prevTop = top;
        } else {
          lines[lines.length - 1].push(idx);
        }
      });

      // ONE global board-fit scale (Section G): resolve the approved clamp()
      // proportions in JS, sum each canonical line's logical occupancy (cells,
      // intra gaps, a fixed punctuation reserve, inter gaps), and scale the
      // whole board system so the densest line fits the stage width. The
      // calculation depends only on canonical structure and available width —
      // typed glyphs (wide `W` included) play no part.
      const vw = window.innerWidth;
      const resolve = (c: { min: number; vw: number; max: number }) =>
        Math.min(c.max, Math.max(c.min, c.vw * vw));
      const baseCell = resolve(BOARD_BASE.cell);
      const baseIntra = resolve(BOARD_BASE.intra);
      const baseInter = resolve(BOARD_BASE.inter);
      const basePunct = baseCell * 0.5; // reserve per fixed punctuation glyph

      const words = activeText.split(" ");
      const avail = mirror.clientWidth;
      let maxRequired = 0;
      lines.forEach(line => {
        let req = Math.max(0, line.length - 1) * baseInter;
        line.forEach(wi => {
          const word = words[wi] || "";
          const letters = getCleanLetters(word).length;
          const punct = Array.from(word).filter(ch => !isLetterChar(ch)).length;
          req += letters * baseCell + Math.max(0, letters - 1) * baseIntra + punct * basePunct;
        });
        if (req > maxRequired) maxRequired = req;
      });
      const scale = avail > 0 && maxRequired > avail ? avail / maxRequired : 1;

      const sig = lines.map(l => l.join(",")).join("|");
      const next: CanonicalLayout = {
        key: layoutKey,
        width: avail,
        sig,
        lines,
        board: { cell: baseCell * scale, intra: baseIntra * scale, inter: baseInter * scale },
      };

      setCanonicalLayout(prev => {
        // THE FROZEN VALID MAP (Section F). A valid map for the current layout
        // identity is preserved against every interaction state. Only three
        // things may replace it:
        //   1. a different layout identity (verse/language/translation/text);
        //   2. a genuine width change beyond the freeze tolerance
        //      (resize/rotation — never the scrollbar side-effect of Clue or
        //      typing growing the page);
        //   3. the authoritative post-font-load correction: the SAME width
        //      (sub-pixel, ≤1px) measuring a genuinely different row signature.
        // Clue, typing, cursor movement, Peek, submission and review can
        // trigger none of these, so they can never regroup the lines.
        if (prev && prev.key === layoutKey) {
          const widthDelta = Math.abs(prev.width - avail);
          if (widthDelta <= CANONICAL_WIDTH_FREEZE_PX) {
            if (widthDelta <= 1 && prev.sig !== sig) {
              return next; // font-readiness correction at the same width
            }
            return prev; // frozen — identical or interaction-induced delta
          }
        }
        return next; // new identity or genuine resize
      });
  };
  // Stable identity holder so the ResizeObserver callback and the mount
  // callback ref always invoke the latest measurement logic.
  const measureCanonicalLayoutRef = useRef(measureCanonicalLayout);
  measureCanonicalLayoutRef.current = measureCanonicalLayout;

  // Mirror lifecycle rides the NODE itself. This stable callback ref runs on
  // mount/unmount only (never on re-renders, never on keystrokes): on mount it
  // measures pre-paint and attaches the mirror-scoped ResizeObserver; on
  // unmount it disconnects. Because the lifecycle is node-driven, no
  // interaction flag needs to appear in any dependency list, and returning
  // from an early-return branch re-measures automatically when the mirror
  // remounts.
  const attachCanonicalMirror = useMemo(() => (node: HTMLDivElement | null) => {
    canonicalMirrorRef.current = node;
    if (canonicalMirrorRORef.current) {
      canonicalMirrorRORef.current.disconnect();
      canonicalMirrorRORef.current = null;
    }
    if (node) {
      measureCanonicalLayoutRef.current();
      if (typeof ResizeObserver !== "undefined") {
        canonicalMirrorRORef.current = new ResizeObserver(() => measureCanonicalLayoutRef.current());
        canonicalMirrorRORef.current.observe(node);
      }
    }
  }, []);

  useLayoutEffect(() => {
    // Layout identity changed (verse / language / translation / canonical
    // text): measure pre-paint so Step 5 never flickers, then re-measure once
    // fonts settle. The fonts promise is guarded against staleness by
    // comparing the identity that subscribed with the identity at resolution.
    measureCanonicalLayoutRef.current();
    let cancelled = false;
    const keyAtSubscribe = canonicalLayoutKey;
    try {
      document.fonts?.ready?.then(() => {
        if (!cancelled && canonicalKeyRef.current === keyAtSubscribe) {
          measureCanonicalLayoutRef.current();
        }
      });
    } catch { /* Fonts API unavailable: the pre-paint measurement stands. */ }
    return () => { cancelled = true; };
  }, [canonicalLayoutKey]);

  // Enforce the cursor law on every entry into live Step 5. A cursor restored
  // from persisted state, left behind by a Clue reveal, or carried across a
  // language switch could otherwise sit on a non-editable slot and swallow
  // keystrokes. `cleanLen` (past-the-end, reached only by typing the final
  // letter) is a legitimate rest position and is left alone.
  useEffect(() => {
    if (stage !== 5 || isRevealed || isAlmostDone) return;
    const lang = activeLanguage;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    if (cleanLen === 0) return;
    const cur = lang === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
    if (cur >= cleanLen) return;
    if (isEditable(cur, lang)) return;
    const snapped = getNearestCursorIndex(cur, lang);
    if (snapped === cur) return;
    if (lang === 'es') setCursorIndexEsLive(snapped);
    else setCursorIndexEnLive(snapped);
  }, [
    stage,
    isRevealed,
    isAlmostDone,
    activeLanguage,
    esTextCleanLen,
    enTextCleanLen,
    revealedIndicesEs,
    revealedIndicesEn,
  ]);

  // Focus management for Stage 5 typing
  useEffect(() => {
    // Allow focus if in stage 5, not revealed, and they haven't won or failed completely
    const canEdit = stage === 5 && !isRevealed && !isAlmostDone && !isCorrect && !didFailFlow;
    
    if (canEdit) {
      const focusInput = () => {
        if (inputRef.current && !isInputComposingRef.current) {
          inputRef.current.focus();
          // Keep selection at the end for detection
          inputRef.current.setSelectionRange(1, 1);
        }
      };
      
      // Initial focus
      focusInput();
      
      // Re-focus on window focus to ensure typing always works
      window.addEventListener('focus', focusInput);
      return () => window.removeEventListener('focus', focusInput);
    }
  }, [stage, isRevealed, isAlmostDone, isCorrect, didFailFlow, activeLanguage, clueCountEs, clueCountEn]);

  // Non-typing steps use the focused arrow button's native Enter activation.
  useEffect(() => {
    if (stage < 1 || stage >= 5 || isAlmostDone || showHalfwayTransition) return;
    const timer = window.setTimeout(() => {
      try {
        mainActionRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Main action focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [stage, isAlmostDone, showHalfwayTransition]);

  // Successful bilingual handoff uses the focused continue button's native Enter activation.
  useEffect(() => {
    const currentPassFailed = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
    if (!showHalfwayTransition || currentPassFailed) return;
    const timer = window.setTimeout(() => {
      try {
        halfwayContinueRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Halfway continue focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showHalfwayTransition, activeLanguage, didFailFlowEs, didFailFlowEn]);

  // Final bilingual completion handoff uses the focused citation button's native Enter activation.
  useEffect(() => {
    if (!isAlmostDone || effectiveMemorizeMode !== 'both' || isAnyPartFailed) return;
    const timer = window.setTimeout(() => {
      try {
        challengeCitationRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Challenge citation focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAlmostDone, state.memorizeMode, isAnyPartFailed]);

  // Phase 3C: the stage-6 "You're almost there" screen is an INTERMEDIATE
  // milestone — the passage is not acquired until Citation is complete — so the
  // large confetti/particle burst that used to fire here was REMOVED, along with
  // its `celebratedAlmostDoneRef` guard. Reaching Step 6 no longer reads as the
  // finale and nothing crosses the dock. The handoff screen itself is untouched
  // (checkmark, gold ring and glow, copy, Citation action), no replacement
  // animation was added, and the final stage-7 acquisition celebration is
  // unchanged. Trigger-scope correction only — not the Phase 8 redesign.

  useEffect(() => {
    const isFailedSession = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
    if (showHalfwayTransition && !isFailedSession) {
      const halfwayKey = `halfway_${verse.id}_${activeLanguage}`;
      if (celebratedHalfwayRef.current !== halfwayKey) {
        celebratedHalfwayRef.current = halfwayKey;
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E8B34B', '#F0C46E', '#8FA2FF'], // Ember gold + royal soft (earned)
          ticks: 200,
          gravity: 1.2
        });
      }
    }
  }, [showHalfwayTransition, activeLanguage, didFailFlowEs, didFailFlowEn, verse.id]);

  if (verse && ((state.memorizeMode === 'es' && isEsLoading) || (state.memorizeMode === 'en' && isEnLoading) || (state.memorizeMode === 'both' && (isEsLoading || isEnLoading)))) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <Loader2 className="animate-spin text-royal-soft" size={36} />
        <p className="font-hanken text-cold-grey text-sm font-medium">
          {state.primaryLanguage === 'es' ? 'Cargando traducción...' : 'Loading translation...'}
        </p>
      </div>
    );
  }

  if (!verse || (!esText && !enText)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[rgba(209,78,92,0.08)] border border-[rgba(209,78,92,0.40)] flex items-center justify-center">
          <AlertCircle size={32} className="text-[#F0A6A0]" />
        </div>
        <h3 className="text-xl font-fraunces font-medium text-cool-white">
          {state.primaryLanguage === 'es' ? 'Versículo no disponible' : 'Verse unavailable'}
        </h3>
        <div className="space-y-2">
          {esError && <p className="font-hanken text-[#F0A6A0] font-semibold text-sm">{esError}</p>}
          {enError && <p className="font-hanken text-[#F0A6A0] font-semibold text-sm">{enError}</p>}
        </div>
        <p className="font-hanken text-cold-grey max-w-xs pt-4">
          {state.primaryLanguage === 'es'
            ? 'Por favor selecciona una traducción diferente en los ajustes.'
            : 'Please select a different translation in settings.'}
        </p>
      </div>
    );
  }

  const nextStage = (forceFailed?: boolean) => {
    // Rotate coach type for variety
    const types: ('encouragement' | 'suggestion' | 'tip')[] = ['encouragement', 'suggestion', 'tip'];
    setCoachType(types[Math.floor(Math.random() * types.length)]);

    if (stage < 5) {
      const newStage = stage + 1;
      setStage(newStage);
      setIsRevealed(false);
      
      if (activeLanguage === 'es') {
        setDidFailFlowEs(false);
        setAttemptsEs(0);
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setIsCorrectEs(false);
        setRevealedIndicesEs([]);
        setCursorIndexEsLive(0);
      } else {
        setDidFailFlowEn(false);
        setAttemptsEn(0);
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setIsCorrectEn(false);
        setRevealedIndicesEn([]);
        setCursorIndexEnLive(0);
      }
      setFeedback(null);
      
      // Initialize slot buffers for Stage 5
      if (newStage === 5) {
        if (esText) setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
        if (enText) setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
      }

      setState(s => ({
        ...s,
        progress: {
          ...s.progress,
          verseStages: {
            ...s.progress.verseStages,
            [verse.id]: newStage
          }
        }
      }));
    } else {
      // Logic for moving past Stage 5
      if (state.memorizeMode === 'both' && currentPassIndex < attemptLanguageOrder.length - 1) {
        updateAttemptCompletion(activeLanguage, { cardsReady: false, passIndex: currentPassIndex });
        // Clear attempts for the language JUST finished
        if (activeLanguage === 'es') {
          if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        } else if (attemptsKeyEn) {
          localStorage.removeItem(attemptsKeyEn);
        }
        setShowHalfwayTransition(true);
      } else {
        // PHASE 4A — latch the Step 5 outcome facts onto the attempt BEFORE the
        // per-attempt keys below are cleared. Without this latch a reload
        // between Step 5 and Step 6 would lose the wrong-submission and Clue
        // counts that separate a clean success from a recovered one, and the
        // scheduler would silently over-reward the session.
        const recallWrongSubmissions = attemptLanguageOrder.reduce(
          (n, lang) => n + (lang === 'es' ? attemptsEs : attemptsEn),
          0
        );
        const recallCluesUsed = attemptLanguageOrder.reduce(
          (n, lang) => n + (lang === 'es' ? clueCountEs : clueCountEn),
          0
        );
        const recallExhaustedNow = forceFailed !== undefined ? forceFailed : isAnyPartFailed;
        setState(s => (
          s.activeAttempt && s.activeAttempt.attemptId === attemptId
            ? {
                ...s,
                activeAttempt: {
                  ...s.activeAttempt,
                  recallWrongSubmissions,
                  recallCluesUsed,
                  recallExhausted: recallExhaustedNow,
                },
              }
            : s
        ));

        // Clear attempts and typing state on level exit
        if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
        if (typingStateKey) localStorage.removeItem(typingStateKey);

        // Success Persistence Fix: Save verse when successfully completed
        const effectiveFailed = forceFailed !== undefined ? forceFailed : isAnyPartFailed;
        if (!effectiveFailed) {
          try {
            localStorage.setItem(`memorize_failed_${verse.id}`, "false");
          } catch (e) {
            console.error(e);
          }
          setState(s => {
            const completedLanguages = s.activeAttempt && s.activeAttempt.attemptId === attemptId
              ? {
                  ...(s.activeAttempt.completedLanguages || {}),
                  [activeLanguage]: true,
                }
              : { [activeLanguage]: true };
            const allRequiredComplete = attemptLanguageOrder.every(lang => completedLanguages[lang] === true);
            return {
              ...s,
              activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
                ? {
                    ...s.activeAttempt,
                    completedLanguages,
                    currentPassIndex,
                    cardsReady: allRequiredComplete,
                    textComplete: allRequiredComplete,
                  }
                : s.activeAttempt,
              // PHASE 4A — a Review session tends an ALREADY acquired passage.
              // It must not add a Saved entry it already has, and it must not
              // demote its completed stage 7 back to 6.
              savedVerses: (!isReviewMode && allRequiredComplete && !s.savedVerses.includes(verse.id))
                ? [...s.savedVerses, verse.id]
                : s.savedVerses,
              progress: isReviewMode
                ? s.progress
                : {
                    ...s.progress,
                    verseStages: {
                      ...s.progress.verseStages,
                      [verse.id]: allRequiredComplete ? 6 : (s.progress.verseStages[verse.id] || 1)
                    }
                  }
            };
          });
        } else {
          try {
            localStorage.setItem(`memorize_failed_${verse.id}`, "true");
          } catch (e) {
            console.error(e);
          }
        }
        setIsAlmostDone(true);
      }
    }
  };

  const handleHalfwayContinue = () => {
    const nextIndex = clampPassIndex(currentPassIndex + 1, attemptLanguageOrder);
    setCurrentPassIndex(nextIndex);
    // PHASE 4A — a Review session skips Steps 1-4 on EVERY pass, including the
    // second language of a bilingual review. An ordinary session is unchanged.
    setStage(isReviewMode ? 5 : 1);
    setShowHalfwayTransition(false);
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    
    const nextLang = attemptLanguageOrder[nextIndex] || activeLanguage;
    setIsRevealed(false);
    
    // Only reset state for the coming language.
    // The language they just finished was completed successfully, so we must keep its states!
    if (nextLang === 'es') {
      setAttemptsEs(0);
      setUserInputEs([]);
      setSubmittedWrongCharsEs({});
      setClueCountEs(0);
      setIsWrongEs(false);
      setHasSubmittedEs(false);
      setIncorrectIndicesEs([]);
      setIsCorrectEs(false);
      setRevealedIndicesEs([]);
      setCursorIndexEsLive(0);
    } else {
      setAttemptsEn(0);
      setUserInputEn([]);
      setSubmittedWrongCharsEn({});
      setClueCountEn(0);
      setIsWrongEn(false);
      setHasSubmittedEn(false);
      setIncorrectIndicesEn([]);
      setIsCorrectEn(false);
      setRevealedIndicesEn([]);
      setCursorIndexEnLive(0);
    }
    // Entering Step 5 directly means the slot buffer is not initialized by the
    // stage-advance path, so the Recall Workspace is sized here instead.
    if (isReviewMode) {
      if (nextLang === 'es' && esText) {
        setUserInputEs(new Array(getCleanLetters(esText).length).fill(""));
      }
      if (nextLang === 'en' && enText) {
        setUserInputEn(new Array(getCleanLetters(enText).length).fill(""));
      }
    }
    setFeedback(null);
  };

  const prevStage = () => {
    // Anti-cheat: Disable going back on Stage 5
    if (stage > 1 && stage !== 5) {
      const newStage = stage - 1;
      setStage(newStage);
      setIsRevealed(false);
      setIsAlmostDone(false);
      setShowHalfwayTransition(false);
      setDidFailFlowEs(false);
      setDidFailFlowEn(false);
      // We don't reset attempts when going back/forward within the session
      // but standard transitions might expect it. 
      // Actually, we want persistence, so we only reset on truly new verse/reset()
      
      if (activeLanguage === 'es') {
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setCursorIndexEsLive(0);
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setIsCorrectEs(false);
        setRevealedIndicesEs([]);
      } else {
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setCursorIndexEnLive(0);
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setIsCorrectEn(false);
        setRevealedIndicesEn([]);
      }
      setFeedback(null);
      setState(s => ({
        ...s,
        progress: {
          ...s.progress,
          verseStages: {
            ...s.progress.verseStages,
            [verse.id]: newStage
          }
        }
      }));
    }
  };

  const reset = () => {
    // PHASE 4A — a Review session never resets an acquired passage. Reset
    // rewinds verseStages to 1 and rebuilds the attempt, which would demote a
    // completed passage out of Saved's completed state. Review mode reaches
    // this function through no reachable control (its halfway screen always
    // continues and its failure screen is bypassed); this is the guard.
    if (isReviewMode) return;

    // If this attempt actually runs both languages, check for a partial retry.
    if (effectiveMemorizeMode === 'both') {
      const enPassed = isCorrectEn && !didFailFlowEn;
      const esPassed = isCorrectEs && !didFailFlowEs;
      
      if (enPassed && !esPassed) {
        // English completed successfully, Spanish failed or incomplete. Only retry Spanish!
        if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setActiveLanguage('es');
        
        setDidFailFlowEs(false);
        setAttemptsEs(0);
        setUserInputEs([]);
        setSubmittedWrongCharsEs({});
        setClueCountEs(0);
        setIsWrongEs(false);
        setHasSubmittedEs(false);
        setIncorrectIndicesEs([]);
        setFeedback(null);
        setRevealedIndicesEs([]);
        setCursorIndexEsLive(0);
        
        setState(s => ({
          ...s,
          activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
            ? {
                ...s.activeAttempt,
                completedLanguages: {
                  ...(s.activeAttempt.completedLanguages || {}),
                  en: true,
                  es: false,
                },
                currentPassIndex: attemptLanguageOrder.indexOf("es") === -1 ? 0 : attemptLanguageOrder.indexOf("es"),
                cardsReady: false,
                textComplete: false,
              }
            : s.activeAttempt,
          progress: {
            ...s.progress,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 1
            }
          }
        }));
        return;
      } else if (esPassed && !enPassed) {
        // Spanish completed successfully, English failed or incomplete. Only retry English!
        if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
        setSessionFailed(false);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "false");
        } catch {}
        
        setStage(1);
        setIsRevealed(false);
        setIsAlmostDone(false);
        setShowHalfwayTransition(false);
        setActiveLanguage('en');
        
        setDidFailFlowEn(false);
        setAttemptsEn(0);
        setUserInputEn([]);
        setSubmittedWrongCharsEn({});
        setClueCountEn(0);
        setIsWrongEn(false);
        setHasSubmittedEn(false);
        setIncorrectIndicesEn([]);
        setFeedback(null);
        setRevealedIndicesEn([]);
        setCursorIndexEnLive(0);
        
        setState(s => ({
          ...s,
          activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
            ? {
                ...s.activeAttempt,
                completedLanguages: {
                  ...(s.activeAttempt.completedLanguages || {}),
                  es: true,
                  en: false,
                },
                currentPassIndex: attemptLanguageOrder.indexOf("en") === -1 ? 0 : attemptLanguageOrder.indexOf("en"),
                cardsReady: false,
                textComplete: false,
              }
            : s.activeAttempt,
          progress: {
            ...s.progress,
            verseStages: {
              ...s.progress.verseStages,
              [verse.id]: 1
            }
          }
        }));
        return;
      }
    }

    // Clear attempts on intentional reset
    if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
    if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
    if (typingStateKey) localStorage.removeItem(typingStateKey);
    localStorage.removeItem(`memorize_failed_${verse.id}`);
    setSessionFailed(false);
    
    setStage(1);
    setIsRevealed(false);
    setIsAlmostDone(false);
    setShowHalfwayTransition(false);
    setBilingualPass(1);
    
    const initialLang = attemptLanguageOrder[0] || (effectiveMemorizeMode === 'en' ? 'en' : effectiveMemorizeMode === 'es' ? 'es' : state.primaryLanguage);
    setActiveLanguage(initialLang);
    
    setDidFailFlowEs(false);
    setDidFailFlowEn(false);
    setAttemptsEs(0);
    setAttemptsEn(0);
    setUserInputEs([]);
    setUserInputEn([]);
    setSubmittedWrongCharsEs({});
    setSubmittedWrongCharsEn({});
    setClueCountEs(0);
    setClueCountEn(0);
    setIsWrongEs(false);
    setIsWrongEn(false);
    setHasSubmittedEs(false);
    setHasSubmittedEn(false);
    setIncorrectIndicesEs([]);
    setIncorrectIndicesEn([]);
    setIsCorrectEs(false);
    setIsCorrectEn(false);
    setFeedback(null);
    setRevealedIndicesEs([]);
    setRevealedIndicesEn([]);
    setState(s => ({
      ...s,
      activeAttempt: s.activeAttempt && s.activeAttempt.attemptId === attemptId
        ? {
            ...s.activeAttempt,
            currentPassIndex: 0,
            completedLanguages: attemptLanguageOrder.reduce<Partial<Record<MemorizeLanguage, boolean>>>((acc, lang) => {
              acc[lang] = false;
              return acc;
            }, {}),
            cardsReady: false,
            textComplete: false,
          }
        : s.activeAttempt,
      progress: {
        ...s.progress,
        verseStages: {
          ...s.progress.verseStages,
          [verse.id]: 1
        }
      }
    }));
  };

  const handleLanguageSwitch = (lang: 'es' | 'en') => {
    if (effectiveMemorizeMode === 'both' && activeLanguage !== lang) {
      setActiveLanguage(lang);
      
      const targetText = lang === 'es' ? esText : enText;
      const targetCleanSize = getCleanLetters(targetText || "").length;
      const currentUserInput = lang === 'es' ? userInputEs : userInputEn;
      const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;

      // When clicking the container, try to find a sensible spot:
      // Either first empty editable, or just the current index for that language.
      // Actually, since we have cursorIndex per language, we just stick with it.
      // But we must ensure it's valid.
      const currentCursor = lang === 'es' ? cursorIndexEs : cursorIndexEn;
      if (currentCursor >= targetCleanSize) {
        // Find first empty
        let firstEmpty = 0;
        while (firstEmpty < targetCleanSize && (revealed.includes(firstEmpty) || currentUserInput[firstEmpty])) {
          firstEmpty++;
        }
        if (lang === 'es') setCursorIndexEsLive(Math.min(firstEmpty, targetCleanSize));
        else setCursorIndexEnLive(Math.min(firstEmpty, targetCleanSize));
      }
      
      // Immediate focus for mobile
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleClue = (lang: 'es' | 'en') => {
    cancelPendingSubmit();
    const processClueForLang = (l: 'es' | 'en') => {
      const text = l === 'es' ? esText : enText;
      if (!text) return;

      const count = l === 'es' ? clueCountEs : clueCountEn;
      const setCount = l === 'es' ? setClueCountEs : setClueCountEn;
      const revealed = l === 'es' ? revealedIndicesEs : revealedIndicesEn;
      const setRevealed = l === 'es' ? setRevealedIndicesEs : setRevealedIndicesEn;

      if (stage === 5) {
        if (count >= 1) return;
        
        const newRevealed: number[] = [];
        let currentLetterIndex = 0;
        const lines = text.split("\n");
        const cleanTargetArr = getCleanLetters(text).split("");
        
        lines.forEach(line => {
          const words = line.split(" ");
          words.forEach(word => {
            const chars = word.split("");
            let wordHasLetter = false;
            chars.forEach(char => {
              // Must use the SAME letter set as `getCleanLetters`, which
              // produced `cleanTargetArr` above: this running index addresses
              // that array. Omitting `ü/Ü` here (as it previously did) desynced
              // the two for every letter after a ü.
              if (isLetterChar(char)) {
                if (!wordHasLetter) {
                  newRevealed.push(currentLetterIndex);
                  wordHasLetter = true;
                }
                currentLetterIndex++;
              }
            });
          });
        });
        
        setRevealed(newRevealed);
        setCount(1);

        // Clue fills and protects these indices, so any review marks they still
        // carried from an earlier submission no longer describe anything the
        // user can act on. Drop only those; every other mark stays. Functional
        // updates, so a mark can never be restored from a stale closure.
        if (l === 'es') {
          setIncorrectIndicesEs(prev => prev.filter(i => !newRevealed.includes(i)));
          setSubmittedWrongCharsEs(prev => {
            const next = { ...prev };
            newRevealed.forEach(i => { delete next[i]; });
            return next;
          });
        } else {
          setIncorrectIndicesEn(prev => prev.filter(i => !newRevealed.includes(i)));
          setSubmittedWrongCharsEn(prev => {
            const next = { ...prev };
            newRevealed.forEach(i => { delete next[i]; });
            return next;
          });
        }

        const setter = l === 'es' ? setUserInputEs : setUserInputEn;
        setter(prev => {
          const next = [...prev];
          newRevealed.forEach(idx => {
            next[idx] = cleanTargetArr[idx];
          });
          return next;
        });

        if (l === activeLanguage) {
          const setCursor = l === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
          // Latest-value ref, not render state: Clue may fire straight after a
          // keystroke whose cursor write has not re-rendered yet.
          const oldCursor = l === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;

          const tempRevealed = [...revealed, ...newRevealed];
          const isEditableWithTemp = (idx: number) => {
            if (idx < 0 || idx >= cleanTargetArr.length) return false;
            return !tempRevealed.includes(idx);
          };

          let finalCursor = oldCursor;
          if (!isEditableWithTemp(finalCursor)) {
            let foundNext = -1;
            for (let i = finalCursor + 1; i < cleanTargetArr.length; i++) {
              if (isEditableWithTemp(i)) {
                foundNext = i;
                break;
              }
            }
            if (foundNext !== -1) {
              finalCursor = foundNext;
            } else {
              let foundPrev = -1;
              for (let i = finalCursor - 1; i >= 0; i--) {
                if (isEditableWithTemp(i)) {
                  foundPrev = i;
                  break;
                }
              }
              if (foundPrev !== -1) {
                finalCursor = foundPrev;
              } else {
                finalCursor = 0;
              }
            }
          }
          setCursor(finalCursor);
        }
      } else {
        if (count >= 2) return;
        const cleanTarget = getCleanLetters(text);
        const unrevealedIndices: number[] = [];
        for (let i = 0; i < cleanTarget.length; i++) {
          if (!revealed.includes(i)) {
            unrevealedIndices.push(i);
          }
        }

        if (unrevealedIndices.length > 0) {
          const randomIdx = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
          setRevealed(prev => [...prev, randomIdx]);
          setCount(prev => prev + 1);
        }
      }
    };

    if (effectiveMemorizeMode === 'both' && !isMobile) {
      processClueForLang('es');
      processClueForLang('en');
    } else {
      processClueForLang(lang);
    }

    if (stage === 5) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const getTypedTextFromInputValue = (value: string) => {
    return value.startsWith(" ") ? value.slice(1) : value;
  };

  // One synchronous focus hand-back for pointer interactions. Deliberately not
  // a retry loop, not a typing-path timeout and not an rAF: a pointer press
  // blurs the hidden input, and this returns focus within the same task so the
  // very next keystroke lands.
  const focusStreamInput = () => {
    const el = inputRef.current;
    if (!el || isInputComposingRef.current) return;
    try {
      el.focus({ preventScroll: true });
      el.setSelectionRange(1, 1);
    } catch {
      // Selection APIs can throw on a detached node; focus is best-effort.
    }
  };

  const resetStreamInput = (input?: HTMLInputElement | null) => {
    if (input) {
      input.value = " ";
      try {
        input.setSelectionRange(1, 1);
      } catch {}
    }
  };

  // Clear one slot's user entry, plus any stale post-submit bookkeeping for it.
  // Every write is a functional update, so rapid Backspace/Delete repeats
  // compose instead of a later event overwriting an earlier one through a stale
  // array closure. Returns the previous object/array untouched when there is
  // nothing to change, so no needless re-render is queued.
  const clearSlotValue = (idx: number, lang: 'es' | 'en') => {
    if (idx < 0) return;
    if (lang === 'es') {
      setSubmittedWrongCharsEs(prev => {
        if (prev[idx] === undefined) return prev;
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      setIncorrectIndicesEs(prev => (prev.includes(idx) ? prev.filter(i => i !== idx) : prev));
      setUserInputEs(prev => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
    } else {
      setSubmittedWrongCharsEn(prev => {
        if (prev[idx] === undefined) return prev;
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      setIncorrectIndicesEn(prev => (prev.includes(idx) ? prev.filter(i => i !== idx) : prev));
      setUserInputEn(prev => {
        const next = [...prev];
        next[idx] = "";
        return next;
      });
    }
  };

  const insertTypedText = (textToInsert: string) => {
    if (!textToInsert) return;

    // Printable input is an edit: it cancels a pending Enter confirmation and
    // continues normally.
    cancelPendingSubmit();

    const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
    const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
    const targetCleanLen = activeLanguage === 'es' ? esTextCleanLen : enTextCleanLen;
    const setter = activeLanguage === 'es' ? setUserInputEs : setUserInputEn;
    const touchedIndices: number[] = [];
    let nextCursor = cursor;
    // Insertions are recorded by slot index and applied through a functional
    // update below, so rapid successive events compose instead of a later
    // event overwriting an earlier one through a stale array closure.
    const insertions: Record<number, string> = {};

    if (hasSubmitted) {
      if (activeLanguage === 'es') {
        setHasSubmittedEs(false);
        setIsWrongEs(false);
      } else {
        setHasSubmittedEn(false);
        setIsWrongEn(false);
      }
    }

    for (const char of Array.from(textToInsert)) {
      if (char.trim() === "") {
        const nextWordStart = findNextEditableWordStart(nextCursor, activeLanguage);
        if (nextWordStart !== -1) {
          nextCursor = nextWordStart;
        }
        continue;
      }

      if (nextCursor < targetCleanLen && isEditable(nextCursor, activeLanguage)) {
        insertions[nextCursor] = char;
        touchedIndices.push(nextCursor);

        let next = nextCursor + 1;
        while (next < targetCleanLen && !isEditable(next, activeLanguage)) {
          next++;
        }
        nextCursor = Math.min(next, targetCleanLen);
      }
    }

    if (touchedIndices.length > 0) {
      if (activeLanguage === 'es') {
        setSubmittedWrongCharsEs(prev => {
          const next = { ...prev };
          touchedIndices.forEach(idx => {
            delete next[idx];
          });
          return next;
        });
        setIncorrectIndicesEs(prev => prev.filter(idx => !touchedIndices.includes(idx)));
      } else {
        setSubmittedWrongCharsEn(prev => {
          const next = { ...prev };
          touchedIndices.forEach(idx => {
            delete next[idx];
          });
          return next;
        });
        setIncorrectIndicesEn(prev => prev.filter(idx => !touchedIndices.includes(idx)));
      }
      setter(prev => {
        const next = [...prev];
        touchedIndices.forEach(idx => {
          next[idx] = insertions[idx];
        });
        return next;
      });
    }

    setCursor(nextCursor);
  };

  const normalizeText = (text: string | null | undefined) => {
    if (!text) return "";
    return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
  };

  const handleCheck = () => {
    if (isCorrect) return;

    // Every submit path (Enter confirmation, pointer control, Next arrow)
    // converges here, so the confirmation always closes exactly once.
    setPendingSubmitLive(false);

    if (activeLanguage === 'es') setHasSubmittedEs(true);
    else setHasSubmittedEn(true);

    const targetText = activeLanguage === 'es' ? esText : enText;
    const targetClean = getCleanLetters(targetText || "").toLowerCase();
    const userInput = activeLanguage === 'es' ? userInputEs : userInputEn;
    const revealed = activeLanguage === 'es' ? revealedIndicesEs : revealedIndicesEn;

    if (targetClean.length === 0) return;
    
    const normalizedTarget = removeAccents(targetClean).toLowerCase();
    let isCurrentCorrect = true;
    let firstIncorrectIdx = -1;
    const currentIncorrectIndices: number[] = [];
    const wrongChars: Record<number, string> = {};
    
    for (let i = 0; i < normalizedTarget.length; i++) {
      if (!revealed.includes(i)) {
        const char = userInput[i] || "";
        const isCharEmpty = char.trim() === "";
        
        if (removeAccents(char.toLowerCase()) !== normalizedTarget[i]) {
          isCurrentCorrect = false;
          currentIncorrectIndices.push(i);
          if (firstIncorrectIdx === -1) {
            firstIncorrectIdx = i;
          }
          if (char && !isCharEmpty) {
            wrongChars[i] = char;
          }
        }
      }
    }
    
    if (isCurrentCorrect) {
      if (activeLanguage === 'es') {
        setIsCorrectEs(true);
        setIncorrectIndicesEs([]);
        setSubmittedWrongCharsEs({});
      } else {
        setIsCorrectEn(true);
        setIncorrectIndicesEn([]);
        setSubmittedWrongCharsEn({});
      }

      setFeedback(state.primaryLanguage === 'es' ? "¡Correcto!" : "Correct!");
      setTimeout(() => {
        nextStage();
      }, 1500);
    } else {
      const currentAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
      const nextAttempts = currentAttempts + 1;
      
      if (activeLanguage === 'es') {
        setAttemptsEs(nextAttempts);
        setIsWrongEs(true);
        setIncorrectIndicesEs(currentIncorrectIndices);
        setSubmittedWrongCharsEs(wrongChars);
        if (firstIncorrectIdx !== -1) {
          setCursorIndexEsLive(firstIncorrectIdx);
        }
        setTimeout(() => setIsWrongEs(false), 1500);
      } else {
        setAttemptsEn(nextAttempts);
        setIsWrongEn(true);
        setIncorrectIndicesEn(currentIncorrectIndices);
        setSubmittedWrongCharsEn(wrongChars);
        if (firstIncorrectIdx !== -1) {
          setCursorIndexEnLive(firstIncorrectIdx);
        }
        setTimeout(() => setIsWrongEn(false), 1500);
      }
      
      // Auto-focus input on failure so user can type immediately
      if (inputRef.current) {
        try {
          inputRef.current.focus({ preventScroll: true });
          inputRef.current.setSelectionRange(1, 1);
        } catch (e) {
          console.warn("Sync focus failed", e);
        }
      }
      setTimeout(() => {
        if (inputRef.current) {
          try {
            inputRef.current.focus({ preventScroll: true });
            inputRef.current.setSelectionRange(1, 1);
          } catch (e) {
            console.warn("Async focus failed", e);
          }
        }
      }, 30);

      if (nextAttempts >= 3) {
        if (activeLanguage === 'es') setDidFailFlowEs(true);
        else setDidFailFlowEn(true);
        setSessionFailed(true);
        try {
          localStorage.setItem(`memorize_failed_${verse.id}`, "true");
        } catch (e) {
          console.error(e);
        }

        setFeedback(state.primaryLanguage === 'es' ? "Se acabaron los intentos. Revelando texto..." : "Out of attempts. Revealing text...");
        setTimeout(() => {
          nextStage(true);
        }, 2000);
      } else {
        // Attempt-sensitive, and pointing at the corrective highlights. The
        // copy names no word, letter, accent or mark, and never the
        // replacement — the marks say only which positions to review. It also
        // never claims progress ("Almost there"/"Casi" removed): the system
        // does not compare attempts, so both messages stay neutral and true.
        setFeedback(
          nextAttempts === 1
            ? (state.primaryLanguage === 'es'
                ? 'Aún no. Revisa las letras resaltadas. Te quedan 2 intentos.'
                : 'Not quite. Review the highlighted letters. You have 2 tries left.')
            : (state.primaryLanguage === 'es'
                ? 'Aún no. Revisa las letras resaltadas. Te queda 1 intento.'
                : 'Not quite. Review the highlighted letters. 1 try left.')
        );
      }
    }
  };

  // ===========================================================================
  // Phase 3C — Citation Step (Step 6) coordination.
  //
  // Memorize stays the flow coordinator: it decides WHEN Citation is shown and
  // owns the acquisition write. All Citation internals (drafts, validation,
  // attempts, confirmation, clue, reveal) live in CitationStep.tsx.
  // ===========================================================================

  const citationRestored = {
    draftEs: activeAttempt?.citationDraftEs || "",
    draftEn: activeAttempt?.citationDraftEn || "",
    attemptsUsed: activeAttempt?.citationAttemptsUsed || 0,
    exhausted: !!activeAttempt?.citationExhausted,
    wrongEs: !!activeAttempt?.citationWrongEs,
    wrongEn: !!activeAttempt?.citationWrongEn,
  };

  // Citation is entered from the stage-6 handoff and latched on the attempt, so
  // a reload returns straight to the Citation Step rather than the handoff.
  const citationActive = !!activeAttempt?.citationStarted;

  const persistCitation = (patch: CitationPersistPatch) => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      return { ...s, activeAttempt: { ...s.activeAttempt, ...patch } };
    });
  };

  const enterCitationStep = () => {
    if (!attemptId) return;
    setState(s => {
      if (!s.activeAttempt || s.activeAttempt.attemptId !== attemptId) return s;
      if (s.activeAttempt.citationStarted) return s;
      return { ...s, activeAttempt: { ...s.activeAttempt, citationStarted: true } };
    });
  };

  // The existing final completion celebration, preserved EXACTLY as the Cards
  // flow implements it (same palette array, particle counts, velocity, spread,
  // shapes, gravity, scalar, drift, ticks, duration and rAF loop). Moving
  // Citation into Memorize would otherwise make it unreachable; this is the
  // minimal trigger connection permitted, with no visual or timing change.
  const runFinalCelebration = () => {
    const duration = 4 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#0d9488'];

    const frame = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return;
      const particleCount = 25 * (timeLeft / duration);
      confetti({
        particleCount,
        startVelocity: 35,
        spread: 360,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: colors,
        shapes: ['circle'],
        gravity: 0.7,
        scalar: Math.random() * 0.5 + 0.5,
        drift: 0,
        ticks: 150
      });
      requestAnimationFrame(frame);
    };
    frame();
  };

  // ===========================================================================
  // PHASE 4A — review outcome and finalization.
  //
  // The outcome is read from what genuinely happened in both stages. Recall
  // facts come from the latch written when Step 5 concluded (so they survive a
  // reload); Citation facts come from the attempt's own persisted Citation
  // fields plus the Clue count already carried inside the persisted draft.
  // ===========================================================================
  const buildSessionOutcome = (citationCorrect: boolean): SessionOutcome => {
    const attempt =
      state.activeAttempt && state.activeAttempt.attemptId === attemptId ? state.activeAttempt : null;

    const recallExhausted = attempt?.recallExhausted ?? isAnyPartFailed;
    const recallWrong =
      attempt?.recallWrongSubmissions ??
      attemptLanguageOrder.reduce((n, lang) => n + (lang === 'es' ? attemptsEs : attemptsEn), 0);
    const recallClues =
      attempt?.recallCluesUsed ??
      attemptLanguageOrder.reduce((n, lang) => n + (lang === 'es' ? clueCountEs : clueCountEn), 0);

    const citationWrong = attempt?.citationAttemptsUsed || 0;
    // An unused language's draft is empty and correctly contributes zero.
    const citationClues =
      readCitationClueCount(attempt?.citationDraftEs) +
      readCitationClueCount(attempt?.citationDraftEn);

    return {
      recall: {
        completed: !recallExhausted,
        exhausted: recallExhausted,
        wrongSubmissions: recallWrong,
        cluesUsed: recallClues,
      },
      citation: {
        // The Citation Step resolves either by a correct submission or by the
        // exhausted acknowledgment — there is no third ending.
        completed: citationCorrect,
        exhausted: !citationCorrect,
        wrongSubmissions: citationWrong,
        cluesUsed: citationClues,
      },
    };
  };

  /**
   * Applies a finished session's result to the single review record for this
   * passage. Idempotent by construction: the session id is compared against the
   * PERSISTED `lastFinalizedSessionId` inside the state updater, so double
   * clicks, repeated effects, rerenders, remounts, route changes, reloads,
   * focus changes and a midnight rollover all resolve to one write.
   */
  const applyReviewOutcome = (
    citationCorrect: boolean,
    sessionId: string,
    passageKey: string,
    wasDueAtStart: boolean,
    writeCompletionSummary: boolean
  ) => {
    const classified = classifySessionOutcome(buildSessionOutcome(citationCorrect));
    const completedAtMs = Date.now();

    setState(s => {
      const records = s.reviewRecords || {};
      const raw = records[passageKey];
      const existing = raw
        ? sanitizeReviewRecord(raw, passageKey, completedAtMs)
        : createReviewRecord(passageKey, completedAtMs, verse.id);

      if (existing.lastFinalizedSessionId === sessionId) return s;

      const updated = computeReviewUpdate({
        record: { ...existing, verseId: verse.id },
        classified,
        completedAtMs,
        wasDueAtStart,
      });

      const nextRecords = {
        ...records,
        [passageKey]: { ...updated, lastFinalizedSessionId: sessionId },
      };

      if (!writeCompletionSummary) {
        return { ...s, reviewRecords: nextRecords };
      }

      return {
        ...s,
        reviewRecords: nextRecords,
        lastReviewCompletion: {
          sessionId,
          passageKey,
          verseId: verse.id,
          outcome: classified.outcome,
          flawless: classified.flawless,
          reviewLevel: updated.reviewLevel,
          nextReviewAt: updated.nextReviewAt,
          smileyPlayed: false,
        },
      };
    });
  };

  /**
   * Ends a queue-driven Review session. It records the review result and
   * NOTHING else: no acquisition, no Saved entry, no completion count, no
   * totalMemorized increment, no verse-stage change and no acquisition
   * celebration. The passage was already acquired.
   */
  const completeReviewSession = (citationCorrect: boolean) => {
    if (!reviewSession) return;
    if (reviewFinalizedRef.current) return;
    reviewFinalizedRef.current = true;

    // SUBSET-LANGUAGE PRACTICE. A bilingual passage practised in one language
    // is NOT its due review, so this path never reaches the scheduler: the
    // record keeps its level, its due time, its unresolved stage, its last
    // outcome and its finalization marker, and the passage stays due exactly as
    // it was. This rule deliberately overrides ordinary early-practice
    // scheduling — `wasDueAtStart` cannot qualify it for mastery.
    const isPractice = reviewSession.qualifiesAsReview === false;

    if (isPractice) {
      setState(s => ({
        ...s,
        activeAttempt: null,
        activeReview: null,
        lastReviewCompletion: {
          sessionId: reviewSession.sessionId,
          passageKey: reviewSession.passageKey,
          verseId: verse.id,
          // Descriptive only — nothing was scheduled from it.
          outcome: "never_reviewed",
          flawless: false,
          reviewLevel: 0,
          nextReviewAt: toIso(Date.now()),
          smileyPlayed: false,
          isPractice: true,
          practiceLanguage: reviewSession.practiceLanguage,
        },
      }));

      try {
        localStorage.removeItem(`memorize_failed_${verse.id}`);
        localStorage.removeItem(`citation_failed_${verse.id}`);
        if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
        if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
        if (typingStateKey) localStorage.removeItem(typingStateKey);
      } catch (e) {
        console.warn("[Review] Failed to clear practice session keys", e);
      }

      onReviewFinalized?.();
      return;
    }

    applyReviewOutcome(
      citationCorrect,
      reviewSession.sessionId,
      reviewSession.passageKey,
      reviewSession.wasDueAtStart,
      true
    );

    // Retire the session. The snapshot and draft are released together so the
    // daily-rollover freeze lifts at the same moment the session ends.
    setState(s => ({ ...s, activeAttempt: null, activeReview: null }));

    try {
      localStorage.removeItem(`memorize_failed_${verse.id}`);
      localStorage.removeItem(`citation_failed_${verse.id}`);
      if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
      if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
      if (typingStateKey) localStorage.removeItem(typingStateKey);
    } catch (e) {
      console.warn("[Review] Failed to clear session keys", e);
    }

    onReviewFinalized?.();
  };

  // ONE acquisition-accounting path for BOTH Citation outcomes. Each caller
  // supplies a truthful `citationCorrect`; the accounting itself is identical,
  // so a correct citation and an exhausted acknowledgment acquire the passage
  // exactly once and record the same completion fields.
  const completeCitationAcquisition = (citationCorrect: boolean) => {
    // PHASE 4A — a Review session never acquires. It finalizes the review
    // record instead, leaving Saved counts and acquisition history untouched.
    if (isReviewMode) {
      completeReviewSession(citationCorrect);
      return;
    }

    if (citationAcquiredRef.current) return;
    if (state.progress.verseStages[verse.id] === 7) return;
    citationAcquiredRef.current = true;

    const today = getLocalDateString();
    const wasFailedSession = (() => {
      try {
        return localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
      } catch {
        return false;
      }
    })();

    // Record the truthful citation outcome on the attempt before it is retired.
    setState(s => (
      s.activeAttempt && s.activeAttempt.attemptId === attemptId
        ? { ...s, activeAttempt: { ...s.activeAttempt, citationCorrect } }
        : s
    ));

    setState(s => {
      // Double defense against duplicate acquisition.
      if (s.progress.verseStages?.[verse.id] === 7) return s;

      const isAlreadyCompleted = s.progress.completedVerses.includes(verse.id);
      const newLastCompletedDailyVerseDate =
        verse.id === votd.id ? today : s.progress.lastCompletedDailyVerseDate;

      const currentCounts = s.progress.completionCounts || {};
      const oldVal = currentCounts[verse.id] !== undefined
        ? currentCounts[verse.id]
        : (isAlreadyCompleted ? 1 : 0);
      const newCounts = { ...currentCounts, [verse.id]: oldVal + 1 };

      // The EFFECTIVE mode, not the global preference: a language dropped for a
      // failed translation must never be recorded as completed, counted, or
      // written into the acquisition record.
      const mode = effectiveMemorizeMode;
      const completedLangs: MemorizeLanguage[] = [...attemptLanguageOrder];
      const pair = s.selectedTranslations;

      const prevLang = s.progress.completionsByLanguage?.[verse.id] || { en: 0, es: 0 };
      const newLang = {
        en: prevLang.en + (completedLangs.includes('en') ? 1 : 0),
        es: prevLang.es + (completedLangs.includes('es') ? 1 : 0),
      };

      const newTrans: Partial<Record<Translation, number>> = {
        ...(s.progress.completionsByTranslation?.[verse.id] || {}),
      };
      const newLastTrans: { es?: Translation; en?: Translation } = {
        ...(s.progress.lastCompletedTranslation?.[verse.id] || {}),
      };
      for (const lang of completedLangs) {
        const t = pair[lang];
        newTrans[t] = (newTrans[t] || 0) + 1;
        newLastTrans[lang] = t;
      }

      return {
        ...s,
        activeAttempt: null,
        progress: {
          ...s.progress,
          totalMemorized: isAlreadyCompleted ? s.progress.totalMemorized : s.progress.totalMemorized + 1,
          completedVerses: isAlreadyCompleted ? s.progress.completedVerses : [...s.progress.completedVerses, verse.id],
          completionCounts: newCounts,
          completionsByLanguage: {
            ...(s.progress.completionsByLanguage || {}),
            [verse.id]: newLang
          },
          completionsByTranslation: {
            ...(s.progress.completionsByTranslation || {}),
            [verse.id]: newTrans
          },
          lastCompletedLanguage: {
            ...(s.progress.lastCompletedLanguage || {}),
            [verse.id]: mode
          },
          lastCompletedTranslation: {
            ...(s.progress.lastCompletedTranslation || {}),
            [verse.id]: newLastTrans
          },
          lastCompletedDailyVerseDate: newLastCompletedDailyVerseDate,
          verseStages: {
            ...s.progress.verseStages,
            [verse.id]: 7
          }
        }
      };
    });

    // Clear stale failure keys, including the legacy citation key, so a later
    // attempt on this verse can never open with zero citation attempts.
    try {
      localStorage.removeItem(`memorize_failed_${verse.id}`);
      localStorage.removeItem(`citation_failed_${verse.id}`);
    } catch (e) {
      console.warn("Failed to clear failure keys", e);
    }

    // PHASE 4A — an ordinary Memorize session on an ALREADY-acquired passage
    // updates that passage's existing review record under the same scheduling
    // rules. A first-ever acquisition deliberately does nothing here: lazy
    // initialization creates the record at level 0 and makes the first
    // POST-acquisition review immediately due, so the acquisition session is
    // never counted as that first review.
    const ordinaryPassageKey = activeAttempt?.reviewPassageKey || passageKeyForVerse(verse);
    if (ordinaryPassageKey && state.reviewRecords?.[ordinaryPassageKey] && attemptId) {
      applyReviewOutcome(
        citationCorrect,
        // The attempt id is this session's stable identity, so the same
        // exactly-once guard covers ordinary sessions too.
        attemptId,
        ordinaryPassageKey,
        activeAttempt?.wasDueAtStart !== false,
        false
      );
    }

    if (!wasFailedSession) runFinalCelebration();
  };

  const renderVerseContent = (textContent: string | null | undefined, userInput: string[], lang: 'es' | 'en', isCurrentActive: boolean = true) => {
    if (!textContent) return null;

    // Committed-HEAD word-flow: all words flow in one wrapping flex container,
    // so each viewport finds its own natural balance. Every character keeps
    // its canonical target glyph in normal inline flow as the layout anchor.
    // Consecutive hidden/empty letters inside a word form a "hidden run":
    // their glyphs stay in flow but fully invisible (visibility: hidden — no
    // silhouette), and one absolute segmented rail divides the run's combined
    // proportional width evenly, one segment per hidden character. Steps 1-5
    // therefore share the identical word arrangement at any given width.
    const words = textContent.split(" ");
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    // `isLangFailed` is the third-incorrect-submission assisted reveal only —
    // distinct from a Peek reveal (`isRevealed`). Its canonical verse reads as
    // neutral Cool White (#E7ECF2), not the warm reading cream (#EFE6D8) used
    // for Steps 1-4 and Peek, and never Ember (that stays the success reveal).
    const isLangFailed = lang === 'es' ? didFailFlowEs : didFailFlowEn;
    const isLangRevealed = isRevealed || isLangFailed;
    const isLangCorrect = lang === 'es' ? isCorrectEs : isCorrectEn;
    const isTypingStep = stage === 5 && !isLangRevealed;
    // The map beacon is the logical cursor itself — no display-side walking.
    // Under the cursor law it always names an editable slot (or the
    // past-the-end sentinel, which simply matches no segment), so what the
    // beacon marks is always where the next keystroke lands.
    const beaconIdx = lang === 'es' ? cursorIndexEs : cursorIndexEn;
    // Indices currently playing their one-shot occupancy bloom.
    const beaconIndices = lang === 'es' ? beaconIndicesEs : beaconIndicesEn;
    // Review set: a snapshot written ONLY by handleCheck on an explicit
    // incorrect submission, and pruned per-index the moment that index is
    // edited. Reading it in render compares nothing against the answer — the
    // grading already happened, at submit time.
    const reviewIndices = lang === 'es' ? incorrectIndicesEs : incorrectIndicesEn;
    let cleanLetterAccumulator = 0;

    const baseSlotClasses = `relative inline-flex flex-col items-center justify-center min-w-[0.25em]`;

    type SlotInfo = { char: string; charIdx: number; isLetter: boolean; letterIndex: number };

    const isHiddenSlot = (info: SlotInfo, wordIdx: number) => {
      if (!info.isLetter || isLangRevealed) return false;
      if (stage === 1) return info.charIdx >= 2;
      if (stage === 2) return wordIdx % 2 !== 0;
      if (stage === 3) return wordIdx % 2 === 0;
      if (stage === 4) return info.charIdx > 0;
      // Step 5: a correct submission reveals the whole verse (no rails).
      if (isLangCorrect) return false;
      // Otherwise EVERY unrevealed editable letter — typed or not — stays a
      // rail segment, so the Memory Map geography never shifts while the user
      // types in the Recall Composer. Only clue-revealed letters are visible.
      return !revealed.includes(info.letterIndex);
    };

    // Slot semantics: a clicked map position becomes the cursor, so the next
    // typed character enters exactly there. (The old left/right-half split
    // produced an insertion boundary that could land past the end or on a Clue
    // letter — a dead position that swallowed keystrokes.)
    const handleLetterSlotClick = (letterIndex: number) => (e: React.MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      cancelPendingSubmit();
      if (!isCurrentActive) setActiveLanguage(lang);

      const targetIdx = getNearestCursorIndex(letterIndex, lang);

      if (lang === 'es') setCursorIndexEsLive(targetIdx);
      else setCursorIndexEnLive(targetIdx);
      focusStreamInput();
    };

    // Steps 1-4 hidden-run rails ONLY. The rail is absolute (zero layout
    // contribution): its segments divide the run's combined proportional width
    // evenly, so the hidden character count stays readable while the invisible
    // canonical glyph anchors keep owning word width and line wrapping — the
    // approved Steps 1-4 Scripture geography is untouched. This renderer no
    // longer serves Step 5: the typing step early-returns the uniform logical
    // cell board (see the board branch before the proportional return below),
    // so these rails are always plain Cold Grey with no occupancy, cursor,
    // review, or beacon state. The failed fixed-width-distributed-across-
    // proportional-word-widths compromise (`space-between` over glyph-anchored
    // runs) was removed with that board.
    const renderHiddenRun = (run: SlotInfo[]) => (
      <span
        key={`run-${run[0].charIdx}`}
        className="relative inline-flex flex-row flex-nowrap gap-x-[1.5px] items-end"
      >
        {run.map(info => (
          <span key={info.charIdx} className={baseSlotClasses}>
            <span className="invisible select-none" aria-hidden="true">{info.char}</span>
          </span>
        ))}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0"
          style={{
            bottom: "0.30em",
            display: "grid",
            gridTemplateColumns: `repeat(${run.length}, minmax(0, 1fr))`,
            gap: "2px",
          }}
        >
          {run.map(info => (
            <span
              key={info.charIdx}
              className="w-full rounded-full"
              style={{ height: "2px", background: "rgba(139,149,163,0.32)" }}
            />
          ))}
        </span>
      </span>
    );

    const renderVisibleSlot = (info: SlotInfo) => {
      const { char, charIdx, isLetter, letterIndex } = info;

      if (!isLetter) {
        return (
          <span
            key={charIdx}
            className={`${baseSlotClasses} ${isLangFailed ? 'text-[#E7ECF2]/45' : 'text-[#EFE6D8]/45'} cursor-text`}
            onClick={(e) => {
              if (isTypingStep) {
                e.stopPropagation();
                cancelPendingSubmit();
                if (!isCurrentActive) setActiveLanguage(lang);

                const targetIdx = getNearestCursorIndex(letterIndex, lang);
                if (lang === 'es') setCursorIndexEsLive(targetIdx);
                else setCursorIndexEnLive(targetIdx);
                focusStreamInput();
              }
            }}
          >
            {char}
          </span>
        );
      }

      if (stage < 5 && !isLangRevealed) {
        // Only pedagogically visible letters reach here; hidden letters are
        // grouped into runs upstream.
        return (
          <span key={charIdx} className={baseSlotClasses}>
            <span>{char}</span>
          </span>
        );
      }

      if (isTypingStep) {
        // In Step 5 only clue-revealed letters reach this visible-letter path
        // (and, after a fully-correct submission, every letter) — all other
        // editable letters are rail segments grouped upstream. The user's
        // typed glyphs are NEVER painted into the Memory Map; they live in the
        // Recall Composer below. Rendered as the canonical glyph in earned
        // Ember, at its own natural proportional width. No caret here.
        return (
          <span key={charIdx} className={`${baseSlotClasses} text-ember`}>
            <span>{char}</span>
          </span>
        );
      }

      // Revealed / Peek / completed: plain canonical glyph.
      return (
        <span key={charIdx} className={`${baseSlotClasses} opacity-100`}>
          {char}
        </span>
      );
    };

    // ================= THE UNIFORM LOGICAL CELL BOARD (Step 5) ================
    // The live typing Map is a logical occupancy board — fixed-width cells,
    // one intra-word gap, one larger inter-word gap — rendered as EXPLICIT
    // ROWS taken from the measured canonical line map, so every word sits on
    // exactly the line it occupies in Steps 1-4. One global board scale
    // (derived from the densest canonical line) fits every row at the current
    // width; CSS never rewraps the board on its own, and typed or canonical
    // glyph widths play no part in cell geometry. Steps 1-4, Peek
    // (isLangRevealed), the success reveal (isLangCorrect), and the
    // third-failure reveal all skip this branch and keep the proportional
    // Scripture rendering below.
    if (isTypingStep && !isLangCorrect) {
      const boardWords = textContent.split(" ");
      const boardWordStarts: number[] = [];
      {
        let acc = 0;
        boardWords.forEach(w => {
          boardWordStarts.push(acc);
          acc += getCleanLetters(w).length;
        });
      }

      // The canonical layout is measured in a layout effect before this commit
      // paints, so this fallback is never visible.
      if (!canonicalLayout) {
        return <div aria-hidden="true" className="w-full" />;
      }
      const { lines: canonicalRows, board } = canonicalLayout;

      const renderBoardWord = (word: string, wordIdx: number) => {
        if (word.length === 0) return null;
        const wordStartIdx = boardWordStarts[wordIdx] || 0;
        let lettersInWord = 0;
        const cells = word.split("").map((char, charIdx) => {
          const isLetter = isLetterChar(char);
          const letterIndex = wordStartIdx + lettersInWord;
          if (isLetter) lettersInWord++;
          return { char, charIdx, isLetter, letterIndex };
        });

        return (
          // One logical word group: cells in canonical order with the global
          // intra-word gap. flex-nowrap — the global scale guarantees the row
          // fits, and canonical rows never rewrap on their own.
          <div
            key={wordIdx}
            className="flex flex-nowrap items-end"
            style={{ gap: `${board.intra}px` }}
          >
                  {cells.map(info => {
                    if (!info.isLetter) {
                      // Fixed canonical punctuation: a glyph attached to its
                      // word — never a tile, never graded, never rose.
                      return (
                        <span
                          key={info.charIdx}
                          onClick={handleLetterSlotClick(info.letterIndex)}
                          className="self-end pb-[1px] leading-none text-[14px] min-[390px]:text-[15px] text-[#EFE6D8]/45 cursor-text select-none"
                        >
                          {info.char}
                        </span>
                      );
                    }

                    const li = info.letterIndex;

                    // Ember provenance is EXACT logical index only: a cell is a
                    // Clue cell iff its own index is in `revealed`. Character
                    // value is never consulted, so a typed `f` beside a Clue
                    // `F` stays a normal occupied tile. The glyph is centered
                    // in the same fixed cell footprint — revealing it never
                    // shifts neighbours, gaps, or wrapping.
                    if (revealed.includes(li)) {
                      return (
                        <span
                          key={info.charIdx}
                          className="inline-flex items-center justify-center select-none"
                          style={{ width: `${board.cell}px`, height: BOARD_CELL_H }}
                        >
                          <span className="text-ember leading-none text-[13px] min-[390px]:text-[14px]">
                            {info.char}
                          </span>
                        </span>
                      );
                    }

                    const isReview = reviewIndices.includes(li);
                    const isCurrent = isCurrentActive && li === beaconIdx;
                    const isOccupied = (userInput[li] || "").trim() !== "";
                    const isBlooming = beaconIndices.includes(li);

                    // Precedence: review rose > current teal > occupied Royal >
                    // empty grey rail. Occupied/current/review all share the
                    // identical fixed dimensions; states differ only through
                    // colour and glow. Correctness never influences geometry.
                    let tileHeight = "2px";
                    let tileRadius = "999px";
                    let tileBg = "rgba(139,149,163,0.32)";
                    let tileShadow: string | undefined = undefined;
                    if (isReview) {
                      tileHeight = BOARD_TILE_H; tileRadius = "2px";
                      tileBg = "rgba(240,166,160,0.86)";
                      tileShadow = "0 0 7px rgba(209,78,92,0.30), inset 0 1px 0 rgba(231,236,242,0.10)";
                    } else if (isCurrent) {
                      tileHeight = BOARD_TILE_H; tileRadius = "2px";
                      tileBg = "#3E8F7B";
                      tileShadow = currentTileShadow;
                    } else if (isOccupied) {
                      tileHeight = BOARD_TILE_H; tileRadius = "2px";
                      tileBg = "rgba(91,120,255,0.82)";
                      tileShadow = "0 0 7px rgba(91,120,255,0.24), inset 0 1px 0 rgba(231,236,242,0.12)";
                    }

                    return (
                      <span
                        key={info.charIdx}
                        data-lang={lang}
                        data-index={li}
                        onClick={handleLetterSlotClick(li)}
                        className="inline-flex items-end justify-center cursor-text"
                        style={{ width: `${board.cell}px`, height: BOARD_CELL_H }}
                      >
                        <span
                          className={`w-full${isBlooming ? ' verso-beacon-bloom' : ''}`}
                          onAnimationEnd={isBlooming ? () => retireBeacon(li, lang) : undefined}
                          style={{
                            height: tileHeight,
                            borderRadius: tileRadius,
                            background: tileBg,
                            boxShadow: tileShadow,
                          }}
                        />
                      </span>
                    );
                  })}
          </div>
        );
      };

      return (
        <div className={`w-full font-serif select-none transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
          <div className="w-full flex flex-col items-center" style={{ rowGap: "10px" }}>
            {canonicalRows.map((rowWordIdxs, rowIdx) => (
              // One explicit centered Map row per canonical Scripture line —
              // words stay on exactly the line they occupy in Steps 1-4.
              <div
                key={rowIdx}
                className="flex flex-nowrap justify-center items-end"
                style={{ columnGap: `${board.inter}px` }}
              >
                {rowWordIdxs.map(wi => renderBoardWord(boardWords[wi] || "", wi))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={`w-full font-serif select-none ${isLangFailed ? 'text-[#E7ECF2]' : 'text-[#EFE6D8]'} text-[21px] min-[390px]:text-[23px] md:text-[27px] xl:text-[30px] leading-[1.45] font-normal [font-optical-sizing:auto] transition-opacity duration-500 ${!isCurrentActive ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex flex-wrap justify-center content-start gap-y-2 md:gap-y-2.5 gap-x-[0.5em] w-full">
          {words.map((word, wordIdx) => {
            const wordStartIdx = cleanLetterAccumulator;
            const cleanWordLen = getCleanLetters(word).length;
            cleanLetterAccumulator += cleanWordLen;

            // Precompute each character's logical letter index (committed
            // semantics: a non-letter carries the index of the next letter
            // for click targeting).
            let lettersInWordCount = 0;
            const slotInfos: SlotInfo[] = word.split("").map((char, charIdx) => {
              const isLetter = isLetterChar(char);
              const letterIndex = wordStartIdx + lettersInWordCount;
              if (isLetter) {
                lettersInWordCount++;
              }
              return { char, charIdx, isLetter, letterIndex };
            });

            // Deterministic grouping: consecutive hidden/empty letters become
            // one hidden run; every other character renders as its own slot.
            const items: React.ReactNode[] = [];
            let run: SlotInfo[] = [];
            const flushRun = () => {
              if (run.length === 0) return;
              items.push(renderHiddenRun(run));
              run = [];
            };
            slotInfos.forEach(info => {
              if (isHiddenSlot(info, wordIdx)) {
                run.push(info);
              } else {
                flushRun();
                items.push(renderVisibleSlot(info));
              }
            });
            flushRun();

            return (
              <div
                key={wordIdx}
                className="flex flex-row flex-nowrap gap-x-[1.5px] items-end cursor-text"
                onClick={(e) => {
                  if (stage === 5 && !isLangRevealed) {
                    e.stopPropagation();
                    cancelPendingSubmit();
                    if (!isCurrentActive) setActiveLanguage(lang);

                    // Click-time geometry only (never per keystroke): a press in
                    // the word's gaps/punctuation coarsely picks the near end,
                    // then snaps to the nearest editable slot.
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const isRightHalf = clickX > rect.width / 2;

                    const targetBaseIdx = isRightHalf ? wordStartIdx + cleanWordLen : wordStartIdx;

                    const targetIdx = getNearestCursorIndex(targetBaseIdx, lang);
                    if (lang === 'es') setCursorIndexEsLive(targetIdx);
                    else setCursorIndexEnLive(targetIdx);
                    focusStreamInput();
                  }
                }}
              >
                {items}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Natural Recall Composer body. Unlike the Memory Map, the ENTERED glyphs
  // own the visible spacing here: each is a normal inline span at its own
  // proportional advance, never forced into a canonical target footprint —
  // so repeated `e`s space naturally, a wrong wide `W` stays fully visible,
  // and nothing clips or overlaps. Empty positions contribute nothing (no
  // placeholder geometry, no target-width gaps); clue-revealed letters read in
  // earned Ember and concatenate with entered letters of the same word;
  // everything the user typed is uniform Cool White with no per-character
  // correctness. Canonical punctuation is omitted so the line reads as the
  // recall itself, and the composer wraps on its own content only.
  //
  // Spacing rule: content is grouped by canonical word, and only groups that
  // actually have something to show (a glyph, or the caret) are emitted —
  // joined by exactly ONE ordinary space. Walking raw characters instead would
  // emit a space per canonical space, so words the user has not reached yet
  // stacked their surrounding spaces into ragged multi-space gaps.
  const renderRecallComposerBody = (
    textContent: string | null | undefined,
    userInput: string[],
    lang: 'es' | 'en',
    isCurrentActive: boolean
  ): React.ReactNode => {
    if (!textContent) return null;
    const revealed = lang === 'es' ? revealedIndicesEs : revealedIndicesEn;
    const cleanLen = lang === 'es' ? esTextCleanLen : enTextCleanLen;
    // Under the cursor law the logical cursor is already an editable slot (or
    // the past-the-end sentinel), so the caret needs no display-side walking —
    // which is what previously let the caret sit in a different word from the
    // slot that actually received the keystroke.
    const cursor = lang === 'es' ? cursorIndexEs : cursorIndexEn;
    // Submitted review snapshot (see renderVerseContent). Marking a glyph here
    // is a lookup, not a comparison: nothing is graded during entry.
    const reviewIndices = lang === 'es' ? incorrectIndicesEs : incorrectIndicesEn;

    // One plain vertical typographic caret: a 1px rule sitting ON the Fraunces
    // baseline (`vertical-align: baseline` puts its bottom edge there, so it
    // can never hang below the line). No rounding, no scaling, no arrowhead,
    // no position animation — only a step-end blink.
    const caret = (key: string) => (
      <span
        key={key}
        aria-hidden="true"
        className="inline-block w-px h-[0.95em] animate-cursor-blink"
        style={{
          background: "#3E8F7B",
          boxShadow: "0 0 4px rgba(91,120,255,0.20)",
          verticalAlign: "baseline",
        }}
      />
    );

    const placeCursor = (idx: number) => {
      cancelPendingSubmit();
      if (!isCurrentActive) setActiveLanguage(lang);
      const target = getNearestCursorIndex(idx, lang);
      if (lang === 'es') setCursorIndexEsLive(target);
      else setCursorIndexEnLive(target);
      focusStreamInput();
    };

    const hasAnyContent =
      userInput.some(c => (c || "").trim() !== "") || revealed.length > 0;

    if (!hasAnyContent) {
      return (
        <span className="text-cold-grey">
          {isCurrentActive && caret("caret-start")}
          {state.primaryLanguage === 'es' ? 'Empieza tu recuerdo…' : 'Begin your recall…'}
        </span>
      );
    }

    // Word-grouped walk. letterIndex accumulates exactly as the Memory Map's
    // does (same letter set, same canonical `split(" ")`), so composer indices
    // and map indices always name the same slot.
    // Index-aligned per-word nodes, so canonical lines can pick exactly their
    // own words when the rows are assembled below.
    const wordNodesByIdx: React.ReactNode[][] = [];
    let letterIndex = 0;
    textContent.split(" ").forEach((word, wordIdx) => {
      const wordNodes: React.ReactNode[] = [];

      Array.from(word).forEach((ch, charIdx) => {
        if (!isLetterChar(ch)) return; // punctuation omitted
        const here = letterIndex;
        letterIndex++;

        if (isCurrentActive && cursor === here) {
          wordNodes.push(caret(`caret-${here}`));
        }
        // THE COMPOSER COLOR LAW: every glyph carries its color as an OWN-NODE
        // INLINE STYLE chosen from its exact logical index — never from a
        // utility class alone, a parent, or inheritance. QA produced a state
        // where ordinary typed glyphs beside Clue glyphs rendered Ember even
        // though the branch logic was exact-index; inline color at the span is
        // the one mechanism no cascade interaction can override.
        //
        // Ember iff `here` is in `revealed` — character value is never
        // consulted, so a user-typed `f` at index N+1 stays Cool White even
        // when Clue revealed an `f` at index N.
        if (revealed.includes(here)) {
          wordNodes.push(
            <span
              key={`w${wordIdx}-c${charIdx}`}
              className="text-ember"
              style={{ color: "#E8B34B" }}
            >
              {ch}
            </span>
          );
          return;
        }
        const typed = userInput[here] || "";
        if (typed.trim() !== "") {
          // Display casing only (see THE CANONICAL DISPLAY-CASING LAW). `ch` is
          // this same walk's canonical glyph at logical index `here` — the walk
          // iterates the canonical text and `letterIndex` advances per letter —
          // so no separate canonical lookup, and no second letter walk, is
          // introduced. It decides upper/lower and nothing more: the glyph
          // painted is always the one the user entered, accent included, and a
          // wrong letter is never swapped for the canonical answer. The raw
          // value in `userInput` is left exactly as typed.
          const displayGlyph = toCanonicalDisplayCase(typed, ch);
          // A glyph the last submitted answer got wrong: restrained rose ink +
          // a hairline underline. Colour and decoration only — no fill, box,
          // glow, animation or transform — so the response's size, spacing,
          // weight and wrapping are byte-for-byte what they were before the
          // submission. The rose marks the SAME wrong glyph, now canonically
          // cased: styling is index-driven, so casing changes nothing about
          // which positions are marked or what they say. Ordinary entries carry
          // explicit inline Cool White; the whole line never turns rose.
          const isReview = reviewIndices.includes(here);
          wordNodes.push(
            <span
              key={`w${wordIdx}-c${charIdx}`}
              data-composer-index={here}
              onClick={(e) => { e.stopPropagation(); placeCursor(here); }}
              className="cursor-text text-cool-white"
              style={isReview ? {
                color: "#F0A6A0",
                textDecorationLine: "underline",
                textDecorationColor: "rgba(209,78,92,0.72)",
                textDecorationThickness: "1px",
                textUnderlineOffset: "0.16em",
              } : { color: "#E7ECF2" }}
            >
              {displayGlyph}
            </span>
          );
        }
        // Empty editable position: nothing rendered — a MISSING position is
        // therefore surfaced only by the Memory Map's review state.
      });

      // Store at the word's canonical index (possibly empty). A word with no
      // glyphs still shows content when the caret rests in it, so the
      // insertion point stays visible inside an untouched word.
      wordNodesByIdx[wordIdx] = wordNodes;
    });

    const endCaret = isCurrentActive && cursor >= cleanLen ? caret("caret-end") : null;

    // ===== Canonical row assembly (one centered Composer row per canonical
    // Scripture line). The Composer's correct canonical text therefore breaks
    // on exactly the same lines as Steps 1-4 and the Step 5 Memory Map. Words
    // within a row are joined by single ordinary spaces; `break-words` on a
    // row is only the emergency fallback for unusually wide INCORRECT glyphs —
    // correct canonical text always fits its canonical row (the Composer type
    // sizes are at or below the Scripture sizes the rows were measured at),
    // and the fallback never touches the line map or the Memory Map. =====
    if (!canonicalLayout) {
      // Pre-measurement fallback (never painted: the layout is measured in a
      // layout effect before this commit reaches the screen).
      const flat: React.ReactNode[] = [];
      wordNodesByIdx.forEach(group => {
        if (!group || group.length === 0) return;
        if (flat.length > 0) flat.push(" ");
        flat.push(...group);
      });
      if (endCaret) flat.push(endCaret);
      return flat;
    }

    const rows: React.ReactNode[][] = canonicalLayout.lines.map(lineWordIdxs => {
      const children: React.ReactNode[] = [];
      lineWordIdxs.forEach(wi => {
        const group = wordNodesByIdx[wi];
        if (!group || group.length === 0) return;
        if (children.length > 0) children.push(" ");
        children.push(...group);
      });
      return children;
    });

    // The end-of-passage caret rides the last row that has visible content.
    if (endCaret) {
      let target = -1;
      rows.forEach((r, i) => { if (r.length > 0) target = i; });
      if (target === -1) {
        rows.push([endCaret]);
      } else {
        rows[target].push(endCaret);
      }
    }

    return (
      <>
        {rows.map((children, rowIdx) =>
          children.length > 0 ? (
            <div key={rowIdx} className="w-full text-center break-words">
              {children}
            </div>
          ) : null
        )}
      </>
    );
  };

  // PHASE 4A — a Review session runs ON an already-acquired passage, whose
  // stage is 7. Without this bypass the completed "Verse Learned!" screen would
  // render instead of the Recall Workspace. Ordinary sessions are unchanged.
  if (state.progress.verseStages[verse.id] === 7 && !isReviewMode) {
    // Renders the fully completed display of Memorize
    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-(--glass-fill) border border-(--rim-gold) shadow-glow-gold flex items-center justify-center">
            <CheckCircle2 size={64} className="text-ember" strokeWidth={1.2} />
          </div>
        </div>

        <div className="space-y-4 px-6">
          <h2 className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight">
            {state.primaryLanguage === 'es' ? '¡Versículo aprendido!' : 'Verse Learned!'}
          </h2>
          {/* One block PER ACQUIRED LANGUAGE, in interface-language order, each
              verse paired with its OWN localized reference. The former single
              quotation joined by " / " with one shared reference could label
              Spanish Scripture with an English book name, and a failed
              translation would have been concatenated straight into it. A
              language that is not part of this attempt contributes no block at
              all — no empty quote, no slash, no mislabelled reference. Card
              shell, spacing and type are the existing ones. */}
          <div className="max-w-md mx-auto space-y-4 px-5 py-6 bg-deep-slate rounded-[24px] border border-(--line)">
            {attemptLanguageOrder.map(lang => {
              const learnedText = lang === 'es' ? esText : enText;
              if (!learnedText) return null;
              return (
                <div key={lang} className="space-y-2">
                  <p className="font-fraunces text-lg font-normal leading-[1.32] italic text-[#EFE6D8] break-words">
                    "{learnedText}"
                  </p>
                  <p className="text-[11px] font-hanken font-semibold uppercase tracking-[0.2em] text-ember break-words">
                    {getLocalizedBookName(verse.book, lang)} {verse.chapter}:{verse.verse}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4 px-6">
          <button 
            onClick={() => {
              // Explicitly reset the memory progress for a clean repeat attempt
              localStorage.removeItem(`memorize_failed_${verse.id}`);
              try {
                if (attemptsKeyEs) localStorage.removeItem(attemptsKeyEs);
                if (attemptsKeyEn) localStorage.removeItem(attemptsKeyEn);
              } catch(e){}
              
              setAttemptsEs(0);
              setAttemptsEn(0);
              setStage(1);
              setIsAlmostDone(false);
              setIsRevealed(false);
              setDidFailFlowEs(false);
              setDidFailFlowEn(false);
              setBilingualPass(1);
              setShowHalfwayTransition(false);
              
              setState(s => {
                const snapshot = buildMemorizeAttemptSnapshot(s, verse);
                return {
                  ...s,
                  activeAttempt: snapshot,
                  progress: {
                    ...s.progress,
                    verseStages: {
                      ...s.progress.verseStages,
                      [verse.id]: 1
                    }
                  }
                };
              });
            }} 
            className="vbtn vbtn--primary w-full"
          >
            <RotateCcw size={18} />
            <span>
              {state.primaryLanguage === 'es' ? 'repetir memorización' : 'repeat memorization'}
            </span>
          </button>

          <button
            onClick={onComplete}
            className="vbtn vbtn--secondary w-full"
          >
            <Bookmark size={18} />
            <span>
              {state.primaryLanguage === 'es' ? 'ver guardados' : 'view saved'}
            </span>
          </button>
        </div>
      </motion.div>
    );
  }

  // Phase 3C: Citation is Step 6 of Memorize. Once entered from the stage-6
  // handoff (and on every reload thereafter) the Citation Step renders here
  // instead of switching to Cards. The handoff screen below is unchanged.
  if (isAlmostDone && citationActive && !recallBlocksCitation) {
    return (
      <CitationStep
        verse={verse}
        esText={esText}
        enText={enText}
        memorizeMode={effectiveMemorizeMode}
        primaryLanguage={state.primaryLanguage === 'es' ? 'es' : 'en'}
        restored={citationRestored}
        onPersist={persistCitation}
        onCorrect={() => completeCitationAcquisition(true)}
        onExhaustedAcknowledge={() => completeCitationAcquisition(false)}
        reviewMode={isReviewMode}
        // The SAME strip element Step 5 renders, handed down rather than
        // duplicated — one definition, no import cycle, identical appearance
        // across both review steps.
        modeStrip={isReviewMode ? (
          <ReviewModeStrip
            label={reviewCopy.modeBannerLabel(state.primaryLanguage === 'es' ? 'es' : 'en')}
            hint={reviewCopy.modeBannerHint(state.primaryLanguage === 'es' ? 'es' : 'en')}
          />
        ) : null}
      />
    );
  }

  if (isAlmostDone) {
    const getFailureScreenContent = () => {
      const enPassed = isCorrectEn && !didFailFlowEn;
      const esPassed = isCorrectEs && !didFailFlowEs;

      let title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
      let body = state.primaryLanguage === 'es' 
        ? 'No has logrado memorizar todo el texto del versículo. Por favor, inténtalo de nuevo para desbloquear el reto de la cita bíblica.' 
        : 'You did not successfully memorize the verse text. Please try again to unlock the citation challenge.';
      let buttonLabel = state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again';

      if (effectiveMemorizeMode === 'both') {
        if (enPassed && !esPassed) {
          title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
          body = state.primaryLanguage === 'es'
            ? 'El inglés ya está asegurado. Ahora intenta con el español de nuevo para desbloquear el reto de la cita bíblica.'
            : 'English is locked in. Now try Spanish again to unlock the citation challenge.';
          buttonLabel = state.primaryLanguage === 'es' ? 'intentar español de nuevo' : 'try Spanish again';
        } else if (esPassed && !enPassed) {
          title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
          body = state.primaryLanguage === 'es'
            ? 'El español ya está asegurado. Ahora intenta con el inglés de nuevo para desbloquear el reto de la cita bíblica.'
            : 'Spanish is locked in. Now try English again to unlock the citation challenge.';
          buttonLabel = state.primaryLanguage === 'es' ? 'intentar inglés de nuevo' : 'try English again';
        }
      }

      return { title, body, buttonLabel };
    };

    const failureContent = getFailureScreenContent();

    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
      >
        <div className="relative">
          <div className={`w-32 h-32 rounded-full bg-(--glass-fill) border flex items-center justify-center ${recallBlocksCitation ? 'border-(--line)' : 'border-(--rim-gold) shadow-glow-gold'}`}>
            {recallBlocksCitation ? (
              <BookOpen size={64} className="text-cold-grey" fill="none" strokeWidth={1.5} />
            ) : (
              <CheckCircle2 size={64} className="text-ember" fill="none" strokeWidth={1.2} />
            )}
          </div>
        </div>

        <div className="space-y-4 px-6">
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight text-center"
          >
            {recallBlocksCitation
              ? failureContent.title
              : (effectiveMemorizeMode === 'both'
                  ? (activeLanguage === 'es'
                      ? (state.primaryLanguage === 'es' ? '¡Buen trabajo! — Español memorizado' : 'Great job — Spanish locked in!')
                      : (state.primaryLanguage === 'es' ? '¡Excelente! — Inglés memorizado' : 'Nice — English locked in!')
                    )
                  : (state.primaryLanguage === 'es' ? '¡Ya casi!' : "You're almost there!")
                )
            }
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="font-hanken text-lg text-cold-grey max-w-sm mx-auto"
          >
            {recallBlocksCitation
              ? failureContent.body
              : (isReviewMode && isAnyPartFailed
                  // A review whose Recall ran out of attempts still continues to
                  // Citation, so the copy must not claim the text is complete.
                  ? reviewCopy.recallStillSettlingHandoff(state.primaryLanguage === 'es' ? 'es' : 'en')
                  : effectiveMemorizeMode === 'both'
                    ? (state.primaryLanguage === 'es'
                        ? 'Ambos idiomas listos. Ya casi. Ahora falta el último paso: la cita bíblica.'
                        : 'Both languages locked in. Almost there. Now for the final step: the citation.')
                    : (state.primaryLanguage === 'es'
                        ? 'Texto completo. Ahora falta el último paso: la cita bíblica.'
                        : 'Text complete. Now for the final step: the citation.')
                )
            }
          </motion.p>
          {!recallBlocksCitation && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[11px] font-hanken font-semibold text-ember uppercase tracking-[0.22em] mt-4"
            >
              {state.primaryLanguage === 'es' ? 'Un paso más.' : 'One more step.'}
            </motion.p>
          )}
        </div>

        <div className="w-full max-w-sm space-y-8 px-6">
          <div className="flex flex-col items-center gap-6">
            {!recallBlocksCitation ? (
              <>
                <motion.button
                  ref={challengeCitationRef}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={enterCitationStep}
                  className="vbtn vbtn--earned w-full"
                >
                  <Layers size={18} />
                  <span>
                    {state.primaryLanguage === 'es' ? 'Reto: Cita bíblica' : 'Challenge: Citation'}
                  </span>
                </motion.button>
                
                <motion.button 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  onClick={() => setShowAbandonConfirm(true)}
                  className="min-h-11 text-[11px] font-hanken font-semibold uppercase tracking-[0.2em] text-[#F0A6A0]/70 hover:text-[#F0A6A0] transition-colors flex items-center gap-2"
                >
                  <span>{state.primaryLanguage === 'es' ? '← abandonar reto' : '← abandon challenge'}</span>
                </motion.button>

                <AnimatePresence>
                  {showAbandonConfirm && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[rgba(8,11,16,0.60)] backdrop-blur-sm"
                        onClick={() => setShowAbandonConfirm(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-sm bg-deep-slate rounded-[24px] shadow-verso-modal border border-(--line) p-7 space-y-6 z-10"
                      >
                        <div className="space-y-3 text-center">
                          <div className="w-16 h-16 rounded-full bg-[rgba(209,78,92,0.08)] border border-[rgba(209,78,92,0.40)] flex items-center justify-center text-[#F0A6A0] mx-auto mb-4">
                            <AlertCircle size={28} />
                          </div>
                          <h3 className="text-2xl font-fraunces font-medium text-cool-white">
                            {state.primaryLanguage === 'es' ? "¿Abandonar reto?" : "Abandon challenge?"}
                          </h3>
                          <p className="font-hanken text-sm text-cold-grey leading-relaxed text-center">
                            {state.primaryLanguage === 'es'
                              ? "Si decides abandonar, se perderá tu progreso actual para este intento. No se otorgará crédito por completarlo."
                              : "If you decide to abandon, your current progress for this attempt will be lost. No completion credit will be awarded."}
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAbandonConfirm(false);
                              onAbandon?.();
                            }}
                            className="vbtn vbtn--destructive w-full"
                          >
                            {state.primaryLanguage === 'es' ? "Sí, abandonar" : "Yes, abandon"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAbandonConfirm(false)}
                            className="vbtn vbtn--secondary w-full"
                          >
                            {state.primaryLanguage === 'es' ? "Cancelar" : "Cancel"}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <motion.button 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={reset}
                className="vbtn vbtn--primary w-full"
              >
                <RotateCcw size={18} />
                <span>
                  {failureContent.buttonLabel}
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (showHalfwayTransition) {
    const isEnNext = activeLanguage === 'es';
    // Small logic fix: use proper failure check for the transition screen
    // If we're halfway, we check if the just-finished language failed
    const currentPassFailed = activeLanguage === 'es' ? didFailFlowEs : didFailFlowEn;
    // PHASE 4A — a Review session never offers "try again" here: retrying calls
    // reset(), which rewinds an acquired passage. A review simply continues to
    // its next language and lets the outcome stand.
    const halfwayShowsRetry = currentPassFailed && !isReviewMode;

    return (
      <motion.div 
        className="h-full flex flex-col items-center justify-center text-center space-y-10"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
      >
        <div className="relative">
          <div className={`w-32 h-32 rounded-full bg-(--glass-fill) border flex items-center justify-center ${currentPassFailed ? 'border-(--line)' : 'border-(--rim-gold) shadow-glow-gold'}`}>
            {currentPassFailed ? (
              <BookOpen size={64} className="text-cold-grey" fill="none" strokeWidth={1.5} />
            ) : (
              <Trophy size={64} className="text-ember" fill="none" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div className="space-y-4 px-8">
          <h2 className="text-3xl sm:text-4xl font-fraunces font-medium text-cool-white leading-tight">
            {currentPassFailed 
              ? (state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet')
              : (activeLanguage === 'es'
                  ? (state.primaryLanguage === 'es' ? '¡Buen trabajo! — Español memorizado' : 'Great job — Spanish locked in!')
                  : (state.primaryLanguage === 'es' ? '¡Excelente! — Inglés memorizado' : 'Nice — English locked in!')
                )
            }
          </h2>
          <div className="space-y-2">
            {!currentPassFailed && (
              <p className="font-hanken text-lg font-semibold text-royal-soft">
                {state.primaryLanguage === 'es'
                  ? 'Ya casi. Un idioma completado.'
                  : 'Almost there. One language down.'}
              </p>
            )}
            <p className="font-hanken text-cold-grey max-w-xs mx-auto leading-relaxed">
              {currentPassFailed
                ? (state.primaryLanguage === 'es' 
                    ? 'No se puede avanzar tras un intento fallido. Por favor, intenta memorizar el versículo desde el principio.' 
                    : 'You cannot proceed after a failed attempt. Please try memorizing the verse from the beginning.')
                : (state.primaryLanguage === 'es' 
                    ? `Sigue con la versión en ${isEnNext ? 'inglés' : 'español'}.`
                    : `Keep going with the ${isEnNext ? 'English' : 'Spanish'} version.`
                  )
              }
            </p>
          </div>
        </div>

        <div className="w-full max-w-[280px] px-6 space-y-4">
          {!halfwayShowsRetry ? (
            <button
              ref={halfwayContinueRef}
              onClick={handleHalfwayContinue}
              className="vbtn vbtn--primary w-full"
            >
              {state.primaryLanguage === 'es' ? 'continuar' : 'continue'}
            </button>
          ) : (
            <button
              onClick={reset}
              className="vbtn vbtn--primary w-full"
            >
              {state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div id="memorize-content" className="flex-1 flex flex-col w-full mx-auto pt-2 sm:pt-0 pb-6 md:max-w-[760px] xl:max-w-[900px]">
      {/* Scoped keyframes for the one-shot occupancy bloom. Local to Memorize
          because no CSS file is authorized; this adds no global stylesheet. */}
      <style>{BEACON_STYLE}</style>

      {/* Top Section - Header */}
      <div className="mb-[18px] md:mb-[22px] flex-shrink-0">
        <div className="space-y-2 sm:space-y-3">
          {/* Row 1: eyebrow + language chip (left) and step status (right).
              The step indicator lives here so the reference below always gets
              the full column width and never competes with it.
              ORDINARY MEMORIZE ONLY. In Review mode the eyebrow is gone, the
              step pill is gone, and the language chip moves below the status
              strip — so the whole row is dropped rather than left empty, and
              the passage reference becomes the first content element beneath
              the global header. */}
          {!isReviewMode && (
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                {/* Section identity — Verdant Teal, no containing pill, no glow. */}
                <span
                  className="font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] leading-none"
                  style={{ color: "#3E8F7B" }}
                >
                  {state.primaryLanguage === 'es' ? 'MEMORIZA' : 'MEMORIZE'}
                </span>

                {state.memorizeMode === 'both' && (
                  <span className="vchip text-[10px] sm:text-[11px] uppercase tracking-[0.2em] min-h-0 py-1.5 select-none">
                    {activeLanguage === 'es'
                      ? (state.primaryLanguage === 'es' ? 'Español' : 'Spanish')
                      : (state.primaryLanguage === 'es' ? 'Inglés' : 'English')}
                  </span>
                )}
              </div>

              {/* Step-status utility pill — ORDINARY MEMORIZE ONLY. One line,
                  all numerals on one baseline (no floating gold numeral); Cold
                  Grey label with the current numeral in Verdant Teal, and a
                  restrained Royal halo. Review mode omits it and shows no
                  replacement badge, pill or progress counter of any kind. */}
              <div
                className="flex-shrink-0 inline-flex items-center h-8 px-[10px] rounded-[12px] select-none"
                style={{
                  background: "rgba(15,20,27,0.58)",
                  border: "1px solid rgba(62,143,123,0.22)",
                  boxShadow: "0 0 8px rgba(91,120,255,0.10)",
                }}
              >
                <span className="font-hanken text-[11px] font-semibold uppercase tracking-widest leading-none text-cold-grey">
                  {state.primaryLanguage === 'es' ? 'Paso ' : 'Step '}
                  <span style={{ color: "#3E8F7B" }}>{Math.min(5, stage)}</span>
                  {state.primaryLanguage === 'es' ? ' de 6' : ' of 6'}
                </span>
              </div>
            </div>
          )}

          {/* REVIEW-MODE STATUS STRIP — the first content element in Review
              mode, centred above the left-aligned passage reference. Persistent
              through Step 5 and Step 6 and restored after a reload, because it
              derives from the live session rather than any transient flag. The
              INTERNAL stage is untouched: Review still runs Step 5 then
              Step 6. */}
          {isReviewMode && (
            <ReviewModeStrip
              label={reviewCopy.modeBannerLabel(state.primaryLanguage === 'es' ? 'es' : 'en')}
              hint={reviewCopy.modeBannerHint(state.primaryLanguage === 'es' ? 'es' : 'en')}
            />
          )}

          {/* Row 2: the verse reference owns the full row. Long and Spanish
              references wrap naturally; never truncated or ellipsized. */}
          {/* Paired to the CONTENT language of the pane on screen, not to the
              interface language. A Spanish pass therefore always reads
              "1 Tesalonicenses 5:17" even under an English interface, and an
              English pass always reads "1 Thessalonians 5:17" even under a
              Spanish one. (The previous expression fell back to the interface
              language whenever the mode was bilingual, which is how a Spanish
              memorization came to show an English book name.) */}
          {/* REFERENCE ROW. In Review mode the compact ACTIVE-PASS pill rides
              this row, right aligned — it no longer occupies a row of its own
              beneath the reference. The reference stays dominant and is never
              truncated; the row wraps only when genuinely necessary, and the
              pill stays compact rather than becoming a full-width badge.
              The pill reports the language CURRENTLY on screen and is driven by
              `activeLanguage`, which derives from the attempt snapshot's own
              language order — never from the global memorize preference. */}
          {isReviewMode ? (
            <div className="w-full flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h2 className="min-w-0 flex-1 font-fraunces text-[clamp(1.50rem,6.8vw,1.78rem)] min-[390px]:text-[clamp(1.78rem,6.5vw,2.15rem)] md:text-[42px] font-normal text-cool-white leading-[1.06] break-words [text-wrap:balance]">
                {getLocalizedBookName(verse.book, activeLanguage)} {verse.chapter}:{verse.verse}
              </h2>
              {/* Plain text, not a pill. The workspace is already dense with
                  containers; this is a quiet metadata label subordinate to the
                  reference — no capsule, border, fill, glow, shadow, icon or
                  separator. */}
              <span className="shrink-0 mt-2 font-hanken text-[10px] font-semibold uppercase tracking-[0.2em] leading-none text-faint select-none">
                {reviewCopy.activePassLabel(
                  activeLanguage,
                  state.primaryLanguage === 'es' ? 'es' : 'en'
                )}
              </span>
            </div>
          ) : (
            <h2 className="w-full font-fraunces text-[clamp(1.50rem,6.8vw,1.78rem)] min-[390px]:text-[clamp(1.78rem,6.5vw,2.15rem)] md:text-[42px] font-normal text-cool-white leading-[1.06] break-words [text-wrap:balance]">
              {getLocalizedBookName(verse.book, activeLanguage)} {verse.chapter}:{verse.verse}
            </h2>
          )}

          {/* Stage instruction — ORDINARY MEMORIZE ONLY. In Review mode the
              status strip already names the order of work and the Recall
              Workspace makes the current task obvious, so this line would be a
              third overlapping message. Removing the element removes its
              spacing with it; no gap is left behind. */}
          {!isReviewMode && (
          <motion.p
            key={`${stage}-${state.primaryLanguage}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-hanken text-[15px] text-cold-grey antialiased"
          >
            {state.primaryLanguage === 'es'
              ? (
                stage === 1 ? 'Sin escribir, léelo en voz alta' :
                stage === 2 ? 'Sin escribir, léelo otra vez' :
                stage === 3 ? 'Sin escribir, recuerda las palabras que faltan' :
                stage === 4 ? 'Una última lectura — escribirás en el siguiente paso' :
                'Recuerda el versículo de memoria'
              )
              : (
                stage === 1 ? 'Read it aloud — no typing yet' :
                stage === 2 ? 'Read it again — no typing yet' :
                stage === 3 ? 'Recall the missing words — no typing yet' :
                stage === 4 ? 'One final read — typing begins next' :
                'Recall the verse from memory'
              )
            }
          </motion.p>
          )}

          {/* Translation-unavailable notice. Deliberately OUTSIDE the Scripture
              stage and styled as interface chrome, so it can never be mistaken
              for — or graded as — verse content. Localized to the INTERFACE
              language while naming the content language that dropped out. */}
          {unavailableNoticeLang && (
            <div
              role="status"
              className="w-full flex items-start gap-2.5 rounded-2xl px-4 py-2.5 bg-deep-slate border border-(--line)"
            >
              <AlertCircle size={15} className="text-cold-grey flex-shrink-0 mt-px" aria-hidden="true" />
              <span className="min-w-0 text-[12px] font-hanken text-cold-grey leading-snug">
                {unavailableNoticeLang === 'es'
                  ? (state.primaryLanguage === 'es'
                      ? 'La traducción en español no está disponible en este momento. Este intento continúa solo en inglés.'
                      : 'The Spanish translation is unavailable right now. This attempt continues in English only.')
                  : (state.primaryLanguage === 'es'
                      ? 'La traducción en inglés no está disponible en este momento. Este intento continúa solo en español.'
                      : 'The English translation is unavailable right now. This attempt continues in Spanish only.')}
              </span>
            </div>
          )}
        </div>

        {/* Home-aligned five-segment progress rail (decorative; the visible
            "Step N / 5" text above is the accessible equivalent). Sits
            between the instruction and the Scripture stage. */}
        <div className="w-full flex justify-center items-center pt-[18px] md:pt-[22px]" aria-hidden="true">
          <StageProgressRail stage={Math.min(5, stage)} accent={isReviewMode ? REVIEW_ACCENT : undefined} />
        </div>
      </div>

      {/* Main Scripture Stage - an open rounded boundary suggested by four
          corner marks; never a full nested card, never full-width rules */}
      <div className="flex-1 flex flex-col items-center w-full mb-[14px] md:mb-[18px]">
        <div
          id="memorize-verse-card"
          className="w-full relative overflow-visible rounded-[14px] md:rounded-[18px] bg-[rgba(15,20,27,0.28)]"
        >
          {/* Open corner frame: only the two relevant sides of each mark render */}
          {/* Open corner frame — Royal atmosphere in ordinary Memorize, Verdant
              in Review mode. Only the rim colour changes; the geometry, radii
              and Scripture stage are identical. */}
          <span aria-hidden="true" className={`pointer-events-none absolute top-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-l rounded-tl-[14px] md:rounded-tl-[18px] ${frameAccentClass}`} />
          <span aria-hidden="true" className={`pointer-events-none absolute top-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-r rounded-tr-[14px] md:rounded-tr-[18px] ${frameAccentClass}`} />
          <span aria-hidden="true" className={`pointer-events-none absolute bottom-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-l rounded-bl-[14px] md:rounded-bl-[18px] ${frameAccentClass}`} />
          <span aria-hidden="true" className={`pointer-events-none absolute bottom-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-r rounded-br-[14px] md:rounded-br-[18px] ${frameAccentClass}`} />
          {/* Stage body - content-sized in-flow column (label, verse, utility
              controls); the Phase 1 shell is the only scroll owner */}
          <div
            className="w-full flex flex-col items-center relative overflow-visible py-7 px-2.5 md:py-9 md:px-6 xl:py-[42px] xl:px-9 gap-[18px] md:gap-6"
          >
            {/* Input Overlay for Stage 5 */}
            {stage === 5 && !isRevealed && !isCorrect && !didFailFlow && (
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                defaultValue=" "
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  const isComposingKey = e.nativeEvent.isComposing || isInputComposingRef.current || e.key === 'Dead' || e.key === 'Process';
                  if (isComposingKey) return;

                  const hasTextInputModifier = e.altKey || e.ctrlKey || e.metaKey || e.getModifierState('AltGraph');
                  if (hasTextInputModifier) return;

                  const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;
                  const cleanLen = activeLanguage === 'es' ? esTextCleanLen : enTextCleanLen;

                  // Reset the post-submit marks when the user starts correcting.
                  const clearSubmittedMarks = () => {
                    if (!hasSubmitted) return;
                    if (activeLanguage === 'es') {
                      setHasSubmittedEs(false);
                      setIsWrongEs(false);
                    } else {
                      setHasSubmittedEn(false);
                      setIsWrongEn(false);
                    }
                  };

                  // macOS full-keyboard forward Delete reports key "Delete"
                  // (fn+Delete on laptops reports key "Delete" with code
                  // "Backspace", so Backspace must be matched on `key` first).
                  const isForwardDelete =
                    e.key === 'Delete' || e.key === 'Del' || e.code === 'Delete';

                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    clearSubmittedMarks();

                    // One predictable slot-editor rule: step back to the
                    // previous editable slot, clear it, and stay there. Clue
                    // letters are not editable, so they are skipped and can
                    // never be deleted; the search is editable-only (not
                    // occupancy-based), so empty runs cannot trap the cursor.
                    const prevEditable = findPreviousEditableIndex(cursor, activeLanguage);
                    if (prevEditable !== -1) {
                      clearSlotValue(prevEditable, activeLanguage);
                      setCursor(prevEditable);
                    }
                  } else if (isForwardDelete) {
                    e.preventDefault();
                    cancelPendingSubmit();
                    clearSubmittedMarks();

                    // Forward Delete clears the CURRENT editable slot and does
                    // not move the cursor. An empty slot simply stays empty; a
                    // Clue slot is not editable and is never cleared.
                    if (cursor < cleanLen && isEditable(cursor, activeLanguage)) {
                      clearSlotValue(cursor, activeLanguage);
                    }
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    if (e.shiftKey) {
                      const prevWordStart = findPreviousEditableWordStart(cursor, activeLanguage);
                      if (prevWordStart !== -1) {
                        setCursor(prevWordStart);
                      }
                    } else {
                      const nextWordStart = findNextEditableWordStart(cursor, activeLanguage);
                      if (nextWordStart !== -1) {
                        setCursor(nextWordStart);
                      }
                    }
                  } else if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    const nextWordStart = findNextEditableWordStart(cursor, activeLanguage);
                    if (nextWordStart !== -1) {
                      setCursor(nextWordStart);
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    // Exactly one editable slot backward, across word
                    // boundaries, regardless of occupancy; stop at the first.
                    const prevEditable = findPreviousEditableIndex(cursor, activeLanguage);
                    if (prevEditable !== -1) {
                      setCursor(prevEditable);
                    }
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    // Exactly one editable slot forward, across word
                    // boundaries, regardless of occupancy; stop at the last.
                    const nextEditable = findNextEditableIndex(cursor + 1, activeLanguage);
                    if (nextEditable !== -1) {
                      setCursor(nextEditable);
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    const currentSpan = document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor}"]`)
                      || document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor - 1}"]`);
                    if (currentSpan) {
                      const refRect = currentSpan.getBoundingClientRect();
                      const refX = refRect.left + refRect.width / 2;
                      const allSpans = Array.from(document.querySelectorAll(`[data-lang="${activeLanguage}"]`));
                      
                      const candidateSpans = allSpans.filter(span => {
                        const rect = span.getBoundingClientRect();
                        return (rect.top + rect.height / 2) < refRect.top;
                      });
                      
                      if (candidateSpans.length > 0) {
                        const maxY = Math.max(...candidateSpans.map(s => s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2));
                        const lineCandidates = candidateSpans.filter(s => {
                          const rect = s.getBoundingClientRect();
                          const centerY = rect.top + rect.height / 2;
                          return Math.abs(centerY - maxY) < 15;
                        });
                        
                        let bestSpan = lineCandidates[0];
                        let minDiff = Infinity;
                        lineCandidates.forEach(s => {
                          const rect = s.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const diff = Math.abs(centerX - refX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            bestSpan = s;
                          }
                        });
                        
                        if (bestSpan) {
                          const targetIdx = parseInt(bestSpan.getAttribute('data-index') || "0", 10);
                          setCursor(getNearestCursorIndex(targetIdx, activeLanguage));
                        }
                      }
                    }
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    cancelPendingSubmit();
                    const currentSpan = document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor}"]`)
                      || document.querySelector(`[data-lang="${activeLanguage}"][data-index="${cursor - 1}"]`);
                    if (currentSpan) {
                      const refRect = currentSpan.getBoundingClientRect();
                      const refX = refRect.left + refRect.width / 2;
                      const allSpans = Array.from(document.querySelectorAll(`[data-lang="${activeLanguage}"]`));
                      
                      const candidateSpans = allSpans.filter(span => {
                        const rect = span.getBoundingClientRect();
                        return (rect.top + rect.height / 2) > (refRect.top + refRect.height);
                      });
                      
                      if (candidateSpans.length > 0) {
                        const minY = Math.min(...candidateSpans.map(s => s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2));
                        const lineCandidates = candidateSpans.filter(s => {
                          const rect = s.getBoundingClientRect();
                          const centerY = rect.top + rect.height / 2;
                          return Math.abs(centerY - minY) < 15;
                        });
                        
                        let bestSpan = lineCandidates[0];
                        let minDiff = Infinity;
                        lineCandidates.forEach(s => {
                          const rect = s.getBoundingClientRect();
                          const centerX = rect.left + rect.width / 2;
                          const diff = Math.abs(centerX - refX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            bestSpan = s;
                          }
                        });
                        
                        if (bestSpan) {
                          const targetIdx = parseInt(bestSpan.getAttribute('data-index') || "0", 10);
                          setCursor(getNearestCursorIndex(targetIdx, activeLanguage));
                        }
                      }
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // A held Enter must never both open and confirm: OS key
                    // repeat is dropped, so confirming always takes a second,
                    // distinct press.
                    if (e.repeat) return;
                    if (!pendingSubmitRef.current) {
                      // First Enter only arms the confirmation. It must not
                      // reach handleCheck, so it can never consume an attempt.
                      setPendingSubmitLive(true);
                      return;
                    }
                    handleCheck();
                  } else if (e.key === 'Escape') {
                    if (pendingSubmitRef.current) {
                      e.preventDefault();
                      setPendingSubmitLive(false);
                      // The hidden input already owns focus — it is the element
                      // receiving this key — so editing simply resumes.
                    }
                  }
                }}
                onCompositionStart={() => {
                  isInputComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isInputComposingRef.current = false;
                  const input = e.currentTarget;
                  window.setTimeout(() => {
                    const composedText = getTypedTextFromInputValue(input.value);
                    if (composedText) {
                      insertTypedText(composedText);
                    }
                    resetStreamInput(input);
                  }, 0);
                }}
                onInput={(e) => {
                  const val = e.currentTarget.value;
                  const nativeInputEvent = e.nativeEvent as InputEvent;
                  if (isInputComposingRef.current || nativeInputEvent.isComposing) return;

                  const cursor = activeLanguage === 'es' ? cursorIndexEsRef.current : cursorIndexEnRef.current;
                  const setCursor = activeLanguage === 'es' ? setCursorIndexEsLive : setCursorIndexEnLive;

                  // Detect addition
                  if (val.length > 0) {
                    const typedText = getTypedTextFromInputValue(val);
                    if (typedText) {
                      insertTypedText(typedText);
                    }
                  } else if (val.length === 0) {
                    // Mobile Backspace detection fallback — the soft keyboard
                    // consumed the space sentinel instead of emitting a
                    // keydown. It runs the identical slot-editor rule as the
                    // hardware Backspace above: step back to the previous
                    // editable slot, clear it, stay there.
                    cancelPendingSubmit();
                    if (hasSubmitted) {
                      if (activeLanguage === 'es') {
                        setHasSubmittedEs(false);
                        setIsWrongEs(false);
                      } else {
                        setHasSubmittedEn(false);
                        setIsWrongEn(false);
                      }
                    }
                    const prevEditable = findPreviousEditableIndex(cursor, activeLanguage);
                    if (prevEditable !== -1) {
                      clearSlotValue(prevEditable, activeLanguage);
                      setCursor(prevEditable);
                    }
                  }

                  // Always reset input value to " " to be ready for next char/deletion
                  resetStreamInput(e.currentTarget);
                }}
                className="absolute opacity-0 inset-0 w-full h-full cursor-default caret-transparent text-transparent outline-none border-none select-none bg-transparent shadow-none"
                autoFocus
              />
            )}

            {/* Translation Label - in-flow, centered inside the implied frame */}
            <div className="relative z-10 flex justify-center">
              <motion.div 
                key={`${activeLanguage}-${state.selectedTranslations.es}-${state.selectedTranslations.en}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <div className="h-px w-6 bg-(--line)" />
                <span className="text-[10px] font-hanken font-semibold uppercase tracking-[0.4em] text-faint">
                  {activeLanguage === 'es' ? (activePair?.es || 'RVR1960') : (activePair?.en || 'KJV')}
                </span>
                <div className="h-px w-6 bg-(--line)" />
              </motion.div>
            </div>

            {/* Verse Content — the Memory Map (verse geography, hidden-run
                rails, clue letters). It never shows the user's typed text and
                stays visually stable through Step 5. */}
            <div className="w-full flex flex-col items-center overflow-visible relative z-10">
              <div className="w-full relative">
                {/* Canonical line-map measurement mirror (Section E): an exact
                    invisible replica of the Steps 1-4 proportional Scripture
                    rendering — same width, outer font classes, word flex
                    structure, per-character slot minimums and gaps — measured
                    (offsetTop per word) to derive the one line map that drives
                    the Step 5 Memory Map and Recall Composer. visibility:hidden
                    keeps full layout while removing it from paint AND from the
                    accessibility tree (with aria-hidden as belt and braces);
                    pointer-events-none and no interactive children keep it
                    unfocusable and unclickable. */}
                <div
                  ref={attachCanonicalMirror}
                  aria-hidden="true"
                  className="invisible pointer-events-none absolute inset-x-0 top-0 w-full select-none font-serif text-[21px] min-[390px]:text-[23px] md:text-[27px] xl:text-[30px] leading-[1.45] font-normal [font-optical-sizing:auto]"
                >
                  <div className="flex flex-wrap justify-center content-start gap-y-2 md:gap-y-2.5 gap-x-[0.5em] w-full">
                    {(activeCanonicalText || "").split(" ").map((word, wi) => (
                      <div key={wi} data-mword={wi} className="flex flex-row flex-nowrap gap-x-[1.5px] items-end">
                        {word.split("").map((ch, ci) => (
                          <span key={ci} className="relative inline-flex flex-col items-center justify-center min-w-[0.25em]">{ch}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {activeLanguage === 'es'
                  ? renderVerseContent(esText, userInputEs, 'es', true)
                  : renderVerseContent(enText, userInputEn, 'en', true)
                }
              </div>
            </div>

            {/* Natural Recall Composer — one coordinated area beneath the
                Memory Map inside the same Scripture stage. Only during live
                Step 5 entry (not on reveal, success, or a failed run). */}
            {stage === 5 && !isRevealed && !isCorrect && !didFailFlow && (
              <>
                {/* Composer surface: one restrained dark-glass panel. The
                    entered glyphs own the width; no fixed max-height, no inner
                    scroll, no transition/animation tied to typing. */}
                <div
                  onClick={() => {
                    // Hand focus back only — never relocate the cursor. Sending
                    // it to `cleanLen` here was the primary input lock: that
                    // past-the-end position satisfied the old navigation rule
                    // but failed insertTypedText's editable guard, so every
                    // later keystroke was silently dropped. Fine positioning
                    // belongs to the map beacon and the per-glyph spans, both
                    // of which snap to a real editable slot.
                    cancelPendingSubmit();
                    focusStreamInput();
                  }}
                  className="relative z-10 w-full rounded-[16px] p-[14px] md:p-4 cursor-text"
                  style={{
                    minHeight: "72px",
                    // Teal core, Royal only as atmosphere; the inset top
                    // highlight is what gives the glass its lit edge. No fill,
                    // no repeating animation — focus simply swaps the values.
                    background: "rgba(15,20,27,0.44)",
                    border: `1px solid ${inputFocused ? "rgba(62,143,123,0.62)" : "rgba(62,143,123,0.30)"}`,
                    boxShadow: inputFocused
                      ? "0 0 0 1px rgba(62,143,123,0.08), 0 0 18px rgba(91,120,255,0.22), 0 0 30px rgba(62,143,123,0.09), inset 0 1px 0 rgba(231,236,242,0.04)"
                      : "0 0 10px rgba(91,120,255,0.08), inset 0 1px 0 rgba(231,236,242,0.025)",
                  }}
                >
                  {/* Label — not a pill; sits immediately above the response. */}
                  <div className="font-hanken text-[10px] font-semibold uppercase tracking-[0.28em] text-cold-grey mb-2 select-none">
                    {state.primaryLanguage === 'es' ? 'TU RECUERDO' : 'YOUR RECALL'}
                  </div>
                  {/* The user's answer in natural proportional Fraunces flow,
                      centered so it shares the Memory Map's visual axis. Plain
                      `text-align: center` only: each wrapped line centers
                      itself, glyphs keep their own advances, and the caret
                      rides the real insertion point. The composer still wraps
                      on its own entered content — its line breaks are NOT
                      coupled to the map's, and nothing is scaled to match.

                      LIGATURES ARE DISABLED HERE (and only here). Colour is a
                      paint-time property, not a shaping property, so Fraunces
                      was free to fuse a Clue `f` and an adjacent typed `f`
                      across their separate spans into one `ff` ligature glyph
                      painted in a single colour — making an ordinary typed
                      glyph read as Ember. Disabling standard + contextual
                      ligatures inside the composer keeps every logical index
                      independently colourable (`ff`, `fi`, `fl`, `ffi`, `ffl`)
                      while Fraunces, proportional advances, spacing, and
                      wrapping stay untouched. Scripture, titles, references
                      and reveals elsewhere keep their normal ligatures. */}
                  <div
                    className="w-full text-center font-serif font-normal text-cool-white text-[20px] min-[390px]:text-[22px] md:text-[26px] xl:text-[28px] leading-[1.45] break-words [font-optical-sizing:auto]"
                    style={{ fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "clig" 0' }}
                  >
                    {activeLanguage === 'es'
                      ? renderRecallComposerBody(esText, userInputEs, 'es', true)
                      : renderRecallComposerBody(enText, userInputEn, 'en', true)}
                  </div>
                </div>
              </>
            )}

            {/* Compact utility control group (clue + peek) inside the
                Scripture stage. Fit-content dark glass, 44px interaction
                height with smaller visual surfaces; clue keeps its stable
                slot via visibility so the group never jumps when clue
                availability changes. EXPLICITLY unrendered while the Enter
                tray is armed — a `hidden` class lost to this element's own
                `inline-flex` display utility in the cascade (display
                utilities conflict by CSS source order, not class order), so
                Clue/Peek stayed visible. Conditional JSX is unambiguous; the
                underlying React state is untouched, so cancelling restores it. */}
            {!(stage === 5 && pendingSubmit) && (
            <div className="relative z-10 inline-flex w-fit h-11 items-center px-1 gap-1 rounded-[13px] bg-[rgba(15,20,27,0.86)] border border-[rgba(150,180,210,0.12)] backdrop-blur-[14px]">
              <div className={`flex items-center gap-1 ${canShowClue ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); handleClue(activeLanguage); }}
                  disabled={!canUseClue}
                  className="h-11 min-w-11 flex items-center justify-center active:translate-y-px disabled:cursor-not-allowed"
                >
                  <span className={`relative h-8 inline-flex items-center gap-1.5 px-[9px] rounded-[11px] text-[10px] font-hanken font-semibold uppercase tracking-widest ${
                    canUseClue ? 'text-ember' : 'text-faint opacity-50'
                  }`}>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-[3px] rounded-[8px] border ${
                        canUseClue ? 'border-[rgba(232,179,75,0.42)]' : 'border-(--line)'
                      }`}
                    />
                    <Sparkles size={12} aria-hidden="true" />
                    <span className="whitespace-nowrap">{state.primaryLanguage === 'es' ? 'Pista' : 'Clue'}</span>
                  </span>
                </button>
                <span aria-hidden="true" className="w-px h-4 bg-[rgba(139,149,163,0.12)]" />
              </div>
              <button
                    disabled={stage === 5}
                    tabIndex={stage === 5 ? -1 : 0}
                    aria-disabled={stage === 5}
                    onPointerDown={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType === "touch" || e.pointerType === "pen") {
                        setIsRevealed(v => !v);
                      } else {
                        setIsRevealed(true);
                      }
                    }}
                    onPointerUp={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType !== "touch" && e.pointerType !== "pen") {
                        setIsRevealed(false);
                      }
                    }}
                    onPointerLeave={(e) => {
                      if (stage === 5) return;
                      e.preventDefault();
                      if (e.pointerType !== "touch" && e.pointerType !== "pen") {
                        setIsRevealed(false);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      userSelect: "none",
                      touchAction: "manipulation",
                    } as React.CSSProperties}
                    aria-label={state.primaryLanguage === 'es' ? 'Ver el versículo' : 'Peek at the verse'}
                    className={`w-11 h-11 flex items-center justify-center active:scale-95 select-none ${
                      stage === 5 ? 'cursor-not-allowed pointer-events-none' : ''
                    }`}
                  >
                    <span className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center ${
                      stage === 5
                        ? 'bg-transparent text-(--control-text-disabled) opacity-40'
                        : isRevealed
                          ? 'bg-[rgba(91,120,255,0.10)] text-royal'
                          : 'bg-transparent text-cold-grey hover:text-royal'
                    }`}>
                      {isRevealed ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </span>
                  </button>
            </div>
            )}

            {/* Enter-submit confirmation TRAY. Rendered in the Clue/Peek slot
                (directly beneath the composer), replacing the lower control
                zone in normal document flow — never an absolute overlay that
                could detach on long-page scroll. While it is armed the
                Clue/Peek group above and the Previous/Next row below are both
                left UNRENDERED (explicit conditional JSX, not a display class),
                so nothing is duplicated and no empty wrapper reserves height.
                A neutral decision state: dark slate + Verdant Teal + restrained
                Royal atmosphere, never rose. The hidden input keeps focus (the
                buttons preventDefault their own mousedown), so the second Enter
                still reaches it. */}
            {stage === 5 && pendingSubmit && (
              <div
                role="group"
                aria-label={state.primaryLanguage === 'es' ? 'Confirmar envío' : 'Confirm submission'}
                className="relative z-10 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-2"
                style={{
                  width: "calc(100% - 24px)",
                  maxWidth: "300px",
                  background: "rgba(15,20,27,0.96)",
                  border: "1px solid rgba(62,143,123,0.42)",
                  boxShadow: "0 0 18px rgba(91,120,255,0.12), inset 0 1px 0 rgba(231,236,242,0.035)",
                }}
              >
                <div className="text-center">
                  <p className="text-[12px] font-hanken font-semibold text-cool-white leading-tight">
                    {state.primaryLanguage === 'es'
                      ? '¿Listo para comprobar lo que recuerdas?'
                      : 'Ready to check your recall?'}
                  </p>
                  <p className="text-[10px] font-hanken text-cold-grey leading-tight mt-0.5">
                    {state.primaryLanguage === 'es'
                      ? 'Pulsa Enter otra vez para enviar · Esc para seguir editando'
                      : 'Press Enter again to submit · Esc to keep editing'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 w-full">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); setPendingSubmitLive(false); focusStreamInput(); }}
                    className="group h-11 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(62,143,123,0.6)]"
                  >
                    <span className="h-8 inline-flex items-center px-2.5 rounded-[11px] border border-(--line) text-[10px] font-hanken font-semibold uppercase tracking-wide text-cold-grey group-hover:text-cool-white whitespace-nowrap">
                      {state.primaryLanguage === 'es' ? 'Seguir editando' : 'Keep editing'}
                    </span>
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); handleCheck(); }}
                    className="group h-11 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(62,143,123,0.6)]"
                  >
                    <span
                      className="h-8 inline-flex items-center px-2.5 rounded-[11px] border text-[10px] font-hanken font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ borderColor: "rgba(62,143,123,0.52)", color: "#3E8F7B", background: "rgba(62,143,123,0.10)" }}
                    >
                      {state.primaryLanguage === 'es' ? 'Comprobar' : 'Check answer'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM FLOW: controls, then feedback, then step bars */}
      <div
        className="w-full flex-shrink-0 pb-2 relative z-10"
      >
        {/* Action Controls - compact secondary rounded rectangles beneath the
            Scripture stage. The Back slot is always reserved (hidden at
            stage 1) so the pair never shifts; 44px interaction targets wrap
            the smaller visual surfaces. EXPLICITLY unrendered while the Enter
            tray is armed (same cascade reason as Clue/Peek: `flex` beat the
            `hidden` class), so the tray fully replaces this row + Clue/Peek;
            React state is untouched, so cancelling restores it exactly. */}
        {!(stage === 5 && pendingSubmit) && (
        <div className="w-full flex items-center justify-center gap-2">
            {/* Previous */}
            <button
              onClick={stage === 5 ? undefined : prevStage}
              disabled={stage === 1 || stage === 5}
              aria-hidden={stage === 1 || undefined}
              tabIndex={stage === 1 ? -1 : undefined}
              className={`group h-11 min-w-11 flex items-center justify-center rounded-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(91,120,255,0.6)] ${
                stage === 1 ? 'opacity-0 pointer-events-none' : stage === 5 ? 'cursor-not-allowed' : ''
              }`}
              aria-label="Back"
            >
              <span className={`w-10 h-[34px] rounded-[11px] border flex items-center justify-center backdrop-blur-[10px] ${
                stage === 5
                  ? 'bg-(--control-fill-disabled) border-(--line) text-(--control-text-disabled)'
                  : 'bg-[rgba(15,20,27,0.55)] border-(--line) text-cold-grey group-hover:text-cool-white group-active:translate-y-px'
              }`}>
                <ArrowLeft size={16} strokeWidth={2} className={stage === 5 ? '' : "group-hover:-translate-x-0.5 transition-transform"} />
              </span>
            </button>

            {/* Main Action (Next/Check) */}
            <button
              ref={mainActionRef}
              key="main-action"
              onClick={() => {
                const currentAttempts = activeLanguage === 'es' ? attemptsEs : attemptsEn;
                const currentIsWrong = activeLanguage === 'es' ? isWrongEs : isWrongEn;
                const currentHasSubmitted = activeLanguage === 'es' ? hasSubmittedEs : hasSubmittedEn;

                if (stage === 5) {
                  if (isStepComplete || isRevealed || (currentIsWrong && currentAttempts >= 3)) {
                    nextStage();
                  } else if (currentHasSubmitted && currentIsWrong) {
                    if (activeLanguage === 'es') {
                      setHasSubmittedEs(false);
                      setIsWrongEs(false);
                    } else {
                      setHasSubmittedEn(false);
                      setIsWrongEn(false);
                    }
                    if (inputRef.current) {
                      try {
                        inputRef.current.focus({ preventScroll: true });
                        inputRef.current.setSelectionRange(1, 1);
                      } catch (e) {
                        console.warn("Click refocus failed", e);
                      }
                    }
                    setTimeout(() => {
                      if (inputRef.current) {
                        try {
                          inputRef.current.focus({ preventScroll: true });
                          inputRef.current.setSelectionRange(1, 1);
                        } catch (e) {
                          console.warn("Async click refocus failed", e);
                        }
                      }
                    }, 30);
                  } else {
                    handleCheck();
                  }
                } else {
                  nextStage();
                }
              }}
              aria-label={state.primaryLanguage === 'es' ? 'Continuar' : 'Continue'}
              className={`group h-11 min-w-11 flex items-center justify-center rounded-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${forwardFocusClass}`}
            >
              <span className={`w-11 h-[34px] rounded-[11px] border flex items-center justify-center bg-[rgba(15,20,27,0.55)] backdrop-blur-[10px] group-active:translate-y-px ${
                stage === 5
                  ? (isStepComplete
                      ? 'border-(--rim-gold) text-ember shadow-[0_0_4px_rgba(232,179,75,0.30)]'
                      : (hasSubmitted && isWrong && attempts < 3
                          ? 'border-[rgba(209,78,92,0.55)] text-[#F0A6A0]'
                          : forwardAccentClass))
                  : forwardAccentClass
              }`}>
                <ArrowRight size={18} strokeWidth={2.25} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
        </div>
        )}

        {/* Feedback Area - natural height so localized copy never clips */}
        <div className={`w-full flex items-center justify-center px-2 ${stage === 5 && feedback ? 'mt-3 md:mt-4' : ''}`}>
          <AnimatePresence mode="wait">
            {stage === 5 && feedback ? (
              <motion.div
                key={feedback}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex items-center gap-2.5 max-w-full bg-deep-slate px-4 sm:px-5 py-2.5 rounded-2xl border shadow-verso-card ${isCorrect ? 'border-(--rim-gold)' : 'border-[rgba(209,78,92,0.40)]'}`}
              >
                {isCorrect ? (
                  <CheckCircle2 size={16} className="text-ember flex-shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle size={16} className="text-[#F0A6A0] flex-shrink-0" aria-hidden="true" />
                )}
                <span className={`min-w-0 text-[11px] sm:text-sm font-hanken font-semibold uppercase tracking-widest ${isCorrect ? 'text-ember' : 'text-[#F0A6A0]'}`}>
                  {feedback}
                </span>
                {!isCorrect && (
                  <span className="text-[10px] font-hanken font-semibold text-faint flex-shrink-0">
                    ({attempts}/3)
                  </span>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

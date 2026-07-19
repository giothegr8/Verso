import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ACTIVE_ATTEMPT_SCHEMA_VERSION,
  ActiveAttemptSnapshot,
  AppState,
  MEMORIZE_TYPING_STATE_SCHEMA_VERSION,
  MemorizeLanguage,
  TRANSLATION_PAIRS,
  TRANSLATION_DETAILS,
  Verse
} from "../types";
import { loadVerseAndMerge } from "../services/bibleService";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { CheckCircle2, RotateCcw, Eye, EyeOff, ArrowRight, ArrowLeft, Trophy, Sparkles, AlertCircle, Bookmark, Layers, BookOpen, Loader2 } from "lucide-react";
import React from "react";
import confetti from "canvas-confetti";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, removeAccents } from "../utils/verseUtils";

interface MemorizeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onComplete?: () => void;
  onGoToFlashcards?: (verseId: string) => void;
  onAbandon?: () => void;
  tourStepId?: string | null;
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
// keep their semantic names (Seed, Water, Root, Sprout, Bloom) in data
// attributes only — never rendered as icons. Decorative; the visible
// "Step N / 5" text in the header is the accessible equivalent.
const STAGE_RAIL_STAGES = ["Seed", "Water", "Root", "Sprout", "Bloom"] as const;

const StageProgressRail = ({ stage }: { stage: number }) => (
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
            // with a restrained Royal Blue atmospheric halo; upcoming → Cold
            // Grey at low opacity. (Locked Memorize accent system.)
            background:
              status === "completed" ? "rgba(232,179,75,0.76)"
              : status === "current" ? "#3E8F7B"
              : "rgba(139,149,163,0.20)",
            boxShadow:
              status === "current" ? "0 0 7px rgba(91,120,255,0.22)"
              : status === "completed" ? "0 0 4px rgba(232,179,75,0.18)"
              : undefined,
          }}
        />
      );
    })}
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

export default function Memorize({ state, setState, onComplete, onGoToFlashcards, onAbandon, tourStepId }: MemorizeProps) {
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
  const attemptLanguageOrder = activeAttempt?.languageOrder && activeAttempt.languageOrder.length > 0
    ? activeAttempt.languageOrder
    : getExpectedLanguageOrder(state.memorizeMode, state.primaryLanguage);
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
  const [stage, setStage] = useState(() => Math.min(5, savedTypingState?.currentStep || globalVerseStage));
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAlmostDone, setIsAlmostDone] = useState(() => {
    try {
      const failed = localStorage.getItem(`memorize_failed_${verse.id}`) === "true";
      return (globalVerseStage === 6 && activeAttempt?.cardsReady === true) || failed;
    } catch {
      return globalVerseStage === 6 && activeAttempt?.cardsReady === true;
    }
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
  const celebratedAlmostDoneRef = useRef<string>("");

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
  const isStepComplete = state.memorizeMode === 'both' ? (isEsDone && isEnDone) : (state.memorizeMode === 'es' ? isEsDone : isEnDone);
  
  const isOverallSuccess = state.memorizeMode === 'both' 
    ? (isCorrectEs && isCorrectEn) 
    : (state.memorizeMode === 'es' ? isCorrectEs : isCorrectEn);

  const isAnyPartFailed = (state.memorizeMode === 'both'
    ? (didFailFlowEs || didFailFlowEn)
    : (state.memorizeMode === 'es' ? didFailFlowEs : didFailFlowEn)) || sessionFailed;

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

  const { esText, enText, esError, enError, activePair: validatedPair } = getValidatedVerse(verse, state);
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
      const nextStage = activeAttempt
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
      setIsAlmostDone(dbStage === 6 && activeAttempt?.cardsReady === true);
      
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
    if (!isAlmostDone || state.memorizeMode !== 'both' || isAnyPartFailed) return;
    const timer = window.setTimeout(() => {
      try {
        challengeCitationRef.current?.focus({ preventScroll: true });
      } catch (e) {
        console.warn("Challenge citation focus failed", e);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAlmostDone, state.memorizeMode, isAnyPartFailed]);

  useEffect(() => {
    if (isAlmostDone && isOverallSuccess) {
      if (state.memorizeMode === 'both') {
        const halfwayKey = `second_${verse.id}_${activeLanguage}`;
        if (celebratedAlmostDoneRef.current !== halfwayKey) {
          celebratedAlmostDoneRef.current = halfwayKey;
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#E8B34B', '#F0C46E', '#8FA2FF'], // Ember gold + royal soft (earned)
            ticks: 200,
            gravity: 1.2
          });
        }
      } else {
        // Earned burst in the locked palette for single language mode complete
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;
        const colors = ['#E8B34B', '#F0C46E', '#8FA2FF', '#E7ECF2'];

        const frame = () => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) return;

          const particleCount = 10 * (timeLeft / duration);
          
          confetti({
            particleCount,
            startVelocity: 30,
            spread: 360,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: colors,
            shapes: ['circle'],
            gravity: 0.8,
            scalar: 0.7,
            drift: 0,
            ticks: 100
          });

          requestAnimationFrame(frame);
        };
        
        frame();
      }
    }
  }, [isAlmostDone, isOverallSuccess, state.memorizeMode, activeLanguage, verse.id]);

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
              savedVerses: allRequiredComplete && !s.savedVerses.includes(verse.id) ? [...s.savedVerses, verse.id] : s.savedVerses,
              progress: {
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
    setStage(1);
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
    // If we're in both-languages mode, check if we can perform a partial retry
    if (state.memorizeMode === 'both') {
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
    
    const initialLang = state.memorizeMode === 'en' ? 'en' : (state.memorizeMode === 'es' ? 'es' : state.primaryLanguage);
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
    if (state.memorizeMode === 'both' && activeLanguage !== lang) {
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

    if (state.memorizeMode === 'both' && !isMobile) {
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

    // One shared hidden-run renderer for Steps 1-5. The rail is absolute
    // (zero layout contribution): its segments divide the run's combined
    // proportional width evenly, so narrow target letters cannot become dots
    // and wide letters cannot become oversized lines, while the hidden
    // character count stays readable. bottom: 0.30em places the rail
    // ~0.10em beneath the Fraunces baseline at the stage's 1.45 line-height.
    // The data-lang/data-index attributes and click handler are retained so
    // keyboard row-navigation and click-to-position still target the map.
    //
    // Step 5 segment states are OCCUPANCY + LOCATION only — never correctness.
    // Nothing here compares an entry to the answer; `isOccupied` is a bare
    // "something is stored in this slot" test, so a right and a wrong letter
    // are pixel-identical. No caret and no entered glyph is drawn in the map:
    // the current slot reads as a quiet located beacon.
    const renderHiddenRun = (run: SlotInfo[]) => (
      <span
        key={`run-${run[0].charIdx}`}
        className="relative inline-flex flex-row flex-nowrap gap-x-[1.5px] items-end"
      >
        {run.map(info => (
          <span
            key={info.charIdx}
            data-lang={isTypingStep ? lang : undefined}
            data-index={isTypingStep ? info.letterIndex : undefined}
            onClick={isTypingStep ? handleLetterSlotClick(info.letterIndex) : undefined}
            className={`${baseSlotClasses}${isTypingStep ? ' cursor-text' : ''}`}
          >
            <span className="invisible select-none" aria-hidden="true">{info.char}</span>
          </span>
        ))}
        {/* Fixed-height (12px = tallest tile) bottom-anchored wrapper. It is
            absolute, so its height contributes NOTHING to Map layout — the
            in-flow invisible glyph anchors own width and line geometry. Every
            tile is bottom-aligned (align-items:end) on the same baseline, so a
            slot changing height (empty rail ↔ occupied ↔ current) grows upward
            only and never nudges its neighbours or reflows a line. Each tile
            keeps its column's proportional width (w-full). */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0"
          style={{
            bottom: "0.30em",
            height: "12px",
            display: "grid",
            gridTemplateColumns: `repeat(${run.length}, minmax(0, 1fr))`,
            gap: "2px",
            alignItems: "end",
          }}
        >
          {run.map(info => {
            const isCurrent = isTypingStep && isCurrentActive && info.letterIndex === beaconIdx;
            // Occupancy is a Step 5 entry concept only: Steps 1-4 rails stay
            // uniformly Cold Grey even if restored input is still in state.
            const isOccupied = isTypingStep && (userInput[info.letterIndex] || "").trim() !== "";
            const isBlooming = isTypingStep && beaconIndices.includes(info.letterIndex);
            // Review outranks current/occupied/empty. The map is the only
            // surface that can show a MISSING position (the composer has no
            // glyph to mark there), so it carries the full wrong-or-missing
            // set. It says "review this position" and nothing more: never the
            // target letter, never whether a letter is wrong vs absent vs a
            // casing or accent difference. Static — no pulse, no shake.
            const isReview = isTypingStep && reviewIndices.includes(info.letterIndex);

            // Precedence (E): review rose > current teal > occupied Royal >
            // empty Cold Grey rail. Occupancy is correctness-neutral — a right
            // and a wrong entry produce the identical Royal tile before submit.
            // Clue letters are Ember glyphs in renderVisibleSlot, never rails,
            // so they never reach this branch. Empty stays a thin pill rail;
            // the others are small illuminated rectangular tiles (radius 2px).
            let tileHeight = "2px";
            let tileRadius = "999px";
            let tileBg = "rgba(139,149,163,0.32)";
            let tileShadow: string | undefined = undefined;
            if (isReview) {
              tileHeight = "10px"; tileRadius = "2px";
              tileBg = "rgba(240,166,160,0.86)";
              tileShadow = "0 0 7px rgba(209,78,92,0.30), inset 0 1px 0 rgba(231,236,242,0.10)";
            } else if (isCurrent) {
              tileHeight = "12px"; tileRadius = "2px";
              tileBg = "#3E8F7B";
              tileShadow = "0 0 9px rgba(91,120,255,0.38), inset 0 1px 0 rgba(231,236,242,0.18)";
            } else if (isOccupied) {
              tileHeight = "10px"; tileRadius = "2px";
              tileBg = "rgba(91,120,255,0.82)";
              tileShadow = "0 0 7px rgba(91,120,255,0.24), inset 0 1px 0 rgba(231,236,242,0.12)";
            }

            return (
              <span
                key={info.charIdx}
                className={`w-full${isBlooming ? ' verso-beacon-bloom' : ''}`}
                onAnimationEnd={isBlooming ? () => retireBeacon(info.letterIndex, lang) : undefined}
                style={{
                  height: tileHeight,
                  borderRadius: tileRadius,
                  background: tileBg,
                  boxShadow: tileShadow,
                }}
              />
            );
          })}
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
    const groups: React.ReactNode[][] = [];
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
        if (revealed.includes(here)) {
          wordNodes.push(
            <span key={`w${wordIdx}-c${charIdx}`} className="text-ember">{ch}</span>
          );
          return;
        }
        const typed = userInput[here] || "";
        if (typed.trim() !== "") {
          // A glyph the last submitted answer got wrong: restrained rose ink +
          // a hairline underline. Colour and decoration only — no fill, box,
          // glow, animation or transform — so the response's size, spacing,
          // weight and wrapping are byte-for-byte what they were before the
          // submission. Correct entries stay Cool White; the whole line never
          // turns rose.
          const isReview = reviewIndices.includes(here);
          wordNodes.push(
            <span
              key={`w${wordIdx}-c${charIdx}`}
              data-composer-index={here}
              onClick={(e) => { e.stopPropagation(); placeCursor(here); }}
              className={`cursor-text${isReview ? '' : ' text-cool-white'}`}
              style={isReview ? {
                color: "#F0A6A0",
                textDecorationLine: "underline",
                textDecorationColor: "rgba(209,78,92,0.72)",
                textDecorationThickness: "1px",
                textUnderlineOffset: "0.16em",
              } : undefined}
            >
              {typed}
            </span>
          );
        }
        // Empty editable position: nothing rendered — a MISSING position is
        // therefore surfaced only by the Memory Map's review state.
      });

      // Emit a word group only if it has something to show. A word with no
      // glyphs still earns its place when the caret rests in it, so the
      // insertion point stays visible inside an untouched word.
      if (wordNodes.length > 0) {
        groups.push(wordNodes);
      }
    });

    const nodes: React.ReactNode[] = [];
    groups.forEach((group, i) => {
      if (i > 0) nodes.push(" "); // exactly one ordinary inter-word space
      nodes.push(...group);
    });
    if (isCurrentActive && cursor >= cleanLen) {
      nodes.push(caret("caret-end"));
    }

    return nodes;
  };

  if (state.progress.verseStages[verse.id] === 7) {
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
          <div className="max-w-md mx-auto space-y-4 px-5 py-6 bg-deep-slate rounded-[24px] border border-(--line)">
            <p className="font-fraunces text-lg font-normal leading-[1.32] italic text-[#EFE6D8]">
              "{state.memorizeMode === 'en' ? enText : (state.memorizeMode === 'es' ? esText : `${esText} / ${enText}`)}"
            </p>
            <p className="text-[11px] font-hanken font-semibold uppercase tracking-[0.2em] text-ember">
              {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
            </p>
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

  if (isAlmostDone) {
    const getFailureScreenContent = () => {
      const enPassed = isCorrectEn && !didFailFlowEn;
      const esPassed = isCorrectEs && !didFailFlowEs;

      let title = state.primaryLanguage === 'es' ? 'Todavía no' : 'Not quite yet';
      let body = state.primaryLanguage === 'es' 
        ? 'No has logrado memorizar todo el texto del versículo. Por favor, inténtalo de nuevo para desbloquear el reto de la cita bíblica.' 
        : 'You did not successfully memorize the verse text. Please try again to unlock the citation challenge.';
      let buttonLabel = state.primaryLanguage === 'es' ? 'intentar de nuevo' : 'try again';

      if (state.memorizeMode === 'both') {
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
          <div className={`w-32 h-32 rounded-full bg-(--glass-fill) border flex items-center justify-center ${isAnyPartFailed ? 'border-(--line)' : 'border-(--rim-gold) shadow-glow-gold'}`}>
            {isAnyPartFailed ? (
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
            {isAnyPartFailed 
              ? failureContent.title
              : (state.memorizeMode === 'both'
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
            {isAnyPartFailed 
              ? failureContent.body
              : (state.memorizeMode === 'both'
                  ? (state.primaryLanguage === 'es' 
                      ? 'Ambos idiomas listos. Ya casi. Ahora falta el último paso: la cita bíblica.' 
                      : 'Both languages locked in. Almost there. Now for the final step: the citation.')
                  : (state.primaryLanguage === 'es' 
                      ? 'Texto completo. Ahora falta el último paso: la cita bíblica.' 
                      : 'Text complete. Now for the final step: the citation.')
                )
            }
          </motion.p>
          {!isAnyPartFailed && (
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
            {!isAnyPartFailed ? (
              <>
                <motion.button 
                  ref={challengeCitationRef}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={() => onGoToFlashcards?.(verse.id)}
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
          {!currentPassFailed ? (
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
              the full column width and never competes with it. */}
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

            {/* Step-status utility pill — one line, all numerals on one
                baseline (no floating gold numeral); Cold Grey label with the
                current numeral in Verdant Teal, and a restrained Royal halo. */}
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
                {state.primaryLanguage === 'es' ? ' de 5' : ' of 5'}
              </span>
            </div>
          </div>

          {/* Row 2: the verse reference owns the full row. Long and Spanish
              references wrap naturally; never truncated or ellipsized. */}
          <h2 className="w-full font-fraunces text-[clamp(1.50rem,6.8vw,1.78rem)] min-[390px]:text-[clamp(1.78rem,6.5vw,2.15rem)] md:text-[42px] font-normal text-cool-white leading-[1.06] break-words [text-wrap:balance]">
            {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
          </h2>

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
        </div>
        
        {/* Home-aligned five-segment progress rail (decorative; the visible
            "Step N / 5" text above is the accessible equivalent). Sits
            between the instruction and the Scripture stage. */}
        <div className="w-full flex justify-center items-center pt-[18px] md:pt-[22px]" aria-hidden="true">
          <StageProgressRail stage={Math.min(5, stage)} />
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
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-l border-[rgba(91,120,255,0.32)] rounded-tl-[14px] md:rounded-tl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-r border-[rgba(91,120,255,0.32)] rounded-tr-[14px] md:rounded-tr-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-l border-[rgba(91,120,255,0.32)] rounded-bl-[14px] md:rounded-bl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-r border-[rgba(91,120,255,0.32)] rounded-br-[14px] md:rounded-br-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
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
                {/* Restrained divider — short + centered, never a full-width
                    rule (keeps the open-corner stage vocabulary). */}
                <div aria-hidden="true" className="w-10 md:w-12 h-px rounded-full bg-[rgba(139,149,163,0.22)]" />

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
                      coupled to the map's, and nothing is scaled to match. */}
                  <div className="w-full text-center font-serif font-normal text-cool-white text-[20px] min-[390px]:text-[22px] md:text-[26px] xl:text-[28px] leading-[1.45] break-words [font-optical-sizing:auto]">
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
              className="group h-11 min-w-11 flex items-center justify-center rounded-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(91,120,255,0.6)]"
            >
              <span className={`w-11 h-[34px] rounded-[11px] border flex items-center justify-center bg-[rgba(15,20,27,0.55)] backdrop-blur-[10px] group-active:translate-y-px ${
                stage === 5
                  ? (isStepComplete
                      ? 'border-(--rim-gold) text-ember shadow-[0_0_4px_rgba(232,179,75,0.30)]'
                      : (hasSubmitted && isWrong && attempts < 3
                          ? 'border-[rgba(209,78,92,0.55)] text-[#F0A6A0]'
                          : 'border-(--rim-royal) text-royal shadow-[0_0_4px_rgba(91,120,255,0.30)]'))
                  : 'border-(--rim-royal) text-royal shadow-[0_0_4px_rgba(91,120,255,0.30)]'
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

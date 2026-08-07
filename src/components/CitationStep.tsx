import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { LanguageMode, MemorizeLanguage, Verse } from "../types";
import { getLocalizedBookName } from "../utils/verseUtils";
import { reviewCopy } from "../data/reviewCopy";

/**
 * Phase 3C — Citation Step (Memorize Step 6).
 *
 * Rebuilt on the Step 5 mental model: a structural REFERENCE MAP above a
 * natural CITATION COMPOSER below.
 *
 * THE SEPARATOR LAW. Logical input is letters and digits ONLY. Every space,
 * colon, period, hyphen and other canonical separator is owned by the app: it
 * is rendered for the user, never typed into a slot, never graded, and can
 * never consume an attempt. `John 11:35`, `john11:35`, `john 11.35` and
 * `john1135` all fill the identical logical sequence, and the app always
 * renders the canonical form. A dot instead of a colon can no longer fail.
 *
 * The map deliberately reveals STRUCTURE (how many letter/digit positions,
 * where the spaces and the chapter:verse separator fall). It never reveals a
 * canonical letter or digit before Clue, success, or final exhaustion.
 */

export interface CitationRestoredState {
  draftEs: string;
  draftEn: string;
  attemptsUsed: number;
  exhausted: boolean;
  wrongEs: boolean;
  wrongEn: boolean;
}

export interface CitationPersistPatch {
  citationDraftEs?: string;
  citationDraftEn?: string;
  citationAttemptsUsed?: number;
  citationExhausted?: boolean;
  citationWrongEs?: boolean;
  citationWrongEn?: boolean;
}

interface CitationStepProps {
  verse: Verse;
  /** Localized Scripture text, shown so the user can identify what they memorized. */
  esText: string | null;
  enText: string | null;
  memorizeMode: LanguageMode;
  primaryLanguage: MemorizeLanguage;
  restored: CitationRestoredState;
  onPersist: (patch: CitationPersistPatch) => void;
  /** Correct citation submitted → acquire with citationCorrect = true. */
  onCorrect: () => void;
  /** Third attempt spent and the user acknowledged → acquire with citationCorrect = false. */
  onExhaustedAcknowledge: () => void;
  // --- Phase 4A ------------------------------------------------------------
  // Both optional and additive: an ordinary Memorize Citation Step is
  // completely unchanged when they are omitted.
  /** Swaps the active-workspace accents from Royal to Verdant. */
  reviewMode?: boolean;
  /** The persistent compact Review-mode status strip, supplied by Memorize. */
  modeStrip?: React.ReactNode;
}

const MAX_CITATION_ATTEMPTS = 3;
const MAX_CLUES_PER_LANGUAGE = 2;

// THE UNIFORM LOGICAL CELL BOARD (Step 6 Reference Map; mirrors the Step 5
// Memory Map constants in Memorize.tsx — keep the two in sync). The Map is a
// structural occupancy guide, not a proportional text silhouette: every
// logical letter/digit is one fixed-width cell, every intra-word gap is
// identical, and every inter-word gap is identical and visibly larger.
// NOTHING here derives from canonical or typed glyph widths.
const BOARD_CELL_W = "clamp(9px, 2.7vw, 11px)";
const BOARD_CELL_H = "14px";
const BOARD_TILE_H = "10px";
const BOARD_INTRA_GAP = "clamp(3px, 0.9vw, 4px)";
const BOARD_INTER_GAP = "clamp(11px, 3.1vw, 15px)";

// U+0300–U+036F combining diacritical marks, from an escaped string so the
// range stays explicit in source (the same range verseUtils uses).
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * THE ONE CITATION CLASSIFIER. Every Citation walk — target construction, map
 * rendering, composer rendering, typing, paste and validation — asks this one
 * question, so all of them stay index-aligned. Unicode-aware, so Spanish
 * accented letters, ñ/Ñ, ü/Ü and digits are all logical positions.
 */
const isLetterOrDigit = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const isDigit = (ch: string) => /\p{N}/u.test(ch);
const isLetter = (ch: string) => /\p{L}/u.test(ch);

/** Fold one character for comparison: accent-insensitive, case-insensitive. */
function foldChar(ch: string): string {
  return ch.normalize("NFD").replace(COMBINING_MARKS_RE, "").toLowerCase();
}

type SegmentKind = "book" | "chapter" | "verse";

interface CitationItem {
  /** The canonical character at this position. */
  char: string;
  /** True when this is a logical letter/digit slot; false for a fixed separator. */
  isSlot: boolean;
  /** Index into the logical target, or -1 for a fixed separator. */
  logicalIndex: number;
  kind: SegmentKind;
}

interface CitationModel {
  items: CitationItem[];
  /** Canonical letters/digits only, in logical order. */
  target: string[];
  /** The full canonical rendered reference, e.g. "1 Thessalonians 5:16". */
  canonical: string;
}

/**
 * Build the localized citation and its logical mapping. Separators keep their
 * canonical position but never occupy a logical index, so the rendered form and
 * the graded form stay in one stable correspondence.
 */
function buildCitationModel(verse: Verse, lang: MemorizeLanguage): CitationModel {
  const segments: { text: string; kind: SegmentKind }[] = [
    { text: getLocalizedBookName(verse.book, lang), kind: "book" },
    { text: " ", kind: "book" },
    { text: String(verse.chapter), kind: "chapter" },
    { text: ":", kind: "chapter" },
    { text: String(verse.verse), kind: "verse" },
  ];

  const items: CitationItem[] = [];
  const target: string[] = [];
  for (const seg of segments) {
    for (const char of Array.from(seg.text)) {
      const slot = isLetterOrDigit(char);
      items.push({
        char,
        isSlot: slot,
        logicalIndex: slot ? target.length : -1,
        kind: seg.kind,
      });
      if (slot) target.push(char);
    }
  }

  return { items, target, canonical: segments.map(s => s.text).join("") };
}

/**
 * Clue 1 — book identity: EXACTLY ONE glyph, the first alphabetic character of
 * the localized book name.
 *
 * It previously revealed the leading ordinal digits AND two initials for any
 * book name of eight or more letters, so `1 Thessalonians 5:17` gave away
 * `1`, `T` and `h` — rendering as `1 Th`, a near-complete abbreviation.
 *
 * `.find` walks `model.items` in canonical order and takes the first BOOK slot
 * that is a letter, which is what makes the rule fall out for free:
 *   - leading ordinals are digits, so `isLetter` skips them;
 *   - spaces and punctuation are not slots (`isSlot` is false), so they are
 *     skipped too;
 *   - `kind === "book"` keeps it out of the chapter and verse;
 *   - exactly one index is ever returned, so no abbreviation can appear.
 *
 * Classification is the file's Unicode-aware `isLetter` (`\p{L}`), never an
 * ASCII range, so accented and non-Latin initials resolve correctly.
 *
 *   `1 Thessalonians 5:17` -> `T`      `1 Tesalonicenses 5:17` -> `T`
 *   `John 11:35`           -> `J`      `Juan 3:16`             -> `J`
 */
function clueOneIndices(model: CitationModel): number[] {
  const firstBookLetter = model.items.find(i => i.isSlot && i.kind === "book" && isLetter(i.char));
  return firstBookLetter ? [firstBookLetter.logicalIndex] : [];
}

/**
 * THE ELIGIBLE NUMERIC CITATION POSITIONS — ONE definition, and the only one.
 *
 * A logical slot whose canonical character is a digit, asked through the same
 * `isDigit` classifier `clueOneIndices` already uses for the leading ordinal.
 * Because it runs over `model.items` in canonical order, the returned list is
 * in logical order, so element 0 IS the first eligible numeric position.
 */
function numericIndices(model: CitationModel): number[] {
  return model.items.filter(i => i.isSlot && isDigit(i.char)).map(i => i.logicalIndex);
}

/**
 * Clue 2 candidates — every eligible numeric position EXCEPT the first.
 *
 * Clue 2 used to be hard-wired to the first chapter digit, so on any given
 * citation it always revealed the same, most-guessable number. It now reveals a
 * RANDOM numeric position instead, with the first one excluded (on a numbered
 * book that leading ordinal is already given away by Clue 1).
 *
 * The candidate list can never be empty: every citation renders a chapter and a
 * verse, so it always carries at least two numeric slots and dropping the first
 * always leaves at least one. No fallback exists, and the first numeric
 * position is never silently reused.
 */
function clueTwoCandidates(model: CitationModel): number[] {
  return numericIndices(model).slice(1);
}

/**
 * Clue 1's positions are fully determined by the clue count. Clue 2's is NOT —
 * it is chosen at random once, at activation, so the chosen index is carried in
 * state and persisted (see `encodeLangState`) and simply read back here. This
 * function is called during render and must therefore never invoke randomness.
 */
function clueIndicesFor(model: CitationModel, clueCount: number, clue2Index: number | null): number[] {
  const out: number[] = [];
  if (clueCount >= 1) out.push(...clueOneIndices(model));
  if (
    clueCount >= 2 &&
    clue2Index !== null &&
    clue2Index >= 0 &&
    clue2Index < model.target.length
  ) {
    out.push(clue2Index);
  }
  return out;
}

interface LangState {
  entries: string[];
  clueCount: number;
  review: number[];
  /**
   * The numeric logical index Clue 2 selected for this attempt, or null before
   * Clue 2 is taken. Chosen exactly once inside the Clue 2 activation handler
   * and never recomputed — not on rerender, not on typing, cursor movement,
   * review feedback, confirmation, cancellation or restoration.
   */
  clue2Index: number | null;
}

/**
 * Persisted per-language Citation state, encoded into the existing
 * `citationDraft*` string field (the attempt schema is intentionally unchanged).
 * A space marks an empty slot, since a space can never be a logical entry.
 */
function encodeLangState(s: LangState): string {
  return JSON.stringify({
    s: s.entries.map(e => e || " ").join(""),
    c: s.clueCount,
    r: s.review,
    // Clue 2's position is random, so unlike Clue 1's it cannot be re-derived
    // from the count. Persisting it is what lets a reload restore the SAME
    // revealed number without invoking randomness again. `null` until taken.
    k: s.clue2Index,
  });
}

/**
 * Decode persisted state, MIGRATING any legacy free-text Citation draft: an
 * older draft such as "john 11.35" is not valid JSON, so its separators are
 * stripped and its letters/digits are left-filled into the logical slots.
 */
function decodeLangState(raw: string, logicalLen: number): LangState {
  const empty: LangState = {
    entries: new Array(logicalLen).fill(""),
    clueCount: 0,
    review: [],
    clue2Index: null,
  };
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.s === "string" && typeof parsed.c === "number" && Array.isArray(parsed.r)) {
      const chars = Array.from(parsed.s as string);
      const entries = new Array(logicalLen).fill("").map((_, i) => {
        const ch = chars[i];
        return ch && ch !== " " ? ch : "";
      });
      const storedCount = Math.max(0, Math.min(MAX_CLUES_PER_LANGUAGE, parsed.c));
      // Restoration reads the stored Clue 2 index; it never re-selects one.
      const clue2Index =
        typeof parsed.k === "number" &&
        Number.isInteger(parsed.k) &&
        parsed.k >= 0 &&
        parsed.k < logicalLen
          ? (parsed.k as number)
          : null;
      // A draft written before Clue 2 became random can record a count of 2
      // with no stored index. Clue 2 has no meaning without its index, so it
      // restores as NOT YET TAKEN — never re-derived, and never resolved to the
      // first numeric position.
      return {
        entries,
        clueCount: storedCount >= 2 && clue2Index === null ? 1 : storedCount,
        review: (parsed.r as unknown[]).filter((n): n is number => typeof n === "number"),
        clue2Index,
      };
    }
  } catch {
    // Not JSON → legacy free-text draft, handled below.
  }

  const alnum = Array.from(raw).filter(isLetterOrDigit);
  return {
    entries: new Array(logicalLen).fill("").map((_, i) => alnum[i] || ""),
    clueCount: 0,
    review: [],
    clue2Index: null,
  };
}

/**
 * PHASE 4A — reads the Clue count already carried by a persisted Citation
 * draft. Pure, read-only, and deliberately narrow: it holds no state, performs
 * no grading, reveals nothing, and cannot influence Clue availability,
 * protection, attempts or the random Clue 2 position. It exists only so the
 * review scheduler can tell a clean success from a recovered one.
 *
 * A legacy free-text draft carries no Clue data and correctly reports 0.
 */
export function readCitationClueCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.c === "number" && Number.isFinite(parsed.c)) {
      return Math.max(0, Math.min(MAX_CLUES_PER_LANGUAGE, Math.floor(parsed.c)));
    }
  } catch {
    // Not JSON -> legacy free-text draft: no Clue was recorded.
  }
  return 0;
}

export default function CitationStep({
  verse,
  esText,
  enText,
  memorizeMode,
  primaryLanguage,
  restored,
  onPersist,
  onCorrect,
  onExhaustedAcknowledge,
  reviewMode = false,
  modeStrip = null,
}: CitationStepProps) {
  const isEs = primaryLanguage === "es";

  const requiredLangs: MemorizeLanguage[] = useMemo(() => {
    if (memorizeMode === "both") return isEs ? ["es", "en"] : ["en", "es"];
    return [memorizeMode === "es" ? "es" : "en"];
  }, [memorizeMode, isEs]);

  const models = useMemo(() => ({
    es: buildCitationModel(verse, "es"),
    en: buildCitationModel(verse, "en"),
  }), [verse]);

  const initial = useMemo(() => ({
    es: decodeLangState(restored.draftEs, models.es.target.length),
    en: decodeLangState(restored.draftEn, models.en.target.length),
  // Decoded once on mount; later edits flow through local state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const [langState, setLangState] = useState<Record<MemorizeLanguage, LangState>>({
    es: initial.es,
    en: initial.en,
  });
  const [attemptsUsed, setAttemptsUsed] = useState(restored.attemptsUsed || 0);
  const [exhausted, setExhausted] = useState(!!restored.exhausted);

  const [activeLang, setActiveLang] = useState<MemorizeLanguage>(requiredLangs[0]);
  const [cursors, setCursors] = useState<Record<MemorizeLanguage, number>>({ es: 0, en: 0 });

  // Session-only UI state (never persisted).
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [emptyHelper, setEmptyHelper] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Latest-value refs for the synchronous key/input stream.
  const langStateRef = useRef(langState);
  langStateRef.current = langState;
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const activeLangRef = useRef(activeLang);
  activeLangRef.current = activeLang;
  const pendingConfirmRef = useRef(false);
  const isComposingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLocked = exhausted || acknowledging;

  const setPendingConfirmLive = (v: boolean) => {
    pendingConfirmRef.current = v;
    setPendingConfirm(v);
  };
  const cancelConfirm = () => {
    if (pendingConfirmRef.current) setPendingConfirmLive(false);
  };

  const clueIdx = (lang: MemorizeLanguage) => {
    const s = langStateRef.current[lang];
    return clueIndicesFor(models[lang], s.clueCount, s.clue2Index);
  };
  const isEditableIndex = (lang: MemorizeLanguage, i: number) => {
    const len = models[lang].target.length;
    return i >= 0 && i < len && !clueIdx(lang).includes(i);
  };
  const nextEditable = (lang: MemorizeLanguage, from: number) => {
    const len = models[lang].target.length;
    for (let i = Math.max(0, from); i < len; i++) if (isEditableIndex(lang, i)) return i;
    return -1;
  };
  const prevEditable = (lang: MemorizeLanguage, from: number) => {
    for (let i = from - 1; i >= 0; i--) if (isEditableIndex(lang, i)) return i;
    return -1;
  };
  const nearestEditable = (lang: MemorizeLanguage, i: number) => {
    if (isEditableIndex(lang, i)) return i;
    const fwd = nextEditable(lang, i);
    if (fwd !== -1) return fwd;
    const back = prevEditable(lang, i);
    return back !== -1 ? back : 0;
  };

  const focusInput = () => {
    try {
      inputRef.current?.focus({ preventScroll: true });
    } catch {
      /* focus is best-effort */
    }
  };

  useEffect(() => {
    if (!isLocked) focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  // Restore the third-attempt feedback line when reopening an exhausted state.
  useEffect(() => {
    if (exhausted) {
      setFeedback(isEs ? "Revisa la cita correcta abajo." : "Review the correct citation below.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistLang = (lang: MemorizeLanguage, next: LangState) => {
    const encoded = encodeLangState(next);
    onPersist(
      lang === "es"
        ? { citationDraftEs: encoded, citationWrongEs: next.review.length > 0 }
        : { citationDraftEn: encoded, citationWrongEn: next.review.length > 0 }
    );
  };

  const updateLang = (lang: MemorizeLanguage, mutate: (s: LangState) => LangState) => {
    setLangState(prev => {
      const next = { ...prev, [lang]: mutate(prev[lang]) };
      langStateRef.current = next;
      persistLang(lang, next[lang]);
      return next;
    });
  };

  const setCursorLive = (lang: MemorizeLanguage, value: number) => {
    setCursors(prev => {
      const next = { ...prev, [lang]: value };
      cursorsRef.current = next;
      return next;
    });
  };

  const placeCursor = (lang: MemorizeLanguage, index: number) => {
    cancelConfirm();
    setEmptyHelper(false);
    setActiveLang(lang);
    activeLangRef.current = lang;
    setCursorLive(lang, nearestEditable(lang, index));
    focusInput();
  };

  /**
   * Insert typed or pasted text. Only letters and digits take a slot; every
   * separator is ignored, so a pasted "John 11:35" and a typed "john1135"
   * produce the identical logical sequence.
   */
  const insertText = (text: string) => {
    if (isLocked) return;
    cancelConfirm();
    setEmptyHelper(false);

    const lang = activeLangRef.current;
    const len = models[lang].target.length;
    const clue = clueIdx(lang);
    let cursor = cursorsRef.current[lang];
    const additions: Record<number, string> = {};

    for (const ch of Array.from(text)) {
      if (!isLetterOrDigit(ch)) continue; // separators never occupy a slot
      while (cursor < len && clue.includes(cursor)) cursor++;
      if (cursor >= len) break;
      additions[cursor] = ch;
      cursor++;
      while (cursor < len && clue.includes(cursor)) cursor++;
    }

    const touched = Object.keys(additions).map(Number);
    if (touched.length > 0) {
      updateLang(lang, s => {
        const entries = [...s.entries];
        touched.forEach(i => { entries[i] = additions[i]; });
        // Editing a marked position clears only that position's review marker.
        return { ...s, entries, review: s.review.filter(i => !touched.includes(i)) };
      });
    }
    setCursorLive(lang, cursor);
  };

  const clearSlot = (lang: MemorizeLanguage, index: number) => {
    updateLang(lang, s => {
      const entries = [...s.entries];
      entries[index] = "";
      return { ...s, entries, review: s.review.filter(i => i !== index) };
    });
  };

  const useClue = (lang: MemorizeLanguage) => {
    if (isLocked || pendingConfirm) return;
    const current = langStateRef.current[lang];
    if (current.clueCount >= MAX_CLUES_PER_LANGUAGE) return;

    const nextCount = current.clueCount + 1;

    // THE ONE CLUE 2 ROLL. Selection happens HERE — inside the activation
    // event, exactly once — and never during render, in an effect, or in a
    // memo. The chosen value is computed OUTSIDE the state updater below, so
    // even a re-invoked updater replays the same index instead of rerolling,
    // and the `clueCount >= MAX_CLUES_PER_LANGUAGE` guard above means the
    // handler cannot run a second time for this language.
    let nextClue2Index = current.clue2Index;
    if (nextCount === 2) {
      const candidates = clueTwoCandidates(models[lang]);
      // Structurally unreachable (a citation always has a chapter digit and a
      // verse digit). If it ever were reachable, Clue 2 does nothing rather
      // than falling back to the excluded first numeric position.
      if (candidates.length === 0) return;
      nextClue2Index = candidates[Math.floor(Math.random() * candidates.length)];
    }

    const revealed =
      nextCount === 1
        ? clueOneIndices(models[lang])
        : nextClue2Index !== null
          ? [nextClue2Index]
          : [];

    updateLang(lang, s => {
      const entries = [...s.entries];
      revealed.forEach(i => { entries[i] = models[lang].target[i]; });
      return {
        entries,
        clueCount: nextCount,
        // Carried forward verbatim, then persisted by `updateLang`, so the same
        // number is revealed again after a reload.
        clue2Index: nextClue2Index,
        // A clue clears review markers only for the positions it fills.
        review: s.review.filter(i => !revealed.includes(i)),
      };
    });

    // Keep the cursor on a still-editable slot.
    const after = clueIndicesFor(models[lang], nextCount, nextClue2Index);
    const cur = cursorsRef.current[lang];
    if (after.includes(cur)) {
      const len = models[lang].target.length;
      let i = cur;
      while (i < len && after.includes(i)) i++;
      setCursorLive(lang, i);
    }
    focusInput();
  };

  const requiredFilledFor = (lang: MemorizeLanguage) => {
    const s = langStateRef.current[lang];
    return s.entries.some(e => e !== "");
  };
  const allRequiredHaveInput = requiredLangs.every(requiredFilledFor);

  const armConfirmation = () => {
    if (isLocked) return;
    if (!allRequiredHaveInput) {
      setEmptyHelper(true);
      return;
    }
    setEmptyHelper(false);
    setPendingConfirmLive(true);
  };

  /** The only path that may consume an attempt. */
  const submitCitation = () => {
    if (isLocked) return;
    if (!allRequiredHaveInput) {
      setEmptyHelper(true);
      return;
    }
    setPendingConfirmLive(false);

    const wrongByLang: Record<string, number[]> = {};
    let allCorrect = true;

    for (const lang of requiredLangs) {
      const model = models[lang];
      const s = langStateRef.current[lang];
      const clue = clueIndicesFor(model, s.clueCount, s.clue2Index);
      const wrong: number[] = [];
      for (let i = 0; i < model.target.length; i++) {
        if (clue.includes(i)) continue; // clue positions are excluded from grading
        const entered = s.entries[i] || "";
        if (entered === "" || foldChar(entered) !== foldChar(model.target[i])) wrong.push(i);
      }
      wrongByLang[lang] = wrong;
      if (wrong.length > 0) allCorrect = false;
    }

    if (allCorrect) {
      setFeedback(null);
      onCorrect();
      return;
    }

    const nextUsed = attemptsUsed + 1;
    setAttemptsUsed(nextUsed);
    requiredLangs.forEach(lang => {
      updateLang(lang, s => ({ ...s, review: wrongByLang[lang] }));
    });

    if (nextUsed >= MAX_CITATION_ATTEMPTS) {
      setExhausted(true);
      setFeedback(isEs ? "Revisa la cita correcta abajo." : "Review the correct citation below.");
      onPersist({ citationAttemptsUsed: nextUsed, citationExhausted: true });
      return;
    }

    setFeedback(
      nextUsed === 1
        ? (isEs
            ? "Aún no. Revisa los caracteres resaltados. Te quedan 2 intentos."
            : "Not quite. Review the highlighted characters. You have 2 tries left.")
        : (isEs
            ? "Aún no. Revisa los caracteres resaltados. Te queda 1 intento."
            : "Not quite. Review the highlighted characters. 1 try left.")
    );
    onPersist({ citationAttemptsUsed: nextUsed });
  };

  const handleAcknowledge = () => {
    if (acknowledging) return;
    setAcknowledging(true);
    onExhaustedAcknowledge();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || isComposingRef.current || e.key === "Dead" || e.key === "Process") return;
    if (e.altKey || e.ctrlKey || e.metaKey) return; // let paste/shortcuts through

    const lang = activeLangRef.current;
    const len = models[lang].target.length;
    const cursor = cursorsRef.current[lang];

    if (e.key === "Enter") {
      e.preventDefault();
      if (e.repeat || isLocked) return;
      if (!pendingConfirmRef.current) armConfirmation();
      else submitCitation();
      return;
    }

    if (e.key === "Escape") {
      if (pendingConfirmRef.current) {
        e.preventDefault();
        setPendingConfirmLive(false);
      }
      return;
    }

    if (isLocked) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      cancelConfirm();
      const target = prevEditable(lang, cursor);
      if (target !== -1) {
        clearSlot(lang, target);
        setCursorLive(lang, target);
      }
    } else if (e.key === "Delete" || e.key === "Del" || e.code === "Delete") {
      e.preventDefault();
      cancelConfirm();
      if (cursor < len && isEditableIndex(lang, cursor)) clearSlot(lang, cursor);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      cancelConfirm();
      const target = prevEditable(lang, cursor);
      if (target !== -1) setCursorLive(lang, target);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      cancelConfirm();
      // THE TERMINAL CITATION CURSOR.
      //
      // The Citation cursor is a SLOT cursor, not an insertion boundary: at an
      // ordinary index it OCCUPIES that logical glyph, the Map paints that tile
      // as current, and the Composer paints the caret immediately BEFORE the
      // glyph the next keystroke will replace. Arrow Right previously could not
      // leave the last editable slot — `nextEditable` returns -1 there and the
      // branch only wrote on a hit — so the caret parked before the FINAL glyph
      // while the cursor still sat on it, and typing replaced that glyph rather
      // than reading as "past the end". That mismatch is the QA failure.
      //
      // The domain is therefore 0 .. len INCLUSIVE, where `len` is a
      // caret-only terminal position: it is NOT a logical glyph, NOT a Map
      // tile, NOT a grading, Clue, review or persisted answer position, and it
      // adds no logical index. At `len` the Composer's existing end-caret
      // renders after the final glyph and no tile is current, because
      // `isCurrent` can match no `li`.
      if (cursor >= len) return; // already terminal — no-op, and never wraps
      const target = nextEditable(lang, cursor + 1);
      // No editable slot remains ahead (end of the citation, or only
      // Clue-protected slots follow): rest at the terminal caret. Arrow Left,
      // Backspace, Delete, typing and Map clicks all already treat `len`
      // correctly, so nothing else changes.
      setCursorLive(lang, target !== -1 ? target : len);
    } else if (e.key === "Tab" && requiredLangs.length > 1) {
      e.preventDefault();
      cancelConfirm();
      const i = requiredLangs.indexOf(lang);
      const nextLang = requiredLangs[(i + (e.shiftKey ? requiredLangs.length - 1 : 1)) % requiredLangs.length];
      setActiveLang(nextLang);
      activeLangRef.current = nextLang;
      focusInput();
    }
  };

  // ---------------------------------------------------------------- rendering

  const caret = (key: string) => (
    <span
      key={key}
      aria-hidden="true"
      className="inline-block w-px h-[0.95em] animate-cursor-blink"
      style={{ background: "#8FA2FF", boxShadow: "0 0 4px rgba(62,143,123,0.28)", verticalAlign: "baseline" }}
    />
  );

  /** Reference Map: structural scaffold. Never shows a canonical letter/digit. */
  const renderMap = (lang: MemorizeLanguage) => {
    const model = models[lang];
    const s = langState[lang];
    // Read-only: the Clue 2 index is state, so rendering never re-rolls it.
    const clue = clueIndicesFor(model, s.clueCount, s.clue2Index);
    const cursor = cursors[lang];

    // Group at fixed spaces so the map wraps naturally instead of forming one
    // rigid viewport-wide grid.
    const groups: CitationItem[][] = [];
    let group: CitationItem[] = [];
    model.items.forEach(item => {
      if (!item.isSlot && item.char === " ") {
        groups.push(group);
        group = [];
      } else {
        group.push(item);
      }
    });
    groups.push(group);

    // The uniform logical cell board: fixed-width cells, fixed intra-word
    // gaps, fixed larger inter-word gaps, natural logical wrapping. Cell
    // geometry is completely independent of canonical glyph widths (the old
    // em-derived 0.62em/0.42em pitch is gone).
    return (
      <div
        className="w-full flex flex-wrap justify-center content-start font-serif"
        style={{ columnGap: BOARD_INTER_GAP, rowGap: "10px" }}
      >
        {groups.map((g, gi) => {
          if (g.length === 0) return null;
          return (
            // One logical word group: cells in canonical order with the fixed
            // intra-word gap; punctuation stays attached as a fixed glyph. The
            // group's own flex-wrap is only the emergency fallback for a
            // single group too long for the viewport.
            <div key={gi} className="flex flex-wrap items-end" style={{ gap: BOARD_INTRA_GAP }}>
              {g.map((item, ii) => {
                if (!item.isSlot) {
                  // Fixed canonical separator: a glyph, never a tile, never
                  // graded, never rose.
                  return (
                    <span
                      key={ii}
                      className="self-end pb-[1px] leading-none text-[14px] min-[390px]:text-[15px] text-[#EFE6D8]/45 select-none"
                    >
                      {item.char}
                    </span>
                  );
                }

                const li = item.logicalIndex;
                // Ember provenance is EXACT logical index only: this cell is a
                // Clue cell iff its own index `li` is in `clue`. Character value
                // (an ordinal digit, a book letter, a chapter digit, a repeated
                // matching character) can never spread Ember to another index.
                // The glyph is centered in the same fixed cell footprint, so
                // revealing it never shifts neighbours, gaps, or wrapping.
                if (clue.includes(li)) {
                  return (
                    <span
                      key={ii}
                      className="inline-flex items-center justify-center select-none"
                      style={{ width: BOARD_CELL_W, height: BOARD_CELL_H }}
                    >
                      <span className="leading-none text-[13px] min-[390px]:text-[14px]" style={{ color: "#E8B34B" }}>
                        {item.char}
                      </span>
                    </span>
                  );
                }

                const occupied = (s.entries[li] || "") !== "";
                const isCurrent = activeLang === lang && cursor === li && inputFocused;
                const isReview = s.review.includes(li);

                // Precedence: review rose > current Royal Soft > occupied teal >
                // empty grey rail. Occupied/current/review share identical fixed
                // dimensions; states differ only through colour and glow.
                let h = "2px";
                let radius = "999px";
                let bg = "rgba(139,149,163,0.32)";
                let shadow: string | undefined;
                if (isReview) {
                  h = BOARD_TILE_H; radius = "2px";
                  bg = "rgba(240,166,160,0.86)";
                  shadow = "0 0 7px rgba(209,78,92,0.30), inset 0 1px 0 rgba(231,236,242,0.10)";
                } else if (isCurrent) {
                  h = BOARD_TILE_H; radius = "2px";
                  // Phase 4A: Review mode carries no Royal. A lighter Verdant
                  // keeps the CURRENT marker clearly distinct from the darker
                  // occupied teal beside it.
                  bg = reviewMode ? "#4FA88F" : "#8FA2FF";
                  shadow = "0 0 9px rgba(62,143,123,0.36), inset 0 1px 0 rgba(231,236,242,0.18)";
                } else if (occupied) {
                  h = BOARD_TILE_H; radius = "2px";
                  bg = "rgba(62,143,123,0.84)";
                  shadow = "0 0 7px rgba(91,120,255,0.24), inset 0 1px 0 rgba(231,236,242,0.12)";
                }

                return (
                  <span
                    key={ii}
                    onClick={() => placeCursor(lang, li)}
                    className="inline-flex items-end justify-center cursor-text"
                    style={{ width: BOARD_CELL_W, height: BOARD_CELL_H }}
                  >
                    <span
                      className="w-full"
                      style={{ height: h, borderRadius: radius, background: bg, boxShadow: shadow }}
                    />
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  /** Composer: the user's own glyphs in canonical structure. */
  const renderComposer = (lang: MemorizeLanguage) => {
    const model = models[lang];
    const s = langState[lang];
    // Read-only: the Clue 2 index is state, so rendering never re-rolls it.
    const clue = clueIndicesFor(model, s.clueCount, s.clue2Index);
    const cursor = cursors[lang];
    const hasContent = s.entries.some(e => e !== "");

    if (!hasContent && clue.length === 0) {
      return (
        <span className="text-cold-grey">
          {activeLang === lang && inputFocused && caret("caret-empty")}
          {isEs ? "Escribe la referencia de memoria" : "Enter the reference from memory"}
        </span>
      );
    }

    const nodes: React.ReactNode[] = [];
    model.items.forEach((item, ii) => {
      if (!item.isSlot) {
        // App-rendered canonical separator (non-breaking so it never collapses).
        nodes.push(
          <span key={`sep-${ii}`} className="text-[#EFE6D8]/55 select-none">
            {item.char === " " ? " " : item.char}
          </span>
        );
        return;
      }

      const li = item.logicalIndex;
      if (activeLang === lang && inputFocused && cursor === li) nodes.push(caret(`caret-${li}`));

      // Ember provenance is EXACT logical index only (same rule as the Map): a
      // typed glyph whose index is not in `clue` stays Cool White regardless of
      // whether its value equals a Clue-revealed character.
      if (clue.includes(li)) {
        nodes.push(<span key={`c-${ii}`} style={{ color: "#E8B34B" }}>{item.char}</span>);
        return;
      }

      const value = s.entries[li] || "";
      if (value === "") return; // empty slot contributes nothing

      const isReview = s.review.includes(li);
      // Same COMPOSER COLOR LAW as Step 5: ordinary typed glyphs carry explicit
      // inline Cool White at their own span (the Clue branch above is already
      // inline Ember), so no cascade interaction can recolor them after Clue.
      nodes.push(
        <span
          key={`c-${ii}`}
          onClick={() => placeCursor(lang, li)}
          className="cursor-text text-cool-white"
          style={isReview ? {
            color: "#F0A6A0",
            textDecorationLine: "underline",
            textDecorationColor: "rgba(209,78,92,0.72)",
            textDecorationThickness: "1px",
            textUnderlineOffset: "0.16em",
          } : { color: "#E7ECF2" }}
        >
          {value}
        </span>
      );
    });

    if (activeLang === lang && inputFocused && cursor >= model.target.length) nodes.push(caret("caret-end"));
    return nodes;
  };

  const langLabel = (lang: MemorizeLanguage) =>
    lang === "es" ? (isEs ? "ESPAÑOL" : "SPANISH") : (isEs ? "INGLÉS" : "ENGLISH");

  const composerSurface = (lang: MemorizeLanguage): React.CSSProperties => {
    const hasReview = langState[lang].review.length > 0;
    const focused = activeLang === lang && inputFocused;
    return {
      background: "rgba(15,20,27,0.44)",
      border: `1px solid ${
        hasReview ? "rgba(209,78,92,0.55)" : focused ? "rgba(62,143,123,0.62)" : "rgba(62,143,123,0.30)"
      }`,
      // Phase 4A: in Review mode the Royal atmosphere in these glows becomes
      // Verdant. The rose review state and the glass itself are unchanged.
      boxShadow: hasReview
        ? "0 0 10px rgba(209,78,92,0.14), inset 0 1px 0 rgba(231,236,242,0.03)"
        : focused
          ? `0 0 0 1px rgba(62,143,123,0.08), 0 0 18px ${
              reviewMode ? "rgba(62,143,123,0.26)" : "rgba(91,120,255,0.22)"
            }, 0 0 30px rgba(62,143,123,0.09), inset 0 1px 0 rgba(231,236,242,0.04)`
          : `0 0 10px ${
              reviewMode ? "rgba(62,143,123,0.10)" : "rgba(91,120,255,0.08)"
            }, inset 0 1px 0 rgba(231,236,242,0.025)`,
    };
  };

  const displayScripture = (requiredLangs[0] === "es" ? esText : enText) || esText || enText || "";

  return (
    <div id="memorize-content" className="flex-1 flex flex-col w-full mx-auto pt-2 sm:pt-0 pb-6 md:max-w-[760px] xl:max-w-[900px]">
      {/* Header — same vocabulary as Steps 1-5. The big Fraunces row shows the
          Citation title, never the canonical reference. */}
      <div className="mb-[18px] md:mb-[22px] flex-shrink-0">
        <div className="space-y-2 sm:space-y-3">
          {/* Eyebrow + step pill — ORDINARY MEMORIZE ONLY. Review mode shows no
              step pill and no replacement badge, pill or progress counter, and
              the whole row is dropped rather than left empty. */}
          {!reviewMode && (
            <div className="flex items-center justify-between gap-3 w-full">
              <span
                className="font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] leading-none"
                style={{ color: "#3E8F7B" }}
              >
                {isEs ? "MEMORIZA" : "MEMORIZE"}
              </span>
              <div
                className="flex-shrink-0 inline-flex items-center h-8 px-[10px] rounded-[12px] select-none"
                style={{
                  background: "rgba(15,20,27,0.58)",
                  border: "1px solid rgba(62,143,123,0.22)",
                  boxShadow: "0 0 8px rgba(91,120,255,0.10)",
                }}
              >
                <span className="font-hanken text-[11px] font-semibold uppercase tracking-widest leading-none text-cold-grey">
                  {isEs ? "Paso " : "Step "}
                  <span style={{ color: "#3E8F7B" }}>6</span>
                  {isEs ? " de 6" : " of 6"}
                </span>
              </div>
            </div>
          )}

          {/* REVIEW-MODE STATUS STRIP — the same element Step 5 renders, so the
              mode stays unmistakable across the whole review and after a
              reload. Centred, and the first content element in Review mode,
              directly above the Citation heading. The INTERNAL stage is
              unchanged — this is still Step 6. */}
          {reviewMode && modeStrip}

          {/* CITATION HEADING ROW. In Review mode the compact ACTIVE-PASS pill
              rides this row, right aligned — never a separate row beneath it.
              It is driven by this step's own `activeLang`, so it follows the
              language the user is actually working in. */}
          {reviewMode ? (
            <div className="w-full flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h2 className="min-w-0 flex-1 font-fraunces text-[clamp(1.50rem,6.8vw,1.78rem)] min-[390px]:text-[clamp(1.78rem,6.5vw,2.15rem)] md:text-[42px] font-normal text-cool-white leading-[1.06] break-words [text-wrap:balance]">
                {isEs ? "La cita" : "The citation"}
              </h2>
              {/* Plain text, not a pill — the same quiet metadata treatment
                  Step 5 uses beside its passage reference. */}
              <span className="shrink-0 mt-2 font-hanken text-[10px] font-semibold uppercase tracking-[0.2em] leading-none text-faint select-none">
                {reviewCopy.activePassLabel(activeLang, isEs ? "es" : "en")}
              </span>
            </div>
          ) : (
            <h2 className="w-full font-fraunces text-[clamp(1.50rem,6.8vw,1.78rem)] min-[390px]:text-[clamp(1.78rem,6.5vw,2.15rem)] md:text-[42px] font-normal text-cool-white leading-[1.06] break-words [text-wrap:balance]">
              {isEs ? "La cita" : "The citation"}
            </h2>
          )}

          {/* Introductory helper sentence — ORDINARY MEMORIZE ONLY. In Review
              mode the status strip already names the order of work, so this
              line would restate it. Error, attempt, Clue, exhaustion,
              translation-unavailable and completion messages are untouched. */}
          {!reviewMode && (
            <p className="font-hanken text-[15px] text-cold-grey antialiased">
              {isEs
                ? "Escribe la referencia de memoria — nosotros ponemos los espacios y la puntuación"
                : "Write the reference from memory — we place the spaces and punctuation"}
            </p>
          )}
        </div>

        <div className="w-full flex justify-center items-center pt-[18px] md:pt-[22px]" aria-hidden="true">
          <div className="w-full max-w-[236px] md:max-w-[280px] flex items-center gap-1.5 md:gap-2">
            {[1, 2, 3, 4, 5, 6].map(seg => (
              <span
                key={seg}
                className="flex-1 h-1 rounded-full"
                style={{
                  background: seg < 6 ? "rgba(232,179,75,0.76)" : "#3E8F7B",
                  boxShadow: seg < 6 ? "0 0 4px rgba(232,179,75,0.18)" : "0 0 7px rgba(91,120,255,0.22)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scripture stage — open-corner frame, matching Steps 1-5. */}
      <div className="flex-1 flex flex-col items-center w-full mb-[14px] md:mb-[18px]">
        <div className="w-full relative overflow-visible rounded-[14px] md:rounded-[18px] bg-[rgba(15,20,27,0.28)]">
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-l border-[rgba(91,120,255,0.32)] rounded-tl-[14px] md:rounded-tl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-t border-r border-[rgba(91,120,255,0.32)] rounded-tr-[14px] md:rounded-tr-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-l border-[rgba(91,120,255,0.32)] rounded-bl-[14px] md:rounded-bl-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 w-[26px] h-[26px] md:w-[34px] md:h-[34px] border-b border-r border-[rgba(91,120,255,0.32)] rounded-br-[14px] md:rounded-br-[18px] shadow-[0_0_18px_rgba(91,120,255,0.08)]" />

          <div className="w-full flex flex-col items-center relative overflow-visible py-7 px-2.5 md:py-9 md:px-6 xl:py-[42px] xl:px-9 gap-[18px] md:gap-6">
            {/* Hidden logical input — Citation-specific engine, entirely separate
                from the approved Step 5 input architecture. */}
            {!isLocked && (
              <input
                ref={inputRef}
                type="text"
                defaultValue=""
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={isEs ? "Entrada de la cita" : "Citation input"}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={(e) => {
                  isComposingRef.current = false;
                  const v = e.currentTarget.value;
                  if (v) { insertText(v); e.currentTarget.value = ""; }
                }}
                onInput={(e) => {
                  if (isComposingRef.current || (e.nativeEvent as InputEvent).isComposing) return;
                  const v = e.currentTarget.value;
                  if (v) { insertText(v); e.currentTarget.value = ""; }
                }}
                className="absolute opacity-0 inset-0 w-full h-full cursor-default caret-transparent text-transparent outline-none border-none select-none bg-transparent shadow-none"
              />
            )}

            {/* The memorized passage — identifies WHAT was learned; it carries no
                book, chapter or verse, so it never leaks the citation. */}
            <div className="w-full text-center font-serif font-normal text-[#EFE6D8] text-[19px] min-[390px]:text-[21px] md:text-[24px] leading-[1.45] [font-optical-sizing:auto] relative z-10">
              {displayScripture}
            </div>

            {requiredLangs.map(lang => (
              <div key={lang} className="w-full flex flex-col items-center gap-3 relative z-10">
                {requiredLangs.length > 1 && (
                  <span className="font-hanken text-[10px] font-semibold uppercase tracking-[0.28em] text-cold-grey select-none">
                    {langLabel(lang)}
                  </span>
                )}

                {/* Reference Map */}
                <div className="w-full" onClick={() => { setActiveLang(lang); activeLangRef.current = lang; focusInput(); }}>
                  {renderMap(lang)}
                </div>

                {/* Citation Composer */}
                <div
                  onClick={() => { setActiveLang(lang); activeLangRef.current = lang; focusInput(); }}
                  className="w-full rounded-[16px] p-[14px] md:p-4 cursor-text"
                  style={{ minHeight: "72px", ...composerSurface(lang) }}
                >
                  <div className="font-hanken text-[10px] font-semibold uppercase tracking-[0.28em] text-cold-grey mb-2 select-none">
                    {isEs ? "TU CITA" : "YOUR CITATION"}
                  </div>
                  {/* Ligatures disabled composer-locally (same fix as the Step 5
                      Recall Composer): colour doesn't interrupt OpenType
                      shaping, so a Clue glyph and an adjacent typed glyph could
                      otherwise fuse into one single-colour ligature. Fraunces,
                      proportional advances, spacing and wrapping unchanged. */}
                  <div
                    className="w-full text-center font-serif font-normal text-cool-white text-[20px] min-[390px]:text-[22px] md:text-[26px] xl:text-[28px] leading-[1.45] break-words [font-optical-sizing:auto]"
                    style={{ fontVariantLigatures: "none", fontFeatureSettings: '"liga" 0, "clig" 0' }}
                  >
                    {renderComposer(lang)}
                  </div>
                </div>
              </div>
            ))}

            {/* Exhausted reveal — the only place a canonical citation appears
                before success. Neutral Cool White, never Ember or cream. */}
            {exhausted && (
              <div className="w-full flex flex-col items-center gap-2 relative z-10">
                <span className="font-hanken text-[10px] font-semibold uppercase tracking-[0.28em] text-cold-grey select-none">
                  {isEs ? "LA CITA CORRECTA" : "THE CORRECT CITATION"}
                </span>
                {requiredLangs.map(lang => (
                  <span
                    key={lang}
                    className="font-serif font-normal text-[20px] min-[390px]:text-[22px] md:text-[26px] leading-[1.45] text-center"
                    style={{ color: "#E7ECF2" }}
                  >
                    {models[lang].canonical}
                  </span>
                ))}
              </div>
            )}

            {/* Utility controls — explicit JSX branches, never CSS hiding. */}
            {!isLocked && !pendingConfirm && (
              <div className="relative z-10 inline-flex w-fit h-11 items-center px-1 gap-1 rounded-[13px] bg-[rgba(15,20,27,0.86)] border border-[rgba(150,180,210,0.12)] backdrop-blur-[14px]">
                {requiredLangs.map(lang => {
                  const used = langState[lang].clueCount;
                  const spent = used >= MAX_CLUES_PER_LANGUAGE;
                  return (
                    <button
                      key={lang}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={e => { e.stopPropagation(); useClue(lang); }}
                      disabled={spent}
                      aria-label={
                        requiredLangs.length > 1
                          ? (isEs ? `Pista ${langLabel(lang)}` : `Clue ${langLabel(lang)}`)
                          : (isEs ? "Pista" : "Clue")
                      }
                      className="h-11 min-w-11 flex items-center justify-center active:translate-y-px disabled:cursor-not-allowed"
                    >
                      <span className={`relative h-8 inline-flex items-center gap-1.5 px-[9px] rounded-[11px] text-[10px] font-hanken font-semibold uppercase tracking-widest ${spent ? "text-faint opacity-50" : "text-ember"}`}>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-[3px] rounded-[8px] border ${spent ? "border-(--line)" : "border-[rgba(232,179,75,0.42)]"}`}
                        />
                        <Sparkles size={12} aria-hidden="true" />
                        <span className="whitespace-nowrap">
                          {isEs ? "Pista" : "Clue"}
                          {requiredLangs.length > 1 ? ` ${lang.toUpperCase()}` : ""}
                          {` ${MAX_CLUES_PER_LANGUAGE - used}/${MAX_CLUES_PER_LANGUAGE}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <span aria-hidden="true" className="w-px h-4 bg-[rgba(139,149,163,0.12)]" />
                <button
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={e => { e.stopPropagation(); armConfirmation(); }}
                  className="h-11 flex items-center justify-center active:translate-y-px"
                >
                  <span
                    className="h-8 inline-flex items-center px-2.5 rounded-[11px] border text-[10px] font-hanken font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ borderColor: "rgba(62,143,123,0.52)", color: "#3E8F7B", background: "rgba(62,143,123,0.10)" }}
                  >
                    {isEs ? "Comprobar cita" : "Check citation"}
                  </span>
                </button>
              </div>
            )}

            {/* Confirmation tray — exactly one, in flow, replacing the controls. */}
            {!isLocked && pendingConfirm && (
              <div
                role="group"
                aria-label={isEs ? "Confirmar cita" : "Confirm citation"}
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
                    {isEs ? "¿Listo para comprobar la cita?" : "Ready to check your citation?"}
                  </p>
                  <p className="text-[10px] font-hanken text-cold-grey leading-tight mt-0.5">
                    {isEs
                      ? "Pulsa Enter otra vez para enviar · Esc para seguir editando"
                      : "Press Enter again to submit · Esc to keep editing"}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 w-full">
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={e => { e.stopPropagation(); setPendingConfirmLive(false); focusInput(); }}
                    className="group h-11 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(62,143,123,0.6)]"
                  >
                    <span className="h-8 inline-flex items-center px-2.5 rounded-[11px] border border-(--line) text-[10px] font-hanken font-semibold uppercase tracking-wide text-cold-grey group-hover:text-cool-white whitespace-nowrap">
                      {isEs ? "Seguir editando" : "Keep editing"}
                    </span>
                  </button>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={e => { e.stopPropagation(); submitCitation(); }}
                    className="group h-11 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(62,143,123,0.6)]"
                  >
                    <span
                      className="h-8 inline-flex items-center px-2.5 rounded-[11px] border text-[10px] font-hanken font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ borderColor: "rgba(62,143,123,0.52)", color: "#3E8F7B", background: "rgba(62,143,123,0.10)" }}
                    >
                      {isEs ? "Comprobar cita" : "Check citation"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Exhausted acknowledgment — the explicit act that acquires the
                passage with citationCorrect = false. */}
            {exhausted && (
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="vbtn vbtn--earned w-full max-w-[300px] disabled:opacity-60 disabled:cursor-not-allowed relative z-10"
              >
                <CheckCircle2 size={18} />
                <span>{isEs ? "Completar pasaje" : "Complete passage"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback — neutral empty-input helper, or the rose status pill. */}
      <div className="w-full flex-shrink-0 pb-2 relative z-10">
        <div className="w-full flex items-center justify-center px-2">
          {emptyHelper ? (
            <div className="flex items-center gap-2.5 max-w-full bg-deep-slate px-4 sm:px-5 py-2.5 rounded-2xl border border-(--line) shadow-verso-card">
              <span className="min-w-0 text-[11px] sm:text-sm font-hanken font-semibold text-cold-grey">
                {isEs ? "Escribe primero la cita completa." : "Enter the full citation first."}
              </span>
            </div>
          ) : feedback ? (
            <div className="flex items-center gap-2.5 max-w-full bg-deep-slate px-4 sm:px-5 py-2.5 rounded-2xl border border-[rgba(209,78,92,0.40)] shadow-verso-card">
              <AlertCircle size={16} className="text-[#F0A6A0] flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-[11px] sm:text-sm font-hanken font-semibold text-[#F0A6A0]">
                {feedback}
              </span>
              <span className="text-[10px] font-hanken font-semibold text-faint flex-shrink-0">
                ({attemptsUsed}/{MAX_CITATION_ATTEMPTS})
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

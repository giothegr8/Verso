import {
  AppState,
  MemorizeLanguage,
  ReviewRecord,
  ReviewScope,
  Translation,
  Verse,
} from "../types";
import { MOCK_VERSES } from "../constants";
import { BOOK_TO_USFM } from "../services/apiBible";
import { getCurrentTranslationPair, validateVerseTranslation } from "../utils/verseUtils";
import {
  clampReviewLevel,
  createReviewRecord,
  isValidIso,
  parseIso,
  sanitizeReviewRecord,
} from "./reviewSchedule";

/**
 * PHASE 4A — THE ONE QUEUE SELECTOR.
 *
 * Everything that decides WHICH passage is reviewed next lives here: the
 * canonical passage identity, lazy initialization, due/upcoming partitioning
 * and the single deterministic comparator. Home and the Review screen both call
 * `selectReviewQueue`; neither computes eligibility or ordering of its own.
 */

// ---------------------------------------------------------------------------
// THE FAILED-TRANSLATION SENTINELS (same narrow, exact-match contract used by
// Home.tsx and Memorize.tsx). Matched EXACTLY after trimming, never as a
// keyword search, so real Scripture containing the word "error" is never
// rejected. A passage whose only text is one of these can never enter Review.
// ---------------------------------------------------------------------------
const FAILED_TRANSLATION_SENTINELS = [
  "Error al cargar la traducción en Español.",
  "Error loading English translation.",
];

export function isFailedTranslationText(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return FAILED_TRANSLATION_SENTINELS.some(sentinel => trimmed === sentinel);
}

// ---------------------------------------------------------------------------
// CANONICAL PASSAGE IDENTITY.
//
// `verse.id` is NOT a passage identity: Home mints translation-scoped ids
// (`custom-<base>-<TRANSLATION>`), so the same passage acquired in two
// translations already carries two different ids. Keying reviews on it would
// produce duplicate rows for one passage.
//
// The repository's real canonical identity is the stored `verse.book`, which
// bibleService guarantees is a canonical book name, resolved through the
// existing BOOK_TO_USFM map. Reusing that map collapses English aliases,
// Spanish aliases, abbreviations and every translation variant onto ONE key of
// the form "HEB 11:1". This adds no second identity system — it reads the same
// canonical table `getLocalizedBookName` already reads.
// ---------------------------------------------------------------------------

// U+0300-U+036F combining diacritical marks, built from an escaped string so
// the range stays explicit in source (the same range verseUtils strips).
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Same normalization ladder verseUtils uses when resolving a book to USFM. */
function resolveUsfm(book: string): string | null {
  if (!book) return null;
  const parts = book.split(" / ").map(p => p.trim());
  for (const candidate of [...parts, book]) {
    const key = candidate.toLowerCase().normalize("NFD").replace(COMBINING_MARKS_RE, "");
    const cleanKey = key.replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
    if (BOOK_TO_USFM && BOOK_TO_USFM[key]) return BOOK_TO_USFM[key];
    if (BOOK_TO_USFM && BOOK_TO_USFM[cleanKey]) return BOOK_TO_USFM[cleanKey];
  }
  return null;
}

/**
 * One stable key per unique passage. Falls back to a normalized book string
 * only when the book cannot resolve to USFM, so a passage is never invisible to
 * Review; the fallback is still deterministic and language-folded.
 */
export function passageKeyForVerse(
  verse: Pick<Verse, "book" | "chapter" | "verse"> | null | undefined
): string | null {
  if (!verse || !verse.book) return null;
  const chapter = Number(verse.chapter);
  const verseNum = Number(verse.verse);
  if (!Number.isFinite(chapter) || !Number.isFinite(verseNum)) return null;

  const usfm = resolveUsfm(verse.book);
  if (usfm) return `${usfm} ${chapter}:${verseNum}`;

  const fallback = verse.book
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!fallback) return null;
  return `${fallback} ${chapter}:${verseNum}`;
}

// ---------------------------------------------------------------------------
// ACQUIRED PASSAGES
// ---------------------------------------------------------------------------

export interface AcquiredPassage {
  passageKey: string;
  /** The verse id that most recently represented this passage. */
  verseId: string;
  verse: Verse;
  /** ISO instant, or null when the repository holds no acquisition timestamp. */
  acquiredAt: string | null;
  /** Languages whose text is genuinely usable right now. */
  availableLanguages: MemorizeLanguage[];
  /** Scope proven by acquisition/completion history, or null if history is silent. */
  strongScope: ReviewScope | null;
  /** Scope inferred from ALL acquired content when history is silent. */
  fallbackScope: ReviewScope;
  /** `strongScope` when present, otherwise `fallbackScope`. */
  learnedScope: ReviewScope;
}

const ES_TRANSLATIONS: Translation[] = ["RVR1960", "NVI", "NBLA"];
const EN_TRANSLATIONS: Translation[] = ["KJV", "NIV", "NASB"];

/**
 * STRONG HISTORICAL EVIDENCE for one canonical passage.
 *
 * `spoke` is true once ANY acquisition/completion source has said something.
 * Only then does history decide the scope; otherwise the availability fallback
 * takes over. Interface language and the current translation selector are never
 * evidence, and a failed translation is never valid language content.
 */
export interface ScopeEvidence {
  en: boolean;
  es: boolean;
  spoke: boolean;
}

export function emptyEvidence(): ScopeEvidence {
  return { en: false, es: false, spoke: false };
}

/**
 * Folds one completed verse id's history into a canonical group's evidence.
 * Every source contributes; sources never override one another, so English
 * proof from one translation-scoped id and Spanish proof from another UNION to
 * bilingual rather than one arbitrarily winning.
 */
export function addVerseEvidence(
  evidence: ScopeEvidence,
  state: AppState,
  verseId: string
): ScopeEvidence {
  const progress = state.progress;

  // 1. Per-language completion counts.
  const perLang = progress?.completionsByLanguage?.[verseId];
  if (perLang) {
    if ((perLang.en || 0) > 0) { evidence.en = true; evidence.spoke = true; }
    if ((perLang.es || 0) > 0) { evidence.es = true; evidence.spoke = true; }
  }

  // 2. The last genuinely completed language mode — the most direct statement
  //    of how the passage was learned. "both" proves bilingual outright.
  const lastMode = progress?.lastCompletedLanguage?.[verseId];
  if (lastMode === "both") {
    evidence.en = true; evidence.es = true; evidence.spoke = true;
  } else if (lastMode === "en") {
    evidence.en = true; evidence.spoke = true;
  } else if (lastMode === "es") {
    evidence.es = true; evidence.spoke = true;
  }

  // 3. Per-translation completion counts, mapped to their language.
  const perTrans = progress?.completionsByTranslation?.[verseId];
  if (perTrans) {
    for (const t of EN_TRANSLATIONS) {
      if ((perTrans[t] || 0) > 0) { evidence.en = true; evidence.spoke = true; }
    }
    for (const t of ES_TRANSLATIONS) {
      if ((perTrans[t] || 0) > 0) { evidence.es = true; evidence.spoke = true; }
    }
  }

  return evidence;
}

/** The scope proven by history alone, or null when history said nothing. */
export function strongScopeFrom(evidence: ScopeEvidence): ReviewScope | null {
  if (!evidence.spoke) return null;
  if (evidence.en && evidence.es) return "bilingual";
  if (evidence.en) return "english";
  if (evidence.es) return "spanish";
  return null;
}

/**
 * Fallback scope from ACQUIRED CONTENT — every translation slot the passage
 * actually holds, not just today's selected pair. Used only when no historical
 * source spoke.
 */
export function fallbackScopeFrom(acquired: { en: boolean; es: boolean }): ReviewScope {
  if (acquired.en && acquired.es) return "bilingual";
  if (acquired.es && !acquired.en) return "spanish";
  return "english";
}

/**
 * THE ONE SCOPE RESOLVER, shared by lazy reconciliation and the queue selector
 * so a repair is visible immediately rather than one render late.
 *
 *   stored english/spanish + strong bilingual -> bilingual
 *   stored english + strong spanish-only      -> spanish   (and the reverse)
 *   stored bilingual + monolingual history    -> bilingual (never downgraded)
 *   no strong history                          -> the stored value is preserved
 *   nothing stored                             -> strong history, else fallback
 */
export function resolveScope(
  stored: ReviewScope | undefined,
  strong: ReviewScope | null,
  fallback: ReviewScope
): ReviewScope {
  if (!stored) return strong || fallback;
  if (!strong || strong === stored) return stored;
  if (strong === "bilingual") return "bilingual";
  // A stored bilingual scope is never downgraded because one historical source
  // happens to be incomplete.
  if (stored === "bilingual") return "bilingual";
  return strong;
}

/** The languages a scope requires, in interface-language order. */
export function scopeLanguages(
  scope: ReviewScope,
  interfaceLang: "es" | "en"
): MemorizeLanguage[] {
  if (scope === "english") return ["en"];
  if (scope === "spanish") return ["es"];
  return interfaceLang === "es" ? ["es", "en"] : ["en", "es"];
}

/** The Memorize language mode a scope maps onto. */
export function scopeToMemorizeMode(scope: ReviewScope): "es" | "en" | "both" {
  if (scope === "english") return "en";
  if (scope === "spanish") return "es";
  return "both";
}

function usableTextFor(
  verse: Verse,
  lang: MemorizeLanguage,
  translation: Translation
): string | null {
  if (!validateVerseTranslation(verse, lang, translation).isValid) return null;
  const raw = verse.text?.[lang]?.[translation] || "";
  return isFailedTranslationText(raw) ? null : raw;
}

/**
 * Which languages this verse holds valid ACQUIRED content for, across every
 * translation slot rather than only today's selected pair. A translation the
 * user has since switched away from still proves the language was acquired.
 */
function acquiredLanguagesForVerse(verse: Verse): { en: boolean; es: boolean } {
  const en = EN_TRANSLATIONS.some(t => usableTextFor(verse, "en", t) !== null);
  const es = ES_TRANSLATIONS.some(t => usableTextFor(verse, "es", t) !== null);
  return { en, es };
}

/** Every verse the app can resolve, keyed by id — the union Saved also uses. */
function allKnownVerses(state: AppState): Verse[] {
  return Array.from(
    new Map([...MOCK_VERSES, ...(state.customVerses || [])].map(v => [v.id, v])).values()
  );
}

/**
 * Collects one entry per UNIQUE acquired passage.
 *
 * Acquisition means the full flow completed — `progress.completedVerses`, which
 * is exactly what the Citation acquisition write appends to. Duplicate
 * acquisitions of the same passage (different translations, repeat sessions)
 * collapse onto one canonical key. Content integrity is enforced here: a
 * passage with no usable Scripture in either language never enters the queue.
 */
export function collectAcquiredPassages(state: AppState): AcquiredPassage[] {
  const completed = state.progress?.completedVerses || [];
  if (completed.length === 0) return [];

  const byId = new Map(allKnownVerses(state).map(v => [v.id, v]));
  const pair = getCurrentTranslationPair(state);
  const byKey = new Map<string, AcquiredPassage>();
  // A passage can hold several translation-scoped verse ids, so BOTH the
  // historical evidence and the acquired-content fallback are unioned across
  // every completed id that resolves to one canonical key. This accumulation
  // happens BEFORE any reviewability filtering: an id whose text is not usable
  // today still proves which language it was learned in.
  const evidenceByKey = new Map<string, ScopeEvidence>();
  const acquiredByKey = new Map<string, { en: boolean; es: boolean }>();

  for (const verseId of completed) {
    const verse = byId.get(verseId);
    if (!verse) continue;

    const passageKey = passageKeyForVerse(verse);
    if (!passageKey) continue;

    // ---- Evidence first, unconditionally. ----
    const evidence = evidenceByKey.get(passageKey) || emptyEvidence();
    evidenceByKey.set(passageKey, addVerseEvidence(evidence, state, verseId));

    const acquiredHere = acquiredLanguagesForVerse(verse);
    const acquired = acquiredByKey.get(passageKey) || { en: false, es: false };
    acquired.en = acquired.en || acquiredHere.en;
    acquired.es = acquired.es || acquiredHere.es;
    acquiredByKey.set(passageKey, acquired);

    // ---- Reviewability second. ----
    const availableLanguages: MemorizeLanguage[] = [];
    if (usableTextFor(verse, "es", pair.es)) availableLanguages.push("es");
    if (usableTextFor(verse, "en", pair.en)) availableLanguages.push("en");
    // A passage whose text cannot be shown is not reviewable. It is skipped,
    // never invented and never substituted with an unrelated daily passage —
    // but its scope evidence has already been recorded above, so skipping it
    // can never silently downgrade the passage's saved scope.
    if (availableLanguages.length === 0) continue;

    const acquiredAt = isValidIso(verse.addedAt) ? (verse.addedAt as string) : null;
    const existing = byKey.get(passageKey);

    if (!existing) {
      byKey.set(passageKey, {
        passageKey,
        verseId,
        verse,
        acquiredAt,
        availableLanguages,
        // All three resolved below, once every id has contributed.
        strongScope: null,
        fallbackScope: "english",
        learnedScope: "english",
      });
      continue;
    }

    // Deterministic collapse: keep the earliest known acquisition time, and
    // prefer the entry offering more usable languages.
    const keepAcquiredAt =
      existing.acquiredAt && acquiredAt
        ? (Date.parse(existing.acquiredAt) <= Date.parse(acquiredAt) ? existing.acquiredAt : acquiredAt)
        : existing.acquiredAt || acquiredAt;

    if (availableLanguages.length > existing.availableLanguages.length) {
      byKey.set(passageKey, {
        ...existing,
        verseId,
        verse,
        acquiredAt: keepAcquiredAt,
        availableLanguages,
      });
    } else if (keepAcquiredAt !== existing.acquiredAt) {
      byKey.set(passageKey, { ...existing, acquiredAt: keepAcquiredAt });
    }
  }

  // Resolve each scope only after every completed verse id has contributed.
  return Array.from(byKey.values()).map(passage => {
    const evidence = evidenceByKey.get(passage.passageKey) || emptyEvidence();
    const acquired = acquiredByKey.get(passage.passageKey) || { en: false, es: false };
    const strongScope = strongScopeFrom(evidence);
    const fallbackScope = fallbackScopeFrom(acquired);
    return {
      ...passage,
      strongScope,
      fallbackScope,
      learnedScope: strongScope || fallbackScope,
    };
  });
}

// ---------------------------------------------------------------------------
// LAZY INITIALIZATION
// ---------------------------------------------------------------------------

/**
 * Creates a record for every acquired passage that has none, and repairs any
 * malformed persisted record. Returns `null` when nothing changed, so callers
 * can skip the state write entirely and never loop.
 *
 * This never touches Saved counts, acquisition history, Scripture text, or the
 * completion record. It only fills in review bookkeeping that did not exist.
 */
export function ensureReviewRecords(
  state: AppState,
  nowMs: number
): Record<string, ReviewRecord> | null {
  const passages = collectAcquiredPassages(state);
  const current = state.reviewRecords || {};
  let changed = false;

  const next: Record<string, ReviewRecord> = {};

  // Keep every existing record (including passages whose text is momentarily
  // unavailable — losing a record would silently reset real mastery).
  for (const [key, raw] of Object.entries(current)) {
    const sanitized = sanitizeReviewRecord(raw, key, nowMs);
    next[key] = sanitized;
    if (
      raw?.reviewLevel !== sanitized.reviewLevel ||
      raw?.nextReviewAt !== sanitized.nextReviewAt ||
      raw?.lastOutcome !== sanitized.lastOutcome ||
      raw?.unresolvedStage !== sanitized.unresolvedStage ||
      raw?.acquiredAt !== sanitized.acquiredAt
    ) {
      changed = true;
    }
  }

  for (const passage of passages) {
    const existing = next[passage.passageKey];
    if (existing) {
      // Keep the launchable verse id fresh, and RECONCILE the review scope.
      //
      // A stored scope is repaired only when STRONG ACQUISITION HISTORY proves
      // it wrong — never by availability, never by the interface language, and
      // never downgrading a stored bilingual scope on partial evidence. When
      // history is silent the stored value is preserved untouched.
      //
      // ONLY `reviewScope` is written here: level, timestamps, outcome,
      // unresolved stage and the finalization marker are all carried through
      // unchanged. Idempotent by construction — once repaired, `resolveScope`
      // returns the stored value and nothing further is written.
      const nextScope = resolveScope(
        existing.reviewScope,
        passage.strongScope,
        passage.fallbackScope
      );
      const needsVerseId = existing.verseId !== passage.verseId;
      const needsScope = nextScope !== existing.reviewScope;
      if (needsVerseId || needsScope) {
        next[passage.passageKey] = {
          ...existing,
          verseId: passage.verseId,
          reviewScope: nextScope,
        };
        changed = true;
      }
      continue;
    }
    // No acquisition timestamp exists in the repository for older passages, so
    // it is derived once (verse.addedAt when present, otherwise this moment)
    // and PERSISTED, which keeps the never-reviewed tie-break stable forever.
    const acquiredMs = passage.acquiredAt ? parseIso(passage.acquiredAt, nowMs) : nowMs;
    next[passage.passageKey] = createReviewRecord(
      passage.passageKey,
      acquiredMs,
      passage.verseId,
      passage.learnedScope
    );
    changed = true;
  }

  return changed ? next : null;
}

// ---------------------------------------------------------------------------
// ELIGIBILITY AND ORDER
// ---------------------------------------------------------------------------

export function isDue(record: ReviewRecord, nowMs: number): boolean {
  return parseIso(record.nextReviewAt, nowMs) <= nowMs;
}

/**
 * Unresolved-difficulty bucket. Exhaustion outranks recovery, so a passage that
 * ran out of attempts is always tended before one that merely stumbled.
 *   0 both stages exhausted
 *   1 exactly one stage exhausted
 *   2 recovered difficulty, no exhaustion
 *   3 no unresolved difficulty
 */
export function difficultyRank(record: ReviewRecord): number {
  if (record.lastOutcome === "both_exhausted") return 0;
  if (record.lastOutcome === "recall_exhausted" || record.lastOutcome === "citation_exhausted") {
    return 1;
  }
  if (record.lastOutcome === "recovered_success" && record.unresolvedStage !== "none") return 2;
  return 3;
}

/**
 * The deterministic comparator. No randomness, no streaks, no language
 * preference, no popularity, no acquisition count, no payment status, no hidden
 * numeric priority. The final passageKey comparison guarantees a total order,
 * so the same queue always renders in the same sequence.
 */
export function compareDueRecords(a: ReviewRecord, b: ReviewRecord, nowMs: number): number {
  const rankDelta = difficultyRank(a) - difficultyRank(b);
  if (rankDelta !== 0) return rankDelta;

  const dueDelta = parseIso(a.nextReviewAt, nowMs) - parseIso(b.nextReviewAt, nowMs);
  if (dueDelta !== 0) return dueDelta;

  // Oldest last review first. A never-reviewed passage counts as infinitely old.
  const aReviewed = a.lastReviewedAt ? parseIso(a.lastReviewedAt, nowMs) : null;
  const bReviewed = b.lastReviewedAt ? parseIso(b.lastReviewedAt, nowMs) : null;
  if (aReviewed === null && bReviewed !== null) return -1;
  if (aReviewed !== null && bReviewed === null) return 1;
  if (aReviewed !== null && bReviewed !== null && aReviewed !== bReviewed) {
    return aReviewed - bReviewed;
  }

  // Both never reviewed: oldest acquisition first.
  if (aReviewed === null && bReviewed === null) {
    const acquiredDelta = parseIso(a.acquiredAt, nowMs) - parseIso(b.acquiredAt, nowMs);
    if (acquiredDelta !== 0) return acquiredDelta;
  }

  return a.passageKey < b.passageKey ? -1 : a.passageKey > b.passageKey ? 1 : 0;
}

export interface QueueRow {
  record: ReviewRecord;
  passage: AcquiredPassage;
  /** The persisted scope when present, otherwise the derived one. */
  scope: ReviewScope;
}

export interface ReviewQueue {
  /** Every due row, in priority order. */
  due: QueueRow[];
  /** The next five scheduled rows, soonest first. */
  upcoming: QueueRow[];
  /** True total due — always the full count, never the rendered slice. */
  totalDue: number;
  /** True total of acquired passages that have a review record. */
  totalAcquired: number;
  /** Convenience: the single highest-priority due row. */
  next: QueueRow | null;
  /** Convenience: the soonest scheduled row when nothing is due. */
  nextUpcoming: QueueRow | null;
}

export const UPCOMING_LIMIT = 5;

/**
 * THE queue calculation. `nowMs` is supplied by the caller so eligibility
 * refreshes at controlled moments (app start, Review open, focus regained,
 * after a review finalizes) rather than ticking second by second.
 */
export function selectReviewQueue(state: AppState, nowMs: number): ReviewQueue {
  const passages = collectAcquiredPassages(state);
  const records = state.reviewRecords || {};

  const rows: QueueRow[] = [];
  for (const passage of passages) {
    const raw = records[passage.passageKey];
    // A passage with no record yet is still shown as due; lazy initialization
    // will persist an identical record on the next state write.
    const record = raw
      ? sanitizeReviewRecord(raw, passage.passageKey, nowMs)
      : createReviewRecord(
          passage.passageKey,
          passage.acquiredAt ? parseIso(passage.acquiredAt, nowMs) : nowMs,
          passage.verseId,
          passage.learnedScope
        );
    // The SAME resolver lazy reconciliation uses, so a repaired scope shows on
    // this render rather than one render after the state write lands.
    rows.push({
      record,
      passage,
      scope: resolveScope(record.reviewScope, passage.strongScope, passage.fallbackScope),
    });
  }

  const due = rows.filter(r => isDue(r.record, nowMs));
  const upcomingAll = rows.filter(r => !isDue(r.record, nowMs));

  due.sort((a, b) => compareDueRecords(a.record, b.record, nowMs));
  upcomingAll.sort((a, b) => {
    const delta = parseIso(a.record.nextReviewAt, nowMs) - parseIso(b.record.nextReviewAt, nowMs);
    if (delta !== 0) return delta;
    return a.record.passageKey < b.record.passageKey ? -1 : 1;
  });

  return {
    due,
    upcoming: upcomingAll.slice(0, UPCOMING_LIMIT),
    totalDue: due.length,
    totalAcquired: rows.length,
    next: due.length > 0 ? due[0] : null,
    nextUpcoming: upcomingAll.length > 0 ? upcomingAll[0] : null,
  };
}

/** Whole days a record is past its due instant (0 when not overdue). */
export function daysOverdue(record: ReviewRecord, nowMs: number): number {
  const dueMs = parseIso(record.nextReviewAt, nowMs);
  if (dueMs > nowMs) return 0;
  return Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
}

/** Convenience for callers that hold only a key. */
export function findQueueRow(queue: ReviewQueue, passageKey: string): QueueRow | null {
  return (
    queue.due.find(r => r.passage.passageKey === passageKey) ||
    queue.upcoming.find(r => r.passage.passageKey === passageKey) ||
    null
  );
}

export { clampReviewLevel };

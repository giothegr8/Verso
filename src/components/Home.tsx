import { motion } from "motion/react";
import { AppState, TRANSLATION_DETAILS, Verse, Translation, CustomPath, Path, ShareSnapshot, ShareBlock } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { getVerseText, getFallbackMessage } from "../utils/verseProvider";
import { Star, X, AlertCircle, Loader2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, getLocalizedPathDay, formatReferenceForLocale, formatLocalizedReference } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import { AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";
import { PATHS } from "../constants";
import { searchVerse, loadVerseAndMerge } from "../services/bibleService";
import { BIBLE_VERSIONS } from "../services/apiBible";
import { BrandIcon, Button, IconButton } from "./ui";
import CoachCard from "./CoachCard";

const ES_TRANSLATIONS = ["RVR1960", "NVI", "NBLA"];
const isEsTranslation = (t: string) => ES_TRANSLATIONS.includes(t);

// THE FAILED-TRANSLATION SENTINELS (same narrow contract as Memorize.tsx).
//
// `loadVerseAndMerge` records a failed fetch by writing a sentence into the
// verse, so the structured failure is lost at the source and the message
// becomes ordinary content that `validateVerseTranslation` accepts as
// Scripture. Matched EXACTLY after trimming — never as a keyword search — so
// real Scripture containing the word "error" is never rejected.
const FAILED_TRANSLATION_SENTINELS = [
  "Error al cargar la traducción en Español.",
  "Error loading English translation.",
];
const isFailedTranslationText = (text: string | null | undefined) => {
  if (!text) return false;
  const trimmed = text.trim();
  return FAILED_TRANSLATION_SENTINELS.some(sentinel => trimmed === sentinel);
};

// Phase 2 locked Home visual recipe (tokens/dark-theme via Tailwind mappings).
// Card: Deep Slate, hairline, 18px radius, 18px padding (24px >=768).
const CARD = "bg-deep-slate border border-(--line) rounded-[18px] p-[18px] md:p-6";
// Eyebrow: Hanken 11.5px / 600 / 0.22em, faint.
const EYEBROW = "font-hanken text-[11.5px] font-semibold uppercase tracking-[0.22em] text-faint";
// Reference: Hanken 600 royal-soft ~10px, never truncated, wraps up to two lines.
const REF = "font-hanken font-semibold uppercase text-royal-soft text-[10px] leading-[1.5] break-words";
// Verse: Fraunces 400, warm cool-white verse ink from the handoff screens spec.
const VERSE = "font-fraunces font-normal leading-[1.32] text-[#EFE6D8]";

interface HomeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onChangeTranslation: (lang: 'es' | 'en', id: Translation) => void;
  onStartMemorizing: (verseId: string) => void;
  onGetAnotherVerse: () => void;
  onGoToSaved: () => void;
  onGoToPaths: (path?: Path | CustomPath) => void;
  onCompletePathDay: () => boolean;
}

export default function Home({ state, setState, onChangeTranslation, onStartMemorizing, onGetAnotherVerse, onGoToSaved, onGoToPaths, onCompletePathDay }: HomeProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSnapshot, setShareSnapshot] = useState<ShareSnapshot | null>(null);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Verse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [searchTranslation, setSearchTranslation] = useState<Translation | " font-bold uppercase py-2" | "">("");
  // Which translation actually produced the current search result. Normally the
  // preferred one; after a one-time alternate-language fallback it is the other
  // language's translation, so the selected verse is pinned to the language
  // whose text really loaded rather than the interface default.
  const [resultTranslation, setResultTranslation] = useState<Translation | null>(null);
  const isEs = state.primaryLanguage === "es";

  // Safety confirmation and undo completion states
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [prevProgressSnapshot, setPrevProgressSnapshot] = useState<{
    pathProgress: any;
    customPathProgress: any;
  } | null>(null);

  React.useEffect(() => {
    if (showUndoToast) {
      const timer = setTimeout(() => {
        setShowUndoToast(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showUndoToast]);

  /**
   * THE ONE-TIME ALTERNATE-LANGUAGE FALLBACK.
   *
   * `searchVerse` separates the two failure kinds precisely: every reference
   * problem (unparseable input, unknown book, out-of-range chapter/verse)
   * THROWS a `PARSE_ERROR`, while a canonical reference that resolved but whose
   * TEXT could not be fetched returns `null`. Only the `null` case can benefit
   * from another language, so only the `null` case triggers one.
   *
   * Cost discipline — this issues NO extra request on a normal successful
   * search. The alternate request happens only after the preferred language's
   * text fails, is attempted exactly ONCE, reuses the same typed query (the
   * parser already resolves English and Spanish aliases to one shared canonical
   * passage, so the user never retypes the book name), and is never retried.
   * A thrown `PARSE_ERROR` propagates out of here untouched, so the "Did you
   * mean?" path and invalid-reference handling are unchanged.
   */
  const preferredSearchTranslation = () =>
    (searchTranslation || (isEs ? state.selectedTranslations.es : state.selectedTranslations.en)) as Translation;

  const runSearchWithFallback = async (
    query: string
  ): Promise<{ result: Verse | null; translation: Translation | null }> => {
    const preferred = preferredSearchTranslation();
    const first = await searchVerse(query, preferred);
    if (first) return { result: first, translation: preferred };

    // Reference resolved, preferred text failed -> try the other language once.
    const alternate = (isEsTranslation(preferred)
      ? state.selectedTranslations.en
      : state.selectedTranslations.es) as Translation;
    if (!alternate || alternate === preferred) return { result: null, translation: null };

    const second = await searchVerse(query, alternate);
    return second ? { result: second, translation: alternate } : { result: null, translation: null };
  };

  const handleApplySuggestion = (sug: string) => {
    setSearchQuery(sug);
    setSuggestion(null);
    setLookupError(null);
    setTimeout(() => {
      setIsSearching(true);
      runSearchWithFallback(sug)
        .then(({ result, translation }) => {
          if (result) {
            setSearchResult(result);
            setResultTranslation(translation);
            setLookupError(null);
          } else {
            // BOTH languages' text failed. The reference itself resolved (a
            // reference problem would have thrown), so this must never claim
            // the passage does not exist. The "Did you mean?" path below is
            // untouched.
            setResultTranslation(null);
            setLookupError(isEs
              ? "La referencia es válida, pero no se pudo cargar el texto en este momento. Inténtalo de nuevo."
              : "The reference is valid, but its text could not be loaded right now. Please try again.");
            setSearchResult(null);
          }
        })
        .catch((e: any) => {
          if (e && e.message && e.message.startsWith("PARSE_ERROR:")) {
            setLookupError(e.message.substring("PARSE_ERROR:".length));
            if (e.suggestion) {
              setSuggestion(e.suggestion);
            }
          } else {
            setLookupError(isEs ? "Error al buscar." : "Error searching.");
          }
          setSearchResult(null);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 10);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setLookupError(isEs ? "Escribe una cita bíblica primero." : "Enter a Bible reference first.");
      setSearchResult(null);
      setSuggestion(null);
      return;
    }

    setIsSearching(true);
    setLookupError(null);
    setSearchResult(null);
    setSuggestion(null);

    try {
      const { result, translation } = await runSearchWithFallback(searchQuery);

      if (result) {
        setSearchResult(result);
        setResultTranslation(translation);
        setLookupError(null);
      } else {
        // REFERENCE FAILURE vs TRANSLATION FAILURE. Every reference-resolution
        // failure inside `searchVerse` THROWS a PARSE_ERROR (caught below), so
        // reaching here means the reference resolved and BOTH the preferred and
        // the one alternate text request failed. Reporting that as "verse not
        // found" would tell the user a valid passage does not exist.
        setResultTranslation(null);
        setLookupError(isEs
          ? "La referencia es válida, pero no se pudo cargar el texto en este momento. Inténtalo de nuevo."
          : "The reference is valid, but its text could not be loaded right now. Please try again.");
        setSearchResult(null);
      }
    } catch (e: any) {
      if (e && e.message && e.message.startsWith("PARSE_ERROR:")) {
        setLookupError(e.message.substring("PARSE_ERROR:".length));
        if (e.suggestion) {
          setSuggestion(e.suggestion);
        }
      } else {
        setLookupError(isEs ? "Error al buscar." : "Error searching.");
      }
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const onSelectCustomVerse = () => {
    if (searchResult) {
      // Pin the verse to the translation that ACTUALLY produced the result. After
      // a one-time alternate-language fallback that is the other language, so
      // using the interface default here would pair the verse with a translation
      // whose text never loaded.
      const translation = resultTranslation || preferredSearchTranslation();

      // Part 8: Check if it matches an existing mock verse by address for normalization
      const matchingMock = MOCK_VERSES.find(v => {
        const bookMatch = v.book.toLowerCase().includes(searchResult.book.toLowerCase()) ||
                          searchResult.book.toLowerCase().includes(v.book.toLowerCase().split(' / ')[0].toLowerCase());
        return bookMatch && v.chapter === searchResult.chapter && v.verse === searchResult.verse;
      });

      // Use a stable ID that includes translation for custom verses,
      // but prioritize the mock ID if it's a match for recognition
      const baseId = matchingMock ? matchingMock.id : searchResult.id;
      const stableId = baseId.includes('-') && !baseId.startsWith('custom-')
        ? `${baseId}-${translation}`
        : (baseId.startsWith('custom-') ? baseId : `custom-${baseId}-${translation}`);

      const verseWithMeta: Verse = {
        ...(matchingMock || searchResult),
        id: stableId,
        source: "custom",
        addedAt: new Date().toISOString(),
        preferredTranslation: translation as Translation
      };

      // Keep the global Quick Switch aligned with the translation this custom
      // verse actually uses (its preferredTranslation), updating only the
      // matching language side. The slot is already loaded, so no fetch occurs.
      const prefSide: 'es' | 'en' = isEsTranslation(translation as Translation) ? 'es' : 'en';

      setState(s => ({
        ...s,
        activeSource: "custom",
        selectedCustomVerse: verseWithMeta,
        selectedTranslations: { ...s.selectedTranslations, [prefSide]: translation as Translation },
        // Also add to customVerses list for library/saved view if not exists
        customVerses: s.customVerses.some(v => v.id === verseWithMeta.id)
          ? s.customVerses
          : [...s.customVerses, verseWithMeta]
      }));

      setSearchResult(null);
      setSearchQuery("");

      // Scroll to top to see the selected verse
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const activePair = getCurrentTranslationPair(state);

  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const today = getLocalDateString();
  const votd = getVerseByDate(today);

  // Path Logic
  const currentPathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId;
  const isCustomPath = !!state.customPaths.find(p => p.id === currentPathId);
  const selectedPath = isCustomPath
    ? state.customPaths.find(p => p.id === currentPathId)
    : (state.pathProgress.selectedPathId ? PATHS.find(p => p.id === state.pathProgress.selectedPathId) : null);

  const isPathDayComplete = isCustomPath ? state.customPathProgress.pathCompletedToday : state.pathProgress.pathCompletedToday;
  const currentPathDayNum = isCustomPath ? state.customPathProgress.currentDay : state.pathProgress.currentDay;

  const pathDuration = selectedPath ? ('duration' in selectedPath ? selectedPath.duration : selectedPath.verses.length) : 0;
  const isPathFullyCompleted = useMemo(() => {
    if (!selectedPath) return false;
    const pathSaved = isCustomPath
      ? (state.customPathProgress?.savedProgress || {})[selectedPath.id]
      : (state.pathProgress?.savedProgress || {})[selectedPath.id];

    const hasAllCompleted = pathSaved && (pathSaved.completedDays || []).length === pathDuration;
    const inCompletedIds = isCustomPath
      ? (state.customPathProgress?.completedPathIds || []).includes(selectedPath.id)
      : (state.pathProgress?.completedPathIds || []).includes(selectedPath.id);

    return !!(hasAllCompleted || inCompletedIds);
  }, [selectedPath, isCustomPath, state.customPathProgress, state.pathProgress, pathDuration]);

  const displayedPathDayNum = (isPathDayComplete && !isPathFullyCompleted)
    ? Math.max(1, currentPathDayNum - 1)
    : currentPathDayNum;

  const savedProgressForSelected = selectedPath
    ? (isCustomPath
        ? (state.customPathProgress?.savedProgress || {})[selectedPath.id]
        : (state.pathProgress?.savedProgress || {})[selectedPath.id])
    : null;
  const shuffledDayOrder = savedProgressForSelected?.shuffledDayOrder;

  const nextPathDayNum = isPathDayComplete
    ? (currentPathDayNum <= pathDuration ? currentPathDayNum : null)
    : (currentPathDayNum < pathDuration ? currentPathDayNum + 1 : null);

  const originalCurrentDayNum = shuffledDayOrder && shuffledDayOrder.length === pathDuration
    ? (shuffledDayOrder[displayedPathDayNum - 1] || displayedPathDayNum)
    : displayedPathDayNum;

  const originalNextDayNum = nextPathDayNum
    ? (shuffledDayOrder && shuffledDayOrder.length === pathDuration
        ? (shuffledDayOrder[nextPathDayNum - 1] || nextPathDayNum)
        : nextPathDayNum)
    : null;

  const currentPathDay = selectedPath
    ? getLocalizedPathDay(
        'days' in selectedPath
          ? selectedPath.days[originalCurrentDayNum - 1]
          : selectedPath.verses.find(v => v.dayNumber === originalCurrentDayNum),
        isEs
      )
    : null;

  const nextPathDay = selectedPath && originalNextDayNum
    ? getLocalizedPathDay(
        'days' in selectedPath
          ? selectedPath.days[originalNextDayNum - 1]
          : selectedPath.verses.find(v => v.dayNumber === originalNextDayNum),
        isEs
      )
    : null;

  const getPathVerse = () => {
    if (!currentPathDay) return null;
    if (isCustomPath) {
      const v = currentPathDay as any;
      // Prefer a real bilingual verse already fetched/merged by loadVerseAndMerge
      const fetched = state.customVerses.find(c => c.id === v.id);
      if (fetched) return fetched;
      // Otherwise place the stored single-language text only in its own translation slot,
      // leaving the other language empty so the lazy fetch can fill the missing language.
      const isEsText = v.translation
        ? ["RVR1960", "NVI", "NBLA"].includes(v.translation)
        : (selectedPath as CustomPath)?.language === 'es';
      const slotKey = v.translation || (isEsText ? "RVR1960" : "KJV");
      const text = {
        es: { RVR1960: "", NVI: "", NBLA: "", KJV: "", NIV: "", NASB: "" },
        en: { KJV: "", NIV: "", NASB: "", RVR1960: "", NVI: "", NBLA: "" }
      };
      if (v.text) (text as any)[isEsText ? 'es' : 'en'][slotKey] = v.text;
      return {
        id: v.id,
        book: v.reference.split(' ').slice(0, -1).join(' '),
        chapter: parseInt(v.reference.split(' ').pop()?.split(':')[0] || '1'),
        verse: parseInt(v.reference.split(' ').pop()?.split(':')[1] || '1'),
        text,
        copyright: v.copyright
      };
    }
    const ref = (currentPathDay as any).reference;
    if (ref) {
      const fromCustom = state.customVerses.find(v => v.id === `ref-${ref}`);
      if (fromCustom) return fromCustom;
    }
    return getVerseText({ reference: (currentPathDay as any).reference });
  };

  const currentPathVerse = getPathVerse();

  // The UI needs a verse object even if text is missing
  const activePathVerse = currentPathVerse || (currentPathDay ? {
    id: `ref-${(currentPathDay as any).reference}`,
    book: (currentPathDay as any).reference.split(' ').slice(0, -1).join(' '),
    chapter: parseInt((currentPathDay as any).reference.split(' ').pop()?.split(':')[0] || '0'),
    verse: parseInt((currentPathDay as any).reference.split(' ').pop()?.split(':')[1] || '0'),
    text: {
       es: { RVR1960: getFallbackMessage('es'), NVI: getFallbackMessage('es'), NBLA: getFallbackMessage('es'), KJV: '', NIV: '', NASB: '' },
       en: { KJV: getFallbackMessage('en'), NIV: getFallbackMessage('en'), NASB: getFallbackMessage('en'), RVR1960: '', NVI: '', NBLA: '' }
    }
  } as Verse : null);

  // Unified Active Verse Logic (Refactored to support Path fallback)
  let currentVerse: Verse;
  switch (state.activeSource) {
    case "custom":
      currentVerse = state.selectedCustomVerse || votd;
      break;
    case "path":
      currentVerse = (state.selectedVerseId
        ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || state.customVerses.find(v => v.id === state.selectedVerseId))
        : null) || activePathVerse || votd;
      break;
    case "extra":
    case "saved":
      currentVerse = (state.selectedVerseId
        ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || state.customVerses.find(v => v.id === state.selectedVerseId))
        : null) || votd;
      break;
    default:
      currentVerse = votd;
  }

  // Load missing verse text automatically on the fly
  React.useEffect(() => {
    if (!currentVerse) return;

    const activePair = getCurrentTranslationPair(state);
    const mode = state.memorizeMode;

    let needsEs = false;
    let needsEn = false;

    if (mode === "es" || mode === "both") {
      const txt = currentVerse.text.es[activePair.es];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEs = true;
      }
    }

    if (mode === "en" || mode === "both") {
      const txt = currentVerse.text.en[activePair.en];
      if (!txt || txt.toLowerCase().includes("coming soon") || txt.toLowerCase().includes("próximamente") || txt.toLowerCase().includes("proximamente")) {
        needsEn = true;
      }
    }

    if (needsEs || needsEn) {
      const ref = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;
      loadVerseAndMerge(ref, currentVerse.id, state, setState);
    }
  }, [
    currentVerse?.id,
    state.memorizeMode,
    state.selectedTranslations?.es,
    state.selectedTranslations?.en,
    state.activeSource
  ]);

  const isCustomMode = state.activeSource === "custom";
  const isVotd = currentVerse.id === votd.id && !isCustomMode;

  const isCurrentVerseCompleted = (() => {
    if (isCustomMode) return false;
    if (state.activeSource === 'path') {
      return isPathDayComplete;
    }
    if (isVotd) {
      return state.progress.lastCompletedDailyVerseDate === today;
    }
    return false;
  })();

  // CONTENT-INTEGRITY GATE. A failed translation is never Scripture: it cannot
  // render in a verse body, cannot enter the Share snapshot, and cannot satisfy
  // the memorize button's enable condition (which tests these same values).
  const {
    esText: rawEsText,
    enText: rawEnText,
    esError,
    enError,
    activePair: validatedPair,
  } = getValidatedVerse(currentVerse, state);
  const esTranslationFailed = isFailedTranslationText(rawEsText);
  const enTranslationFailed = isFailedTranslationText(rawEnText);
  const esText = esTranslationFailed ? null : rawEsText;
  const enText = enTranslationFailed ? null : rawEnText;
  const esTransToUse = validatedPair?.es || esDetail.id;
  const enTransToUse = validatedPair?.en || enDetail.id;
  // Tie the verse-card translation label/name to the same validated pair used
  // to render the body, so the label can never name a different translation
  // than the text shown (e.g. custom verses pinned via preferredTranslation).
  const esVerseDetail = TRANSLATION_DETAILS[esTransToUse] || esDetail;
  const enVerseDetail = TRANSLATION_DETAILS[enTransToUse] || enDetail;
  const isEsLoading = !!(currentVerse && state.loadingTranslations && state.loadingTranslations[`${currentVerse.id}_${esTransToUse}`]);
  const isEnLoading = !!(currentVerse && state.loadingTranslations && state.loadingTranslations[`${currentVerse.id}_${enTransToUse}`]);

  // Ordered list of the languages whose verse bodies are visible on the Home card,
  // in the exact order they render (Spanish block first, then English). One source
  // of order, used for both the visible reference and the Home Share snapshot
  // reference so the two always match.
  // INTERFACE LANGUAGE decides bilingual order — never fetch timing, object
  // insertion order, the language of the search query, or which translation
  // arrived first. Availability then removes any language with no valid text.
  const requestedHomeLangs: ('es' | 'en')[] =
    state.memorizeMode === 'es' ? ['es']
    : state.memorizeMode === 'en' ? ['en']
    : (state.primaryLanguage === 'es' ? ['es', 'en'] : ['en', 'es']);
  const referenceLangs: ('es' | 'en')[] = (() => {
    const available = requestedHomeLangs.filter(lang => (lang === 'es' ? esText : enText));
    return available.length > 0 ? available : requestedHomeLangs;
  })();
  // Reported only when the card genuinely still shows the other language.
  const homeUnavailableLang: ('es' | 'en') | null =
    esTranslationFailed && !esText && !!enText ? 'es'
    : enTranslationFailed && !enText && !!esText ? 'en'
    : null;

  // The rendered reference drives the locked Home type rules: long references
  // tighten tracking (0.20em -> 0.12em past 22 chars) and step the verse body
  // down one notch (24px -> 21px, never below the 20px floor). Long verse
  // bodies step down the same notch so the reading column stays composed.
  // THE HEADER USES THE UNFILTERED, INTERFACE-ORDERED LIST.
  //
  // `referenceLangs` is availability-filtered, so a failed Spanish translation
  // collapsed the top bilingual header to "1 Thessalonians 5:17" and the
  // Spanish book name vanished. Translation availability governs SCRIPTURE
  // CONTENT — it must never delete a known localized Bible reference from the
  // header. `requestedHomeLangs` carries interface-language order without that
  // filter, and `formatLocalizedReference` joins the names with " / " and
  // appends chapter:verse exactly ONCE at the end:
  //   English interface -> "1 Thessalonians / 1 Tesalonicenses 5:17"
  //   Spanish interface -> "1 Tesalonicenses / 1 Thessalonians 5:17"
  // Single-language mode passes a one-entry list, so it still renders one book
  // name with no slash. `referenceLangs` is deliberately left untouched below,
  // where the Share snapshot continues to use it unchanged.
  const displayedReference = formatLocalizedReference(currentVerse.book, currentVerse.chapter, currentVerse.verse, requestedHomeLangs);
  const isLongReference = displayedReference.length > 22;
  const isLongVerse = (esText?.length ?? 0) > 140 || (enText?.length ?? 0) > 140;
  const verseSizeClass = (isLongReference || isLongVerse) ? "text-[21px]" : "text-[24px]";
  // `refTrackingClass` existed only to tighten the COMBINED card header, which
  // has been removed: each language block now owns its own localized reference,
  // so there is no combined string whose length should drive tracking.
  // `displayedReference` itself is retained — the Share snapshot and ShareModal
  // still consume it, and `isLongVerse`/`isLongReference` still size the body.

  // Path memory-verse reference (path card block): same wrapping rules; the
  // chapter:verse group never breaks internally, so a forced wrap lands before
  // the verse range.
  const pathVerseBookName = activePathVerse
    ? getLocalizedBookName(activePathVerse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))
    : "";
  const pathRefText = activePathVerse ? `${pathVerseBookName} ${activePathVerse.chapter}:${activePathVerse.verse}` : "";
  const pathRefTrackingClass = pathRefText.length > 22 ? "tracking-[0.12em]" : "tracking-[0.2em]";

  const pathTitleText = selectedPath
    ? (isCustomPath ? (selectedPath as CustomPath).title : (isEs ? (selectedPath as Path).titleEs : (selectedPath as Path).title))
    : "";

  // Build an immutable, source-aware snapshot from the verse currently displayed
  // on Home. Provenance: the genuine daily verse → "Today's Verse"; anything else
  // (searched/custom/path) → "Shared from Verso". A Home share is never labeled
  // "Memorized with Verso" merely because the verse may also exist in Saved.
  const buildHomeSnapshot = (): ShareSnapshot => {
    const mode = state.memorizeMode;
    const blocks: ShareBlock[] = [];
    if ((mode === 'es' || mode === 'both') && esText) {
      blocks.push({ language: 'es', translation: esTransToUse, label: TRANSLATION_DETAILS[esTransToUse]?.name || esTransToUse, bibleId: BIBLE_VERSIONS[esTransToUse], text: esText });
    }
    if ((mode === 'en' || mode === 'both') && enText) {
      blocks.push({ language: 'en', translation: enTransToUse, label: TRANSLATION_DETAILS[enTransToUse]?.name || enTransToUse, bibleId: BIBLE_VERSIONS[enTransToUse], text: enText });
    }
    const refLang: 'es' | 'en' = referenceLangs[0];
    const isDaily = isVotd;
    return {
      source: isDaily ? 'daily' : 'custom',
      book: currentVerse.book,
      chapter: currentVerse.chapter,
      verse: currentVerse.verse,
      refLang,
      reference: formatLocalizedReference(currentVerse.book, currentVerse.chapter, currentVerse.verse, referenceLangs),
      blocks,
      footer: isDaily
        ? (state.primaryLanguage === 'es' ? 'Versículo de Hoy' : 'Today’s Verse')
        : (state.primaryLanguage === 'es' ? 'Compartido desde Verso' : 'Shared from Verso'),
    };
  };

  const onShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareSnapshot(buildHomeSnapshot());
    setIsShareModalOpen(true);
  };

  const onNativeShare = async (elementId?: string, filename?: string) => {
    const snap = shareSnapshot || buildHomeSnapshot();
    const bodyLines = snap.blocks.map(b => `${b.language === 'es' ? 'ES' : 'EN'}: ${b.text}`).join('\n');
    const title = `Verso: ${snap.reference}`;
    const text = `${snap.reference}\n\n${bodyLines}\n\n${snap.footer}`;
    const url = window.location.href;

    await handleShare(title, text, url, (msg) => {
      setToastMessage(msg === "Shared successfully!" ? (state.primaryLanguage === 'es' ? "¡Compartido!" : "Shared!") : (msg === "Copied to clipboard!" ? (state.primaryLanguage === 'es' ? "¡Copiado!" : "Copied!") : msg));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, elementId, filename);
    // Do not auto-close the modal: it must stay open after success, cancellation,
    // clipboard, download, or failure so the toast feedback remains visible. The
    // modal closes only via its explicit close control.
  };

  // Active verse card (shared by both Home branches; only the DOM ids and the
  // path-completed sentence differ between them, preserved verbatim).
  const renderVerseSection = (loaderId: string, errId: string, pathCompletedSentence: string) => (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 w-full">
        <h2 className={`${EYEBROW} min-w-0`}>
          {state.activeSource === 'path'
            ? (isEs ? "Versículo de la serie" : "Today's Path Verse")
            : (isCustomMode
              ? (isEs ? "Tu propio versículo" : "Custom Verse")
              : (isVotd
                ? (isEs ? "Versículo del día" : "Verse of the Day")
                : (isEs ? "Versículo extra" : "Extra Verse")))}
        </h2>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-hanken font-semibold uppercase tracking-widest text-faint whitespace-nowrap">
            {state.primaryLanguage === 'es' ? '1 versículo al día' : '1 verse a day'}
          </span>
          <button
            onClick={() => {
              if (isCustomMode) {
                setState(s => ({ ...s, activeSource: "daily" }));
              } else if (isVotd) {
                onGetAnotherVerse();
              } else {
                setState(s => ({ ...s, selectedVerseId: null, activeSource: "daily" }));
              }
            }}
            className="min-h-11 text-[10px] font-hanken font-semibold uppercase tracking-widest text-royal-soft hover:underline whitespace-nowrap"
          >
            {isCustomMode || !isVotd
              ? (state.primaryLanguage === 'es' ? 'VOLVER AL DIARIO' : 'BACK TO DAILY')
              : (state.primaryLanguage === 'es' ? 'OTRO VERSÍCULO' : 'ANOTHER VERSE')}
          </button>
        </div>
      </div>

      <motion.div
        id="votd-card"
        whileHover={{ scale: 1.01 }}
        className={`${CARD} relative overflow-hidden`}
      >
        {state.isLoadingAnotherVerse && (
          <div id={loaderId} className="absolute inset-0 bg-midnight/80 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] rounded-[18px] animate-in fade-in duration-200">
            <Loader2 size={32} className="animate-spin text-royal-soft" />
            <span className="text-[11px] font-hanken font-semibold uppercase tracking-widest text-cold-grey">
              {state.primaryLanguage === 'es' ? "Cargando versículo..." : "Loading verse..."}
            </span>
          </div>
        )}

        <div className="relative flex flex-col gap-6">
          {state.anotherVerseError && (
            <div id={errId} className="vmsg vmsg--error animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="vmsg__icon"><AlertCircle size={20} /></span>
              <p className="text-sm font-medium">{state.anotherVerseError}</p>
            </div>
          )}

          {/* THE COMBINED CARD HEADER IS GONE.
              It restated, slash-joined, the very references each language block
              already owns ("1 THESSALONIANS / 1 TESALONICENSES 5:17"), wrapped
              badly at iPhone SE width, and competed with the Share control for
              the same corner. The FIRST language block is now the card's top
              content anchor, and Share rides that block's own reference row —
              so there is no duplicated title, no empty header pocket, and no
              separate row for the control to float in.
              Blocks still render in INTERFACE-LANGUAGE order, each with its OWN
              localized reference, so a Spanish verse can never be labelled with
              an English book name (or the reverse). */}
          <div className="flex flex-col gap-6">
            {requestedHomeLangs.map((lang, i) => {
              const blockText = lang === 'es' ? esText : enText;
              const blockLoading = lang === 'es' ? isEsLoading : isEnLoading;
              const blockError = lang === 'es' ? esError : enError;
              const blockDetail = lang === 'es' ? esVerseDetail : enVerseDetail;
              const blockFailed = lang === 'es' ? esTranslationFailed : enTranslationFailed;
              return (
                <React.Fragment key={lang}>
                  {i > 0 && <div className="h-px w-full bg-(--line)" />}
                  <div className="flex flex-col gap-3">
                    {/* The localized reference is ALWAYS shown in full — never
                        hidden, never ellipsized. Only the translation label
                        swaps form: its official abbreviation (KJV, NBLA, ...)
                        at narrow widths, the full name from `sm:` up. Both come
                        from the existing TRANSLATION_DETAILS entry, so no new
                        data, type or token is involved. `break-words` lets the
                        metadata wrap naturally inside its own region, which now
                        never overlaps the Share control. This span sits above
                        the text/loading/error branch, so a language whose
                        Scripture failed keeps its reference and its label. */}
                    {/* METADATA ROW — the card's top anchor for the first block.
                        Two real regions: a `min-w-0 flex-1` text column and, on
                        the first block only, a `shrink-0` Share column. The
                        reference wraps inside its own column, so Share can never
                        overlap a reference, a label, Scripture or a notice, and
                        nothing is absolutely positioned.
                        Hierarchy: the localized reference is primary (Royal Soft
                        via the existing REF token); the translation identifier is
                        subordinate (smaller, Cold Grey). Narrow widths stack them
                        and show the official abbreviation (KJV / NIV / NBLA);
                        from `sm:` up they share a baseline row and the full
                        translation name returns. Nothing is truncated or
                        ellipsized, and a language whose Scripture failed keeps
                        both lines. */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                        <span className={`${REF} min-w-0`}>
                          {getLocalizedBookName(currentVerse.book, lang)} {currentVerse.chapter}:{currentVerse.verse}
                        </span>
                        <span className="text-[9px] font-hanken font-semibold uppercase tracking-[0.18em] text-cold-grey break-words">
                          <span className="sm:hidden">{blockDetail.label}</span>
                          <span className="hidden sm:inline">{blockDetail.name}</span>
                        </span>
                      </div>
                      {i === 0 && (
                        // SHARE — a 44x44 hit target wrapping a compact 30px
                        // rounded-square ghost: transparent fill, restrained
                        // hairline border, Royal Soft icon, royal hover/focus
                        // glow. Never a large glass disc, never Verdant Teal.
                        // The -my-3 offset (derived from 44px control vs ~15px
                        // text line) keeps the row the height of the text, so no
                        // empty pocket forms beneath it.
                        <button
                          id="share-btn-home"
                          type="button"
                          aria-label={state.primaryLanguage === 'es' ? "Compartir versículo" : "Share verse"}
                          onClick={onShareClick}
                          className="group shrink-0 -my-3 -mr-1 w-11 h-11 flex items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(91,120,255,0.6)]"
                        >
                          <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center border border-(--line) bg-transparent text-royal-soft transition-colors group-hover:border-(--rim-royal) group-hover:shadow-[0_0_10px_rgba(91,120,255,0.20)]">
                            <BrandIcon name="ui-share" size={16} />
                          </span>
                        </button>
                      )}
                    </div>
                    {blockText ? (
                      <p className={`${VERSE} ${verseSizeClass}`}>
                        {blockText}
                      </p>
                    ) : blockLoading ? (
                      <div className="flex flex-col gap-2 animate-pulse py-2">
                        <div className="h-6 bg-white/10 rounded-lg w-full" />
                        <div className="h-6 bg-white/10 rounded-lg w-5/6" />
                      </div>
                    ) : (
                      // Never the raw service sentence: a known failed
                      // translation gets its own localized notice inside the
                      // existing message row, not a Scripture paragraph.
                      <div className="vmsg vmsg--error">
                        <span className="vmsg__icon"><AlertCircle size={20} /></span>
                        <p className="text-sm font-medium">
                          {blockFailed
                            ? (isEs
                                ? `La traducción en ${lang === 'es' ? 'español' : 'inglés'} no está disponible en este momento.`
                                : `The ${lang === 'es' ? 'Spanish' : 'English'} translation is unavailable right now.`)
                            : blockError}
                        </p>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* One localized notice, outside every Scripture block, stating that
                the card has fallen back to the language that is still valid. */}
            {homeUnavailableLang && (
              <p role="status" className="text-[12px] font-hanken text-cold-grey leading-snug">
                {homeUnavailableLang === 'es'
                  ? (isEs
                      ? 'La traducción en español no está disponible en este momento. Se muestra solo el inglés.'
                      : 'The Spanish translation is unavailable right now. Showing English only.')
                  : (isEs
                      ? 'La traducción en inglés no está disponible en este momento. Se muestra solo el español.'
                      : 'The English translation is unavailable right now. Showing Spanish only.')}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-5 pt-5 border-t border-(--line)">
            <p className="min-w-0 sm:flex-1 text-[10px] font-hanken font-semibold uppercase tracking-widest text-faint text-center sm:text-left">
              {isCustomMode
                ? (state.primaryLanguage === 'es' ? 'Tu búsqueda' : 'Your search')
                : (isVotd
                  ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                  : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse'))}
            </p>
            {isCurrentVerseCompleted ? (
              <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                <span className="text-sm font-hanken font-medium text-cold-grey">
                  {state.activeSource === 'path'
                    ? pathCompletedSentence
                    : (isEs ? "Completaste el versículo de hoy." : "You completed today’s verse.")}
                </span>
                <span className="vchip vchip--earned text-[11px] uppercase tracking-wider select-none">
                  <BrandIcon name="ui-completion" size={14} />
                  {isEs ? "completado" : "completed"}
                </span>
              </div>
            ) : (
              <Button
                id="memorize-btn-main"
                variant="primary"
                className="w-full sm:w-auto shrink-0"
                leftIcon={<BrandIcon name="ui-memorize" size={16} />}
                onClick={(e) => {
                  e.stopPropagation();
                  if (esText || enText) {
                    onStartMemorizing(currentVerse.id);
                  }
                }}
                disabled={!esText && !enText}
              >
                {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-[620px] mx-auto flex flex-col gap-6 md:gap-7"
    >
      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        snapshot={shareSnapshot}
        state={state}
        onNativeShare={onNativeShare}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-deep-slate border border-(--line) text-cool-white px-6 py-3 rounded-full font-hanken font-semibold text-sm shadow-verso-modal flex items-center gap-2"
          >
            <Star size={16} className="text-royal-soft" fill="currentColor" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top utility row: streak + translation quick switch */}
      <div id="home-summary" className="flex flex-wrap justify-between items-center gap-3">
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onGoToSaved}
          className="vchip vchip--selected min-h-11 shadow-glow-royal"
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            {state.progress.currentStreak} {state.primaryLanguage === 'es'
              ? (state.progress.currentStreak === 1 ? 'Día' : 'Días')
              : (state.progress.currentStreak === 1 ? 'Day' : 'Days')}
            {' '}
            {state.primaryLanguage === 'es' ? 'seguidos' : 'streak'}
          </span>
        </motion.button>

        <div className="flex flex-col items-end gap-3 relative">
          <motion.button
            id="translation-pill"
            key={`${esDetail.label}-${enDetail.label}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsQuickSwitchOpen(!isQuickSwitchOpen)}
            aria-expanded={isQuickSwitchOpen}
            className="vchip min-h-11"
          >
            <BrandIcon name="ui-language" size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">
              {state.memorizeMode === 'both'
                ? `${esDetail.label} / ${enDetail.label}`
                : state.memorizeMode === 'es' ? esDetail.label : enDetail.label
              }
            </span>
          </motion.button>

          {/* Quick Switch Menu */}
          <AnimatePresence>
            {isQuickSwitchOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setIsQuickSwitchOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10, x: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10, x: 20 }}
                  className="absolute top-full right-0 mt-2 z-50 w-64 bg-deep-slate rounded-[18px] shadow-verso-modal border border-(--line) p-4 space-y-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between pl-2">
                    <span className={EYEBROW}>
                      {state.primaryLanguage === 'es' ? 'Cambio rápido' : 'Quick Switch'}
                    </span>
                    <button
                      onClick={() => setIsQuickSwitchOpen(false)}
                      aria-label={state.primaryLanguage === 'es' ? 'Cerrar' : 'Close'}
                      className="flex items-center justify-center min-h-11 min-w-11 -my-3 -mr-2 text-faint hover:text-cool-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                    {/* Spanish Options */}
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-hanken font-semibold uppercase tracking-[0.22em] text-faint px-2">
                          {state.primaryLanguage === 'es' ? 'Español' : 'Spanish'}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {['RVR1960', 'NVI', 'NBLA'].map((id) => (
                            <button
                              key={id}
                              onClick={() => { setIsQuickSwitchOpen(false); onChangeTranslation('es', id as Translation); }}
                              className={`flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl text-[11px] font-hanken font-semibold uppercase tracking-wider transition-all border ${activePair.es === id ? 'bg-[rgba(91,120,255,0.10)] text-royal-soft border-(--rim-royal)' : 'border-transparent text-cold-grey hover:bg-white/5 hover:text-cool-white'}`}
                            >
                              <span>{id}</span>
                              {activePair.es === id && <Star size={10} fill="currentColor" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* English Options */}
                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-hanken font-semibold uppercase tracking-[0.22em] text-faint px-2">
                          {state.primaryLanguage === 'es' ? 'Inglés' : 'English'}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {['KJV', 'NIV', 'NASB'].map((id) => (
                            <button
                              key={id}
                              onClick={() => { setIsQuickSwitchOpen(false); onChangeTranslation('en', id as Translation); }}
                              className={`flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl text-[11px] font-hanken font-semibold uppercase tracking-wider transition-all border ${activePair.en === id ? 'bg-[rgba(91,120,255,0.10)] text-royal-soft border-(--rim-royal)' : 'border-transparent text-cold-grey hover:bg-white/5 hover:text-cool-white'}`}
                            >
                              <span>{id}</span>
                              {activePair.en === id && <Star size={10} fill="currentColor" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content Area - Order: Path (if active) -> Votd -> Custom */}
      {selectedPath ? (
        <>
          {/* Current-path section - First priority when active */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className={`${EYEBROW} min-w-0 break-words`}>
                {isEs ? "Tu serie" : "Your path"}
                {pathTitleText && (
                  <span className="text-cold-grey"> · {pathTitleText}</span>
                )}
              </h2>
              <Button
                variant="text"
                onClick={() => onGoToPaths()}
                className="shrink-0 text-[11px] uppercase tracking-widest"
              >
                {isEs ? "Ver series" : "View all"}
              </Button>
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => onGoToPaths(selectedPath)}
              className={`${CARD} cursor-pointer text-left flex flex-col gap-4`}
            >
              {/* Progress step segments + accessible day summary */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: pathDuration }).map((_, i) => {
                    const dayNum = i + 1;
                    const pathSaved = isCustomPath
                      ? (state.customPathProgress?.savedProgress || {} as any)[currentPathId]
                      : (state.pathProgress?.savedProgress || {} as any)[currentPathId];

                    const isCompleted = isPathFullyCompleted ||
                                        pathSaved?.completedDays?.includes(dayNum) ||
                                        dayNum < displayedPathDayNum ||
                                        (dayNum === displayedPathDayNum && isPathDayComplete);
                    const isActive = !isPathFullyCompleted && dayNum === displayedPathDayNum && !isPathDayComplete;

                    return (
                      <span
                        key={i}
                        className={`h-[5px] flex-1 min-w-0 rounded-[3px] ${
                          isCompleted
                            ? "bg-ember shadow-[0_0_8px_rgba(232,179,75,0.5)]"
                            : isActive
                            ? "bg-royal shadow-[0_0_8px_rgba(91,120,255,0.5)]"
                            : "bg-white/10"
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-hanken font-semibold uppercase tracking-[0.15em] text-faint">
                  {isEs ? `Día ${displayedPathDayNum} de ${pathDuration}` : `Day ${displayedPathDayNum} of ${pathDuration}`}
                </span>
              </div>

              {/* Body Content Section */}
              {isPathDayComplete ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <BrandIcon name="ui-completion" size={18} className="text-ember shrink-0" />
                    <h3 className="font-fraunces text-lg font-medium text-cool-white leading-snug">
                      {isEs ? "Día completado" : "Day completed"}
                    </h3>
                  </div>
                  <p className="font-hanken text-base text-cold-grey leading-relaxed">
                    {isEs ? (
                      "Puedes volver mañana o seguir con el siguiente día."
                    ) : (
                      "You can return tomorrow or continue with the next day."
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <span className="vchip vchip--earned text-[11px] uppercase tracking-wider select-none">
                      <BrandIcon name="ui-completion" size={14} />
                      {isEs ? "completado" : "completed"}
                    </span>
                    {nextPathDay && (
                      <Button
                        id="next-path-day-btn"
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setState(s => {
                            if (isCustomPath) {
                              return {
                                ...s,
                                customPathProgress: {
                                  ...s.customPathProgress,
                                  pathCompletedToday: false
                                }
                              };
                            } else {
                              return {
                                ...s,
                                pathProgress: {
                                  ...s.pathProgress,
                                  pathCompletedToday: false
                                }
                              };
                            }
                          });
                        }}
                      >
                        {isEs ? "siguiente día" : "next day"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                activePathVerse && (
                  <div className="flex flex-col gap-4">
                    {((currentPathDay as any)?.title || (currentPathDay as any)?.theme) && (
                      <div className="flex flex-col gap-1">
                        {(currentPathDay as any)?.title && (
                          <h3 className="font-fraunces text-lg font-medium text-cool-white leading-snug">
                            {(currentPathDay as any).title}
                          </h3>
                        )}
                        {(currentPathDay as any)?.theme && (
                          <p className="font-hanken text-base text-cold-grey leading-relaxed">
                            {(currentPathDay as any).theme}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Memorization Verse block */}
                    <div className="rounded-[14px] border border-(--line) bg-white/[0.02] p-4 flex flex-col gap-2">
                      <p className="text-[10px] font-hanken font-semibold uppercase tracking-widest text-faint leading-none">
                        {isEs ? "Versículo de memorización:" : "Memory verse:"}
                      </p>
                      <p className={`${REF} ${pathRefTrackingClass}`}>
                        <span>{pathVerseBookName}</span>
                        {' '}
                        <span className="whitespace-nowrap">{activePathVerse.chapter}:{activePathVerse.verse}</span>
                      </p>
                    </div>

                    {/* Metadata context section */}
                    {(currentPathDay as any)?.contextPassage && (
                      <div className="flex items-start gap-1.5 text-xs font-hanken text-cold-grey border border-(--line) rounded-xl px-3 py-2 max-w-full bg-white/[0.02]">
                        <BrandIcon name="ui-memorize" size={13} className="text-faint shrink-0 mt-0.5" />
                        <p className="min-w-0 break-words">
                          {isEs ? "Lectura de contexto: " : "Context reading: "}
                          <span className="text-royal-soft font-semibold">{formatReferenceForLocale((currentPathDay as any).contextPassage, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (isEs ? 'es' : 'en'))}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )
              )}

              {!isPathDayComplete && (
                <p className="text-[10px] font-hanken font-semibold uppercase tracking-widest text-faint">
                  {isEs ? "Listo para memorizar" : "Ready to memorize"}
                </p>
              )}
            </motion.div>

            {/* Dark-glass Go to verse + mark-complete (below the card, per the Home frame) */}
            {!isPathDayComplete && (
              <div className="flex items-stretch gap-2.5 pt-1.5">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activePathVerse) {
                       if (currentVerse.id === activePathVerse.id) {
                         const el = document.getElementById('votd-card');
                         el?.scrollIntoView({ behavior: 'smooth' });
                       } else {
                         setState(s => ({ ...s, selectedVerseId: activePathVerse.id, activeSource: "path" }));
                       }
                    }
                  }}
                >
                  {currentVerse.id === activePathVerse?.id
                    ? (isEs ? "ver el versículo" : "view the verse")
                    : (isEs ? "ir al versículo" : "go to verse")}
                </Button>

                <IconButton
                  label={isEs ? "marcar como hecho" : "mark as complete"}
                  icon={<BrandIcon name="ui-completion" size={20} />}
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmingComplete(true);
                  }}
                />
              </div>
            )}
          </section>

          {/* Verse of the Day Card - Second priority when path is active */}
          {renderVerseSection(
            "another-verse-loader-1",
            "another-verse-err-1",
            isEs ? "Día completado." : "Day completed."
          )}
        </>
      ) : (
        <>
          {/* Paths Selection Prompt - Consistently at the top */}
          <section className="flex flex-col gap-2.5">
            <h2 className={EYEBROW}>
              {isEs ? "Tu serie" : "Your path"}
            </h2>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onGoToPaths()}
              className={`${CARD} w-full text-left cursor-pointer`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="font-fraunces text-[1.35rem] font-medium text-cool-white leading-snug">
                    {isEs ? "Elige una serie" : "Choose a path"}
                  </h3>
                  <p className="font-hanken text-base text-cold-grey leading-relaxed">
                    {isEs ? "Empieza un recorrido en la Palabra para este momento." : "Start a Scripture journey for this season."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-royal-soft font-hanken font-semibold text-[11px] uppercase tracking-widest">
                  {isEs ? "Elegir una serie" : "Choose a path"}
                  <BrandIcon name="ui-next" size={14} />
                </span>
              </div>
            </motion.button>
          </section>

          {/* Verse of the Day Card - Primary when NO path is active */}
          {renderVerseSection(
            "another-verse-loader-2",
            "another-verse-err-2",
            isEs ? "Día completado de la serie." : "Series day completed."
          )}
        </>
      )}

      {/* Today - the tend-your-verse coach card, fed by the live active verse */}
      <section className="flex flex-col gap-2.5">
        <h2 className={EYEBROW}>
          {isEs ? "Hoy" : "Today"}
        </h2>
        <CoachCard
          state={state}
          type="tip"
          verseReference={displayedReference}
          verseText={esText || enText || ""}
          stage={0}
          status={isCurrentVerseCompleted ? "completed" : "succeeding"}
        />
      </section>

      {/* Custom Verse Selection */}
      <section className="flex flex-col gap-2.5 pt-2">
        <h2 className={EYEBROW}>
          {isEs ? "Elige tu propio versículo" : "Choose your own verse"}
        </h2>

        <div className={`${CARD} flex flex-col gap-5`}>
          <div className="flex flex-col gap-1.5">
            <h3 className="font-fraunces text-[1.35rem] font-medium text-cool-white leading-snug">
              {isEs ? "Memoriza tu propio versículo" : "Memorize your own verse"}
            </h3>
            <p className="font-hanken text-sm text-cold-grey leading-relaxed">
              {isEs ? "Busca un pasaje y memorízalo hoy." : "Search for a passage and memorize it today."}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Translation Selection Pills */}
            <div className="flex flex-wrap gap-2">
              {(isEs ? ['RVR1960', 'NVI', 'NBLA'] : ['KJV', 'NIV', 'NASB']).map((t) => {
                const isActiveTranslation = searchTranslation === t || (!searchTranslation && (isEs ? state.selectedTranslations.es : state.selectedTranslations.en) === t);
                return (
                  <button
                    key={t}
                    onClick={() => setSearchTranslation(t as Translation)}
                    aria-pressed={isActiveTranslation}
                    className={`vchip min-h-11 text-[10px] uppercase tracking-widest ${isActiveTranslation ? 'vchip--selected' : 'hover:text-cool-white'}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="vfield">
              <span className="vfield__icon" aria-hidden="true">
                <BrandIcon name="ui-search" size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchResult) setSearchResult(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={isEs ? "Juan 3:16" : "John 3:16"}
                aria-label={isEs ? "Buscar cita bíblica" : "Search Bible reference"}
              />
              {isSearching && (
                <Loader2 size={18} className="animate-spin text-royal-soft mr-3 shrink-0" />
              )}
            </div>

            {lookupError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2"
              >
                <div className="vmsg vmsg--error">
                  <span className="vmsg__icon"><AlertCircle size={14} /></span>
                  <span>{lookupError}</span>
                </div>
                {suggestion && (
                  <Button
                    variant="secondary"
                    onClick={() => handleApplySuggestion(suggestion)}
                    className="self-start text-[11px] uppercase tracking-wider"
                  >
                    {isEs ? `¿Quisiste buscar "${suggestion}"?` : `Did you mean "${suggestion}"?`}
                  </Button>
                )}
              </motion.div>
            )}

            {searchResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[14px] border border-(--rim-royal) bg-[rgba(91,120,255,0.06)] p-4 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    {/* Search-result reference: one line always. The book name
                        and chapter:verse are kept together with whitespace-nowrap
                        (overriding REF's break-words), and a narrow-screen-only
                        size/tracking step keeps even `1 TESALONICENSES 5:16`
                        on one line at 320px without ellipsis, abbreviation, or
                        horizontal scroll. REF's own text-[10px] is stripped for
                        this element only so the responsive size has no Tailwind
                        conflict; every other REF usage is untouched. sm: restores
                        the exact prior desktop appearance (10px / 0.2em). */}
                    <h4 className={`${REF.replace(' text-[10px]', '')} whitespace-nowrap min-w-0 text-[9px] tracking-[0.08em] sm:text-[10px] sm:tracking-[0.2em]`}>
                      {getLocalizedBookName(searchResult.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {searchResult.chapter}:{searchResult.verse}
                    </h4>
                    <p className="text-[10px] font-hanken font-semibold uppercase tracking-widest text-faint">
                      {isEs ? "Versículo encontrado" : "Verse found"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSearchResult(null)}
                    aria-label={isEs ? "Descartar resultado" : "Dismiss result"}
                    className="flex shrink-0 items-center justify-center min-h-11 min-w-11 -my-2 -mr-2 text-faint hover:text-cool-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  leftIcon={<BrandIcon name="ui-memorize" size={16} />}
                  onClick={onSelectCustomVerse}
                >
                  {isEs ? "seleccionar versículo" : "select verse"}
                </Button>
              </motion.div>
            )}

            {!searchResult && !isSearching && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
              >
                {isEs ? "buscar versículo" : "search verse"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingComplete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingComplete(false)}
              className="absolute inset-0 bg-[rgba(8,11,16,0.6)] backdrop-blur-[3px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-deep-slate p-6 sm:p-8 rounded-[24px] shadow-verso-modal border border-(--line) text-center flex flex-col gap-6 z-10"
            >
              <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 border border-(--rim-gold) flex items-center justify-center text-ember">
                <BrandIcon name="ui-completion" size={24} />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-fraunces text-xl font-medium text-cool-white leading-tight">
                  {isEs ? "¿Marcar este día como completado?" : "Mark this day complete?"}
                </h3>
                <p className="font-hanken text-sm text-cold-grey leading-relaxed">
                  {isEs ? "Solo marca esto como completado si terminaste de memorizar el versículo de hoy." : "Only mark this complete if you finished memorizing today’s verse."}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="earned"
                  className="w-full"
                  onClick={() => {
                    // Snapshot the progress before completing (deep copy)
                    setPrevProgressSnapshot({
                      pathProgress: JSON.parse(JSON.stringify(state.pathProgress)),
                      customPathProgress: JSON.parse(JSON.stringify(state.customPathProgress))
                    });
                    const success = onCompletePathDay();
                    setIsConfirmingComplete(false);
                    if (success) {
                      setShowUndoToast(true);
                    }
                  }}
                >
                  {isEs ? "Marcar hoy completado" : "Mark complete"}
                </Button>
                <Button
                  variant="text"
                  className="w-full"
                  onClick={() => setIsConfirmingComplete(false)}
                >
                  {isEs ? "Cancelar" : "Cancel"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Toast notification */}
      <AnimatePresence>
        {showUndoToast && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-6">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="flex items-center justify-between gap-4 px-5 py-3 bg-deep-slate border border-(--line) rounded-[18px] shadow-verso-modal text-cool-white text-sm font-hanken font-medium"
            >
              <span>{isEs ? "Día marcado como completado." : "Day marked complete."}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (prevProgressSnapshot) {
                      setState(s => ({
                        ...s,
                        pathProgress: prevProgressSnapshot.pathProgress,
                        customPathProgress: prevProgressSnapshot.customPathProgress
                      }));
                    }
                    setShowUndoToast(false);
                    setPrevProgressSnapshot(null);
                  }}
                  className="min-h-11 px-2 text-royal-soft hover:text-cool-white font-semibold uppercase text-xs tracking-widest underline decoration-2 underline-offset-2 shrink-0 transition-colors"
                >
                  {isEs ? "Deshacer" : "Undo"}
                </button>
                <button
                  onClick={() => setShowUndoToast(false)}
                  aria-label={isEs ? "Cerrar" : "Close"}
                  className="flex items-center justify-center min-h-11 min-w-11 -mr-2 rounded-full text-cold-grey hover:text-cool-white shrink-0 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

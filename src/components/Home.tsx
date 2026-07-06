import { motion } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS, Verse, Translation, CustomPath, CustomPathVerse, Path, ShareSnapshot, ShareBlock } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { getVerseText, getFallbackMessage } from "../utils/verseProvider";
import { Globe, Play, Flame, Trophy, Sparkles, Languages, BookOpen, History, AlertCircle, Share2, Star, X, Sprout, Compass, ChevronRight, CheckCircle2, Search, Loader2, Flower2 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, VERSE_LAYOUT, getLocalizedPathDay, formatReferenceForLocale, formatLocalizedReference } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import { AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";
import { PATHS } from "../constants";
import { searchVerse, loadVerseAndMerge } from "../services/bibleService";
import { BIBLE_VERSIONS } from "../services/apiBible";

const ES_TRANSLATIONS = ["RVR1960", "NVI", "NBLA"];
const isEsTranslation = (t: string) => ES_TRANSLATIONS.includes(t);

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

  const handleApplySuggestion = (sug: string) => {
    setSearchQuery(sug);
    setSuggestion(null);
    setLookupError(null);
    setTimeout(() => {
      setIsSearching(true);
      searchVerse(sug, searchTranslation || (isEs ? state.selectedTranslations.es : state.selectedTranslations.en))
        .then((result) => {
          if (result) {
            setSearchResult(result);
            setLookupError(null);
          } else {
            setLookupError(isEs ? "Versículo no encontrado. Prueba 'Juan 3:16'." : "Verse not found. Try 'John 3:16'.");
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
      const translation = searchTranslation || (isEs ? state.selectedTranslations.es : state.selectedTranslations.en);
      const result = await searchVerse(searchQuery, translation as Translation);
      
      if (result) {
        setSearchResult(result);
        setLookupError(null);
      } else {
        setLookupError(isEs ? "Versículo no encontrado. Prueba 'Juan 3:16'." : "Verse not found. Try 'John 3:16'.");
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
      const translation = searchTranslation || (isEs ? state.selectedTranslations.es : state.selectedTranslations.en);
      
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

  const { esText, enText, esError, enError, activePair: validatedPair } = getValidatedVerse(currentVerse, state);
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
  const referenceLangs: ('es' | 'en')[] =
    state.memorizeMode === 'es' ? ['es'] : state.memorizeMode === 'en' ? ['en'] : ['es', 'en'];

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="h-full flex flex-col space-y-12 sm:space-y-14"
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-earth dark:bg-ivory text-white dark:text-earth px-6 py-3 rounded-full font-black text-sm shadow-2xl flex items-center gap-2"
          >
            <Star size={16} fill="currentColor" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Section - Clean and Focused */}
      <div id="home-summary" className="flex justify-between items-center">
        <div className="space-y-1">
          <motion.button 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onGoToSaved}
            className="flex items-center gap-2.5 bg-teal/10 px-4 py-2 rounded-full border border-teal/20 shadow-sm"
          >
            <Sprout size={16} className="text-teal" fill="currentColor" />
            <span className="text-[11px] font-black uppercase tracking-widest text-teal">
              {state.progress.currentStreak} {state.primaryLanguage === 'es' 
                ? (state.progress.currentStreak === 1 ? 'Día' : 'Días') 
                : (state.progress.currentStreak === 1 ? 'Day' : 'Days')}
              <span className="text-amber-500 dark:text-amber-400 ml-1">
                {state.primaryLanguage === 'es' ? 'seguidos' : 'streak'}
              </span>
            </span>
          </motion.button>
        </div>
        <div className="flex flex-col items-end gap-3 relative">
          <motion.button 
            id="translation-pill"
            key={`${esDetail.label}-${enDetail.label}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsQuickSwitchOpen(!isQuickSwitchOpen)}
            className="flex items-center gap-2 bg-playful-purple/10 dark:bg-plum/20 px-4 py-2 rounded-2xl border border-playful-purple/20 dark:border-plum/30 transition-all hover:bg-playful-purple/20 dark:hover:bg-plum/30"
          >
            <Languages size={16} className="text-playful-purple dark:text-plum" />
            <span className="text-xs font-black text-playful-purple dark:text-plum uppercase tracking-widest">
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
                  className="absolute top-full right-0 mt-2 z-50 w-64 bg-white dark:bg-charcoal rounded-3xl shadow-2xl border border-earth/10 dark:border-white/10 p-4 space-y-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                      {state.primaryLanguage === 'es' ? 'Cambio rápido' : 'Quick Switch'}
                    </span>
                    <button onClick={() => setIsQuickSwitchOpen(false)}>
                      <X size={14} className="text-earth-light/40" />
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                    {/* Spanish Options */}
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-playful-purple/60 px-2">
                          {state.primaryLanguage === 'es' ? 'Español' : 'Spanish'}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {['RVR1960', 'NVI', 'NBLA'].map((id) => (
                            <button
                              key={id}
                              onClick={() => { setIsQuickSwitchOpen(false); onChangeTranslation('es', id as Translation); }}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${activePair.es === id ? 'bg-playful-purple/10 text-playful-purple border border-playful-purple/30' : 'hover:bg-playful-purple/10 text-earth/60 dark:text-ivory/60'}`}
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
                        <p className="text-[9px] font-black uppercase tracking-widest text-golden/60 px-2">
                          {state.primaryLanguage === 'es' ? 'Inglés' : 'English'}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {['KJV', 'NIV', 'NASB'].map((id) => (
                            <button
                              key={id}
                              onClick={() => { setIsQuickSwitchOpen(false); onChangeTranslation('en', id as Translation); }}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${activePair.en === id ? 'bg-golden/10 text-golden-dark dark:text-golden border border-golden/30' : 'hover:bg-golden/10 text-earth/60 dark:text-ivory/60'}`}
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
          {/* Paths Section - First priority when active */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-sky-blue" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {isEs ? "Tu serie" : "Your Path"}
                </h2>
              </div>
              <button 
                onClick={() => onGoToPaths()}
                className="text-[10px] font-black uppercase tracking-widest text-teal hover:underline"
              >
                {isEs ? "Ver series" : "View all"}
              </button>
            </div>

            <motion.div
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => onGoToPaths(selectedPath)}
              className="card bg-white dark:bg-charcoal p-6 sm:p-8 shadow-xl border border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer text-left transition-all duration-300 hover:shadow-2xl"
            >
              {/* Path Watermark */}
              <div className="absolute -bottom-10 -right-10 p-12 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-transform duration-700 group-hover:scale-110">
                <Sprout size={180} className="text-teal" />
              </div>

              <div className="relative space-y-6">
                {/* Header Metadata Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-earth/5 dark:border-white/5 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
                      {isCustomPath ? (selectedPath as CustomPath).title : (isEs ? (selectedPath as Path).titleEs : (selectedPath as Path).title)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-500 dark:text-amber-400">
                        {isEs ? `Día ${displayedPathDayNum} de ${pathDuration}` : `Day ${displayedPathDayNum} of ${pathDuration}`}
                      </span>
                    </div>
                  </div>

                  {/* Path Snail Trail */}
                  <div className="flex flex-wrap items-center gap-2 pb-1 shrink-0">
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
                        <div key={i} className="relative flex items-center justify-center w-3 h-3">
                          {isCompleted ? (
                            <Flower2 
                              size={12} 
                              className="text-amber-500 dark:text-amber-400 shrink-0" 
                              strokeWidth={2.5} 
                            />
                          ) : (
                            <>
                              <motion.div 
                                initial={false}
                                animate={{
                                  scale: isActive ? 1.25 : 1,
                                }}
                                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                  isActive 
                                    ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
                                    : "bg-earth/10 dark:bg-white/10"
                                }`}
                              />
                              {isActive && (
                                <motion.div 
                                  className="absolute inset-0 rounded-full bg-amber-500/30"
                                  initial={{ opacity: 0, scale: 1 }}
                                  animate={{ opacity: [0, 0.6, 0], scale: [1, 2.5, 3.5] }}
                                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Body Content Section */}
                {isPathDayComplete ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2.5 text-teal dark:text-teal-400">
                      <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center text-teal dark:text-teal-400">
                        <CheckCircle2 size={16} />
                      </div>
                      <h4 className="text-lg font-serif font-black">
                        {isEs ? "Día completado" : "Day completed"}
                      </h4>
                    </div>
                    <p className="text-sm text-earth-light/70 dark:text-lavender-muted/70 font-medium leading-relaxed">
                      {isEs ? (
                        "Puedes volver mañana o seguir con el siguiente día."
                      ) : (
                        "You can return tomorrow or continue with the next day."
                      )}
                    </p>
                    {nextPathDay && (
                      <button
                        id="next-path-day-btn"
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
                        className="py-2.5 px-5 bg-teal text-white hover:bg-teal-dark dark:bg-teal dark:text-white dark:hover:bg-teal/90 text-xs font-black uppercase tracking-wider rounded-xl inline-flex items-center justify-center gap-2 mt-1 shadow-md hover:bg-opacity-95 select-none active:scale-95 transition-all cursor-pointer"
                      >
                        {isEs ? "siguiente día" : "next day"}
                      </button>
                    )}
                  </div>
                ) : (
                  activePathVerse && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        {(currentPathDay as any)?.title && (
                          <h4 className="text-lg sm:text-xl font-serif font-black text-amber-600 dark:text-amber-400 leading-tight">
                            {(currentPathDay as any).title}
                          </h4>
                        )}
                        {(currentPathDay as any)?.theme && (
                          <p className="text-sm font-serif italic text-earth/70 dark:text-ivory/70 leading-relaxed">
                            {(currentPathDay as any).theme}
                          </p>
                        )}
                      </div>

                      {/* Memorization Verse block */}
                      <div className="p-4 bg-earth/[0.02] dark:bg-white/[0.02] rounded-2xl border border-earth/5 dark:border-white/5 space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 leading-none">
                          {isEs ? "Versículo de memorización:" : "Memory verse:"}
                        </p>
                        <p className="text-base sm:text-lg font-serif italic font-bold text-earth dark:text-ivory leading-snug whitespace-nowrap overflow-x-auto scrollbar-thin">
                          {getLocalizedBookName(activePathVerse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {activePathVerse.chapter}:{activePathVerse.verse}
                        </p>
                      </div>

                      {/* Metadata context section */}
                      {(currentPathDay as any)?.contextPassage && (
                        <div className="flex items-center gap-1.5 text-xs text-earth-light/60 dark:text-lavender-muted/60 bg-teal/[0.02] dark:bg-teal-950/[0.05] border border-teal/5 rounded-xl px-3 py-2 w-max max-w-full">
                          <BookOpen size={13} className="text-teal/70 shrink-0" />
                          <p className="truncate">
                            {isEs ? "Lectura de contexto: " : "Context reading: "}
                            <span className="font-serif italic font-bold text-teal whitespace-nowrap">{formatReferenceForLocale((currentPathDay as any).contextPassage, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (isEs ? 'es' : 'en'))}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Footer Actions Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-earth/5 dark:border-white/5">
                  <div>
                    {isPathDayComplete ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal/10 text-teal rounded-xl font-semibold text-xs border border-teal/20 shadow-sm uppercase tracking-wider">
                        <CheckCircle2 size={14} />
                        <span>{isEs ? "completado" : "completed"}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-earth-light/40 dark:text-lavender-muted/40 uppercase tracking-widest">
                        {isEs ? "Listo para memorizar" : "Ready to memorize"}
                      </p>
                    )}
                  </div>

                  {!isPathDayComplete && (
                    <div className="flex items-center gap-2.5">
                      <button 
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
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-5 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-xl font-black text-xs uppercase tracking-wider border border-teal/20 active:scale-95 transition-all shadow-sm"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span>
                          {currentVerse.id === activePathVerse?.id 
                            ? (isEs ? "ver el versículo" : "view the verse")
                            : (isEs ? "ir al versículo" : "go to verse")}
                        </span>
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsConfirmingComplete(true);
                        }}
                        className="p-2.5 rounded-xl border border-earth/10 dark:border-white/10 text-earth/40 dark:text-white/20 hover:text-teal hover:border-teal/30 hover:bg-teal/5 active:scale-95 transition-all shadow-sm shrink-0"
                        title={isEs ? "marcar como hecho" : "mark as complete"}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Personalized reminders are paused on Home until contextual placement rules are finalized. */}

          {/* Verse of the Day Card - Second priority when path is active */}
          <div className="space-y-6">
            <div className="flex flex-row justify-between items-center px-1 gap-4 w-full">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {state.activeSource === 'path'
                    ? (isEs ? "Versículo de la serie" : "Today's Path Verse")
                    : (isCustomMode
                      ? (isEs ? "Tu propio versículo" : "Custom Verse")
                      : (isVotd 
                        ? (isEs ? "Versículo del día" : "Verse of the Day")
                        : (isEs ? "Versículo extra" : "Extra Verse")))}
                </h2>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 whitespace-nowrap">
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
                  className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline transition-all active:scale-95 whitespace-nowrap"
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
              whileTap={{ scale: 0.99 }}
              className="card bg-white dark:bg-charcoal p-8 sm:p-10 shadow-2xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
            >
              {state.isLoadingAnotherVerse && (
                <div id="another-verse-loader-1" className="absolute inset-0 bg-white/80 dark:bg-charcoal/80 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-200">
                  <Loader2 size={32} className="animate-spin text-playful-purple" />
                  <span className="text-xs font-black uppercase tracking-widest text-earth-light dark:text-lavender-muted">
                    {state.primaryLanguage === 'es' ? "Cargando versículo..." : "Loading verse..."}
                  </span>
                </div>
              )}
              {/* Active Verse Watermark */}
              <div className="absolute -bottom-8 -right-8 p-10 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110">
                <Sparkles size={160} className="text-amber-500" />
              </div>
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <motion.button 
                  id="share-btn-home"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onShareClick}
                  className="p-3 rounded-2xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all border border-earth/5 dark:border-white/5"
                >
                  <Share2 size={18} />
                </motion.button>
              </div>

              <div className="relative space-y-8 sm:space-y-10 focus:outline-none">
                {state.anotherVerseError && (
                  <div id="another-verse-err-1" className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={20} />
                    <p className="text-sm font-bold">{state.anotherVerseError}</p>
                  </div>
                )}
                <div className="space-y-8">
                  {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-playful-purple/80 dark:text-plum/80">
                        {esVerseDetail.name}
                      </span>
                      {esText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {esText}
                        </p>
                      ) : isEsLoading ? (
                        <div className="space-y-2 animate-pulse py-2">
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-5/6" />
                        </div>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{esError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {state.memorizeMode === 'both' && (
                    <div className="h-px w-full bg-earth/10 dark:bg-white/10" />
                  )}

                  {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-golden/80">
                        {enVerseDetail.name}
                      </span>
                      {enText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {enText}
                        </p>
                      ) : isEnLoading ? (
                        <div className="space-y-2 animate-pulse py-2">
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-5/6" />
                        </div>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-6 sm:gap-6 pt-6 border-t border-earth/5 dark:border-white/5">
                  <div className="min-w-0 w-full sm:flex-1 space-y-1 text-center sm:text-left">
                    <h3 className="max-w-full text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight break-words">
                      {formatLocalizedReference(currentVerse.book, currentVerse.chapter, currentVerse.verse, referenceLangs)}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                      {isCustomMode
                        ? (state.primaryLanguage === 'es' ? 'Tu búsqueda' : 'Your search')
                        : (isVotd 
                          ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                          : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse'))}
                    </p>
                  </div>
                    {isCurrentVerseCompleted ? (
                      <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                        <span className="text-sm font-semibold text-teal dark:text-teal-400 font-serif">
                          {state.activeSource === 'path'
                            ? (isEs ? "Día completado." : "Day completed.")
                            : (isEs ? "Completaste el versículo de hoy." : "You completed today’s verse.")}
                        </span>
                        <div className="flex items-center gap-2 py-2 px-5 bg-teal/15 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/30 select-none">
                          <span>✓ {isEs ? "completado" : "completed"}</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        id="memorize-btn-main"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (esText || enText) {
                            onStartMemorizing(currentVerse.id);
                          }
                        }}
                        disabled={!esText && !enText}
                        className={`relative overflow-hidden group shrink-0 w-full sm:w-auto justify-center flex items-center gap-2.5 py-3.5 px-10 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all shadow-sm active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                      >
                        <BookOpen size={16} className="text-teal" />
                        <span className="text-sm sm:text-base tracking-tight lowercase">
                          {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                        </span>
                      </button>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : (
        <>
          {/* Paths Selection Prompt - Consistently at the top */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-sky-blue" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {isEs ? "Tu serie" : "Your Path"}
                </h2>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onGoToPaths()}
              className="w-full card bg-white dark:bg-charcoal p-8 shadow-xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer text-left"
            >
              <div className="relative space-y-4">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                    {isEs ? "Elige una serie" : "Choose a path"}
                  </h3>
                  <p className="text-sm font-medium text-earth-light/70 dark:text-lavender-muted/70">
                    {isEs ? "Empieza un recorrido en la Palabra para este momento." : "Start a Scripture journey for this season."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-teal font-black text-xs uppercase tracking-widest group-hover:gap-3 transition-all">
                  <span>{isEs ? "Elegir una serie" : "Choose a path"}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.button>
          </div>

          {/* Personalized reminders are paused on Home until contextual placement rules are finalized. */}

          {/* Verse of the Day Card - Primary when NO path is active */}
          <div className="space-y-6">
            <div className="flex flex-row justify-between items-center px-1 gap-4 w-full">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {state.activeSource === 'path'
                    ? (isEs ? "Versículo de la serie" : "Today's Path Verse")
                    : (isCustomMode
                      ? (isEs ? "Tu propio versículo" : "Custom Verse")
                      : (isVotd 
                        ? (isEs ? "Versículo del día" : "Verse of the Day")
                        : (isEs ? "Versículo extra" : "Extra Verse")))}
                </h2>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 whitespace-nowrap">
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
                  className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline transition-all active:scale-95 whitespace-nowrap"
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
              whileTap={{ scale: 0.99 }}
              className="card bg-white dark:bg-charcoal p-8 sm:p-10 shadow-2xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
            >
              {state.isLoadingAnotherVerse && (
                <div id="another-verse-loader-2" className="absolute inset-0 bg-white/80 dark:bg-charcoal/80 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-200">
                  <Loader2 size={32} className="animate-spin text-playful-purple" />
                  <span className="text-xs font-black uppercase tracking-widest text-earth-light dark:text-lavender-muted">
                    {state.primaryLanguage === 'es' ? "Cargando versículo..." : "Loading verse..."}
                  </span>
                </div>
              )}
              {/* Active Verse Watermark */}
              <div className="absolute -bottom-8 -right-8 p-10 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110">
                <Sparkles size={160} className="text-amber-500" />
              </div>
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
                <motion.button 
                  id="share-btn-home"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onShareClick}
                  className="p-3 rounded-2xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all border border-earth/5 dark:border-white/5"
                >
                  <Share2 size={18} />
                </motion.button>
              </div>

              <div className="relative space-y-8 sm:space-y-10">
                {state.anotherVerseError && (
                  <div id="another-verse-err-2" className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={20} />
                    <p className="text-sm font-bold">{state.anotherVerseError}</p>
                  </div>
                )}
                <div className="space-y-8">
                  {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-playful-purple/80 dark:text-plum/80">
                        {esVerseDetail.name}
                      </span>
                      {esText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {esText}
                        </p>
                      ) : isEsLoading ? (
                        <div className="space-y-2 animate-pulse py-2">
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-5/6" />
                        </div>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{esError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {state.memorizeMode === 'both' && (
                    <div className="h-px w-full bg-earth/10 dark:bg-white/10" />
                  )}

                  {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-golden/80">
                        {enVerseDetail.name}
                      </span>
                      {enText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {enText}
                        </p>
                      ) : isEnLoading ? (
                        <div className="space-y-2 animate-pulse py-2">
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                          <div className="h-6 bg-earth/10 dark:bg-white/10 rounded-lg w-5/6" />
                        </div>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-6 sm:gap-6 pt-6 border-t border-earth/5 dark:border-white/5">
                  <div className="min-w-0 w-full sm:flex-1 space-y-1 text-center sm:text-left">
                    <h3 className="max-w-full text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight break-words">
                      {formatLocalizedReference(currentVerse.book, currentVerse.chapter, currentVerse.verse, referenceLangs)}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                      {isCustomMode
                        ? (state.primaryLanguage === 'es' ? 'Tu búsqueda' : 'Your search')
                        : (isVotd 
                          ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                          : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse'))}
                    </p>
                  </div>
                    {isCurrentVerseCompleted ? (
                      <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                        <span className="text-sm font-semibold text-teal dark:text-teal-400 font-serif">
                          {state.activeSource === 'path'
                            ? (isEs ? "Día completado de la serie." : "Series day completed.")
                            : (isEs ? "Completaste el versículo de hoy." : "You completed today’s verse.")}
                        </span>
                        <div className="flex items-center gap-2 py-2 px-5 bg-teal/15 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/30 select-none">
                          <span>✓ {isEs ? "completado" : "completed"}</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        id="memorize-btn-main"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (esText || enText) {
                            onStartMemorizing(currentVerse.id);
                          }
                        }}
                        disabled={!esText && !enText}
                        className={`relative overflow-hidden group shrink-0 w-full sm:w-auto justify-center flex items-center gap-2.5 py-3.5 px-10 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all shadow-sm active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                      >
                        <BookOpen size={16} className="text-teal" />
                        <span className="text-sm sm:text-base tracking-tight lowercase">
                          {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                        </span>
                      </button>
                    )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}


      {/* Custom Verse Selection */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center gap-2 px-1">
          <BookOpen size={16} className="text-playful-purple" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
            {isEs ? "ELIGE TU PROPIO VERSÍCULO" : "CHOOSE YOUR OWN VERSE"}
          </h2>
        </div>

        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="card bg-white dark:bg-charcoal p-8 shadow-xl border border-earth/10 dark:border-white/10 relative overflow-hidden group"
        >
          {/* Custom Verse Watermark */}
          <div className="absolute -bottom-6 -right-6 p-8 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-700">
            <BookOpen size={140} className="text-playful-purple" />
          </div>
          
          {/* Subtle Accent Glow */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-playful-purple/30 to-transparent" />
          
          <div className="relative space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">
              {isEs ? "Memoriza tu propio versículo" : "Memorize your own verse"}
            </h3>
            <p className="text-xs sm:text-sm font-medium text-earth-light/70 dark:text-lavender-muted/70">
              {isEs ? "Busca un pasaje y memorízalo hoy." : "Search for a passage and memorize it today."}
            </p>
          </div>

            <div className="space-y-5">
              {/* Translation Selection Pills */}
              <div className="flex flex-wrap gap-2">
                {(isEs ? ['RVR1960', 'NVI', 'NBLA'] : ['KJV', 'NIV', 'NASB']).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSearchTranslation(t as Translation)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                      (searchTranslation === t || (!searchTranslation && (isEs ? state.selectedTranslations.es : state.selectedTranslations.en) === t))
                        ? "bg-playful-purple/10 text-playful-purple border-playful-purple/40"
                        : "bg-earth/5 dark:bg-white/5 text-earth/40 dark:text-ivory/40 border-earth/10 dark:border-white/10 hover:border-playful-purple/30"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-earth-light/40">
                  <Search size={18} />
                </div>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (searchResult) setSearchResult(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={isEs ? "Juan 3:16" : "John 3:16"}
                  className="w-full bg-earth/5 dark:bg-white/5 border border-earth/10 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-earth dark:text-ivory font-bold focus:outline-none focus:ring-2 focus:ring-playful-purple/20 transition-all placeholder:text-earth-light/20 dark:placeholder:text-lavender-muted/20"
                />
                {isSearching && (
                  <div className="absolute inset-y-0 right-4 flex items-center">
                    <Loader2 size={18} className="animate-spin text-playful-purple" />
                  </div>
                )}
              </div>

              {lookupError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-coral/10 border border-coral/20 flex flex-col gap-2 text-[11px] font-bold text-coral"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{lookupError}</span>
                  </div>
                  {suggestion && (
                    <button
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="mt-1 px-3 py-1.5 self-start bg-coral/20 hover:bg-coral/30 border border-coral/30 rounded-lg text-[10px] uppercase tracking-wider text-coral font-black focus:outline-none transition-all cursor-pointer"
                    >
                      {isEs ? `¿Quisiste buscar "${suggestion}"?` : `Did you mean "${suggestion}"?`}
                    </button>
                  )}
                </motion.div>
              )}

              {searchResult && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-2xl bg-playful-purple/5 border border-playful-purple/10 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-lg font-serif font-black text-earth dark:text-ivory">
                        {getLocalizedBookName(searchResult.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {searchResult.chapter}:{searchResult.verse}
                      </h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-playful-purple/60">
                        {isEs ? "Versículo encontrado" : "Verse found"}
                      </p>
                    </div>
                    <button 
                      onClick={() => setSearchResult(null)}
                      className="text-earth-light/40 hover:text-coral transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <button 
                    onClick={onSelectCustomVerse}
                    className="w-full py-4 rounded-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 font-bold text-sm tracking-tight flex items-center justify-center gap-2.5 transition-all shadow-sm border border-teal/20 active:scale-95 lowercase"
                  >
                    <BookOpen size={16} className="text-teal" />
                    <span>{isEs ? "seleccionar versículo" : "select verse"}</span>
                  </button>
                </motion.div>
              )}

              {!searchResult && !isSearching && (
                 <button 
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                  className="w-full py-4 rounded-full bg-earth/5 hover:bg-earth/10 dark:bg-white/5 dark:hover:bg-white/10 text-earth-light/60 dark:text-lavender-muted/60 font-bold text-sm tracking-tight transition-all border border-earth/10 dark:border-white/10 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed lowercase"
                >
                  {isEs ? "buscar versículo" : "search verse"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingComplete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingComplete(false)}
              className="absolute inset-0 bg-espresso/85 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white dark:bg-charcoal p-6 sm:p-8 rounded-[36px] shadow-2xl border border-earth/15 dark:border-white/15 text-center space-y-6 z-10"
            >
              {/* Elegant Icon at Top */}
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <CheckCircle2 size={24} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-serif font-black text-earth dark:text-ivory leading-tight">
                  {isEs ? "¿Marcar este día como completado?" : "Mark this day complete?"}
                </h3>
                <p className="text-sm font-medium text-earth-light/70 dark:text-lavender-muted/70 leading-relaxed">
                  {isEs ? "Solo marca esto como completado si terminaste de memorizar el versículo de hoy." : "Only mark this complete if you finished memorizing today’s verse."}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
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
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl active:scale-98 transition-all shadow-md shadow-amber-500/20"
                >
                  {isEs ? "Marcar hoy completado" : "Mark complete"}
                </button>
                <button
                  onClick={() => setIsConfirmingComplete(false)}
                  className="w-full py-3 hover:bg-earth/5 dark:hover:bg-white/5 text-earth/50 dark:text-ivory/50 font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
                >
                  {isEs ? "Cancelar" : "Cancel"}
                </button>
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
              className="flex items-center justify-between gap-4 px-5 py-4 bg-espresso dark:bg-charcoal border border-earth/20 dark:border-white/10 rounded-2xl shadow-2xl text-white dark:text-ivory text-sm font-semibold"
            >
              <span>{isEs ? "Día marcado como completado." : "Day marked complete."}</span>
              <div className="flex items-center gap-3">
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
                  className="text-amber-500 hover:text-amber-400 font-extrabold uppercase text-xs tracking-widest underline decoration-2 underline-offset-2 shrink-0"
                >
                  {isEs ? "Deshacer" : "Undo"}
                </button>
                <button 
                  onClick={() => setShowUndoToast(false)}
                  className="p-1 hover:bg-white/10 dark:hover:bg-white/5 rounded-full text-white/50 hover:text-white shrink-0 transition-colors"
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

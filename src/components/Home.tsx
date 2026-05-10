import { motion } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS, Verse, Translation } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { getVerseText, getFallbackMessage } from "../utils/verseProvider";
import { Globe, Play, Flame, Trophy, Sparkles, Languages, BookOpen, History, AlertCircle, Share2, Star, X, Sprout, Compass, ChevronRight, CheckCircle2, Search, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, VERSE_LAYOUT } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import { AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";
import { PATHS } from "../constants";
import { searchVerse } from "../services/bibleService";

interface HomeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string) => void;
  onGetAnotherVerse: () => void;
  onGoToSaved: () => void;
  onGoToPaths: () => void;
  onCompletePathDay: () => void;
}

export default function Home({ state, setState, onStartMemorizing, onGetAnotherVerse, onGoToSaved, onGoToPaths, onCompletePathDay }: HomeProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Verse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchTranslation, setSearchTranslation] = useState<Translation | "">("");
  const isEs = state.primaryLanguage === "es";

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setLookupError(isEs ? "Escribe una cita bíblica primero." : "Enter a Bible reference first.");
      setSearchResult(null);
      return;
    }
    
    setIsSearching(true);
    setLookupError(null);
    setSearchResult(null);
    
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
    } catch (e) {
      setLookupError(isEs ? "Error al buscar." : "Error searching.");
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
      
      setState(s => ({ 
        ...s, 
        activeSource: "custom",
        selectedCustomVerse: verseWithMeta,
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

  // Unified Active Verse Logic (Part 5)
  let currentVerse: Verse;
  switch (state.activeSource) {
    case "custom":
      currentVerse = state.selectedCustomVerse || votd;
      break;
    case "path":
    case "extra":
    case "saved":
      currentVerse = (state.selectedVerseId 
        ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || state.customVerses.find(v => v.id === state.selectedVerseId))
        : null) || votd;
      break;
    default:
      currentVerse = votd;
  }

  const isCustomMode = state.activeSource === "custom";
  const isVotd = currentVerse.id === votd.id && !isCustomMode;

  const { esText, enText, esError, enError } = getValidatedVerse(currentVerse, state);

  // Path Logic
  const selectedPath = state.pathProgress.selectedPathId ? PATHS.find(p => p.id === state.pathProgress.selectedPathId) : null;
  const isPathDayComplete = state.pathProgress.pathCompletedToday;
  
  const currentPathDayNum = state.pathProgress.currentDay;
  const nextPathDayNum = currentPathDayNum < (selectedPath?.duration || 0) ? currentPathDayNum + 1 : null;
  
  const currentPathDay = selectedPath ? selectedPath.days[currentPathDayNum - 1] : null;
  const nextPathDay = selectedPath && nextPathDayNum ? selectedPath.days[nextPathDayNum - 1] : null;
  
  const currentPathVerse = currentPathDay ? getVerseText({ reference: currentPathDay.reference }) : null;

  // The UI needs a verse object even if text is missing
  const activePathVerse = currentPathVerse || (currentPathDay ? {
    id: `ref-${currentPathDay.reference}`,
    book: currentPathDay.reference.split(' ').slice(0, -1).join(' '),
    chapter: parseInt(currentPathDay.reference.split(' ').pop()?.split(':')[0] || '0'),
    verse: parseInt(currentPathDay.reference.split(' ').pop()?.split(':')[1] || '0'),
    text: {
       es: { RVR1960: getFallbackMessage('es'), NVI: getFallbackMessage('es'), NBLA: getFallbackMessage('es'), KJV: '', NIV: '', NASB: '' },
       en: { KJV: getFallbackMessage('en'), NIV: getFallbackMessage('en'), NASB: getFallbackMessage('en'), RVR1960: '', NVI: '', NBLA: '' }
    }
  } : null);

  const onShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShareModalOpen(true);
  };

  const onNativeShare = async (elementId?: string) => {
    const title = `Verso: ${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;
    const text = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}\n\n${esText ? `ES: ${esText}\n` : ''}${enText ? `EN: ${enText}` : ''}\n\nShared via Verso`;
    const url = window.location.href;

    await handleShare(title, text, url, (msg) => {
      setToastMessage(msg === "Shared successfully!" ? (state.primaryLanguage === 'es' ? "¡Compartido!" : "Shared!") : (msg === "Copied to clipboard!" ? (state.primaryLanguage === 'es' ? "¡Copiado!" : "Copied!") : msg));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, elementId);
    setIsShareModalOpen(false);
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
        verse={currentVerse}
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
            <span className="text-[11px] font-black uppercase tracking-widest">
              <span className="text-teal">
                {state.progress.currentStreak} {state.primaryLanguage === 'es' 
                  ? (state.progress.currentStreak === 1 ? 'Día' : 'Días') 
                  : (state.progress.currentStreak === 1 ? 'Day' : 'Day')}
              </span>
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
                              onClick={() => {
                                setState(s => ({ 
                                  ...s, 
                                  selectedTranslations: { ...s.selectedTranslations, es: id as any } 
                                }));
                                setIsQuickSwitchOpen(false);
                              }}
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
                              onClick={() => {
                                setState(s => ({ 
                                  ...s, 
                                  selectedTranslations: { ...s.selectedTranslations, en: id as any } 
                                }));
                                setIsQuickSwitchOpen(false);
                              }}
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
                  {isEs ? "Tu camino" : "Your Path"}
                </h2>
              </div>
              <button 
                onClick={onGoToPaths}
                className="text-[10px] font-black uppercase tracking-widest text-teal hover:underline"
              >
                {isEs ? "Ver todos" : "View all"}
              </button>
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="card bg-white dark:bg-charcoal p-6 sm:p-8 shadow-xl border-earth/10 dark:border-white/10 relative overflow-hidden group"
            >
              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex-1 space-y-5">
                    <div className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                        {isEs ? selectedPath.titleEs : selectedPath.title}
                      </h3>
                      <div className="flex flex-col gap-4">
                        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-500 dark:text-amber-400">
                          {isEs ? `Día ${state.pathProgress.currentDay} de ${selectedPath.duration}` : `Day ${state.pathProgress.currentDay} of ${selectedPath.duration}`}
                        </span>
                        
                        {/* Path Snail Trail */}
                        <div className="flex flex-wrap items-center gap-2.5 pb-1">
                          {Array.from({ length: selectedPath.duration }).map((_, i) => {
                            const dayNum = i + 1;
                            const isCompleted = dayNum < state.pathProgress.currentDay;
                            const isActive = dayNum === state.pathProgress.currentDay;
                            
                            return (
                              <div key={i} className="relative flex items-center justify-center">
                                <motion.div 
                                  initial={false}
                                  animate={{
                                    scale: isActive ? 1.25 : 1,
                                  }}
                                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                                    isCompleted 
                                      ? "bg-amber-500/40" 
                                      : isActive 
                                        ? "bg-amber-100 dark:bg-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.5)]" 
                                        : "bg-earth/10 dark:bg-white/10"
                                  }`}
                                />
                                {isActive && (
                                  <motion.div 
                                    className="absolute inset-0 rounded-full bg-amber-200/40"
                                    initial={{ opacity: 0, scale: 1 }}
                                    animate={{ opacity: [0, 0.5, 0], scale: [1, 2.5, 3.5] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                  {isPathDayComplete ? (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xl font-serif font-black text-teal dark:text-teal-400">
                        {isEs ? "Lo hiciste bien hoy." : "You’ve done well today."}
                      </h4>
                      {nextPathDay && (
                        <p className="text-sm text-earth-light/60 dark:text-lavender-muted/60">
                          {isEs ? `Vuelve mañana para ${nextPathDay.reference}.` : `Come back tomorrow for ${nextPathDay.reference}.`}
                        </p>
                      )}
                    </div>
                  ) : (
                    activePathVerse && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/50 dark:text-lavender-muted/50">
                          {isEs ? "Versículo de hoy:" : "Today's verse:"}
                        </p>
                        <p className="text-lg sm:text-xl font-serif italic text-earth dark:text-ivory">
                          {getLocalizedBookName(activePathVerse.book, state.memorizeMode)} {activePathVerse.chapter}:{activePathVerse.verse}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  {isPathDayComplete ? (
                    <div className="flex items-center gap-2 px-6 py-3 bg-teal/10 text-teal rounded-full font-bold text-sm border border-teal/20 shadow-sm">
                      <CheckCircle2 size={16} />
                      <span className="lowercase">{isEs ? "hoy completado" : "today done"}</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        if (activePathVerse) {
                           if (currentVerse.id === activePathVerse.id) {
                             const el = document.getElementById('votd-card');
                             el?.scrollIntoView({ behavior: 'smooth' });
                           } else {
                             setState(s => ({ ...s, selectedVerseId: activePathVerse.id, activeSource: "path" }));
                           }
                        }
                      }}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2.5 py-4 px-8 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all active:scale-95 text-sm tracking-tight shadow-sm"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-100 dark:bg-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                      <span className="lowercase">
                      {currentVerse.id === activePathVerse?.id 
                        ? (isEs ? "ver el versículo" : "view the verse")
                        : (isEs ? "ir al versículo" : "go to verse")}
                      </span>
                    </button>
                  )}
                  
                  {!isPathDayComplete && (
                     <button 
                      onClick={onCompletePathDay}
                      className="p-4 rounded-full border border-earth/10 dark:border-white/10 text-earth/40 hover:text-teal hover:border-teal/30 hover:bg-teal/5 transition-all shadow-sm"
                      title={isEs ? "marcar como hecho" : "mark as complete"}
                    >
                      <CheckCircle2 size={24} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Verse of the Day Card - Second priority when path is active */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {isCustomMode
                    ? (isEs ? "Tu propio versículo" : "Custom Verse")
                    : (currentVerse.id === activePathVerse?.id 
                      ? (isEs ? "Versículo del camino" : "Today's Path Verse")
                      : (isVotd 
                        ? (isEs ? "Versículo del día" : "Verse of the Day")
                        : (isEs ? "Versículo extra" : "Extra Verse")))}
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40">
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
                  className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline transition-all active:scale-95"
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
                <div className="space-y-8">
                  {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-playful-purple/80 dark:text-plum/80">
                        {esDetail.name}
                      </span>
                      {esText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {esText}
                        </p>
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
                        {enDetail.name}
                      </span>
                      {enText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {enText}
                        </p>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 sm:gap-0 pt-6 border-t border-earth/5 dark:border-white/5">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                      {getLocalizedBookName(currentVerse.book, state.memorizeMode)} {currentVerse.chapter}:{currentVerse.verse}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                      {isCustomMode
                        ? (state.primaryLanguage === 'es' ? 'Tu búsqueda' : 'Your search')
                        : (isVotd 
                          ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                          : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse'))}
                    </p>
                  </div>
                    <button 
                      id="memorize-btn-main"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (esText || enText) {
                          onStartMemorizing(currentVerse.id);
                        }
                      }}
                      disabled={!esText && !enText}
                      className={`relative overflow-hidden group flex items-center gap-2.5 py-3.5 px-10 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all shadow-sm active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      <BookOpen size={16} className="text-teal" />
                      <span className="text-sm sm:text-base tracking-tight lowercase">
                        {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                      </span>
                    </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : (
        <>
          {/* Verse of the Day Card - Primary when NO path is active */}
          <div className="space-y-6">
            {/* Same Votd Card code as above */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {isCustomMode
                    ? (isEs ? "Tu propio versículo" : "Custom Verse")
                    : (isVotd 
                      ? (isEs ? "Versículo del día" : "Verse of the Day")
                      : (isEs ? "Versículo extra" : "Extra Verse"))}
                </h2>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40">
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
                  className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline transition-all active:scale-95"
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
                <div className="space-y-8">
                  {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-playful-purple/80 dark:text-plum/80">
                        {esDetail.name}
                      </span>
                      {esText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {esText}
                        </p>
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
                        {enDetail.name}
                      </span>
                      {enText ? (
                        <p className={`text-2xl sm:text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT} tracking-tight`}>
                          {enText}
                        </p>
                      ) : (
                        <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                          <AlertCircle size={20} />
                          <p className="text-sm font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 sm:gap-0 pt-6 border-t border-earth/5 dark:border-white/5">
                  <div className="space-y-1 text-center sm:text-left">
                    <h3 className="text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                      {getLocalizedBookName(currentVerse.book, state.memorizeMode)} {currentVerse.chapter}:{currentVerse.verse}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                      {isCustomMode
                        ? (state.primaryLanguage === 'es' ? 'Tu búsqueda' : 'Your search')
                        : (isVotd 
                          ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                          : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse'))}
                    </p>
                  </div>
                    <button 
                      id="memorize-btn-main"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (esText || enText) {
                          onStartMemorizing(currentVerse.id);
                        }
                      }}
                      disabled={!esText && !enText}
                      className={`relative overflow-hidden group flex items-center gap-2.5 py-3.5 px-10 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all shadow-sm active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      <BookOpen size={16} className="text-teal" />
                      <span className="text-sm sm:text-base tracking-tight lowercase">
                        {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                      </span>
                    </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Paths Selection Prompt - Below Votd when NO active path */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-sky-blue" />
                <h2 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
                  {isEs ? "Tu camino" : "Your Path"}
                </h2>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onGoToPaths}
              className="w-full card bg-white dark:bg-charcoal p-8 shadow-xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer text-left"
            >
              <div className="relative space-y-4">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                    {isEs ? "Elige un camino" : "Choose a path"}
                  </h3>
                  <p className="text-sm font-medium text-earth-light/70 dark:text-lavender-muted/70">
                    {isEs ? "Empieza un recorrido en la Palabra para este momento." : "Start a Scripture journey for this season."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-teal font-black text-xs uppercase tracking-widest group-hover:gap-3 transition-all">
                  <span>{isEs ? "Elegir un camino" : "Choose a path"}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.button>
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
                  className="p-3 rounded-xl bg-coral/10 border border-coral/20 flex items-center gap-2 text-[11px] font-bold text-coral"
                >
                  <AlertCircle size={14} />
                  <span>{lookupError}</span>
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
                        {getLocalizedBookName(searchResult.book, state.memorizeMode)} {searchResult.chapter}:{searchResult.verse}
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

    </motion.div>
  );
}

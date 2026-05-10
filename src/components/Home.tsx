import { motion } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { getVerseText, getFallbackMessage } from "../utils/verseProvider";
import { Globe, Play, Flame, Trophy, Sparkles, Languages, BookOpen, History, AlertCircle, Share2, Star, X, Sprout, Compass, ChevronRight, CheckCircle2 } from "lucide-react";
import React, { useState } from "react";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, VERSE_LAYOUT } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import { AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";
import { PATHS } from "../constants";

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
  const isEs = state.primaryLanguage === "es";

  const activePair = getCurrentTranslationPair(state);
  
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  const today = getLocalDateString();
  const votd = getVerseByDate(today);

  const currentVerse = state.selectedVerseId 
    ? (MOCK_VERSES.find(v => v.id === state.selectedVerseId) || votd)
    : votd;

  const isVotd = currentVerse.id === votd.id;

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
      className="h-full flex flex-col space-y-12"
    >
      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        verse={{
          ...currentVerse,
          textEs: esText,
          textEn: enText
        }}
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
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${activePair.es === id ? 'bg-playful-purple text-white' : 'hover:bg-playful-purple/10 text-earth/60 dark:text-ivory/60'}`}
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
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${activePair.en === id ? 'bg-golden text-white' : 'hover:bg-golden/10 text-earth/60 dark:text-ivory/60'}`}
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

      {/* Verse of the Day Card */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
              {currentVerse.id === activePathVerse?.id 
                ? (isEs ? "Versículo del camino" : "Today's Path Verse")
                : (isVotd 
                  ? (isEs ? "Versículo del día" : "Verse of the Day")
                  : (isEs ? "Versículo extra" : "Extra Verse"))}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40">
              {state.primaryLanguage === 'es' ? '1 versículo al día' : '1 verse a day'}
            </span>
            {!isVotd && (
              <button 
                onClick={() => setState(s => ({ ...s, selectedVerseId: null }))}
                className="text-[10px] font-black uppercase tracking-widest text-playful-purple hover:underline"
              >
                {state.primaryLanguage === 'es' ? 'Volver al diario' : 'Back to Daily'}
              </button>
            )}
          </div>
        </div>
        
        <motion.div 
          id="votd-card"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="card bg-white dark:bg-charcoal p-10 shadow-2xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer"
        >
          {/* Repositioned Share Button - Top Right */}
          <div className="absolute top-6 right-6 z-20">
            <motion.button 
              id="share-btn-home"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onShareClick}
              className="p-3 rounded-2xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all border border-earth/5 dark:border-white/5"
            >
              <Share2 size={20} />
            </motion.button>
          </div>

          <div className="relative space-y-10">
            <div className="space-y-8">
              {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-playful-purple/80 dark:text-plum/80">
                    {esDetail.name}
                  </span>
                  {esText ? (
                    <p className={`text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT}`}>
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
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-golden/80">
                    {enDetail.name}
                  </span>
                  {enText ? (
                    <p className={`text-3xl font-serif leading-relaxed text-earth dark:text-ivory ${VERSE_LAYOUT.FONT_WEIGHT}`}>
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
                  {isVotd 
                    ? (state.primaryLanguage === 'es' ? 'Agregado hoy' : 'Added today')
                    : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra verse')}
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
                  className={`relative overflow-hidden group flex items-center gap-2.5 py-3 px-10 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all shadow-sm active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  <BookOpen size={16} />
                  <span className="text-sm sm:text-base tracking-tight lowercase">
                    {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                  </span>
                </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Secondary Action - Another Verse */}
      <div className="flex justify-center pt-4">
        <button 
          onClick={onGetAnotherVerse}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/50 dark:bg-charcoal/50 border border-earth/10 dark:border-white/10 hover:bg-white dark:hover:bg-charcoal transition-all group"
        >
          <History size={16} className="text-earth-light/60 dark:text-lavender-muted/60 group-hover:text-playful-purple transition-colors" />
          <span className="text-xs font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60 group-hover:text-playful-purple transition-colors">
            {state.primaryLanguage === 'es' ? 'Otro versículo' : 'Another verse'}
          </span>
        </button>
      </div>

      {/* Paths Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-sky-blue" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
              {isEs ? "Tu camino" : "Your Path"}
            </h2>
          </div>
          {selectedPath && (
            <button 
              onClick={onGoToPaths}
              className="text-[10px] font-black uppercase tracking-widest text-teal hover:underline"
            >
              {isEs ? "Ver todos" : "View all"}
            </button>
          )}
        </div>

        {!selectedPath ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onGoToPaths}
            className="w-full card bg-white dark:bg-charcoal p-8 shadow-xl border-earth/10 dark:border-white/10 relative overflow-hidden group cursor-pointer text-left"
          >
            <div className="relative space-y-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
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
        ) : (
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="card bg-white dark:bg-charcoal p-8 shadow-xl border-earth/10 dark:border-white/10 relative overflow-hidden group"
          >
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-serif font-black text-earth dark:text-ivory">
                      {isEs ? selectedPath.titleEs : selectedPath.title}
                    </h3>
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 dark:text-amber-400">
                        {isEs ? `Día ${state.pathProgress.currentDay} de ${selectedPath.duration}` : `Day ${state.pathProgress.currentDay} of ${selectedPath.duration}`}
                      </span>
                      
                      {/* Path Snail Trail */}
                      <div className="flex flex-wrap items-center gap-2 pb-1">
                        {Array.from({ length: selectedPath.duration }).map((_, i) => {
                          const dayNum = i + 1;
                          const isCompleted = dayNum < state.pathProgress.currentDay;
                          const isActive = dayNum === state.pathProgress.currentDay;
                          
                          return (
                            <div key={i} className="relative flex items-center justify-center">
                              <motion.div 
                                initial={false}
                                animate={{
                                  scale: isActive ? 1.2 : 1,
                                }}
                                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                  isCompleted 
                                    ? "bg-amber-500/40" 
                                    : isActive 
                                      ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" 
                                      : "bg-earth/10 dark:bg-white/10"
                                }`}
                              />
                              {isActive && (
                                <motion.div 
                                  className="absolute inset-0 rounded-full bg-amber-500/40"
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
                  <div className="space-y-2">
                    <h4 className="text-lg font-serif font-black text-teal dark:text-teal-400">
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
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/50 dark:text-lavender-muted/50">
                        {isEs ? "Versículo de hoy:" : "Today's verse:"}
                      </p>
                      <p className="text-lg font-serif italic text-earth dark:text-ivory">
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
                           // Already viewing, just scroll to it
                           const el = document.getElementById('votd-card');
                           el?.scrollIntoView({ behavior: 'smooth' });
                         } else {
                           // Set as active verse and scroll
                           setState(s => ({ ...s, selectedVerseId: activePathVerse.id }));
                         }
                      }
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2.5 py-3 px-8 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-full font-bold border border-teal/20 transition-all active:scale-95 text-sm tracking-tight shadow-sm"
                  >
                    <BookOpen size={16} />
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
                    className="p-3 rounded-full border border-earth/10 dark:border-white/10 text-earth/40 hover:text-teal hover:border-teal/30 hover:bg-teal/5 transition-all shadow-sm"
                    title={isEs ? "marcar como hecho" : "mark as complete"}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>


    </motion.div>
  );
}

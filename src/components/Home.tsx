import { motion } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { MOCK_VERSES, getVerseByDate } from "../constants";
import { Globe, Play, Flame, Trophy, Sparkles, Languages, BookOpen, History, AlertCircle, Share2, Star, X } from "lucide-react";
import React, { useState } from "react";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName, getLocalDateString, VERSE_LAYOUT } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import { AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";

interface HomeProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string) => void;
  onGetAnotherVerse: () => void;
}

export default function Home({ state, setState, onStartMemorizing, onGetAnotherVerse }: HomeProps) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
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
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 bg-coral/10 px-3 py-1.5 rounded-full border border-coral/20"
          >
            <Flame size={14} className="text-coral" fill="currentColor" />
            <span className="text-[10px] font-black text-coral uppercase tracking-widest">
              {state.progress.currentStreak} {state.primaryLanguage === 'es' ? 'Días seguidos' : 'Day streak'}
            </span>
          </motion.div>
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
            <Sparkles size={16} className="text-golden" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-earth-light dark:text-lavender-muted">
              {isVotd 
                ? (state.primaryLanguage === 'es' ? 'Versículo del día' : 'Verse of the Day')
                : (state.primaryLanguage === 'es' ? 'Versículo extra' : 'Extra Verse')}
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
                  className={`relative overflow-hidden group flex items-center gap-2.5 py-2 px-6 sm:py-3.5 sm:px-8 bg-playful-purple dark:bg-plum text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-playful-purple/30 active:scale-95 ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 relative z-10">
                    <Play size={14} fill="currentColor" className="sm:w-[18px] sm:h-[18px]" />
                    <span className="text-sm sm:text-base tracking-tight lowercase">
                      {state.primaryLanguage === 'es' ? 'memorizar' : 'memorize'}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
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
    </motion.div>
  );
}

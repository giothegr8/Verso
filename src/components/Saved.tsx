import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS } from "../types";
import { Bookmark, Share2, Trash2, BookOpen, Search, Languages, Star, Heart, AlertCircle, X, Sprout, Sparkles } from "lucide-react";
import { MOCK_VERSES } from "../constants";
import React, { useState } from "react";
import { handleShare } from "../utils/shareUtils";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName } from "../utils/verseUtils";
import ShareModal from "./ShareModal";

interface SavedProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string) => void;
}

export default function Saved({ state, setState, onStartMemorizing }: SavedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedVerseForShare, setSelectedVerseForShare] = useState<any>(null);
  const activePair = getCurrentTranslationPair(state);
  
  // For demo, we'll show some from MOCK_VERSES if savedVerses is empty
  const savedList = state.savedVerses.length > 0 
    ? MOCK_VERSES.filter(v => state.savedVerses.includes(v.id))
    : MOCK_VERSES.slice(0, 2);

  const filteredList = savedList.filter(v => {
    const { esText, enText } = getValidatedVerse(v, state);
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const bookParts = v.book.toLowerCase().split(' / ');
    const esBook = bookParts[0];
    const enBook = bookParts[1] || esBook;
    
    const citationEs = `${esBook} ${v.chapter}:${v.verse}`.toLowerCase();
    const citationEn = `${enBook} ${v.chapter}:${v.verse}`.toLowerCase();
    const shortCitation = `${v.chapter}:${v.verse}`.toLowerCase();
    const chapterOnly = `${esBook} ${v.chapter}`.toLowerCase();
    const chapterOnlyEn = `${enBook} ${v.chapter}`.toLowerCase();
    
    return esBook.includes(query) ||
           enBook.includes(query) ||
           String(v.chapter) === query ||
           String(v.verse) === query ||
           citationEs.includes(query) ||
           citationEn.includes(query) ||
           shortCitation.includes(query) ||
           chapterOnly.includes(query) ||
           chapterOnlyEn.includes(query) ||
           (esText || "").toLowerCase().includes(query) ||
           (enText || "").toLowerCase().includes(query);
  });

  const removeSaved = (id: string) => {
    setState(s => ({
      ...s,
      savedVerses: s.savedVerses.filter(vid => vid !== id)
    }));
  };

  const onShareClick = (verse: any) => {
    setSelectedVerseForShare(verse);
    setIsShareModalOpen(true);
  };

  const onNativeShare = async (elementId?: string) => {
    if (!selectedVerseForShare) return;
    const { esText, enText } = getValidatedVerse(selectedVerseForShare, state);
    const title = `Verso: ${selectedVerseForShare.book} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}`;
    const text = `${selectedVerseForShare.book} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}\n\n${esText ? `ES: ${esText}\n` : ''}${enText ? `EN: ${enText}` : ''}\n\nShared via Verso`;
    const url = window.location.href;

    await handleShare(title, text, url, (msg) => {
      setToastMessage(msg === "Shared successfully!" ? (state.primaryLanguage === 'es' ? "¡Compartido!" : "Shared!") : (msg === "Copied to clipboard!" ? (state.primaryLanguage === 'es' ? "¡Copiado!" : "Copied!") : msg));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, elementId);
    setIsShareModalOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        verse={selectedVerseForShare ? {
          ...selectedVerseForShare,
          textEs: getValidatedVerse(selectedVerseForShare, state).esText,
          textEn: getValidatedVerse(selectedVerseForShare, state).enText
        } : null}
        state={state}
        onNativeShare={onNativeShare}
      />
      <div className="space-y-4">
        <div className="text-center sm:text-left">
          <h2 className="text-5xl sm:text-6xl font-serif font-black text-earth dark:text-ivory tracking-tighter">
            {state.primaryLanguage === 'es' ? 'Arraigados' : 'Rooted'}
          </h2>
          <div className="space-y-0.5 mt-1">
            <p className="text-base font-medium text-teal/80 dark:text-teal/60">
              {state.primaryLanguage === 'es' 
                ? 'Versículos guardados, sembrados en tu corazón.' 
                : 'Saved verses, planted in your heart.'}
            </p>
            <p className="text-lg font-serif font-semibold text-amber-600 dark:text-golden">
              {state.primaryLanguage === 'es' ? 'Dios da el crecimiento' : 'God gives the growth'}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Streak Card - Centered and Impactful */}
      <div className="flex justify-center">
        <div className="w-full max-w-sm card p-8 bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 shadow-xl flex flex-col items-center text-center space-y-3 ring-1 ring-teal/5">
          <span className="text-6xl font-serif font-black text-teal dark:text-teal/70">
            {state.progress.currentStreak}
          </span>
          <div className="flex flex-col items-center">
            <span className="text-xs font-black uppercase tracking-widest text-teal/70 dark:text-teal/50">
              {state.primaryLanguage === 'es' 
                ? (state.progress.currentStreak === 1 ? '1 día seguido' : `${state.progress.currentStreak} días seguidos`)
                : (state.progress.currentStreak === 1 ? '1-day streak' : `${state.progress.currentStreak}-day streak`)}
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/60 dark:text-golden/40 mt-2">
              {state.primaryLanguage === 'es' ? 'Arraigados en Su Palabra' : 'Rooted in His Word'}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-earth/40 dark:text-lavender-muted/60" size={18} />
        <input 
          type="text"
          placeholder={state.primaryLanguage === 'es' ? "Buscar versículos..." : "Search verses..."}
          className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white dark:bg-charcoal border-2 border-earth/10 dark:border-white/10 focus:border-playful-purple dark:focus:border-plum outline-none transition-all font-medium text-earth dark:text-ivory placeholder:text-earth/40 dark:placeholder:text-lavender-muted/60 shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
        />
      </div>

      {/* List */}
      <div className="space-y-6">
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

        <AnimatePresence mode="popLayout">
          {filteredList.map((verse, idx) => {
            const { esText, enText, esError, enError } = getValidatedVerse(verse, state);
            const isMemorized = state.progress.completedVerses.includes(verse.id);
            const memorizationStage = state.progress.verseStages?.[verse.id] || 0;
            
            let growthLabel = "";
            let growthIcon = null;
            let growthColorClass = "";

            if (isMemorized) {
              growthLabel = state.primaryLanguage === 'es' ? 'Dando fruto' : 'Bearing Fruit';
              growthIcon = <Sparkles size={10} className="text-amber-500" fill="currentColor" />;
              growthColorClass = "bg-earth/80 dark:bg-charcoal text-ivory/90 dark:text-white/90 border-earth/20 dark:border-white/10 shadow-sm ring-1 ring-amber-500/20";
            } else if (memorizationStage > 0) {
              growthLabel = state.primaryLanguage === 'es' ? 'Echando raíces' : 'Taking Root';
              growthIcon = <div className="w-1.5 h-1.5 rounded-full bg-playful-purple" />;
              growthColorClass = "bg-playful-purple/10 text-playful-purple border-playful-purple/20";
            } else {
              growthLabel = state.primaryLanguage === 'es' ? 'Semilla sembrada' : 'Seed Planted';
              growthIcon = <div className="w-1.5 h-1.5 rounded-full bg-golden" />;
              growthColorClass = "bg-golden/10 text-golden border-golden/20";
            }

            return (
              <motion.div 
                key={verse.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className="card p-6 space-y-4 border border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal shadow-lg relative overflow-hidden group"
              >
                <div className="absolute top-3 left-6">
                  <div className={`${growthColorClass} px-2 py-1 rounded-lg flex items-center gap-1.5 border shadow-sm`}>
                    {growthIcon}
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {growthLabel}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-start relative z-10 pt-6">
                  <div className="space-y-1 flex items-start gap-3">
                    <motion.div
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.05, 1] 
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="mt-1 text-teal"
                    >
                      <Sprout size={20} />
                    </motion.div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                        {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
                      </h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onShareClick(verse)}
                      className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all ring-1 ring-teal/20"
                    >
                      <Share2 size={18} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeSaved(verse.id)}
                      className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-coral hover:bg-coral/10 transition-all"
                    >
                      <Trash2 size={18} />
                    </motion.button>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-playful-purple/60 dark:text-plum/60 bg-playful-purple/5 dark:bg-plum/5 px-2 py-0.5 rounded border border-playful-purple/10 dark:border-plum/10">
                          {activePair.es}
                        </span>
                      </div>
                      {esText ? (
                        <p className="text-xl font-serif leading-relaxed text-earth dark:text-ivory font-black">
                          {esText}
                        </p>
                      ) : (
                        <div className="p-3 bg-coral/10 rounded-xl flex items-center gap-2 text-coral border border-coral/20">
                          <AlertCircle size={16} />
                          <p className="text-[10px] font-bold">{esError}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-golden/60 dark:text-gold/60 bg-golden/5 dark:bg-gold/5 px-2 py-0.5 rounded border border-golden/10 dark:border-gold/10">
                          {activePair.en}
                        </span>
                      </div>
                      {enText ? (
                        <p className="text-lg font-serif leading-relaxed text-earth/80 dark:text-lavender-muted border-l-4 border-playful-purple/30 dark:border-plum/40 pl-4 bg-playful-purple/5 dark:bg-plum/5 py-3 rounded-r-xl font-medium">
                          {enText}
                        </p>
                      ) : (
                        <div className="p-3 bg-coral/10 rounded-xl flex items-center gap-2 text-coral border border-coral/20">
                          <AlertCircle size={16} />
                          <p className="text-[10px] font-bold">{enError}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <motion.button 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (esText || enText) {
                      onStartMemorizing(verse.id);
                    }
                  }}
                  disabled={!esText && !enText}
                  className={`w-full py-4 rounded-2xl bg-playful-purple dark:bg-plum text-white font-bold text-sm tracking-tight flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-playful-purple/20 ring-1 ring-teal/30 lowercase ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  <BookOpen size={16} />
                  <span>{state.primaryLanguage === 'es' ? 'memorizar ahora' : 'memorize now'}</span>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredList.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center space-y-6"
          >
            <div className="relative w-32 h-32 mx-auto">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-full h-full bg-playful-purple/10 dark:bg-plum/10 rounded-[40px] flex items-center justify-center"
              >
                <Bookmark size={64} className="text-playful-purple dark:text-plum" fill="currentColor" />
              </motion.div>
              <motion.div
                className="absolute -top-2 -right-2"
              >
                <Star size={32} className="text-golden" fill="currentColor" />
              </motion.div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                {state.primaryLanguage === 'es' ? 'Sin versículos guardados' : 'No saved verses'}
              </h3>
              <p className="text-earth-light dark:text-lavender-muted max-w-xs mx-auto">
                {state.primaryLanguage === 'es' 
                  ? 'Guarda tus versículos favoritos para verlos aquí.' 
                  : 'Save your favorite verses to see them here.'}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS, ActiveVerseSource } from "../types";
import { Bookmark, Share2, Trash2, BookOpen, Search, Languages, Star, Heart, AlertCircle, X, Flower2, Sparkles, Compass } from "lucide-react";
import { MOCK_VERSES, PATHS } from "../constants";
import React, { useState } from "react";
import { handleShare } from "../utils/shareUtils";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName } from "../utils/verseUtils";
import ShareModal from "./ShareModal";

interface SavedProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string, source?: ActiveVerseSource) => void;
}

export default function Saved({ state, setState, onStartMemorizing }: SavedProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedVerseForShare, setSelectedVerseForShare] = useState<any>(null);
  const activePair = getCurrentTranslationPair(state);
  
  const allAvailableVerses = Array.from(
    new Map(
      [...MOCK_VERSES, ...state.customVerses].map(v => [v.id, v])
    ).values()
  );
  
  // For demo, we'll show some from MOCK_VERSES if savedVerses is empty
  const savedList = state.savedVerses.length > 0 
    ? allAvailableVerses.filter(v => state.savedVerses.includes(v.id))
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
    const locBook = getLocalizedBookName(selectedVerseForShare.book, state.primaryLanguage === 'es' ? 'es' : 'en');
    const title = `Verso: ${locBook} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}`;
    const text = `${locBook} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}\n\n${esText ? `ES: ${esText}\n` : ''}${enText ? `EN: ${enText}` : ''}\n\nShared via Verso`;
    const url = window.location.href;

    await handleShare(title, text, url, (msg) => {
      setToastMessage(msg === "Shared successfully!" ? (state.primaryLanguage === 'es' ? "¡Compartido!" : "Shared!") : (msg === "Copied to clipboard!" ? (state.primaryLanguage === 'es' ? "¡Copiado!" : "Copied!") : msg));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, elementId);
    setIsShareModalOpen(false);
  };

  return (
    <div id="saved-content" className="space-y-8">
      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        verse={selectedVerseForShare}
        state={state}
        onNativeShare={onNativeShare}
      />
      <div className="space-y-6 pt-2">
        <div className="text-center">
          <h2 className="text-4xl sm:text-7xl font-serif font-black text-earth dark:text-ivory tracking-tighter text-center">
            {state.primaryLanguage === 'es' ? 'La Cosecha' : 'The Harvest'}
          </h2>
          <div className="mt-3 space-y-3">
            <div className="text-sm sm:text-base font-medium text-teal/80 dark:text-teal/60 max-w-sm mx-auto leading-relaxed">
              {state.primaryLanguage === 'es' ? (
                <>
                  <p>Versículos guardados, sembrados</p>
                  <p>en tu corazón.</p>
                </>
              ) : (
                <p>Saved verses, planted in your heart.</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-earth/10 dark:bg-white/10" />
              <div className="flex items-center text-xl sm:text-2xl font-script text-earth/90 dark:text-ivory/90">
                <span className="text-coral mr-2">
                  {state.primaryLanguage === 'es' ? 'Dios' : 'God'}
                </span>
                <span>
                  {state.primaryLanguage === 'es' ? 'da el crecimiento' : 'gives the growth'}
                </span>
              </div>
              <div className="h-px w-8 bg-earth/10 dark:bg-white/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-sm card p-10 bg-white dark:bg-charcoal border-2 border-teal/10 dark:border-white/5 shadow-[0_0_40px_rgba(20,184,166,0.08)] flex flex-col items-center text-center space-y-4 ring-1 ring-teal/20 dark:ring-teal/10 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />

          <span className="text-7xl font-serif font-black text-earth dark:text-white drop-shadow-[0_2px_15px_rgba(0,0,0,0.15)] relative z-10 transition-colors">
            {state.progress.currentStreak}
          </span>
          <div className="flex flex-col items-center relative z-10">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-earth/5 dark:bg-white/5 rounded-full border border-earth/10 dark:border-white/10">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-earth-light/80 dark:text-white transition-colors">
                {state.primaryLanguage === 'es' 
                  ? (state.progress.currentStreak === 1 ? '1 día' : `${state.progress.currentStreak} días`)
                  : (state.progress.currentStreak === 1 ? '1-day' : `${state.progress.currentStreak}-day`)}
              </span>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 dark:text-amber-400">
                {state.primaryLanguage === 'es' ? 'seguidos' : 'streak'}
              </span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
              <span className="text-teal dark:text-teal-400">
                {state.primaryLanguage === 'es' ? 'ARRAIGADOS' : 'ROOTED'}
              </span>
              <span className="text-earth dark:text-white">
                {state.primaryLanguage === 'es' ? 'EN SU PALABRA' : 'IN HIS WORD'}
              </span>
            </div>
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
              growthIcon = <Sparkles size={10} className="text-amber-500 dark:text-amber-400" fill="currentColor" />;
              growthColorClass = "bg-earth/90 dark:bg-charcoal text-ivory/90 dark:text-white/90 border-earth/20 dark:border-white/10 shadow-sm ring-1 ring-amber-500/20";
            } else if (memorizationStage > 0) {
              growthLabel = state.primaryLanguage === 'es' ? 'Echando raíces' : 'Taking Root';
              growthIcon = <div className="w-1.5 h-1.5 rounded-full bg-teal" />;
              growthColorClass = "bg-teal/10 text-teal border-teal/20";
            } else {
              growthLabel = state.primaryLanguage === 'es' ? 'Semilla sembrada' : 'Seed Planted';
              growthIcon = <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />;
              growthColorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20";
            }

            const getSourceInfo = (verseId: string) => {
              const isEs = state.primaryLanguage === 'es';
              
              const vObj = allAvailableVerses.find(v => v.id === verseId);
              if (!vObj) return { label: isEs ? 'versículo' : 'verse', icon: <Compass size={10} /> };

              for (const path of PATHS) {
                if (path.verses.includes(verseId)) {
                  return { 
                    label: isEs ? path.titleEs.toLowerCase() : path.title.toLowerCase(), 
                    icon: <Compass size={10} className="text-sky-blue" /> 
                  };
                }
                
                const hasMatch = path.days.some(day => {
                  const normRef = day.reference.toLowerCase();
                  const bookParts = vObj.book.toLowerCase().split("/");
                  const matchBook = bookParts.some(p => normRef.includes(p.trim()));
                  const matchNum = normRef.includes(`${vObj.chapter}:${vObj.verse}`);
                  return matchBook && matchNum;
                });
                
                if (hasMatch) {
                  return { 
                    label: isEs ? path.titleEs.toLowerCase() : path.title.toLowerCase(), 
                    icon: <Compass size={10} className="text-sky-blue" /> 
                  };
                }
              }

              if (vObj.source === "custom") {
                return {
                  label: isEs ? 'tu búsqueda' : 'your search',
                  icon: <Search size={10} className="text-playful-purple" />
                };
              }

              return { 
                label: isEs ? 'versículo del día' : 'daily verse', 
                icon: <Sparkles size={10} className="text-amber-500" /> 
              };
            };

            const sourceInfo = getSourceInfo(verse.id);

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
                  <div className="bg-earth/5 dark:bg-white/5 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-earth/10 dark:border-white/10 shadow-sm transition-colors group-hover:bg-earth/10 dark:group-hover:bg-white/10">
                    {sourceInfo.icon}
                    <span className="text-[9px] font-black uppercase tracking-widest text-earth/60 dark:text-ivory/60">
                      {sourceInfo.label}
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
                      className="mt-1 text-amber-500 dark:text-amber-400"
                    >
                      <Flower2 size={20} />
                    </motion.div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight whitespace-nowrap">
                        {getLocalizedBookName(verse.book, state.primaryLanguage === 'es' ? 'es' : 'en')} {verse.chapter}:{verse.verse}
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
                      onStartMemorizing(verse.id, "saved");
                    }
                  }}
                  disabled={!esText && !enText}
                  className={`w-full py-4 rounded-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 font-bold text-sm tracking-tight flex items-center justify-center gap-2.5 transition-all shadow-sm border border-teal/20 lowercase ${(!esText && !enText) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
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
                <Star size={32} className="text-amber-500 dark:text-amber-400" fill="currentColor" />
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

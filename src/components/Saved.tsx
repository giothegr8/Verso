import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, TRANSLATION_DETAILS, ActiveVerseSource, Translation } from "../types";
import { Bookmark, Share2, Trash2, BookOpen, Search, Languages, Star, Heart, AlertCircle, X, Flower2, Sparkles, Compass, Sprout, Grape } from "lucide-react";
import { MOCK_VERSES, PATHS } from "../constants";
import React, { useState } from "react";
import { handleShare } from "../utils/shareUtils";
import { getCurrentTranslationPair, getValidatedVerse, getLocalizedBookName } from "../utils/verseUtils";
import ShareModal from "./ShareModal";

interface SavedProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onStartMemorizing: (verseId: string, source?: ActiveVerseSource) => void;
  onGoToFlashcards?: (verseId: string) => void;
}

export default function Saved({ state, setState, onStartMemorizing, onGoToFlashcards }: SavedProps) {
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

  const normalizeText = (str: string): string => {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.;]/g, ":")
      .replace(/\s+/g, " ")
      .trim();
  };

  const filteredList = savedList.filter(v => {
    const { esText, enText } = getValidatedVerse(v, state);
    const query = normalizeText(searchQuery);
    if (!query) return true;

    const bookParts = v.book.split(' / ');
    const esBook = bookParts[0] || "";
    const enBook = bookParts[1] || esBook;
    
    const esBookNorm = normalizeText(esBook);
    const enBookNorm = normalizeText(enBook);
    
    const citationEs = normalizeText(`${esBook} ${v.chapter}:${v.verse}`);
    const citationEn = normalizeText(`${enBook} ${v.chapter}:${v.verse}`);
    const shortCitation = `${v.chapter}:${v.verse}`;
    const chapterOnly = normalizeText(`${esBook} ${v.chapter}`);
    const chapterOnlyEn = normalizeText(`${enBook} ${v.chapter}`);
    const verseTextEsNorm = normalizeText(esText || "");
    const verseTextEnNorm = normalizeText(enText || "");
    
    return esBookNorm.includes(query) ||
           enBookNorm.includes(query) ||
           String(v.chapter) === query ||
           String(v.verse) === query ||
           citationEs.includes(query) ||
           citationEn.includes(query) ||
           shortCitation.includes(query) ||
           chapterOnly.includes(query) ||
           chapterOnlyEn.includes(query) ||
           verseTextEsNorm.includes(query) ||
           verseTextEnNorm.includes(query);
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

  const onNativeShare = async (elementId?: string, filename?: string) => {
    if (!selectedVerseForShare) return;
    const { esText, enText } = getValidatedVerse(selectedVerseForShare, state);
    const locBook = getLocalizedBookName(selectedVerseForShare.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'));
    const title = `Verso: ${locBook} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}`;
    const text = `${locBook} ${selectedVerseForShare.chapter}:${selectedVerseForShare.verse}\n\n${esText ? `ES: ${esText}\n` : ''}${enText ? `EN: ${enText}` : ''}\n\nShared via Verso`;
    const url = window.location.href;

    await handleShare(title, text, url, (msg) => {
      setToastMessage(msg === "Shared successfully!" ? (state.primaryLanguage === 'es' ? "¡Compartido!" : "Shared!") : (msg === "Copied to clipboard!" ? (state.primaryLanguage === 'es' ? "¡Copiado!" : "Copied!") : msg));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, elementId, filename);
    setIsShareModalOpen(false);
  };

  const inProgressList = filteredList.filter(v => !state.progress.completedVerses.includes(v.id));
  const completedList = filteredList.filter(v => state.progress.completedVerses.includes(v.id));

  const renderVerseCard = (verse: any, idx: number) => {
    const { esText, enText, esError, enError, activePair: validatedPair } = getValidatedVerse(verse, state);
    const esTransToUse = validatedPair?.es || activePair.es;
    const enTransToUse = validatedPair?.en || activePair.en;
    const isEsLoading = !!(state.loadingTranslations && state.loadingTranslations[`${verse.id}_${esTransToUse}`]);
    const isEnLoading = !!(state.loadingTranslations && state.loadingTranslations[`${verse.id}_${enTransToUse}`]);
    const isMemorized = state.progress.completedVerses.includes(verse.id);
    const memorizationStage = state.progress.verseStages?.[verse.id] || 0;

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

    const completionCounts = state.progress.completionCounts || {};
    const count = completionCounts[verse.id] !== undefined ? completionCounts[verse.id] : (isMemorized ? 1 : 0);

    // Per-language / per-translation completion history (begins from the newer
    // implementation; older records have none). "Both Languages" is true only
    // when there is at least one genuine English AND one genuine Spanish
    // completion in the stored history.
    const langCounts = state.progress.completionsByLanguage?.[verse.id];
    const transCounts = state.progress.completionsByTranslation?.[verse.id];
    const enCount = langCounts?.en || 0;
    const esCount = langCounts?.es || 0;
    const isBothLanguages = enCount >= 1 && esCount >= 1;
    const transEntries = transCounts
      ? (Object.entries(transCounts) as [Translation, number][]).filter(([, n]) => n > 0)
      : [];
    const hasBreakdown = enCount > 0 || esCount > 0 || transEntries.length > 0;

    const badgeText = count === 0
      ? (state.primaryLanguage === 'es' ? 'En Progreso' : 'In Progress')
      : count === 1
        ? (state.primaryLanguage === 'es' ? 'Floreció' : 'Bloomed')
        : (state.primaryLanguage === 'es' ? 'Dio fruto' : 'Bore fruit');

    const badgeClasses = count === 0
      ? 'bg-teal/10 dark:bg-teal/25 text-teal dark:text-teal-300 border-teal/20'
      : count === 1
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.15)]';

    const isActiveInProgress = !!(state.activeAttempt && state.activeAttempt.verseId === verse.id);
    const isUnfinishedCitationPending = memorizationStage === 6 && !isMemorized;
    const shouldBlur = isActiveInProgress || isUnfinishedCitationPending;

    return (
      <motion.div 
        key={verse.id}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ scale: 1.01, y: -2 }}
        className="card p-6 space-y-4 border border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal shadow-lg relative overflow-hidden group"
      >
        <div className="absolute top-3 left-6 flex items-center gap-2">
          <div className="bg-earth/5 dark:bg-white/5 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-earth/10 dark:border-white/10 shadow-sm transition-colors group-hover:bg-earth/10 dark:group-hover:bg-white/10">
            {sourceInfo.icon}
            <span className="text-[9px] font-black uppercase tracking-widest text-earth/60 dark:text-ivory/60">
              {sourceInfo.label}
            </span>
          </div>
          <div className={`${badgeClasses} px-2.5 py-1 rounded-full flex items-center gap-1 border shadow-sm text-[9px] font-black uppercase tracking-widest`}>
            <span>{badgeText}</span>
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
              className={`mt-1 shrink-0 ${
                count === 0 
                  ? "text-teal-600 dark:text-teal-400" 
                  : count === 1 
                    ? "text-amber-500 dark:text-amber-400" 
                    : "text-rose-500 dark:text-rose-400"
              }`}
            >
              <div className="relative">
                {count === 0 && <Sprout size={20} />}
                {count === 1 && <Flower2 size={20} />}
                {count >= 2 && (
                  <div className="flex items-center gap-1">
                    <Grape size={20} className="animate-pulse" />
                    {count >= 3 && (
                      <span className="text-[10px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1 rounded-md">
                        ×{count}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            <div className="space-y-1">
              <h3 className={`text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight whitespace-nowrap transition-all duration-300 ${shouldBlur ? 'blur-md select-none pointer-events-none' : ''}`}>
                {getLocalizedBookName(verse.book, state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (state.primaryLanguage === 'es' ? 'es' : 'en'))} {verse.chapter}:{verse.verse}
              </h3>
              {!shouldBlur && hasBreakdown && (
                <div className="text-[11px] font-medium text-earth-light dark:text-lavender-muted space-y-0.5">
                  <p>
                    {state.primaryLanguage === 'es'
                      ? `Completado ${count} ${count === 1 ? 'vez' : 'veces'}`
                      : `Completed ${count} ${count === 1 ? 'time' : 'times'}`}
                  </p>
                  {(enCount > 0 || esCount > 0) && (
                    <p>
                      {enCount > 0 && `${state.primaryLanguage === 'es' ? 'Inglés' : 'English'}: ${enCount}`}
                      {enCount > 0 && esCount > 0 && '  ·  '}
                      {esCount > 0 && `${state.primaryLanguage === 'es' ? 'Español' : 'Spanish'}: ${esCount}`}
                    </p>
                  )}
                  {transEntries.length > 0 && (
                    <p>
                      {transEntries
                        .map(([t, n]) => `${(TRANSLATION_DETAILS[t]?.label) || t}: ${n}`)
                        .join('  ·  ')}
                    </p>
                  )}
                  {isBothLanguages && (
                    <p className="font-black uppercase tracking-widest text-[9px] text-playful-purple/70 dark:text-plum/70">
                      {state.primaryLanguage === 'es' ? 'Ambos idiomas' : 'Both Languages'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isMemorized && !shouldBlur && (
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onShareClick(verse)}
                className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-playful-purple dark:hover:text-plum hover:bg-playful-purple/10 dark:hover:bg-plum/20 transition-all ring-1 ring-teal/20"
              >
                <Share2 size={18} />
              </motion.button>
            )}
            {!shouldBlur && (
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => removeSaved(verse.id)}
                className="p-2.5 rounded-xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-coral hover:bg-coral/10 transition-all"
              >
                <Trash2 size={18} />
              </motion.button>
            )}
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {shouldBlur && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 dark:bg-charcoal/60 backdrop-blur-md rounded-xl p-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const currentStage = state.progress.verseStages?.[verse.id] || 1;
                  if (currentStage === 6) {
                    onGoToFlashcards?.(verse.id);
                  } else {
                    onStartMemorizing(verse.id, state.activeSource || "saved");
                  }
                }}
                className="px-6 py-3 bg-teal hover:bg-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-teal/25 transition-all flex items-center gap-2"
              >
                <BookOpen size={14} />
                <span>
                  {state.primaryLanguage === 'es' 
                    ? (memorizationStage === 6 ? 'reto: cita bíblica' : 'continuar reto')
                    : (memorizationStage === 6 ? 'challenge: citation' : 'continue challenge')}
                </span>
              </motion.button>
            </div>
          )}
          {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-playful-purple/60 dark:text-plum/60 bg-playful-purple/5 dark:bg-plum/5 px-2 py-0.5 rounded border border-playful-purple/10 dark:border-plum/10">
                  {esTransToUse}
                </span>
              </div>
              {esText ? (
                <p className={`text-xl font-serif leading-relaxed text-earth dark:text-ivory font-black transition-all duration-300 ${shouldBlur ? 'blur-md select-none pointer-events-none' : ''}`}>
                  {esText}
                </p>
              ) : isEsLoading ? (
                <div className="space-y-1.5 animate-pulse py-1">
                  <div className="h-5 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                  <div className="h-5 bg-earth/10 dark:bg-white/10 rounded-lg w-4/5" />
                </div>
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
                  {enTransToUse}
                </span>
              </div>
              {enText ? (
                <p className={`text-lg font-serif leading-relaxed text-earth/80 dark:text-lavender-muted border-l-4 border-playful-purple/30 dark:border-plum/40 pl-4 bg-playful-purple/5 dark:bg-plum/5 py-3 rounded-r-xl font-medium transition-all duration-300 ${shouldBlur ? 'blur-md select-none pointer-events-none' : ''}`}>
                  {enText}
                </p>
              ) : isEnLoading ? (
                <div className="space-y-1.5 animate-pulse py-1">
                  <div className="h-5 bg-earth/10 dark:bg-white/10 rounded-lg w-full" />
                  <div className="h-5 bg-earth/10 dark:bg-white/10 rounded-lg w-4/5" />
                </div>
              ) : (
                <div className="p-3 bg-coral/10 rounded-xl flex items-center gap-2 text-coral border border-coral/20">
                  <AlertCircle size={16} />
                  <p className="text-[10px] font-bold">{enError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {!shouldBlur && (memorizationStage === 6 && !isMemorized ? (
          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              onGoToFlashcards?.(verse.id);
            }}
            className="w-full py-4 rounded-[20px] bg-playful-purple/10 hover:bg-playful-purple/20 text-playful-purple dark:text-plum font-bold text-sm tracking-tight flex items-center justify-center gap-2.5 transition-all shadow-sm border border-playful-purple/20 lowercase"
          >
            <Sparkles size={16} className="animate-pulse" />
            <span>{state.primaryLanguage === 'es' ? 'reto: cita bíblica' : 'challenge: citation'}</span>
          </motion.button>
        ) : (
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
            <span>{isMemorized 
              ? (state.primaryLanguage === 'es' ? 'repasar ahora' : 'review now')
              : (state.primaryLanguage === 'es' ? 'memorizar ahora' : 'memorize now')
            }</span>
          </motion.button>
        ))}
      </motion.div>
    );
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
      <div className="space-y-8">
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

        {filteredList.length > 0 ? (
          <div className="space-y-10">
            {inProgressList.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mt-2 mb-4">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
                    {state.primaryLanguage === 'es' ? 'EN PROGRESO' : 'IN PROGRESS'}
                  </span>
                  <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                  <span className="text-[10px] font-mono text-earth-light/60 dark:text-ivory/40">
                    ({inProgressList.length})
                  </span>
                </div>
                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {inProgressList.map((verse, idx) => renderVerseCard(verse, idx))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {completedList.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mt-2 mb-4">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-500 dark:text-amber-400 font-bold">
                    {state.primaryLanguage === 'es' ? 'COMPLETADOS' : 'COMPLETED'}
                  </span>
                  <div className="h-px flex-1 bg-earth/10 dark:bg-white/10" />
                  <span className="text-[10px] font-mono text-earth-light/60 dark:text-ivory/40">
                    ({completedList.length})
                  </span>
                </div>
                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {completedList.map((verse, idx) => renderVerseCard(verse, idx))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        ) : (
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

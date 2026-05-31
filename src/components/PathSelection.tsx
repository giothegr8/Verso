import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Path, Translation, TRANSLATION_DETAILS, Verse, CustomPath, CustomPathVerse } from "../types";
import { PATHS, MOCK_VERSES } from "../constants";
import { ArrowLeft, Compass, Clock, ChevronRight, Sprout, CheckCircle2, Lock, Flower2, RotateCw, BookOpen, RotateCcw, X, Share2, Sparkles, Trash2, Plus } from "lucide-react";
import { getCurrentTranslationPair, getLocalizedBookName, getValidatedVerse } from "../utils/verseUtils";
import { handleShare } from "../utils/shareUtils";
import ShareModal from "./ShareModal";

interface PathSelectionProps {
  state: AppState;
  onSelectPath: (pathId: string) => void;
  onBack: () => void;
  onMemorize: (verseId: string, source?: "path" | "saved" | "extra") => void;
  onCreateCustom: () => void;
  onEditCustom: (path: CustomPath) => void;
  onDeleteCustom: (pathId: string) => void;
  selectedPath: Path | CustomPath | null;
  setSelectedPath: (path: Path | CustomPath | null) => void;
}

export default function PathSelection({ state, onSelectPath, onBack, onMemorize, onCreateCustom, onEditCustom, onDeleteCustom, selectedPath, setSelectedPath }: PathSelectionProps) {
  const isEs = state.primaryLanguage === "es";
  const [flippedDay, setFlippedDay] = useState<number | null>(null);
  const [reviewDay, setReviewDay] = useState<number | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const selectedPathId = state.pathProgress.selectedPathId || state.customPathProgress.selectedPathId;

  const getVerseByRef = (ref: string) => {
    // If we're in a custom path, we might have the verse text already
    if (selectedPath && 'verses' in selectedPath && typeof selectedPath.verses[0] === 'object') {
       const found = (selectedPath as CustomPath).verses.find(v => v.reference === ref);
       if (found && found.text) {
          return {
            id: found.id,
            book: found.reference.split(' ').slice(0, -1).join(' '),
            chapter: parseInt(found.reference.split(' ').pop()?.split(':')[0] || '1'),
            verse: parseInt(found.reference.split(' ').pop()?.split(':')[1] || '1'),
            text: {
              es: { RVR1960: found.text, NVI: found.text, NBLA: found.text, KJV: "", NIV: "", NASB: "" },
              en: { KJV: found.text, NIV: found.text, NASB: found.text, RVR1960: "", NVI: "", NBLA: "" }
            }
          } as Verse;
       }
    }

    return MOCK_VERSES.find(v => {
      const parts = v.book.split(' / ');
      const esBook = parts[0];
      const enBook = parts[1] || parts[0];
      // Check for exact matches first
      const vEsRef = `${esBook} ${v.chapter}:${v.verse}`;
      const vEnRef = `${enBook} ${v.chapter}:${v.verse}`;
      return ref === vEsRef || ref === vEnRef;
    }) || MOCK_VERSES.find(v => {
      // Fallback: look if reference contains both book name and numbers
      const parts = v.book.split(' / ');
      const esBook = parts[0];
      const enBook = parts[1] || parts[0];
      return (ref.includes(esBook) || ref.includes(enBook)) && ref.includes(`${v.chapter}:${v.verse}`);
    });
  };

  const currentReviewVerse = useMemo(() => {
    if (!selectedPath || reviewDay === null) return null;
    if ('days' in selectedPath) {
      const dayData = (selectedPath as Path).days?.find(d => d.day === reviewDay);
      return dayData ? getVerseByRef(dayData.reference) : null;
    } else {
      const dayData = (selectedPath as CustomPath).verses.find(v => v.dayNumber === reviewDay);
      return dayData ? getVerseByRef(dayData.reference) : null;
    }
  }, [selectedPath, reviewDay]);

  // Sort paths to move currently selected path to the top, then alphabetize the rest
  const sortedPaths = [...PATHS].sort((a, b) => {
    if (a.id === selectedPathId) return -1;
    if (b.id === selectedPathId) return 1;
    const titleA = isEs ? (a.titleEs || a.title) : a.title;
    const titleB = isEs ? (b.titleEs || b.title) : b.title;
    return titleA.localeCompare(titleB);
  });

  // Find the next path in sequence
  const nextPath = useMemo(() => {
    if (!selectedPath) return null;
    const isCustom = 'type' in selectedPath && selectedPath.type === "custom";
    if (isCustom) {
      if (state.customPaths.length > 1) {
        const idx = state.customPaths.findIndex(p => p.id === selectedPath.id);
        if (idx !== -1) {
          const nextIdx = (idx + 1) % state.customPaths.length;
          return state.customPaths[nextIdx];
        }
      } else if (sortedPaths.length > 0) {
        return sortedPaths[0];
      }
      return null;
    } else {
      const idx = sortedPaths.findIndex(p => p.id === selectedPath.id);
      if (idx !== -1) {
        const nextIdx = (idx + 1) % sortedPaths.length;
        return sortedPaths[nextIdx];
      }
      return null;
    }
  }, [selectedPath, state.customPaths, sortedPaths]);

  if (selectedPath) {
    const isCustom = 'type' in selectedPath && selectedPath.type === "custom";
    const pathTitle = isCustom ? (selectedPath as CustomPath).title : (isEs ? (selectedPath as Path).titleEs : (selectedPath as Path).title);
    const pathDesc = isCustom ? (selectedPath as CustomPath).description : (isEs ? (selectedPath as Path).descriptionEs : (selectedPath as Path).description);
    const pathDuration = isCustom ? (selectedPath as CustomPath).verses.length : (selectedPath as Path).duration;

    const reviewDayData = reviewDay !== null 
      ? (isCustom 
          ? (selectedPath as CustomPath).verses.find(v => v.dayNumber === reviewDay)
          : (selectedPath as Path).days?.find(d => d.day === reviewDay)) 
      : null;
    
    const { esText, enText, esError, enError } = currentReviewVerse 
      ? getValidatedVerse(currentReviewVerse, state) 
      : { esText: null, enText: null, esError: null, enError: null };

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col space-y-8 pb-12"
      >
        {/* Delete Confirmation Overlay */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-espresso/80 backdrop-blur-md"
                onClick={() => setShowDeleteConfirm(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-charcoal rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 p-8 space-y-6"
              >
                <div className="space-y-3 text-center">
                  <div className="w-16 h-16 bg-coral/10 rounded-2xl flex items-center justify-center text-coral mx-auto mb-4">
                    <Trash2 size={28} />
                  </div>
                  <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                    {isEs ? "¿Eliminar esta Serie?" : "Delete this Path?"}
                  </h3>
                  <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 leading-relaxed">
                    {isEs 
                      ? "Esto elimina la Serie personalizada y su progreso. Las Series predeterminadas no se verán afectadas." 
                      : "This removes the custom Path and its progress. Preset Paths will not be affected."}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      if (selectedPath) {
                        onDeleteCustom(selectedPath.id);
                        setSelectedPath(null);
                        setShowDeleteConfirm(false);
                      }
                    }}
                    className="w-full h-14 bg-coral text-white rounded-2xl font-black uppercase tracking-widest text-xs"
                  >
                    {isEs ? "Eliminar Serie" : "Delete Path"}
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full h-14 bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 rounded-2xl font-black uppercase tracking-widest text-xs border border-earth/10 dark:border-white/10"
                  >
                    {isEs ? "Conservar Serie" : "Keep Path"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Share Modal integrated for review flow */}
        {currentReviewVerse && (
          <ShareModal 
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            verse={currentReviewVerse}
            state={state}
            onNativeShare={async (elementId) => {
              const title = `Verso: ${currentReviewVerse.book} ${currentReviewVerse.chapter}:${currentReviewVerse.verse}`;
              const text = `${currentReviewVerse.book} ${currentReviewVerse.chapter}:${currentReviewVerse.verse}\n\nShared via Verso`;
              await handleShare(title, text, window.location.href, () => {}, elementId);
              setIsShareModalOpen(false);
            }}
          />
        )}

        {/* Verse Review Modal */}
        <AnimatePresence>
          {reviewDay !== null && currentReviewVerse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setReviewDay(null)}
                className="absolute inset-0 bg-espresso/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-charcoal rounded-[40px] shadow-2xl border border-white/10 overflow-hidden flex flex-col"
              >
                <div className="p-8 space-y-8">
                  {/* Top Close */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal/80">
                        {isEs ? "VERSÍCULO DE LA SERIE" : "PATH VERSE"}
                      </span>
                      <h4 className="text-xl font-serif font-black text-ivory/60">
                        {pathTitle} — {isEs ? `Día ${reviewDay}` : `Day ${reviewDay}`}
                      </h4>
                      {(reviewDayData as any)?.title && (
                        <h4 className="text-lg font-serif font-bold text-white mt-2">
                          {(reviewDayData as any).title}
                        </h4>
                      )}
                      {(reviewDayData as any)?.theme && (
                        <p className="text-xs font-serif italic text-teal-400/80">
                          {(reviewDayData as any).theme}
                        </p>
                      )}
                      {(reviewDayData as any)?.contextPassage && (
                        <p className="text-xs text-ivory/40">
                          {isEs ? "Lectura de contexto/adicional:" : "Context passage/additional reading:"} <span className="font-serif italic font-bold text-teal whitespace-nowrap">{(reviewDayData as any).contextPassage}</span>
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => setReviewDay(null)}
                      className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-colors border border-white/5"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Verse Content */}
                  <div className="space-y-6">
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-teal/40">
                          {TRANSLATION_DETAILS[state.selectedTranslations.es].name}
                        </span>
                        <p className="text-2xl sm:text-3xl font-serif leading-relaxed text-ivory tracking-tight">
                          {esText || esError || (isEs ? "Texto no disponible" : "Text unavailable")}
                        </p>
                      </div>
                    )}

                    {state.memorizeMode === 'both' && (
                      <div className="w-12 h-px bg-white/10" />
                    )}

                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">
                          {TRANSLATION_DETAILS[state.selectedTranslations.en].name}
                        </span>
                        <p className="text-2xl sm:text-3xl font-serif leading-relaxed text-ivory tracking-tight">
                          {enText || enError || (!isEs ? "Text unavailable" : "Texto no disponible")}
                        </p>
                      </div>
                    )}

                    <div className="pt-4">
                      <h5 className="text-lg font-serif font-black text-teal-400 whitespace-nowrap">
                        {getLocalizedBookName(currentReviewVerse.book, state.memorizeMode)} {currentReviewVerse.chapter}:{currentReviewVerse.verse}
                      </h5>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 pt-4">
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="w-full h-16 rounded-[24px] bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple flex items-center justify-center gap-3 transition-all hover:bg-playful-purple/10 active:scale-95 shadow-[0_0_20px_rgba(109,40,217,0.1)]"
                    >
                      <Share2 size={20} />
                      <span className="font-black uppercase tracking-widest text-sm">
                        {isEs ? "Compartir" : "Share"}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        setReviewDay(null);
                        onMemorize(currentReviewVerse.id, "extra");
                      }}
                      className="w-full h-16 rounded-[24px] bg-white/5 text-ivory/60 hover:text-ivory font-black text-sm flex items-center justify-center gap-3 border-2 border-white/10 hover:bg-white/10 transition-all active:scale-95 transition-all"
                    >
                      <RotateCcw size={20} />
                      <span className="font-black uppercase tracking-widest">
                        {isEs ? "repasar de nuevo" : "review again"}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Detail Header */}
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <button 
              onClick={() => setSelectedPath(null)}
              className="flex items-center h-5 gap-2 text-earth/50 dark:text-ivory/50 hover:text-teal transition-colors group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-widest">
                {isEs ? "Todas las series" : "All Paths"}
              </span>
            </button>

            {nextPath && (
              <button 
                onClick={() => setSelectedPath(nextPath)}
                className="flex flex-col items-end text-right text-earth/50 dark:text-ivory/50 hover:text-teal transition-colors group shrink-0 animate-in fade-in slide-in-from-right-3 duration-500"
              >
                <div className="flex items-center h-5 gap-1">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-widest">
                    {isEs ? "Siguiente" : "Next Path"}
                  </span>
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-[10px] text-earth-light/50 dark:text-lavender-muted/50 font-serif font-semibold max-w-[120px] sm:max-w-[200px] truncate mt-0.5">
                  {'type' in nextPath && nextPath.type === "custom" 
                    ? (nextPath as CustomPath).title 
                    : (isEs ? (nextPath as Path).titleEs : (nextPath as Path).title)}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center text-teal mb-2">
                  <Sprout size={24} />
                </div>
                {isCustom && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl border border-amber-500/20 dark:border-amber-400/30">
                      <Clock size={14} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300/80">
                        {pathDuration} {isEs ? (pathDuration === 1 ? "día" : "días") : (pathDuration === 1 ? "day" : "days")}
                      </span>
                    </div>
                    <button 
                      onClick={() => onEditCustom(selectedPath as CustomPath)}
                      className="p-3 rounded-2xl bg-teal/10 text-teal hover:bg-teal/20 transition-all border border-teal/10"
                      title={isEs ? "Editar Serie" : "Edit Path"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-3 rounded-2xl bg-coral/10 text-coral hover:bg-coral/20 transition-all border border-coral/10"
                      title={isEs ? "Eliminar Serie" : "Delete Path"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
              <h2 className="text-4xl sm:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
                {pathTitle}
              </h2>
              <p className="text-lg text-earth-light/80 dark:text-lavender-muted/80 font-medium max-w-xl">
                {pathDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Day Grid */}
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-earth/40 dark:text-ivory/40 border-b border-earth/5 pb-2">
            {isEs ? "Recorrido diario" : "Daily Journey"}
          </h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {Array.from({ length: pathDuration }).map((_, i) => {
              const dayNum = i + 1;
              const dayData = isCustom 
                ? (selectedPath as CustomPath).verses.find(v => v.dayNumber === dayNum)
                : (selectedPath as Path).days?.find(d => d.day === dayNum);
              
              // Robust completion detection
              const pathSaved = isCustom 
                ? (state.customPathProgress?.savedProgress || {} as any)[(selectedPath as any).id]
                : (state.pathProgress?.savedProgress || {} as any)[(selectedPath as any).id];
              
              const isCompleted = pathSaved?.completedDays.includes(dayNum) || 
                                (selectedPathId === selectedPath.id && 
                                  (isCustom ? state.customPathProgress.currentDay : state.pathProgress.currentDay || 1) > dayNum);
              const isActive = (selectedPathId === selectedPath.id) && 
                              (isCustom ? state.customPathProgress.currentDay === dayNum : state.pathProgress.currentDay === dayNum);
              const isFlipped = flippedDay === dayNum && isActive;

              const verse = dayData ? getVerseByRef(dayData.reference) : null;
              const previewText = verse ? (isEs ? (verse.text.es[state.selectedTranslations.es] || verse.text.es.RVR1960) : (verse.text.en[state.selectedTranslations.en] || verse.text.en.NIV)) : null;

              return (
                <div key={dayNum} className="relative h-[90px] perspective-1000">
                  <motion.div 
                    initial={false}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-full h-full preserve-3d cursor-pointer"
                    onClick={() => {
                      if (isActive) {
                        setFlippedDay(isFlipped ? null : dayNum);
                      } else if (isCompleted) {
                        setReviewDay(dayNum);
                      }
                    }}
                  >
                    {/* Front Side */}
                    <div className="absolute inset-0 backface-hidden">
                      <div className={`w-full h-full p-4 rounded-[20px] border transition-all flex items-center gap-4 ${
                        isCompleted 
                          ? "bg-teal/5 border-teal/20 shadow-sm" 
                          : isActive
                            ? "bg-teal/10 border-teal-400/30 dark:border-teal-400/40 shadow-lg shadow-teal/5 ring-1 ring-teal/20"
                            : "bg-white/40 dark:bg-charcoal/40 border-earth/5 dark:border-white/5 opacity-60"
                      }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black transition-transform ${
                          isCompleted 
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                            : isActive
                              ? "bg-teal text-white shadow-[0_0_15px_rgba(45,212,191,0.4)]"
                              : "bg-earth/5 dark:bg-white/5 text-earth/20 dark:text-ivory/20"
                        }`}>
                          {isCompleted ? <Flower2 size={18} className="text-amber-600 dark:text-amber-400" /> : dayNum}
                        </div>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1 flex-wrap ${
                            isCompleted ? "text-amber-600/60 dark:text-amber-400/60" : isActive ? "text-teal" : "text-earth-light/30"
                          }`}>
                            {(dayData as any)?.title 
                              ? <span>{isEs ? `Día ${dayNum}` : `Day ${dayNum}`} • <span className="whitespace-nowrap">{(dayData as any).reference}</span></span>
                              : (isEs ? `Día ${dayNum}` : `Day ${dayNum}`)}
                          </span>
                          <span className={`font-serif font-bold text-base truncate ${isActive ? "text-teal-900 dark:text-teal-50" : isCompleted ? "text-earth/60 dark:text-ivory/60" : "text-earth dark:text-ivory"}`}>
                            {(dayData as any)?.title || (dayData as any)?.reference ? <span className={!(dayData as any)?.title ? "whitespace-nowrap" : undefined}>{(dayData as any)?.title || (dayData as any)?.reference}</span> : (isEs ? "Versículo" : "Verse")}
                          </span>
                        </div>
                        {isActive && (
                          <div className="ml-auto opacity-20 group-hover:opacity-60 transition-opacity">
                            <RotateCw size={14} className="text-earth/40 dark:text-ivory/40" />
                          </div>
                        )}
                        {isCompleted && (
                           <div className="ml-auto opacity-40 group-hover:opacity-100 transition-opacity">
                              <BookOpen size={14} className="text-amber-500" />
                           </div>
                        )}
                        {!isCompleted && !isActive && <Lock size={14} className="ml-auto text-earth/10 dark:text-white/10" />}
                      </div>
                    </div>

                    {/* Back Side (Only for Active Day) */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180">
                      <div className={`w-full h-full p-4 rounded-[20px] border border-teal-400/20 bg-teal/10 dark:bg-teal-950/20 flex flex-col justify-center`}>
                        <div className="overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[8px] font-black uppercase tracking-widest text-teal/60 whitespace-nowrap">
                              {dayData?.reference}
                            </p>
                            <RotateCw size={10} className="text-teal/40" />
                          </div>
                          <p className="text-[10px] sm:text-[11px] font-serif font-black text-earth/90 dark:text-ivory/90 line-clamp-2 leading-relaxed">
                            {previewText || (isEs ? "Versículo de la serie..." : "Verse of the path...")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-8 sticky bottom-0 bg-gradient-to-t from-parchment dark:from-espresso to-transparent pb-4">
          <button
            onClick={() => onSelectPath(selectedPath.id)}
            className="w-full py-4 rounded-full bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 font-bold text-sm tracking-tight flex items-center justify-center gap-2.5 transition-all shadow-sm border border-teal/20 lowercase active:scale-95"
          >
            <Compass size={18} />
            <span className="tracking-tight">
              {state.pathProgress.selectedPathId === selectedPath.id || state.customPathProgress.selectedPathId === selectedPath.id 
                ? (isEs ? "continuar serie" : "continue path") 
                : (isCustom ? (isEs ? "empezar serie" : "start path") : (isEs ? (selectedPath as Path).ctaEs.toLowerCase() : (selectedPath as Path).cta.toLowerCase()))}
            </span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div id="paths-content" className="flex flex-col pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header - Refined for Consistency and Left Aligned */}
      <div className="w-full mb-8 sm:mb-12">
        <div className="flex flex-col space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-blue animate-pulse" />
            <span className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.3em] text-sky-blue leading-none">
              {isEs ? 'SERIES' : 'PATHS'}
            </span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
            {isEs ? 'Tu Jardín Sagrado' : 'Your Sacred Garden'}
          </h2>
          
          <p className="text-sm sm:text-base text-earth-light/70 dark:text-lavender-muted/70 font-medium tracking-tight">
            {isEs 
              ? 'Elige dónde quieres crecer en tu caminar espiritual' 
              : 'Choose where you want to grow in your spiritual journey'}
          </p>
        </div>
      </div>

      {/* Creation Entry Card */}
      <div className="mb-10">
        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onCreateCustom}
          className="w-full relative overflow-hidden group rounded-[32px] p-8 border-2 border-dashed border-teal/20 bg-teal/[0.03] flex flex-col sm:flex-row items-center gap-6 text-left transition-all hover:bg-teal/[0.06] hover:border-teal/40"
        >
          <div className="w-20 h-20 shrink-0 rounded-[28px] bg-teal/10 flex items-center justify-center text-teal relative">
            <Sparkles size={32} className="relative z-10" />
            <div className="absolute inset-0 bg-teal/20 blur-2xl rounded-full scale-50 group-hover:scale-100 transition-transform" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] font-black text-teal/60 dark:text-teal/40 uppercase tracking-[0.2em] ml-0.5">
                {isEs ? "PERSONALIZADA" : "CUSTOM"}
              </span>
              <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                {isEs ? "Crea tu propia Serie" : "Create your own Path"}
              </h3>
            </div>
            <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 leading-relaxed max-w-sm">
              {isEs 
                ? "Agrega versículos de una prédica, clase, estudio o algo que quieras memorizar." 
                : "Add verses from a sermon, class, study, or anything you want to memorize."}
            </p>
          </div>
          <div className="flex items-center gap-2 px-6 py-3 bg-teal text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-teal/20 group-hover:scale-105 transition-transform">
             {isEs ? "Crear Serie" : "Create Path"}
             <Plus size={14} strokeWidth={3} />
          </div>
        </motion.button>
      </div>

      {/* Custom Paths Section */}
      {state.customPaths.length > 0 && (
        <div className="space-y-6 mb-10">
           <h3 className="text-xs font-black uppercase tracking-[0.3em] text-earth/20 dark:text-ivory/20 px-1">
             {isEs ? "TUS SERIES PERSONALIZADAS" : "YOUR CUSTOM PATHS"}
           </h3>
           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.customPaths.map((path, idx) => {
                const isActive = path.id === selectedPathId;
                return (
                  <motion.button
                    key={path.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedPath(path)}
                    className={`group relative flex flex-col items-start p-6 bg-white dark:bg-charcoal border transition-all text-left overflow-hidden ring-1 ${
                      isActive 
                        ? "border-teal/50 ring-teal/20 bg-teal/[0.02] shadow-lg" 
                        : "border-earth/10 dark:border-white/10 ring-teal/5 shadow-sm hover:shadow-xl hover:border-teal/30"
                    } rounded-[32px]`}
                  >
                    <div className="flex justify-between items-start w-full mb-4 relative z-10">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                        isActive ? "bg-teal text-white shadow-xl shadow-teal/20 scale-110" : "bg-teal/10 text-teal group-hover:scale-110"
                      }`}>
                        <Sprout size={24} />
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/5 dark:bg-teal/10 rounded-full border border-teal/10 dark:border-teal/20">
                        <Clock size={12} className="text-amber-500/80 dark:text-amber-400/80" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                          {path.verses.length} {isEs ? (path.verses.length === 1 ? "día" : "días") : (path.verses.length === 1 ? "day" : "days")}
                        </span>
                      </div>
                    </div>

                    {/* Watermark Motif */}
                    <div className="absolute top-6 -right-16 p-8 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                      <Sprout size={140} className="text-teal transform rotate-[-12deg]" />
                    </div>

                    <div className="mb-4 min-h-[1.5rem] relative z-10">
                      {isActive && (
                        <motion.div 
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-teal/10 dark:bg-teal/20 rounded-lg border border-teal/20 dark:border-teal-400/20"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-teal dark:bg-teal-400 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-teal dark:text-teal-400">
                            {isEs ? "Actual" : "Current"}
                          </span>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3 relative z-10 w-full mb-6 text-left">
                      <h3 className="text-xl sm:text-2xl font-serif font-black transition-colors leading-tight text-earth dark:text-ivory min-h-[4.5rem] sm:min-h-[4rem] line-clamp-2">
                        {path.title}
                      </h3>
                      <p className="text-sm text-earth-light/70 dark:text-lavender-muted/60 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                        {path.description || (isEs ? "Serie personalizada" : "Custom scripture path")}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-colors text-earth-light/40 dark:text-ivory/30 group-hover:text-teal">
                      <span>{isEs ? "Ver detalles" : "View details"}</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </motion.button>
                );
              })}
           </div>
        </div>
      )}

      {/* Preset Path Cards */}
      <div className="space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-earth/20 dark:text-ivory/20 px-1">
          {isEs ? "BIBLIOTECA DE SERIES" : "PATH LIBRARY"}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPaths.map((path, index) => {
          const isActive = path.id === selectedPathId;
          
          return (
            <motion.button
              key={path.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedPath(path)}
              className={`group relative flex flex-col items-start p-6 bg-white dark:bg-charcoal border transition-all text-left overflow-hidden ring-1 ${
                isActive 
                  ? "border-sky-blue/50 ring-sky-blue/20 bg-teal/[0.02] shadow-lg" 
                  : "border-earth/10 dark:border-white/10 ring-sky-blue/5 shadow-sm hover:shadow-xl hover:border-sky-blue/30"
              } rounded-[32px]`}
            >
              {/* Background Accent - Repositioned to sit higher and further right for artistic cropping */}
              <div className="absolute top-6 -right-16 p-8 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
                <Compass size={140} className="text-sky-blue transform rotate-[-12deg]" />
              </div>

              <div className="flex justify-between items-start w-full mb-4 relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isActive ? "bg-teal text-white shadow-xl shadow-teal/20 scale-110" : "bg-teal/10 text-teal group-hover:scale-110"
                }`}>
                  <Sprout size={24} />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/5 dark:bg-teal/10 rounded-full border border-teal/10 dark:border-teal/20">
                  <Clock size={12} className="text-amber-500/80 dark:text-amber-400/80" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    {path.duration} {isEs ? (path.duration === 1 ? "día" : "días") : (path.duration === 1 ? "day" : "days")}
                  </span>
                </div>
              </div>

              {/* Current Status Badge - Independent of duration pill */}
              <div className="mb-4 min-h-[1.5rem] relative z-10">
                {isActive && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-teal/10 dark:bg-teal/20 rounded-lg border border-teal/20 dark:border-teal-400/20"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-teal dark:bg-teal-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal dark:text-teal-400">
                      {isEs ? "Actual" : "Current"}
                    </span>
                  </motion.div>
                )}
              </div>

              <div className="flex-1 space-y-3 relative z-10 w-full mb-6">
                <h3 className="text-xl sm:text-2xl font-serif font-black transition-colors leading-tight text-earth dark:text-ivory min-h-[4.5rem] sm:min-h-[4rem] line-clamp-2">
                  {isEs ? path.titleEs : path.title}
                </h3>
                <p className="text-sm text-earth-light/70 dark:text-lavender-muted/60 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                  {isEs ? path.descriptionEs : path.description}
                </p>
              </div>

              <div className="mt-auto flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-colors text-earth-light/40 dark:text-ivory/30 group-hover:text-earth-light/60">
                <span>{isEs ? "Ver detalles" : "View details"}</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

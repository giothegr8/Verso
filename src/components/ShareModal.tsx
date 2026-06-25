import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Share2, Loader2, Sparkles, BookOpen } from "lucide-react";
import { AppState, TRANSLATION_DETAILS, Verse, ShareSnapshot, ShareBlock } from "../types";
import { getLocalizedBookName, getValidatedVerse } from "../utils/verseUtils";
import { getVerseFilename, prepareShareImage, clearPreparedShareImage } from "../utils/shareUtils";
import VersoLogo from "./VersoLogo";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Preferred: a fully-resolved, source-aware snapshot. When provided the modal
  // renders only from it and never touches global Settings translation logic.
  snapshot?: ShareSnapshot | null;
  // Legacy fallback for callers that still pass a raw verse (path review flow).
  verse?: Verse;
  state: AppState;
  onNativeShare: (elementId: string, filename: string) => void;
}

export default function ShareModal({ isOpen, onClose, snapshot, verse, state, onNativeShare }: ShareModalProps) {
  const isSpanish = state.primaryLanguage === 'es';

  // Build the immutable view. When a snapshot is supplied (Saved / Home), it is
  // the single source of truth — no getValidatedVerse / selectedTranslations /
  // memorizeMode is consulted. The legacy branch only runs for raw-verse callers.
  const view: ShareSnapshot | null = (() => {
    if (snapshot) return snapshot;
    if (!verse) return null;
    const { esText, enText, esError, enError, activePair } = getValidatedVerse(verse, state);
    const blocks: ShareBlock[] = [];
    if (state.memorizeMode === 'es' || state.memorizeMode === 'both') {
      blocks.push({
        language: 'es',
        translation: activePair.es,
        label: TRANSLATION_DETAILS[activePair.es]?.name || activePair.es,
        text: esText || esError || (isSpanish ? 'Texto no disponible' : 'Text unavailable'),
      });
    }
    if (state.memorizeMode === 'en' || state.memorizeMode === 'both') {
      blocks.push({
        language: 'en',
        translation: activePair.en,
        label: TRANSLATION_DETAILS[activePair.en]?.name || activePair.en,
        text: enText || enError || (isSpanish ? 'Texto no disponible' : 'Text unavailable'),
      });
    }
    const refLang: 'es' | 'en' = state.memorizeMode === 'es' ? 'es' : state.memorizeMode === 'en' ? 'en' : (isSpanish ? 'es' : 'en');
    return {
      source: 'saved',
      book: verse.book,
      chapter: verse.chapter,
      verse: verse.verse,
      refLang,
      reference: `${getLocalizedBookName(verse.book, refLang)} ${verse.chapter}:${verse.verse}`,
      blocks,
      footer: isSpanish ? 'Memorizado con Verso' : 'Memorized with Verso',
    };
  })();

  const cardId = "share-card-preview";
  const filename = view ? getVerseFilename(view.book, view.chapter, view.verse, isSpanish) : "";

  // Preparation state for the share image. The image is generated when the modal
  // opens so the Share click can call navigator.share inside the user's
  // activation. 'preparing' disables Share; 'ready' enables it; 'failed' surfaces
  // a visible error while the independent Download Image button stays usable.
  const [shareState, setShareState] = useState<'idle' | 'preparing' | 'ready' | 'failed'>('idle');

  // Re-prepare only when the immutable card content actually changes (not on
  // every render), per the rendered snapshot.
  const prepKey = view
    ? JSON.stringify({
        source: view.source,
        reference: view.reference,
        footer: view.footer,
        blocks: view.blocks.map(b => `${b.language}:${b.translation}:${b.text}`),
      })
    : null;

  useEffect(() => {
    if (!isOpen || !view) {
      setShareState('idle');
      clearPreparedShareImage();
      return;
    }
    let cancelled = false;
    setShareState('preparing');
    clearPreparedShareImage();
    // Defer to the next paints so the share card is mounted and laid out before
    // html-to-image captures it.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        prepareShareImage(cardId, filename).then((result) => {
          if (!cancelled) setShareState(result ? 'ready' : 'failed');
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prepKey]);

  if (!view) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-espresso/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-parchment dark:bg-espresso rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-earth/5 dark:border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest text-earth/60 dark:text-ivory/60">
                {state.primaryLanguage === 'es' ? 'Compartir Versículo' : 'Share Verse'}
              </h3>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-earth/5 dark:hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
              <div 
                id={cardId}
                className="w-full bg-charcoal rounded-[32px] shadow-2xl p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden border border-white/10 min-h-[450px]"
              >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-playful-purple/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal/10 rounded-full -ml-24 -mb-24 blur-3xl" />
                
                <div className="space-y-6 sm:space-y-8 relative z-10">
                  <div className="flex items-center gap-2 mb-4 sm:mb-6">
                    <div className="opacity-80 scale-75 origin-left">
                      <VersoLogo size="sm" showText={true} mode="white" />
                    </div>
                  </div>

                  <div className="space-y-5 sm:space-y-6">
                    {view.blocks.map((block, i) => (
                      <React.Fragment key={`${block.language}-${block.translation}`}>
                        {i > 0 && <div className="h-px w-12 bg-white/10" />}
                        <div className="space-y-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${block.language === 'es' ? 'text-playful-purple' : 'text-golden'}`}>
                            {block.label}
                          </span>
                          <p className="text-lg sm:text-2xl font-serif leading-relaxed text-ivory font-medium">
                            {block.text || (isSpanish ? 'Texto no disponible' : 'Text unavailable')}
                          </p>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 sm:pt-8 border-t border-white/10 flex justify-between items-end relative z-10">
                  <div className="space-y-1">
                    <h4 className="text-lg sm:text-xl font-serif font-black text-ivory whitespace-normal break-words">
                      {view.reference}
                    </h4>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-ivory/40">
                      {view.footer}
                    </p>
                  </div>
                  
                  {/* Watermark */}
                  <div className="flex items-center gap-2">
                    <VersoLogo size="md" showText={true} mode="white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-earth/5 dark:bg-white/5 flex flex-col gap-3">
              <button
                onClick={() => { if (shareState === 'ready') onNativeShare(cardId, filename); }}
                disabled={shareState !== 'ready'}
                className={`w-full btn-primary flex items-center justify-center gap-2 py-4 shadow-xl shadow-playful-purple/20 ${shareState !== 'ready' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {shareState === 'preparing'
                  ? <Loader2 size={20} className="animate-spin" />
                  : <Share2 size={20} />}
                <span className="font-black uppercase tracking-widest text-sm">
                  {shareState === 'preparing'
                    ? (isSpanish ? 'Preparando…' : 'Preparing share…')
                    : shareState === 'failed'
                      ? (isSpanish ? 'Imagen no disponible' : 'Image unavailable')
                      : (isSpanish ? 'Compartir' : 'Share')}
                </span>
              </button>
              {shareState === 'failed' && (
                <p className="text-center text-[11px] font-bold text-red-500/80">
                  {isSpanish
                    ? 'No se pudo preparar la imagen. Usa Descargar Imagen.'
                    : 'Could not prepare the image. Use Download Image instead.'}
                </p>
              )}
              
              <button 
                onClick={async () => {
                  const element = document.getElementById(cardId);
                  if (element) {
                    const { toPng } = await import('html-to-image');
                    // Ensure fonts are loaded before capture
                    await document.fonts.ready;
                    
                    const dataUrl = await toPng(element, {
                      cacheBust: true,
                      pixelRatio: 3, // Higher quality for sharing
                      skipAutoScale: true,
                      style: {
                        transform: 'scale(1)',
                        transformOrigin: 'top left'
                      }
                    });
                    
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = dataUrl;
                    link.click();
                  }
                }}
                className="w-full py-4 rounded-[24px] bg-white dark:bg-charcoal text-earth dark:text-ivory font-black text-sm flex items-center justify-center gap-2 hover:bg-earth/5 dark:hover:bg-white/5 transition-all border border-earth/10 dark:border-white/10"
              >
                <Download size={20} />
                <span className="font-black uppercase tracking-widest">
                  {state.primaryLanguage === 'es' ? 'Descargar Imagen' : 'Download Image'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

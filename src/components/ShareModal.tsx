import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Share2, Sparkles, BookOpen } from "lucide-react";
import { AppState, TRANSLATION_DETAILS } from "../types";
import { getCurrentTranslationPair, getLocalizedBookName } from "../utils/verseUtils";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  verse: any;
  state: AppState;
  onNativeShare: (elementId: string) => void;
}

export default function ShareModal({ isOpen, onClose, verse, state, onNativeShare }: ShareModalProps) {
  const activePair = getCurrentTranslationPair(state);
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  if (!verse) return null;

  const cardId = "share-card-preview";

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
            <div className="flex-1 p-8 overflow-y-auto max-h-[70vh]">
              <div 
                id={cardId}
                className="aspect-[4/5] w-full bg-charcoal rounded-[32px] shadow-2xl p-10 flex flex-col justify-between relative overflow-hidden border border-white/10"
              >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-playful-purple/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal/10 rounded-full -ml-24 -mb-24 blur-3xl" />
                
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-playful-purple rounded-lg flex items-center justify-center">
                      <BookOpen size={14} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ivory/60">
                      Verso
                    </span>
                  </div>

                  <div className="space-y-6">
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-playful-purple">
                          {esDetail.name}
                        </span>
                        <p className="text-2xl font-serif leading-relaxed text-ivory font-medium">
                          {verse.textEs || verse.text}
                        </p>
                      </div>
                    )}

                    {state.memorizeMode === 'both' && (
                      <div className="h-px w-12 bg-white/10" />
                    )}

                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-golden">
                          {enDetail.name}
                        </span>
                        <p className="text-2xl font-serif leading-relaxed text-ivory font-medium">
                          {verse.textEn || verse.text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex justify-between items-end relative z-10">
                  <div className="space-y-1">
                    <h4 className="text-xl font-serif font-black text-ivory">
                      {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
                    </h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-ivory/40">
                      {state.primaryLanguage === 'es' ? 'Memorizado con Verso' : 'Memorized with Verso'}
                    </p>
                  </div>
                  
                  {/* Watermark */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-playful-purple rounded-xl flex items-center justify-center shadow-lg shadow-playful-purple/20">
                      <BookOpen size={16} className="text-white" />
                    </div>
                    <span className="text-lg font-serif font-black text-playful-purple tracking-tight">Verso</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-earth/5 dark:bg-white/5 flex flex-col gap-3">
              <button 
                onClick={() => onNativeShare(cardId)}
                className="w-full btn-primary flex items-center justify-center gap-2 py-4 shadow-xl shadow-playful-purple/20"
              >
                <Share2 size={20} />
                <span className="font-black uppercase tracking-widest text-sm">
                  {state.primaryLanguage === 'es' ? 'Compartir' : 'Share'}
                </span>
              </button>
              
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
                    link.download = `verso-${Date.now()}.png`;
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

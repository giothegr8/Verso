import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Share2, Sparkles, BookOpen } from "lucide-react";
import { AppState, TRANSLATION_DETAILS, Verse } from "../types";
import { getCurrentTranslationPair, getLocalizedBookName, getValidatedVerse } from "../utils/verseUtils";
import VersoLogo from "./VersoLogo";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  verse: Verse;
  state: AppState;
  onNativeShare: (elementId: string) => void;
}

export default function ShareModal({ isOpen, onClose, verse, state, onNativeShare }: ShareModalProps) {
  const { esText, enText, esError, enError, activePair } = getValidatedVerse(verse, state);
  const esDetail = TRANSLATION_DETAILS[activePair.es];
  const enDetail = TRANSLATION_DETAILS[activePair.en];

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
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-playful-purple">
                          {esDetail.name}
                        </span>
                        <p className="text-lg sm:text-2xl font-serif leading-relaxed text-ivory font-medium">
                          {esText || esError || (state.primaryLanguage === 'es' ? 'Texto no disponible' : 'Text unavailable')}
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
                        <p className="text-lg sm:text-2xl font-serif leading-relaxed text-ivory font-medium">
                          {enText || enError || (state.primaryLanguage === 'en' ? 'Text unavailable' : 'Texto no disponible')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 sm:pt-8 border-t border-white/10 flex justify-between items-end relative z-10">
                  <div className="space-y-1">
                    <h4 className="text-lg sm:text-xl font-serif font-black text-ivory">
                      {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
                    </h4>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-ivory/40">
                      {state.primaryLanguage === 'es' ? 'Memorizado con Verso' : 'Memorized with Verso'}
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

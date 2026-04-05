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
  onNativeShare: () => void;
}

export default function ShareModal({ isOpen, onClose, verse, state, onNativeShare }: ShareModalProps) {
  const activePair = getCurrentTranslationPair(state);
  const esDetail = TRANSLATION_DETAILS[activePair?.es || "RVR1960"] || TRANSLATION_DETAILS["RVR1960"];
  const enDetail = TRANSLATION_DETAILS[activePair?.en || "KJV"] || TRANSLATION_DETAILS["KJV"];

  if (!verse) return null;

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
                id="share-card-preview"
                className="aspect-[4/5] w-full bg-white dark:bg-charcoal rounded-[32px] shadow-xl p-10 flex flex-col justify-between relative overflow-hidden border border-earth/5 dark:border-white/5"
              >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-playful-purple/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-golden/5 rounded-full -ml-16 -mb-16 blur-3xl" />
                
                <div className="space-y-8 relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles size={16} className="text-golden" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/60 dark:text-lavender-muted/60">
                      Verso Daily
                    </span>
                  </div>

                  <div className="space-y-6">
                    {(state.memorizeMode === 'es' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-playful-purple/60">
                          {esDetail.name}
                        </span>
                        <p className="text-2xl font-serif leading-relaxed text-earth dark:text-ivory font-medium">
                          {verse.textEs || verse.text}
                        </p>
                      </div>
                    )}

                    {state.memorizeMode === 'both' && (
                      <div className="h-px w-12 bg-earth/10 dark:bg-white/10" />
                    )}

                    {(state.memorizeMode === 'en' || state.memorizeMode === 'both') && (
                      <div className="space-y-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-golden/60">
                          {enDetail.name}
                        </span>
                        <p className="text-2xl font-serif leading-relaxed text-earth dark:text-ivory font-medium">
                          {verse.textEn || verse.text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-8 border-t border-earth/5 dark:border-white/5 flex justify-between items-end relative z-10">
                  <div className="space-y-1">
                    <h4 className="text-xl font-serif font-black text-earth dark:text-ivory">
                      {getLocalizedBookName(verse.book, state.memorizeMode)} {verse.chapter}:{verse.verse}
                    </h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40">
                      {state.primaryLanguage === 'es' ? 'Memorizado con Verso' : 'Memorized with Verso'}
                    </p>
                  </div>
                  
                  {/* Watermark */}
                  <div className="flex items-center gap-2 opacity-40">
                    <div className="w-6 h-6 bg-playful-purple rounded-lg flex items-center justify-center">
                      <BookOpen size={12} className="text-white" />
                    </div>
                    <span className="text-xs font-serif font-black text-playful-purple tracking-tight">Verso</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-earth/5 dark:bg-white/5 flex gap-4">
              <button 
                onClick={onNativeShare}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-4 shadow-xl shadow-playful-purple/20"
              >
                <Share2 size={20} />
                <span className="font-black uppercase tracking-widest text-sm">
                  {state.primaryLanguage === 'es' ? 'Compartir' : 'Share'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

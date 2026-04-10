import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Shield } from "lucide-react";
import Markdown from "react-markdown";
import { PRIVACY_POLICY_MD } from "../constants/privacyPolicy";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryLanguage: 'es' | 'en';
}

export default function PrivacyPolicyModal({ isOpen, onClose, primaryLanguage }: PrivacyPolicyModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-earth/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div 
            className="w-full max-w-3xl bg-white dark:bg-charcoal rounded-[40px] overflow-hidden shadow-2xl border border-earth/5 dark:border-white/10 flex flex-col max-h-[85vh]"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 border-b border-earth/10 dark:border-white/10 flex justify-between items-center bg-white dark:bg-charcoal sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal/10 rounded-2xl flex items-center justify-center text-teal">
                  <Shield size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                    {primaryLanguage === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
                  </h2>
                  <p className="text-[10px] font-black text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                    {primaryLanguage === 'es' ? 'Cómo protegemos tus datos' : 'How we protect your data'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="btn-icon bg-earth/5 dark:bg-white/5 hover:bg-earth/10 dark:hover:bg-white/10 transition-colors border-none shadow-none"
              >
                <X size={24} className="text-earth/40 dark:text-lavender-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 custom-scrollbar bg-parchment/30 dark:bg-espresso/30">
              <div className="prose prose-sm dark:prose-invert max-w-none 
                prose-headings:font-serif prose-headings:font-black prose-headings:text-earth dark:prose-headings:text-ivory
                prose-p:text-earth-light dark:prose-p:text-lavender-muted prose-p:leading-relaxed
                prose-li:text-earth-light dark:prose-li:text-lavender-muted
                prose-strong:text-earth dark:prose-strong:text-ivory
                prose-hr:border-earth/10 dark:prose-hr:border-white/10">
                <Markdown>{PRIVACY_POLICY_MD}</Markdown>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal flex justify-center">
              <button 
                onClick={onClose}
                className="btn-primary px-12"
              >
                {primaryLanguage === 'es' ? 'Entendido' : 'Got it'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

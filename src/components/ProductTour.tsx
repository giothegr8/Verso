import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, ChevronLeft, Sparkles, Play, Languages, Bookmark, Check, Settings, Layers, Share2 } from "lucide-react";

interface TourStep {
  id: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  targetId: string;
  icon: React.ReactNode;
  tab?: string;
  cta?: { en: string; es: string };
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "votd",
    title: { en: "Today's Verse", es: "Versículo del día" },
    description: { 
      en: "This is your daily focus. Read it carefully to begin.", 
      es: "Este es tu enfoque de hoy. Léelo con atención para comenzar." 
    },
    targetId: "votd-card",
    icon: <Sparkles className="text-golden" size={24} />,
    tab: "home"
  },
  {
    id: "translation",
    title: { en: "Choose Your Version", es: "Elige tu versión" },
    description: { 
      en: "Want a different version? Switch translations instantly right here.", 
      es: "Toca aquí para cambiar la traducción del verso. Puedes elegir la que más te guste o la que te resulte más fácil de aprender." 
    },
    targetId: "translation-pill",
    icon: <Languages className="text-playful-purple" size={24} />,
    tab: "home",
    cta: { en: "Got it", es: "Entendido" }
  },
  {
    id: "memorize-btn",
    title: { en: "Start Memorizing", es: "Empieza a memorizar" },
    description: { 
      en: "When you're ready, tap here to start. We'll guide you step by step.", 
      es: "Cuando estés listo, toca este botón para comenzar tu práctica. Te guiaremos paso a paso hasta que lo grabes en tu corazón." 
    },
    targetId: "memorize-btn-main",
    icon: <Play className="text-playful-purple" size={24} fill="currentColor" />,
    tab: "home",
    cta: { en: "Let's go!", es: "¡Vamos!" }
  },
  {
    id: "nav-memorize-step",
    title: { en: "Guided Practice", es: "Práctica guiada" },
    description: { 
      en: "This is where you'll rehearse the text until every word is in your memory.", 
      es: "En esta sección ensayarás el texto hasta que cada palabra quede en tu memoria." 
    },
    targetId: "nav-memorize",
    icon: <Play className="text-playful-purple" size={24} />,
    tab: "memorize"
  },
  {
    id: "nav-cards-step",
    title: { en: "Citation Challenge", es: "Reto de la cita" },
    description: { 
      en: "Test your memory by recalling exactly where each verse is found.", 
      es: "Aquí pondrás a prueba tu memoria recordando exactamente dónde está el versículo." 
    },
    targetId: "nav-flashcards",
    icon: <Layers className="text-coral" size={24} />,
    tab: "flashcards"
  },
  {
    id: "nav-saved-step",
    title: { en: "Your Progress", es: "Tus progresos" },
    description: { 
      en: "All your memorized verses are saved here for quick review anytime.", 
      es: "Todos tus versículos memorizados se guardan aquí para que los repases cuando quieras." 
    },
    targetId: "nav-saved",
    icon: <Bookmark className="text-earth-light" size={24} />,
    tab: "saved"
  },
  {
    id: "share-step",
    title: { en: "Share Your Faith", es: "Comparte tu fe" },
    description: { 
      en: "Create beautiful images of your favorite verses to share with others.", 
      es: "Crea imágenes hermosas de tus versículos favoritos para compartirlas con otros." 
    },
    targetId: "share-btn-home",
    icon: <Share2 className="text-playful-purple" size={24} />,
    tab: "home"
  },
  {
    id: "bilingual",
    title: { en: "Bilingual Mode", es: "Modo bilingüe" },
    description: { 
      en: "Ready for a bigger challenge? Enable bilingual mode to learn in two languages.", 
      es: "¿Listo para un reto mayor? Activa el modo bilingüe para aprender en dos idiomas." 
    },
    targetId: "nav-settings",
    icon: <Settings className="text-teal" size={24} />,
    tab: "home"
  }
];

interface ProductTourProps {
  isOpen: boolean;
  onClose: () => void;
  primaryLanguage: 'en' | 'es';
  onTabChange?: (tab: string) => void;
}

export default function ProductTour({ isOpen, onClose, primaryLanguage, onTabChange }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' });

  useEffect(() => {
    if (isOpen) {
      const step = TOUR_STEPS[currentStep];
      if (step.tab && onTabChange) {
        onTabChange(step.tab);
      }

      const updateRect = () => {
        const target = document.getElementById(step.targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          setTargetRect(rect);
          
          // Calculate tooltip position
          const spaceBelow = window.innerHeight - rect.bottom;
          const tooltipHeight = 220; // Estimated
          const placement = spaceBelow > tooltipHeight ? 'bottom' : 'top';
          
          const top = placement === 'bottom' 
            ? rect.bottom + 20 
            : rect.top - tooltipHeight - 20;
            
          const left = Math.max(20, Math.min(window.innerWidth - 340, rect.left + rect.width / 2 - 160));
          
          setTooltipPos({ top, left, placement });
        }
      };
      
      // Small delay to ensure tab change and layout are stable
      const timer = setTimeout(updateRect, 150);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('resize', updateRect);
        clearTimeout(timer);
      };
    }
  }, [isOpen, currentStep, onTabChange]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {/* Backdrop with spotlight - Stronger dimming, no blur */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-espresso/70 pointer-events-auto"
          style={{
            clipPath: targetRect ? `polygon(
              0% 0%, 0% 100%, 
              ${targetRect.left - 8}px 100%, 
              ${targetRect.left - 8}px ${targetRect.top - 8}px, 
              ${targetRect.right + 8}px ${targetRect.top - 8}px, 
              ${targetRect.right + 8}px ${targetRect.bottom + 8}px, 
              ${targetRect.left - 8}px ${targetRect.bottom + 8}px, 
              ${targetRect.left - 8}px 100%, 
              100% 100%, 100% 0%
            )` : 'none'
          }}
          onClick={onClose}
        />

        {/* Spotlight Border - Precise, no glow */}
        <AnimatePresence>
          {targetRect && (
            <motion.div
              layoutId="spotlight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute z-[101] border border-white/40 rounded-[32px]"
              style={{
                left: targetRect.left - 8,
                top: targetRect.top - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
            />
          )}
        </AnimatePresence>

        {/* Tour Card - Relative to target */}
        <div 
          className="absolute z-[102] w-full max-w-[320px] pointer-events-auto transition-all duration-500 ease-out"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
          }}
        >
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: tooltipPos.placement === 'bottom' ? -10 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: tooltipPos.placement === 'bottom' ? -10 : 10 }}
            className="bg-white dark:bg-charcoal rounded-[24px] shadow-2xl border border-earth/10 dark:border-white/10 p-6 relative"
          >
            {/* Arrow */}
            <div 
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent ${
                tooltipPos.placement === 'bottom' 
                  ? 'bottom-full border-b-[8px] border-b-white dark:border-b-charcoal' 
                  : 'top-full border-t-[8px] border-t-white dark:border-t-charcoal'
              }`}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-earth/5 dark:bg-white/5 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-serif font-black text-earth dark:text-ivory tracking-tight">
                    {step.title[primaryLanguage]}
                  </h3>
                </div>
                <span className="text-[10px] font-black text-earth-light/40 dark:text-lavender-muted/40 uppercase tracking-widest">
                  {currentStep + 1} / {TOUR_STEPS.length}
                </span>
              </div>
              
              <p className="text-sm text-earth-light dark:text-lavender-muted leading-relaxed font-medium">
                {step.description[primaryLanguage]}
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button 
                onClick={onClose}
                className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 hover:text-earth dark:hover:text-ivory transition-colors"
              >
                {primaryLanguage === 'es' ? 'Saltar' : 'Skip'}
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button 
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="w-8 h-8 rounded-full bg-earth/5 dark:bg-white/5 flex items-center justify-center text-earth-light hover:bg-earth/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                
                <button 
                  onClick={() => isLastStep ? onClose() : setCurrentStep(s => s + 1)}
                  className="bg-playful-purple text-white py-2 px-5 rounded-full shadow-lg shadow-playful-purple/20 flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isLastStep 
                      ? (primaryLanguage === 'es' ? 'Listo' : 'Done') 
                      : (step.cta ? step.cta[primaryLanguage] : (primaryLanguage === 'es' ? 'Siguiente' : 'Next'))}
                  </span>
                  {isLastStep ? <Check size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, ChevronLeft, Sparkles, Play, Languages, Bookmark, Check, Settings, Layers, Share2, EyeOff, MessageCircle } from "lucide-react";

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
      es: "Cambia aquí la versión de la Biblia." 
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
    id: "practice-mechanic",
    title: { en: "Guided Practice", es: "Práctica guiada" },
    description: { 
      en: "You won't type here yet. We'll gradually remove letters as you rehearse, so your memory gets stronger each round.", 
      es: "Aquí no escribirás todavía. Iremos quitando letras gradualmente mientras ensayas, para que tu memoria se fortalezca en cada paso." 
    },
    targetId: "memorize-verse-card",
    icon: <EyeOff className="text-playful-purple" size={24} />,
    tab: "memorize"
  },
  {
    id: "recall-challenge",
    title: { en: "Final Recall", es: "Recuerdo final" },
    description: { 
      en: "On the last step, you'll type the verse from memory. If you need a little help, you can use a clue.", 
      es: "En el último paso, escribirás el versículo de memoria. Si necesitas un poco de ayuda, puedes usar una pista." 
    },
    targetId: "memorize-controls",
    icon: <MessageCircle className="text-playful-purple" size={24} />,
    tab: "memorize"
  },
  {
    id: "nav-cards-step",
    title: { en: "Citation Challenge", es: "Reto de la cita bíblica" },
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
  onStepChange?: (stepId: string) => void;
}

export default function ProductTour({ isOpen, onClose, primaryLanguage, onTabChange, onStepChange }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 20, placement: 'bottom' as 'top' | 'bottom' });
  const [arrowLeft, setArrowLeft] = useState(160);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const step = TOUR_STEPS[currentStep];
      if (!step) {
        setHasError(true);
        return;
      }

      if (step.tab && onTabChange) {
        onTabChange(step.tab);
      }

      if (onStepChange) {
        onStepChange(step.id);
      }

      const updateRect = (iteration = 0) => {
        const target = document.getElementById(step.targetId);
        
        // Responsive tooltip width
        const isSmallScreen = window.innerWidth < 640;
        const tooltipWidth = isSmallScreen ? Math.min(window.innerWidth - 32, 280) : 320;
        
        if (target) {
          const rect = target.getBoundingClientRect();
          // This catches cases where elements are mid-animation or hidden initially
          if (rect.width === 0 && iteration < 10) {
            setTimeout(() => updateRect(iteration + 1), 100);
            return;
          }

          setTargetRect(rect);
          
          // Calculate tooltip position with safety margins
          const spaceBelow = window.innerHeight - rect.bottom;
          const tooltipHeight = isSmallScreen ? 180 : 220; // Estimate height based on compactness
          const placement = spaceBelow > (tooltipHeight + 40) ? 'bottom' : 'top';
          
          let top = placement === 'bottom' 
            ? rect.bottom + 12 
            : rect.top - tooltipHeight - 12;
            
          // Bounds checking for vertical positioning
          top = Math.max(isSmallScreen ? 10 : 20, Math.min(window.innerHeight - tooltipHeight - (isSmallScreen ? 10 : 20), top));
          
          // Horizontal positioning with edge safety
          const targetCenter = rect.left + rect.width / 2;
          let left = targetCenter - tooltipWidth / 2;
          const margin = isSmallScreen ? 16 : 20;
          left = Math.max(margin, Math.min(window.innerWidth - tooltipWidth - margin, left));
          
          // Calculate dynamic arrow position relative to tooltip
          const arrowX = targetCenter - left;
          // Clamp arrow position
          setArrowLeft(Math.max(20, Math.min(tooltipWidth - 20, arrowX)));
          
          setTooltipPos({ top, left, placement });
        } else {
          // If returning to a tab, the element might not be in DOM yet
          if (iteration < 15) {
            setTimeout(() => updateRect(iteration + 1), 100);
            return;
          }
          console.warn(`[Tour Debug] Target element NOT FOUND after retries: ${step.targetId}. Falling back to center.`);
          setTargetRect(null);
          setTooltipPos({ top: 100, left: (window.innerWidth - 320) / 2, placement: 'bottom' });
          setArrowLeft(tooltipWidth / 2);
        }
      };
      
      // Multi-phase measurement to catch start, middle, and end of layout transitions
      // This is crucial for spring animations that can take up to 1s to fully settle
      const timerS = setTimeout(() => updateRect(0), 100);
      const timerM = setTimeout(() => updateRect(0), 400);
      const timerL = setTimeout(() => updateRect(0), 1000);
      
      window.addEventListener('resize', () => updateRect(0));
      window.addEventListener('scroll', () => updateRect(0), true);

      return () => {
        window.removeEventListener('resize', () => updateRect(0));
        window.removeEventListener('scroll', () => updateRect(0), true);
        clearTimeout(timerS);
        clearTimeout(timerM);
        clearTimeout(timerL);
      };
    }
  }, [isOpen, currentStep, onTabChange]);

  if (!isOpen || hasError) return null;

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
          className="absolute inset-0 bg-espresso/80 pointer-events-auto"
          style={{
            clipPath: targetRect ? `polygon(
              0% 0%, 0% 100%, 
              ${targetRect.left - 4}px 100%, 
              ${targetRect.left - 4}px ${targetRect.top - 4}px, 
              ${targetRect.right + 4}px ${targetRect.top - 4}px, 
              ${targetRect.right + 4}px ${targetRect.bottom + 4}px, 
              ${targetRect.left - 4}px ${targetRect.bottom + 4}px, 
              ${targetRect.left - 4}px 100%, 
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
              className="absolute z-[101] border border-white/40 rounded-[20px] sm:rounded-[32px]"
              style={{
                left: targetRect.left - 4,
                top: targetRect.top - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
              }}
            />
          )}
        </AnimatePresence>

        {/* Tour Card - Relative to target */}
        <div 
          className="absolute z-[102] w-full pointer-events-auto transition-all duration-500 ease-out"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            maxWidth: window.innerWidth < 640 ? Math.min(window.innerWidth - 32, 280) : 320
          }}
        >
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: tooltipPos.placement === 'bottom' ? -10 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: tooltipPos.placement === 'bottom' ? -10 : 10 }}
            className="bg-white dark:bg-charcoal rounded-[24px] shadow-2xl border border-earth/10 dark:border-white/10 p-4 sm:p-6 relative"
          >
            {/* Arrow */}
            <div 
              style={{ left: arrowLeft }}
              className={`absolute -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent ${
                tooltipPos.placement === 'bottom' 
                  ? 'bottom-full border-b-[8px] border-b-white dark:border-b-charcoal' 
                  : 'top-full border-t-[8px] border-t-white dark:border-t-charcoal'
              }`}
            />

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-earth/5 dark:bg-white/5 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-base sm:text-lg font-serif font-black text-earth dark:text-ivory tracking-tight">
                    {step.title[primaryLanguage]}
                  </h3>
                </div>
                <span className="text-[9px] sm:text-[10px] font-black text-earth-light/40 dark:text-lavender-muted/40 uppercase tracking-widest">
                  {currentStep + 1} / {TOUR_STEPS.length}
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-earth-light dark:text-lavender-muted leading-relaxed font-medium">
                {step.description[primaryLanguage]}
              </p>
            </div>

            <div className="mt-6 sm:mt-8 flex items-center justify-between">
              <button 
                onClick={onClose}
                className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 hover:text-earth dark:hover:text-ivory transition-colors"
              >
                {primaryLanguage === 'es' ? 'Saltar' : 'Skip'}
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button 
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-earth/5 dark:bg-white/5 flex items-center justify-center text-earth-light hover:bg-earth/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                
                <button 
                  onClick={() => isLastStep ? onClose() : setCurrentStep(s => s + 1)}
                  className="bg-playful-purple text-white py-1.5 px-4 sm:py-2 sm:px-5 rounded-full shadow-lg shadow-playful-purple/20 flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
                >
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
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

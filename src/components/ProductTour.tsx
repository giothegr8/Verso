import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, ChevronLeft, Sparkles, BookOpen, Layers, Bookmark, Check } from "lucide-react";

interface TourStep {
  id: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  targetId: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "votd",
    title: { en: "Verse of the Day", es: "Versículo del día" },
    description: { 
      en: "This is your verse for today. First, read the verse and say it out loud.", 
      es: "Este es tu versículo de hoy. Primero, lee el versículo y dilo en voz alta." 
    },
    targetId: "votd-card",
    icon: <Sparkles className="text-golden" size={24} />
  },
  {
    id: "memorize",
    title: { en: "Memorize", es: "Memorizar" },
    description: { 
      en: "Say it out loud as the words disappear. You do not type yet. Just rehearse!", 
      es: "Dilo en voz alta mientras las palabras desaparecen. Todavía no escribas. ¡Solo ensaya!" 
    },
    targetId: "nav-memorize",
    icon: <BookOpen className="text-playful-purple" size={24} />
  },
  {
    id: "final",
    title: { en: "Final Challenge", es: "Reto final" },
    description: { 
      en: "At the end, you type the citation. This helps you remember where it is found.", 
      es: "Al final, escribes la cita. Esto te ayuda a recordar dónde se encuentra." 
    },
    targetId: "nav-flashcards",
    icon: <Layers className="text-coral" size={24} />
  },
  {
    id: "saved",
    title: { en: "Saved & Progress", es: "Guardados y progreso" },
    description: { 
      en: "Your saved verses live here. You can review them anytime.", 
      es: "Tus versículos guardados viven aquí. Puedes repasarlos en cualquier momento." 
    },
    targetId: "nav-saved",
    icon: <Bookmark className="text-earth-light" size={24} />
  }
];

interface ProductTourProps {
  isOpen: boolean;
  onClose: () => void;
  primaryLanguage: 'en' | 'es';
}

export default function ProductTour({ isOpen, onClose, primaryLanguage }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen) {
      const updateRect = () => {
        const target = document.getElementById(TOUR_STEPS[currentStep].targetId);
        if (target) {
          setTargetRect(target.getBoundingClientRect());
        }
      };
      updateRect();
      window.addEventListener('resize', updateRect);
      return () => window.removeEventListener('resize', updateRect);
    }
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
        {/* Backdrop with spotlight */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-earth/40 backdrop-blur-sm pointer-events-auto"
          style={{
            clipPath: targetRect ? `polygon(
              0% 0%, 0% 100%, 
              ${targetRect.left}px 100%, 
              ${targetRect.left}px ${targetRect.top}px, 
              ${targetRect.right}px ${targetRect.top}px, 
              ${targetRect.right}px ${targetRect.bottom}px, 
              ${targetRect.left}px ${targetRect.bottom}px, 
              ${targetRect.left}px 100%, 
              100% 100%, 100% 0%
            )` : 'none'
          }}
          onClick={onClose}
        />

        {/* Tour Card */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-sm bg-white dark:bg-charcoal rounded-[32px] shadow-2xl border border-earth/10 dark:border-white/10 p-8 pointer-events-auto relative overflow-hidden"
          >
            {/* Progress Dots */}
            <div className="flex gap-1.5 mb-6">
              {TOUR_STEPS.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-500 ${idx === currentStep ? 'w-6 bg-playful-purple' : 'w-2 bg-earth/10 dark:bg-white/10'}`}
                />
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-earth/5 dark:bg-white/5 flex items-center justify-center">
                  {step.icon}
                </div>
                <h3 className="text-xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                  {step.title[primaryLanguage]}
                </h3>
              </div>
              
              <p className="text-earth-light dark:text-lavender-muted leading-relaxed font-medium">
                {step.description[primaryLanguage]}
              </p>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button 
                onClick={onClose}
                className="text-xs font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 hover:text-earth dark:hover:text-ivory transition-colors"
              >
                {primaryLanguage === 'es' ? 'Saltar' : 'Skip'}
              </button>

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button 
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="w-10 h-10 rounded-full bg-earth/5 dark:bg-white/5 flex items-center justify-center text-earth-light hover:bg-earth/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                
                <button 
                  onClick={() => isLastStep ? onClose() : setCurrentStep(s => s + 1)}
                  className="btn-primary py-3 px-6 shadow-xl shadow-playful-purple/20 flex items-center gap-2"
                >
                  <span className="text-xs font-black uppercase tracking-widest">
                    {isLastStep 
                      ? (primaryLanguage === 'es' ? 'Listo' : 'Done') 
                      : (primaryLanguage === 'es' ? 'Siguiente' : 'Next')}
                  </span>
                  {isLastStep ? <Check size={16} /> : <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

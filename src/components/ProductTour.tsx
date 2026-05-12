import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, ChevronLeft, Sparkles, BookOpen, Layers, Compass, Sprout, Check, Home, Brain } from "lucide-react";

interface TourStep {
  id: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  targetId: string;
  icon: React.ReactNode;
  tab?: string;
  highlightTab?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "nav-home",
    title: { en: "Home", es: "Inicio" },
    description: { 
      en: "Start each day with your verse, streak, and current path.", 
      es: "Empieza cada día con tu versículo, tus días seguidos y tu serie actual." 
    },
    targetId: "home-summary",
    icon: <Home className="text-playful-purple" size={24} />,
    tab: "home",
    highlightTab: "nav-home"
  },
  {
    id: "votd-card",
    title: { en: "Today's Verse", es: "Versículo del día" },
    description: { 
      en: "Read it slowly. This is your daily focus.", 
      es: "Léelo con calma. Este es tu enfoque diario." 
    },
    targetId: "votd-card",
    icon: <BookOpen className="text-teal" size={24} />,
    tab: "home",
    highlightTab: "nav-home"
  },
  {
    id: "nav-paths",
    title: { en: "Paths", es: "Series" },
    description: { 
      en: "Choose a Scripture journey for what you’re walking through.", 
      es: "Elige un recorrido en la Palabra para lo que estás viviendo." 
    },
    targetId: "paths-content",
    icon: <Compass className="text-teal" size={24} />,
    tab: "paths",
    highlightTab: "nav-paths"
  },
  {
    id: "nav-memorize",
    title: { en: "Memorize", es: "Memorizar" },
    description: { 
      en: "Practice the verse step by step until it settles in your heart.", 
      es: "Practica el versículo paso a paso hasta guardarlo en el corazón." 
    },
    targetId: "memorize-content",
    icon: <BookOpen className="text-gold" size={24} />,
    tab: "memorize",
    highlightTab: "nav-memorize"
  },
  {
    id: "nav-flashcards",
    title: { en: "Cards", es: "Tarjetas" },
    description: { 
      en: "Review and test the reference from memory.", 
      es: "Repasa y prueba la cita bíblica de memoria." 
    },
    targetId: "cards-content",
    icon: <Layers className="text-coral" size={24} />,
    tab: "flashcards",
    highlightTab: "nav-flashcards"
  },
  {
    id: "nav-saved",
    title: { en: "Saved", es: "Guardados" },
    description: { 
      en: "Keep verses you want to return to again and again.", 
      es: "Guarda los versículos a los que quieres volver." 
    },
    targetId: "saved-content",
    icon: <Sprout className="text-earth-light" size={24} />,
    tab: "saved",
    highlightTab: "nav-saved"
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
  const [navRect, setNavRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 20, placement: 'bottom' as 'top' | 'bottom' });
  const [arrowLeft, setArrowLeft] = useState(160);

  // Explicitly reset step when tour is opened (e.g. manual replay from settings)
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const updateRect = useCallback((iteration = 0) => {
    if (!isOpen) return;
    
    // Responsive configuration
    const isSmallScreen = window.innerWidth < 640;
    const tooltipWidth = isSmallScreen ? Math.min(window.innerWidth - 32, 280) : 320;
    const margin = isSmallScreen ? 12 : 24;
    const tooltipHeight = isSmallScreen ? 140 : 200;

    const step = TOUR_STEPS[currentStep];
    const target = document.getElementById(step.targetId);
    const navItem = step.highlightTab ? document.getElementById(step.highlightTab) : null;
    
    if (navItem) {
      setNavRect(navItem.getBoundingClientRect());
    } else {
      setNavRect(null);
    }
    
    if (target || isSmallScreen) {
      let rect: DOMRect;
      
      if (isSmallScreen) {
        // Broad highlights for mobile logic moved to target-based detection
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        rect = target?.getBoundingClientRect() || { 
          top: 100, 
          bottom: 300, 
          left: 16, 
          right: width - 16, 
          width: width - 32, 
          height: 200 
        } as DOMRect;
      } else {
        rect = target?.getBoundingClientRect()!;
        if ((!rect || rect.width === 0) && iteration < 10) {
          setTimeout(() => updateRect(iteration + 1), 100);
          return;
        }
      }

      if (!rect) return;

      setTargetRect(rect);
      
      const bottomNavHeight = 84;
      const safeBottom = window.innerHeight - bottomNavHeight - 20;

      if (isSmallScreen) {
        // Mobile positioning: Bottom if highlight is top, otherwise top
        const isHighlightInTopHalf = rect.top < window.innerHeight / 2;
        
        let top: number;
        if (isHighlightInTopHalf) {
          // If highlight is at the top, place tooltip towards the bottom but above nav
          top = Math.min(rect.bottom + 20, safeBottom - tooltipHeight);
          // If even that overlaps, just stick to safe area
          if (top < rect.bottom && rect.bottom < safeBottom) {
             top = safeBottom - tooltipHeight;
          }
        } else {
          // If highlight is at the bottom, place tooltip at the top
          top = Math.max(margin, rect.top - tooltipHeight - 20);
          if (top < margin) top = 80; // Default top
        }

        setTooltipPos({
          top,
          left: (window.innerWidth - tooltipWidth) / 2,
          placement: isHighlightInTopHalf ? 'bottom' : 'top'
        });
      } else {
        const spaceBelow = window.innerHeight - rect.bottom - bottomNavHeight - 40;
        const spaceAbove = rect.top - 40;
        
        const placement = spaceBelow > tooltipHeight ? 'bottom' : 'top';
        
        let top = placement === 'bottom' 
          ? rect.bottom + 16 
          : rect.top - tooltipHeight - 16;
          
        // Constraint check: don't let it overlap bottom nav area on desktop
        if (placement === 'bottom' && (top + tooltipHeight) > safeBottom) {
          // If it overlaps, try placing it above
          if (spaceAbove > tooltipHeight) {
            top = rect.top - tooltipHeight - 16;
          } else {
             // If no space above or below, center it but shift away from bottom
             top = Math.max(margin, safeBottom - tooltipHeight - 40);
          }
        }
        
        top = Math.max(margin, Math.min(window.innerHeight - tooltipHeight - margin, top));
        
        const targetCenter = rect.left + rect.width / 2;
        let left = targetCenter - tooltipWidth / 2;
        left = Math.max(margin, Math.min(window.innerWidth - tooltipWidth - margin, left));
        
        const arrowX = targetCenter - left;
        setArrowLeft(Math.max(20, Math.min(tooltipWidth - 20, arrowX)));
        setTooltipPos({ top, left, placement });
      }
    } else if (iteration < 15) {
      setTimeout(() => updateRect(iteration + 1), 150);
    } else {
      // Fallback
      setTargetRect(null);
      setTooltipPos({ 
        top: (window.innerHeight - tooltipHeight) / 2, 
        left: (window.innerWidth - tooltipWidth) / 2, 
        placement: 'bottom' 
      });
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen) {
      const step = TOUR_STEPS[currentStep];
      
      // Navigate to the relevant tab
      if (step.tab && onTabChange) {
        onTabChange(step.tab);
      }
      
      if (onStepChange) {
        onStepChange(step.id);
      }

      // Re-measure after a short delay to allow tab transition to complete
      const measureTimer = setTimeout(() => updateRect(), 300);

      const isSmallScreen = window.innerWidth < 640;
      if (!isSmallScreen) {
        const observer = new ResizeObserver(() => updateRect());
        observer.observe(document.body);
        const updateInterval = setInterval(() => updateRect(), 1000);

        return () => {
          observer.disconnect();
          clearInterval(updateInterval);
          clearTimeout(measureTimer);
        };
      } else {
        window.addEventListener('resize', () => updateRect());
        return () => {
          window.removeEventListener('resize', () => updateRect());
          clearTimeout(measureTimer);
        };
      }
    }
  }, [isOpen, currentStep, onTabChange, onStepChange, updateRect]);

  if (!isOpen) return null;

  const isSmallScreen = window.innerWidth < 640;
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
          className="absolute inset-0 bg-charcoal/60 pointer-events-auto backdrop-blur-[1px]"
          style={{
            clipPath: (targetRect) ? `polygon(
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

        {/* Visual Highlight Border/Glow */}
        {targetRect && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute border-2 border-teal dark:border-teal-400 rounded-2xl pointer-events-none shadow-[0_0_20px_rgba(20,184,166,0.3)] z-[101]"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16
            }}
          />
        )}

        {/* Tour Card */}
        <div 
          className="absolute z-[102] w-full pointer-events-auto transition-all duration-500 ease-out flex justify-center px-4"
          style={{
            top: tooltipPos.top,
            left: isSmallScreen ? 0 : tooltipPos.left,
            maxWidth: isSmallScreen ? '100%' : (window.innerWidth < 1024 ? 300 : 320)
          }}
        >
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9, y: isSmallScreen ? 20 : (tooltipPos.placement === 'bottom' ? -20 : 20) }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: isSmallScreen ? 20 : (tooltipPos.placement === 'bottom' ? -20 : 20) }}
            className={`bg-charcoal border border-white/10 rounded-[32px] shadow-2xl ${isSmallScreen ? 'p-5' : 'p-6'} relative overflow-hidden ring-1 ring-white/5 w-full max-w-[320px]`}
          >
            {/* Arrow - Hidden on mobile */}
            {!isSmallScreen && targetRect && (
              <div 
                style={{ left: arrowLeft }}
                className={`absolute -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent ${
                  tooltipPos.placement === 'bottom' 
                    ? 'bottom-full border-b-[10px] border-b-charcoal' 
                    : 'top-full border-t-[10px] border-t-charcoal'
                }`}
              />
            )}

            <div className={`${isSmallScreen ? 'space-y-3' : 'space-y-4'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${isSmallScreen ? 'w-8 h-8 rounded-xl' : 'w-10 h-10 rounded-2xl'} bg-white/5 flex items-center justify-center shadow-inner`}>
                    {React.cloneElement(step.icon as React.ReactElement<any>, { size: isSmallScreen ? 20 : 24 })}
                  </div>
                  <h3 className={`${isSmallScreen ? 'text-base' : 'text-lg'} font-serif font-black text-ivory tracking-tight`}>
                    {step.title[primaryLanguage]}
                  </h3>
                </div>
                <div className="px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
                  <span className="text-[10px] font-black text-ivory/40 uppercase tracking-widest whitespace-nowrap">
                    {currentStep + 1} / {TOUR_STEPS.length}
                  </span>
                </div>
              </div>
              
              <p className={`${isSmallScreen ? 'text-xs' : 'text-sm'} text-lavender-muted leading-relaxed font-medium`}>
                {step.description[primaryLanguage]}
              </p>
            </div>

            <div className={`${isSmallScreen ? 'mt-6' : 'mt-8'} flex items-center justify-between`}>
              <button 
                onClick={onClose}
                className="text-[10px] font-black uppercase tracking-widest text-lavender-muted/40 hover:text-ivory transition-colors"
              >
                {primaryLanguage === 'es' ? 'Saltar' : 'Skip'}
              </button>

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button 
                    onClick={() => setCurrentStep(s => s - 1)}
                    className={`${isSmallScreen ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-white/5 flex items-center justify-center text-ivory/40 hover:bg-white/10 hover:text-ivory transition-all`}
                  >
                    <ChevronLeft size={isSmallScreen ? 16 : 20} />
                  </button>
                )}
                
                <button 
                  onClick={() => isLastStep ? onClose() : setCurrentStep(s => s + 1)}
                  className={`bg-white text-charcoal ${isSmallScreen ? 'py-2 px-4' : 'py-2.5 px-6'} rounded-full shadow-xl flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isLastStep 
                      ? (primaryLanguage === 'es' ? 'Listo' : 'Done') 
                      : (primaryLanguage === 'es' ? 'Siguiente' : 'Next')}
                  </span>
                  {isLastStep ? <Check size={16} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={3} />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Nav Highlight */}
        {navRect && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute z-[101] border-2 border-teal rounded-xl pointer-events-none shadow-[0_0_15px_rgba(20,184,166,0.6)]"
            style={{
              top: navRect.top - 4,
              left: navRect.left - 4,
              width: navRect.width + 8,
              height: navRect.height + 8
            }}
          >
             <motion.div 
               animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="absolute inset-0 bg-teal/20 rounded-xl"
             />
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}


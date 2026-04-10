import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Translation, LanguageMode, ReminderSettings } from "../types";
import { ChevronRight, Check, Globe, Book, Moon } from "lucide-react";

interface OnboardingProps {
  onComplete: (prefs: Partial<AppState>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Partial<AppState>>({
    primaryLanguage: "es",
    memorizeMode: "es",
    theme: "system",
    reminders: {
      enabled: false,
      type: "notification",
      time: "09:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const next = () => setStep(s => s + 1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            key="step1"
            className="space-y-8 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-24 h-24 bg-playful-purple/10 rounded-[32px] flex items-center justify-center mx-auto text-playful-purple shadow-lg shadow-playful-purple/10">
              <Book size={48} />
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-serif font-black text-playful-purple tracking-tighter">Verso</h1>
              <p className="text-lg font-medium text-earth/60 dark:text-ivory/60">
                Memoriza un versículo al día.<br />
                One verse a day.
              </p>
            </div>
            <button onClick={next} className="w-full btn-primary">
              Comenzar / Start
            </button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div 
            key="step2"
            className="space-y-8"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">Tu idioma</h2>
              <p className="text-sm font-medium text-earth/60 dark:text-ivory/60">¿En qué idioma prefieres aprender?</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {['es', 'en'].map((lang) => (
                <button 
                  key={lang}
                  onClick={() => setPrefs(p => ({ ...p, primaryLanguage: lang as any }))}
                  className={`card p-6 flex justify-between items-center transition-all border-2 ${prefs.primaryLanguage === lang ? 'border-playful-purple bg-playful-purple/5 dark:bg-playful-purple/10 shadow-lg shadow-playful-purple/10' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal'}`}
                >
                  <span className="font-black text-lg text-earth dark:text-ivory">{lang === 'es' ? 'Español' : 'English'}</span>
                  {prefs.primaryLanguage === lang && <Check className="text-playful-purple" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <button onClick={next} className="w-full btn-primary flex items-center justify-center gap-2">
              <span>Siguiente</span>
              <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            key="step3"
            className="space-y-8"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">Memorización bilingüe</h2>
              <p className="text-sm font-medium text-earth/60 dark:text-ivory/60">¿Te gustaría ver los versículos en ambos idiomas?</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'es', label: 'Solo Español', sub: 'Spanish only' },
                { id: 'en', label: 'Solo Inglés', sub: 'English only' },
                { id: 'both', label: 'Ambos idiomas', sub: 'Both languages' },
              ].map((mode) => (
                <button 
                  key={mode.id}
                  onClick={() => setPrefs(p => ({ ...p, memorizeMode: mode.id as any }))}
                  className={`card p-6 flex justify-between items-center transition-all border-2 ${prefs.memorizeMode === mode.id ? 'border-playful-purple bg-playful-purple/5 dark:bg-playful-purple/10 shadow-lg shadow-playful-purple/10' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal'}`}
                >
                  <div className="text-left">
                    <p className="font-black text-lg text-earth dark:text-ivory">{mode.label}</p>
                    <p className="text-xs font-bold text-earth/40 dark:text-ivory/40 uppercase tracking-widest">{mode.sub}</p>
                  </div>
                  {prefs.memorizeMode === mode.id && <Check className="text-playful-purple" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <button onClick={() => onComplete(prefs)} className="w-full btn-primary flex items-center justify-center gap-2">
              <span>¡Todo listo! / All set!</span>
              <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-parchment dark:bg-espresso flex flex-col justify-center p-8 max-w-md mx-auto transition-colors duration-500 relative overflow-hidden">
      <AnimatePresence mode="popLayout">
        {renderStep()}
      </AnimatePresence>
    </div>
  );
}

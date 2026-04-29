import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Translation, LanguageMode, ReminderSettings } from "../types";
import { ChevronRight, Check, Globe, BookOpen, Moon, Sparkles } from "lucide-react";

interface OnboardingProps {
  onComplete: (prefs: Partial<AppState>) => void;
}

const TRANSLATIONS = {
  es: {
    welcome: "Memoriza un versículo al día.",
    welcomeSub: "Estudia la palabra en tu idioma.",
    start: "Comenzar",
    languageTitle: "Tu idioma",
    languageSubtitle: "¿En qué idioma prefieres aprender?",
    next: "Siguiente",
    bilingualTitle: "Memorización bilingüe",
    bilingualSubtitle: "¿Te gustaría ver los versículos en ambos idiomas?",
    modes: {
      es: { label: "Solo Español", sub: "Spanish only" },
      en: { label: "Solo Inglés", sub: "English only" },
      both: { label: "Ambos idiomas", sub: "Both languages" }
    },
    allSet: "¡Todo listo!",
    error: "Algo salió mal.",
    restart: "Reiniciar Onboarding"
  },
  en: {
    welcome: "Memorize one verse a day.",
    welcomeSub: "Study the word in your language.",
    start: "Start",
    languageTitle: "Your Language",
    languageSubtitle: "Which language do you prefer for learning?",
    next: "Next",
    bilingualTitle: "Bilingual Memorization",
    bilingualSubtitle: "Would you like to see the verses in both languages?",
    modes: {
      es: { label: "Spanish Only", sub: "Solo Español" },
      en: { label: "English Only", sub: "Solo Inglés" },
      both: { label: "Both Languages", sub: "Ambos idiomas" }
    },
    allSet: "All set!",
    error: "Something went wrong.",
    restart: "Restart Onboarding"
  }
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Partial<AppState>>(() => {
    let timezone = "UTC";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) {
      console.warn("[Onboarding] Failed to detect timezone:", e);
    }
    
    return {
      primaryLanguage: "es",
      memorizeMode: "es",
      theme: "system",
      reminders: {
        enabled: false,
        type: "notification",
        time: "09:00",
        timezone,
      },
    };
  });

  const t = TRANSLATIONS[prefs.primaryLanguage as "es" | "en"] || TRANSLATIONS.es;

  const next = () => {
    console.log("[Onboarding] Moving to next step. Current:", step, "Language:", prefs.primaryLanguage);
    setStep(s => {
      const nextStep = s + 1;
      if (nextStep > 3) {
        console.warn("[Onboarding] Step exceeding bounds, ignoring increment:", nextStep);
        return s;
      }
      return nextStep;
    });
  };

  const handleComplete = () => {
    console.log("[Onboarding] Completion button clicked. Final UI Locale:", prefs.primaryLanguage, "Memorization Mode:", prefs.memorizeMode);
    onComplete(prefs);
  };

  const handleLanguageSelect = (lang: "es" | "en") => {
    console.log(`[Onboarding] Language option tapped: ${lang}. Current UI Locale was: ${prefs.primaryLanguage}`);
    setPrefs(p => ({ 
      ...p, 
      primaryLanguage: lang,
      // Default memorizeMode to match UI language choice, but user can override in next step
      memorizeMode: lang
    }));
  };

  const handleModeSelect = (mode: LanguageMode) => {
    console.log(`[Onboarding] Memorization mode selection: ${mode}. UI Locale remains: ${prefs.primaryLanguage}`);
    setPrefs(p => ({ ...p, memorizeMode: mode }));
  };

  console.log("[Onboarding] Rendering step:", step, "| UI Locale:", prefs.primaryLanguage, "| MemMode:", prefs.memorizeMode);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            key="step1"
            className="space-y-12 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-24 h-24 bg-playful-purple/10 rounded-[40px] flex items-center justify-center mx-auto text-playful-purple shadow-xl shadow-playful-purple/5 relative">
              <BookOpen size={48} strokeWidth={1.5} />
              <motion.div 
                className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-charcoal rounded-full flex items-center justify-center shadow-lg"
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Sparkles size={16} className="text-gold" fill="currentColor" />
              </motion.div>
            </div>

            <div className="space-y-6">
              <h1 className="text-5xl sm:text-6xl font-serif font-black text-playful-purple tracking-tighter">Verso</h1>
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory leading-tight tracking-tight px-2">
                    {TRANSLATIONS.es.welcome}
                  </p>
                  <p className="text-xl font-serif font-medium text-earth/30 dark:text-ivory/30 italic leading-tight">
                    {TRANSLATIONS.en.welcome}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8 pt-4">
              <div className="flex flex-col items-center gap-3">
                <div className="h-px w-8 bg-earth/10 dark:bg-white/10" />
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-earth/40 dark:text-ivory/40">
                    En español, en inglés o en ambos
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-earth/20 dark:text-ivory/20">
                    In Spanish, in English, or both
                  </p>
                </div>
              </div>

              <button 
                onClick={next} 
                className="w-full bg-playful-purple text-white py-7 rounded-[32px] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative"
              >
                <div className="flex items-baseline gap-3 relative z-10">
                  <span className="text-2xl font-black uppercase tracking-widest">{TRANSLATIONS.es.start}</span>
                  <span className="text-sm font-medium opacity-40 uppercase tracking-widest">{TRANSLATIONS.en.start}</span>
                </div>
                <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform opacity-60 relative z-10" />
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
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
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{t.languageTitle}</h2>
              <p className="text-sm font-medium text-earth/60 dark:text-ivory/60">{t.languageSubtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {['es', 'en'].map((lang) => (
                <button 
                  key={lang}
                  onClick={() => handleLanguageSelect(lang as any)}
                  className={`card p-6 flex justify-between items-center transition-all border-2 ${prefs.primaryLanguage === lang ? 'border-playful-purple bg-playful-purple/5 dark:bg-playful-purple/10 shadow-lg shadow-playful-purple/10' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal'}`}
                >
                  <span className="font-black text-lg text-earth dark:text-ivory">{lang === 'es' ? 'Español' : 'English'}</span>
                  {prefs.primaryLanguage === lang && <Check className="text-playful-purple" strokeWidth={3} />}
                </button>
              ))}
            </div>
            <button onClick={next} className="w-full btn-primary flex items-center justify-center gap-2">
              <span>{t.next}</span>
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
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{t.bilingualTitle}</h2>
              <p className="text-sm font-medium text-earth/60 dark:text-ivory/60">{t.bilingualSubtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'es' },
                { id: 'en' },
                { id: 'both' },
              ].map((mode) => {
                const modeT = t.modes[mode.id as keyof typeof t.modes];
                return (
                  <button 
                    key={mode.id}
                    onClick={() => handleModeSelect(mode.id as any)}
                    className={`card p-6 flex justify-between items-center transition-all border-2 ${prefs.memorizeMode === mode.id ? 'border-playful-purple bg-playful-purple/5 dark:bg-playful-purple/10 shadow-lg shadow-playful-purple/10' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal'}`}
                  >
                    <div className="text-left">
                      <p className="font-black text-lg text-earth dark:text-ivory">{modeT.label}</p>
                      <p className="text-xs font-bold text-earth/40 dark:text-ivory/40 uppercase tracking-widest">{modeT.sub}</p>
                    </div>
                    {prefs.memorizeMode === mode.id && <Check className="text-playful-purple" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <button onClick={handleComplete} className="w-full btn-primary flex items-center justify-center gap-2">
              <span>{t.allSet}</span>
              <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      default:
        console.error("[Onboarding] Unexpected step index reached:", step);
        return (
          <div className="text-center space-y-4">
            <p className="text-earth/60">{t.error}</p>
            <button onClick={() => setStep(1)} className="btn-primary">{t.restart}</button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen-dynamic bg-parchment dark:bg-espresso flex flex-col justify-center transition-colors duration-500 relative overflow-hidden">
      <div className="w-full max-w-md mx-auto p-4 sm:p-8 overflow-y-auto max-h-screen-dynamic scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
}

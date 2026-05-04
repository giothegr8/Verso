import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  ChevronRight, 
  ChevronLeft, 
  BookOpen, 
  Compass, 
  Activity, 
  Anchor, 
  ShieldAlert, 
  Sprout, 
  Clock, 
  Loader2,
  CheckCircle2,
  Check,
  User,
  AlertCircle
} from "lucide-react";
import { AppState, DailyRhythm, IdentityAnchor, Blocker, ReminderPreference, LanguageMode } from "../types";
import { PATHS } from "../constants";
import VersoLogo from "./VersoLogo";

interface OnboardingProps {
  onComplete: (prefs: Partial<AppState>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [appLanguage, setAppLanguage] = useState<"en" | "es">("en");
  const [memMode, setMemMode] = useState<LanguageMode>("both");
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [rhythm, setRhythm] = useState<DailyRhythm | null>(null);
  const [identity, setIdentity] = useState<IdentityAnchor | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [reminder, setReminder] = useState<ReminderPreference | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  // Total steps: 11
  const TOTAL_STEPS = 11;

  const [showFallback, setShowFallback] = useState(false);

  // Auto-advance logic for step 10
  useEffect(() => {
    let timer: any;
    let fallbackTimer: any;
    if (step === 10) {
      setShowFallback(false);
      // Actual advance timer
      timer = setTimeout(() => {
        setIsPreparing(false);
        setStep(11);
      }, 3500);

      // Show fallback button if it takes too long
      fallbackTimer = setTimeout(() => {
        setShowFallback(true);
      }, 5000);
    }
    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [step]);

  const next = () => {
    if (step === 10) {
      setIsPreparing(true);
      // Transition is now handled by useEffect logic
    } else {
      setStep(s => s + 1);
    }
  };

  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleFinish = () => {
    onComplete({
      primaryLanguage: appLanguage,
      memorizeMode: memMode,
      pathProgress: {
        selectedPathId,
        currentDay: 1,
        lastCompletedAt: null,
        pathCompletedToday: false,
        completedPathIds: [],
        savedProgress: {}
      },
      onboardingProfile: {
        dailyRhythm: rhythm || "daily",
        identityAnchorId: identity || "returner",
        blocker: blocker || "other",
        reminderPreference: reminder || "morning"
      }
    });
  };

  const t = {
    en: {
      langTitle: "Choose your language",
      langSub: "Set your main app language.",
      continue: "Continue",
      welcomeTitle: "Verso",
      welcomeHead: "Memorize one verse a day.",
      welcomeSub: "Store His Word in your heart, one day at a time.",
      welcomeBtn: "Begin",
      memTitle: "How do you want to memorize?",
      memSub: "Choose the language you want to practice in.",
      memOptions: [
        { id: "en", label: "English only" },
        { id: "es", label: "Spanish only" },
        { id: "both", label: "Both languages" }
      ],
      pathTitle: "Where do you want to begin?",
      pathSub: "Choose your first path in the Word.",
      rhythmTitle: "What habit feels realistic?",
      rhythmSub: "Start small. Let it grow.",
      rhythmOptions: [
        { id: "daily", label: "One verse a day" },
        { id: "weekly", label: "A few days a week" },
        { id: "path-based", label: "One path at a time" },
        { id: "loose", label: "I just want to begin" }
      ],
      identityTitle: "Who are you becoming?",
      identitySub: "Choose the reminder you want Verso to reflect back to you.",
      identityOptions: [
        { id: "returner", label: "I am someone who returns to the Word." },
        { id: "finisher", label: "I am someone who finishes what I start." },
        { id: "carrier", label: "I am someone who carries Scripture with me." },
        { id: "room-maker", label: "I am someone who makes room for God daily." }
      ],
      blockerTitle: "What usually gets in the way?",
      blockerSub: "We’ll help you keep the habit simple.",
      blockerOptions: [
        { id: "busy", label: "Busy schedule" },
        { id: "forgetful", label: "I forget" },
        { id: "inconsistent", label: "I start but don’t finish" },
        { id: "clueless", label: "I don’t know where to begin" },
        { id: "distracted", label: "I get distracted" },
        { id: "other", label: "Other" }
      ],
      encouragementHead: "Small roots grow deep.",
      encouragementSub: "You’re not just opening an app. You’re forming a habit with the Word.",
      encouragementFooter: "What you sow, you will reap.",
      reminderTitle: "When do you want to make room for the Word?",
      reminderSubtitle: "You can change this later.",
      reminderOptions: [
        { id: "morning", label: "Morning" },
        { id: "midday", label: "Midday" },
        { id: "evening", label: "Evening" },
        { id: "bedtime", label: "Before bed" },
        { id: "later", label: "I’ll decide later" }
      ],
      preTitle: "Preparing your first plan...",
      preCheck: [
        "Choosing your first path",
        "Setting your memorization language",
        "Preparing today’s verse",
        "Saving your reminder"
      ],
      readyTitle: "Your first path is ready.",
      readyBtn: "Start today's verse"
    },
    es: {
      langTitle: "Elige tu idioma",
      langSub: "Elige el idioma principal de la app.",
      continue: "Continuar",
      welcomeTitle: "Verso",
      welcomeHead: "Memoriza un versículo al día.",
      welcomeSub: "Guarda Su Palabra en tu corazón, un día a la vez.",
      welcomeBtn: "Empezar",
      memTitle: "¿Cómo quieres memorizar?",
      memSub: "Elige el idioma en el que quieres practicar.",
      memOptions: [
        { id: "es", label: "Solo español" },
        { id: "en", label: "Solo inglés" },
        { id: "both", label: "Ambos idiomas" }
      ],
      pathTitle: "¿Por dónde quieres empezar?",
      pathSub: "Elige tu primer camino en la Palabra.",
      rhythmTitle: "¿Qué hábito se siente posible?",
      rhythmSub: "Empieza pequeño. Deja que el hábito crezca.",
      rhythmOptions: [
        { id: "daily", label: "Un versículo al día" },
        { id: "weekly", label: "Algunos días a la semana" },
        { id: "path-based", label: "Un camino a la vez" },
        { id: "loose", label: "Solo quiero empezar" }
      ],
      identityTitle: "Haz un acuerdo contigo.",
      identitySub: "Elige la persona que quieres seguir formando con la Palabra.",
      identityOptions: [
        { id: "returner", label: "Quiero ser alguien que vuelve a la Palabra." },
        { id: "finisher", label: "Quiero ser alguien que termina lo que empieza." },
        { id: "carrier", label: "Quiero ser alguien que guarda la Escritura en el corazón." },
        { id: "room-maker", label: "Quiero ser alguien que hace espacio para Dios cada día." }
      ],
      blockerTitle: "¿Qué suele atravesarse?",
      blockerSub: "Te ayudaremos a mantener un hábito sencillo.",
      blockerOptions: [
        { id: "busy", label: "Muchos compromisos" },
        { id: "forgetful", label: "Se me olvida" },
        { id: "inconsistent", label: "No termino" },
        { id: "clueless", label: "No sé por dónde empezar" },
        { id: "distracted", label: "Me distraigo" },
        { id: "other", label: "Otro" }
      ],
      encouragementHead: "Las raíces pequeñas crecen profundo.",
      encouragementSub: "No solo estás abriendo una app. Estás formando un hábito con la Palabra.",
      encouragementFooter: "Lo que siembras, eso cosechas.",
      reminderTitle: "¿En qué momento del día quieres apartar tiempo?",
      reminderSubtitle: "Puedes cambiarlo después.",
      reminderOptions: [
        { id: "morning", label: "En la mañana" },
        { id: "midday", label: "Al mediodía" },
        { id: "evening", label: "En la tarde" },
        { id: "bedtime", label: "Antes de dormir" },
        { id: "later", label: "Lo decido después" }
      ],
      preTitle: "Preparando tu primer plan...",
      preCheck: [
        "Eligiendo tu primer camino",
        "Configurando tu idioma de memorización",
        "Preparando el versículo de hoy",
        "Guardando tu recordatorio"
      ],
      readyTitle: "Tu primer camino está listo.",
      readyBtn: "Empezar el versículo de hoy"
    }
  };

  const curr = t[appLanguage];

  const renderProgress = () => (
    <div className="fixed top-0 left-0 right-0 h-1.5 bg-earth/5 dark:bg-white/5 z-[60]">
      <motion.div 
        className="h-full bg-teal shadow-[0_0_10px_rgba(20,184,166,0.5)]"
        initial={{ width: 0 }}
        animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      />
    </div>
  );

  const renderStep = () => {
    switch(step) {
      case 1: // LANGUAGE
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal">
                <Globe size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight">Choose your language</h1>
                <p className="text-xl font-serif italic text-earth-light/60 dark:text-lavender-muted/60">Elige tu idioma</p>
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-earth-light/40 dark:text-ivory/30">
                Set your main app language <br/>
                <span className="opacity-60 text-[10px]">Elige el idioma principal de la app</span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'en', label: 'English', sub: 'Inglés' },
                { id: 'es', label: 'Español', sub: 'Spanish' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setAppLanguage(opt.id as "en" | "es")}
                  className={`p-6 rounded-[24px] border-2 transition-all flex justify-between items-center ${appLanguage === opt.id ? 'border-teal bg-teal/[0.03] shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <div className="text-left">
                    <p className="text-xl font-black text-earth dark:text-ivory">{opt.label}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/30 dark:text-ivory/20">{opt.sub}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${appLanguage === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {appLanguage === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2: // WELCOME
        return (
          <div className="text-center space-y-12 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <VersoLogo size="xl" showText={true} variant="onboarding" />
            <div className="space-y-3">
              <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory leading-tight">{curr.welcomeHead}</h3>
              <p className="text-lg font-serif italic text-earth-light/60 dark:text-lavender-muted/60 leading-relaxed px-4">{curr.welcomeSub}</p>
            </div>
          </div>
        );

      case 3: // MEM MODE
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto text-gold mb-6">
                <BookOpen size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.memTitle}</h2>
              <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.memSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {curr.memOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setMemMode(opt.id as LanguageMode)}
                  className={`p-6 rounded-[24px] border-2 transition-all flex justify-between items-center ${memMode === opt.id ? 'border-teal bg-teal/[0.03] shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${memMode === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {memMode === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4: // PATH
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-6">
                <Compass size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.pathTitle}</h2>
              <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.pathSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto px-1 custom-scrollbar">
              {PATHS.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  className={`p-4 rounded-[20px] border-2 transition-all flex justify-between items-center ${selectedPathId === p.id ? 'border-teal bg-teal/[0.03] shadow-lg shadow-teal/5' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-sm font-bold text-earth dark:text-ivory">{appLanguage === 'es' ? p.titleEs : p.title}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 ${selectedPathId === p.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {selectedPathId === p.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 5: // RHYTHM
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-6">
                <Activity size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.rhythmTitle}</h2>
              <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.rhythmSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {curr.rhythmOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setRhythm(opt.id as DailyRhythm)}
                  className={`p-6 rounded-[24px] border-2 transition-all flex justify-between items-center ${rhythm === opt.id ? 'border-teal bg-teal/[0.03] shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${rhythm === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {rhythm === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 6: // IDENTITY
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-6">
                <Anchor size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.identityTitle}</h2>
              <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.identitySub}</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {curr.identityOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setIdentity(opt.id as IdentityAnchor)}
                  className={`p-6 rounded-[24px] border-2 transition-all flex justify-between items-center text-left ${identity === opt.id ? 'border-teal bg-teal/[0.03] shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-base font-black text-earth dark:text-ivory leading-tight">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${identity === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {identity === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 7: // BLOCKER
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-coral/10 rounded-2xl flex items-center justify-center mx-auto text-coral mb-6">
                <ShieldAlert size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.blockerTitle}</h2>
              <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.blockerSub}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {curr.blockerOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setBlocker(opt.id as Blocker)}
                  className={`p-4 h-32 rounded-[24px] border-2 transition-all flex flex-col justify-between items-start text-left ${blocker === opt.id ? 'border-coral bg-coral/[0.03] shadow-[0_0_15px_rgba(255,107,107,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-coral/30'}`}
                >
                  <span className="text-base font-black text-earth dark:text-ivory leading-tight">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${blocker === opt.id ? 'bg-coral border-coral text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {blocker === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 8: // ENCOURAGEMENT
        return (
          <div className="text-center space-y-12 w-full animate-in fade-in zoom-in duration-1000">
            <div className="space-y-10">
              <div className="relative inline-block">
                <div className="w-32 h-32 bg-teal/5 rounded-full flex items-center justify-center mx-auto text-teal blur-sm animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sprout size={64} className="text-teal" strokeWidth={1.5} />
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.encouragementHead}</h2>
                  <p className="text-lg font-serif italic text-earth-light/60 dark:text-lavender-muted/60 leading-relaxed max-w-xs mx-auto">{curr.encouragementSub}</p>
                </div>
                {curr.encouragementFooter && (
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal/40 animate-pulse">
                    {curr.encouragementFooter}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 9: // REMINDERS
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-6">
                <Clock size={30} />
              </div>
              <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.reminderTitle}</h2>
              {curr.reminderSubtitle && (
                <p className="text-sm font-medium text-earth-light/60 dark:text-lavender-muted/60 px-6">{curr.reminderSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 px-4">
              {curr.reminderOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setReminder(opt.id as ReminderPreference)}
                  className={`p-6 rounded-[24px] border-2 transition-all flex justify-between items-center ${reminder === opt.id ? 'border-teal bg-teal/[0.03] shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${reminder === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {reminder === opt.id && <Check size={14} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 10: // PREPARING
        return (
          <div className="text-center space-y-12 w-full">
            <div className="space-y-10">
              <div className="w-20 h-20 bg-teal/10 rounded-3xl flex items-center justify-center mx-auto text-teal relative">
                <Loader2 size={40} className="animate-spin" />
              </div>
              <div className="space-y-8">
                <h2 className="text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.preTitle}</h2>
                <div className="space-y-4 max-w-xs mx-auto">
                  {curr.preCheck.map((line, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.6 }}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className="w-5 h-5 rounded-full bg-teal/10 flex items-center justify-center text-teal">
                        <Check size={12} strokeWidth={4} />
                      </div>
                      <span className="text-sm font-bold text-earth-light/60 dark:text-lavender-muted/60">{line}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Safe Fallback Button */}
              {showFallback && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => {
                    setIsPreparing(false);
                    setStep(11);
                  }}
                  className="mt-8 text-[10px] font-black uppercase tracking-widest text-teal hover:underline"
                >
                  {appLanguage === 'en' ? 'Continue' : 'Continuar'}
                </motion.button>
              )}
            </div>
          </div>
        );

      case 11: // READY
        return (
          <div className="text-center space-y-12 w-full animate-in fade-in zoom-in duration-700">
            <div className="space-y-10">
              <div className="w-24 h-24 bg-teal/10 rounded-[40px] flex items-center justify-center mx-auto text-teal shadow-2xl">
                <CheckCircle2 size={56} strokeWidth={1.2} />
              </div>
              <div className="space-y-8">
                <h2 className="text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.readyTitle}</h2>
                <div className="bg-white dark:bg-charcoal/50 rounded-[32px] p-8 border border-earth/5 dark:border-white/5 space-y-6 shadow-xl">
                  {selectedPathId && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-ivory/30">
                        {appLanguage === 'es' ? 'Tu camino' : 'Your path'}
                      </p>
                      <p className="text-xl font-serif font-black text-playful-purple">
                        {appLanguage === 'es' ? PATHS.find(p => p.id === selectedPathId)?.titleEs : PATHS.find(p => p.id === selectedPathId)?.title}
                      </p>
                    </div>
                  )}
                  {identity && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-ivory/30">
                        {appLanguage === 'es' ? 'Tu ancla' : 'Your anchor'}
                      </p>
                      <p className="text-sm font-serif italic text-earth-light/80 dark:text-lavender-muted">
                        "{curr.identityOptions.find(o => o.id === identity)?.label}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  const isNextDisabled = () => {
    if (step === 4) return !selectedPathId;
    if (step === 5) return !rhythm;
    if (step === 6) return !identity;
    if (step === 7) return !blocker;
    if (step === 9) return !reminder;
    return false;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-parchment dark:bg-espresso flex flex-col items-center justify-center transition-colors duration-500 overflow-hidden">
      {renderProgress()}
      
      <div className="w-full max-w-md h-full flex flex-col items-center justify-center p-6 relative">
        <AnimatePresence mode="wait">
          {isPreparing ? (
            <motion.div 
              key="preparing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center w-full"
            >
               {renderStep()}
            </motion.div>
          ) : (
            <motion.div 
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex items-center justify-center w-full overflow-y-auto scrollbar-hide py-10"
            >
              <div className="w-full">
                {renderStep()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Footer */}
        {!isPreparing && step < 10 && (
          <div className="w-full pt-8 flex flex-col gap-4">
            <button 
              onClick={next}
              disabled={isNextDisabled()}
              className={`w-full h-16 rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all ${isNextDisabled() ? 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-not-allowed' : 'bg-playful-purple text-white shadow-playful-purple/20 hover:scale-[1.02] active:scale-95'}`}
            >
              <span className="font-black uppercase tracking-widest text-lg">
                {step === 1 ? (appLanguage === 'en' ? 'Continue' : 'Continuar') : curr.continue}
              </span>
              <ChevronRight size={20} />
            </button>
            {step > 1 && (
              <button 
                onClick={prev}
                className="h-12 flex items-center justify-center gap-2 text-earth-light/40 dark:text-ivory/30 font-black uppercase tracking-[0.2em] text-[10px] hover:text-teal transition-all"
              >
                <ChevronLeft size={14} />
                {appLanguage === 'en' ? 'Back' : 'Atrás'}
              </button>
            )}
          </div>
        )}

        {step === 11 && (
          <div className="w-full pt-8">
            <button 
              onClick={handleFinish}
              className="w-full h-16 bg-playful-purple text-white rounded-[24px] shadow-2xl shadow-playful-purple/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="font-black uppercase tracking-widest text-lg">{curr.readyBtn}</span>
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
  AlertCircle,
  Mail,
  Lock,
  Crown
} from "lucide-react";
import { AppState, DailyRhythm, IdentityAnchor, Blocker, ReminderPreference, LanguageMode } from "../types";
import { PATHS } from "../constants";
import VersoLogo from "./VersoLogo";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import Paywall from "./Paywall";

interface OnboardingProps {
  onComplete: (prefs: Partial<AppState>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [appLanguage, setAppLanguage] = useState<"en" | "es">("en");
  const [memMode, setMemMode] = useState<LanguageMode>("both");
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [rhythm, setRhythm] = useState<DailyRhythm | null>(null);
  const [growthGoal, setGrowthGoal] = useState<{label: string, subline: string} | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [reminder, setReminder] = useState<ReminderPreference | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");

  const isSupabaseConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  // Total steps: 13
  // 1-9: Prefs, 10: Auth, 11: Preparing, 12: Ready, 13: Paywall
  const TOTAL_STEPS = 13;

  const [showFallback, setShowFallback] = useState(false);

  // Auto-advance logic for step 11 (Preparing)
  useEffect(() => {
    let timer: any;
    let fallbackTimer: any;
    if (step === 11) {
      setShowFallback(false);
      timer = setTimeout(() => {
        setIsPreparing(false);
        setStep(12);
      }, 3500);

      fallbackTimer = setTimeout(() => {
        setShowFallback(true);
      }, 5000);
    }
    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [step]);

  // If user is already authenticated and on step 10, advance
  useEffect(() => {
    if (step === 10 && user) {
      setStep(11);
    }
  }, [step, user]);

  const next = () => {
    if (step === 11) {
      setIsPreparing(true);
    } else {
      setStep(s => s + 1);
    }
  };

  const prev = () => setStep(s => Math.max(1, s - 1));

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Profile created by trigger in SQL migration
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // Auth change will be caught by useAuth and effect above will move step
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

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
        growthGoalLabel: growthGoal?.label,
        growthGoalSubline: growthGoal?.subline,
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
      welcomeSub: "Study Scripture in a way that stays with you.",
      welcomeBtn: "Begin",
      memTitle: "How do you want to memorize?",
      memSub: "Choose the language you want to practice in.",
      memHelper: "You can change this later in Settings.",
      memOptions: [
        { id: "en", label: "English only" },
        { id: "es", label: "Spanish only" },
        { id: "both", label: "Both languages" }
      ],
      pathTitle: "Where do you need guidance today?",
      pathSub: "Choose a path to follow with your daily verse.",
      pathHelper: "Each path is a guided set of verses for a specific season, struggle, or truth.",
      rhythmTitle: "What habit feels realistic?",
      rhythmSub: "Start small. Stay steady",
      rhythmOptions: [
        { id: "daily", label: "One verse a day" },
        { id: "weekly", label: "A few days a week" },
        { id: "loose", label: "I just want to begin" }
      ],
      identityTitle: "What are you here to grow?",
      identitySub: "Choose a reminder Verso can reflect back to you.",
      identityOptions: [
        { id: "habit", label: "A steady habit", sub: "I want to keep showing up." },
        { id: "faith", label: "A stronger faith", sub: "I want this to shape me spiritually." },
        { id: "heart", label: "A calmer heart", sub: "I want Scripture to steady me." },
        { id: "memory", label: "A lasting memory", sub: "I want to remember what I learn." }
      ],
      blockerTitle: "What usually gets in the way?",
      blockerSub: "We’ll help you keep the habit simple.",
      blockerHelper: {
        forgetful: "A gentle reminder can help you return tomorrow.",
        busy: "Pick a time that already fits your day.",
        inconsistent: "Choose a time that helps you keep going.",
        clueless: "Choose a time, and Verso will help with the next step.",
        distracted: "Pick a quiet moment you can return to.",
        other: "Pick a time that works for you."
      },
      blockerOptions: [
        { id: "busy", label: "Busy schedule" },
        { id: "forgetful", label: "I forget" },
        { id: "inconsistent", label: "I start but don’t finish" },
        { id: "clueless", label: "I don’t know where to begin" },
        { id: "distracted", label: "I get distracted" },
        { id: "other", label: "Other" }
      ],
      encouragementHead: "Growth starts small.",
      encouragementSub: "You’re not just opening an app. You’re forming a habit that nourishes your soul.",
      encouragementFooter: "WHAT YOU SOW, YOU WILL REAP",
      reminderTitle: "When do you want to make room for Verso?",
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
      readyBtn: "Start today's verse",
      authTitle: "Save your progress",
      authSub: "Create an account to keep your streaks and verses synced.",
      authModeSwitch: "ALREADY HAVE AN ACCOUNT? SIGN IN",
      authModeSwitchBack: "NO ACCOUNT? CREATE ONE",
      authBtn: "Create Account",
      authBtnSignin: "Sign In"
    },
    es: {
      langTitle: "Elige tu idioma",
      langSub: "Elige el idioma principal de la app.",
      continue: "Continuar",
      welcomeTitle: "Verso",
      welcomeHead: "Memoriza un versículo al día.",
      welcomeSub: "Estudia la Biblia de una forma que siembre algo firme en ti.",
      welcomeBtn: "Empezar",
      memTitle: "¿Cómo quieres memorizar?",
      memSub: "Elige el idioma en el que quieres practicar.",
      memHelper: "Puedes cambiar esto después en Configuración.",
      memOptions: [
        { id: "es", label: "Solo español" },
        { id: "en", label: "Solo inglés" },
        { id: "both", label: "Ambos idiomas" }
      ],
      pathTitle: "¿Qué quieres estudiar hoy?",
      pathSub: "Elige una Serie de versículos para acompañar tu Versículo Diario.",
      pathHelper: "Cada serie tiene versículos para lo que estás viviendo o necesitas hoy.",
      rhythmTitle: "¿Qué hábito se siente posible?",
      rhythmSub: "Empieza pequeño. Mantente constante.",
      rhythmOptions: [
        { id: "daily", label: "Un versículo al día" },
        { id: "weekly", label: "Algunos días a la semana" },
        { id: "loose", label: "Solo quiero empezar" }
      ],
      identityTitle: "¿Qué quieres cultivar?",
      identitySub: "Elige un recordatorio que Verso pueda repetirte.",
      identityOptions: [
        { id: "habit", label: "Un hábito constante", sub: "Quiero seguir volviendo." },
        { id: "faith", label: "Una fe más firme", sub: "Quiero que esto me forme espiritualmente." },
        { id: "heart", label: "Un corazón más tranquilo", sub: "Quiero que la paz me acompañe." },
        { id: "memory", label: "Una memoria que permanece", sub: "Quiero recordar lo que aprendo." }
      ],
      blockerTitle: "¿Qué suele atravesarse?",
      blockerSub: "Te ayudaremos a mantener un hábito sencillo.",
      blockerHelper: {
        forgetful: "Un pequeño recordatorio puede ayudarte a volver mañana.",
        busy: "Elige un momento que ya encaje en tu día.",
        inconsistent: "Elige un momento que te ayude a seguir adelante.",
        clueless: "ELIGE UN MOMENTO PARA QUE VERSO TE AYUDE A VOLVER.",
        distracted: "Elige un momento de quietud al que puedas volver.",
        other: "Elige un momento que funcione para ti."
      },
      blockerOptions: [
        { id: "busy", label: "Muchos compromisos" },
        { id: "forgetful", label: "Se me olvida" },
        { id: "inconsistent", label: "No termino" },
        { id: "clueless", label: "No sé por dónde empezar" },
        { id: "distracted", label: "Me distraigo" },
        { id: "other", label: "Otro" }
      ],
      encouragementHead: "El crecimiento empieza pequeño.",
      encouragementSub: "No solo estás abriendo una app. Estás formando un hábito que nutre tu alma.",
      encouragementFooter: "LO QUE SIEMBRAS, COSECHARÁS",
      reminderTitle: "¿Cuándo quieres sacar tiempo para Verso?",
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
        "Eligiendo tu primera serie",
        "Configurando tu idioma de memorización",
        "Preparando el versículo de hoy",
        "Guardando tu recordatorio"
      ],
      readyTitle: "Tu primera serie está lista.",
      readyBtn: "Empezar el versículo de hoy",
      authTitle: "Guarda tu progreso",
      authSub: "Crea una cuenta para mantener tus rachas y versículos sincronizados.",
      authModeSwitch: "¿YA TIENES CUENTA? INICIA SESIÓN",
      authModeSwitchBack: "¿NO TIENES CUENTA? CREA UNA",
      authBtn: "Crear Cuenta",
      authBtnSignin: "Iniciar Sesión"
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
          <div className="space-y-5 sm:space-y-8 w-full animate-in fade-in duration-700 text-center">
            <div className="flex justify-center mb-1">
              <VersoLogo size="lg" showText={true} variant="onboarding" />
            </div>
            
            <div className="space-y-2">
              <div className="space-y-0.5">
                <h1 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">Choose your language</h1>
                <p className="text-base sm:text-lg font-serif italic text-earth-light/90 dark:text-lavender-muted/90">Elige tu idioma</p>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal animate-pulse">
                Set your main app language
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-w-xs mx-auto w-full px-2">
              {[
                { id: 'en', label: 'English', sub: 'Inglés' },
                { id: 'es', label: 'Español', sub: 'Spanish' }
              ].map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setAppLanguage(opt.id as "en" | "es")}
                  className={`p-3.5 sm:p-5 rounded-2xl border-2 transition-colors flex justify-between items-center text-left ${appLanguage === opt.id ? 'border-teal bg-teal/10 shadow-[0_4px_15px_rgba(13,148,136,0.12)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <div className="text-left">
                    <p className="text-base font-black text-earth dark:text-ivory leading-tight">{opt.label}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-[#a0a0a0] dark:text-ivory/30">{opt.sub}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${appLanguage === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {appLanguage === opt.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2: // WELCOME
        return (
          <div className="text-center space-y-6 sm:space-y-12 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <VersoLogo size="xl" showText={true} variant="onboarding" />
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-xl sm:text-2xl font-serif font-black text-earth dark:text-ivory leading-tight text-balance">{curr.welcomeHead}</h3>
              <p className="text-base sm:text-lg font-serif italic text-earth-light/90 dark:text-lavender-muted/90 leading-relaxed px-4 max-w-sm mx-auto text-balance">{curr.welcomeSub}</p>
            </div>
          </div>
        );

      case 3: // MEM MODE
        return (
          <div className="space-y-5 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto text-gold mb-1">
                <BookOpen size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.memTitle}</h2>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">{curr.memSub}</p>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-earth-light/90 dark:text-ivory/20">{curr.memHelper}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:gap-3 px-2">
              {curr.memOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setMemMode(opt.id as LanguageMode)}
                  className={`p-3.5 sm:p-5 rounded-2xl border-2 transition-colors flex justify-between items-center ${memMode === opt.id ? 'border-teal bg-teal/10 shadow-[0_4px_15px_rgba(13,148,136,0.12)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-sm sm:text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${memMode === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {memMode === opt.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4: // PATH
        return (
          <div className="space-y-5 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-1">
                <Compass size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight max-w-sm mx-auto leading-tight text-balance">{curr.pathTitle}</h2>
              <div className="space-y-1.5 px-4">
                <p className="text-xs sm:text-base font-medium text-earth-light/90 dark:text-lavender-muted/90 max-w-sm mx-auto text-balance">
                  {appLanguage === 'es' ? 'Elige una Serie de versículos para acompañar tu Versículo Diario.' : curr.pathSub}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal max-w-[320px] mx-auto leading-normal text-balance">
                  {curr.pathHelper}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 px-2">
              {[...PATHS]
                .sort((a, b) => {
                  const titleA = appLanguage === 'es' ? (a.titleEs || a.title) : a.title;
                  const titleB = appLanguage === 'es' ? (b.titleEs || b.title) : b.title;
                  return titleA.localeCompare(titleB);
                })
                .map(p => (
                <button 
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  className={`p-3 sm:p-4 rounded-2xl border-2 transition-colors flex flex-col justify-between items-start text-left gap-2 sm:gap-3 ${selectedPathId === p.id ? 'border-teal bg-teal/10 shadow-[0_4px_10px_rgba(13,148,136,0.1)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-[11px] sm:text-sm font-black text-earth dark:text-ivory leading-tight line-clamp-2">{appLanguage === 'es' ? p.titleEs : p.title}</span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selectedPathId === p.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {selectedPathId === p.id && <Check size={8} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 5: // RHYTHM
        return (
          <div className="space-y-5 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-1">
                <Activity size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.rhythmTitle}</h2>
              <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">{curr.rhythmSub}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:gap-3 px-2">
              {curr.rhythmOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setRhythm(opt.id as DailyRhythm)}
                  className={`p-3.5 sm:p-5 rounded-2xl border-2 transition-colors flex justify-between items-center ${rhythm === opt.id ? 'border-teal bg-teal/10 shadow-[0_4px_15px_rgba(13,148,136,0.12)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-sm sm:text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${rhythm === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {rhythm === opt.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 6: // IDENTITY
        return (
          <div className="space-y-4 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-1">
                <Anchor size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.identityTitle}</h2>
              <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">{curr.identitySub}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:gap-3 px-2">
              {curr.identityOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setGrowthGoal({ label: opt.label, subline: opt.sub })}
                  className={`p-3 sm:p-5 rounded-2xl border-2 transition-colors flex justify-between items-center text-left ${growthGoal?.label === opt.label ? 'border-teal bg-teal/10 shadow-[0_4px_15px_rgba(13,148,136,0.12)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm sm:text-lg font-black text-earth dark:text-ivory leading-tight">{opt.label}</span>
                    <span className="text-xs text-[#a0a0a0] dark:text-[#cccccc] font-serif italic">{opt.sub}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 transition-all ${growthGoal?.label === opt.label ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {growthGoal?.label === opt.label && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 7: // BLOCKER
        return (
          <div className="space-y-4 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-coral/10 rounded-2xl flex items-center justify-center mx-auto text-coral mb-1">
                <ShieldAlert size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.blockerTitle}</h2>
              <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">{curr.blockerSub}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-sm mx-auto px-2">
              {curr.blockerOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setBlocker(opt.id as Blocker)}
                  className={`p-2.5 sm:p-4 h-18 sm:h-32 rounded-2xl border-2 transition-colors flex flex-col justify-between items-start text-left ${blocker === opt.id ? 'border-coral bg-coral/10 shadow-[0_4px_15px_rgba(225,29,72,0.1)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-coral/30'}`}
                >
                  <span className="text-xs sm:text-base font-black text-earth dark:text-ivory leading-tight">{opt.label}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${blocker === opt.id ? 'bg-coral border-coral text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {blocker === opt.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 8: // ENCOURAGEMENT
        return (
          <div className="text-center space-y-8 sm:space-y-12 w-full animate-in fade-in zoom-in duration-1000">
            <div className="space-y-8">
              <div className="relative inline-block">
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-teal/5 rounded-full flex items-center justify-center mx-auto text-teal blur-sm animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sprout size={48} className="text-teal sm:size-[64px]" strokeWidth={1.5} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.encouragementHead}</h2>
                  <p className="text-base sm:text-lg font-serif italic text-earth-light/90 dark:text-lavender-muted/90 leading-relaxed max-w-xs mx-auto text-balance">{curr.encouragementSub}</p>
                </div>
                {curr.encouragementFooter && (
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal/90 animate-pulse">
                    {curr.encouragementFooter}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 9: // REMINDERS
        return (
          <div className="space-y-4 sm:space-y-8 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto text-teal mb-1">
                <Clock size={24} className="sm:size-[28px]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight text-balance max-w-sm mx-auto leading-tight">{curr.reminderTitle}</h2>
              <div className="space-y-1 px-4">
                <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90">{curr.reminderSubtitle}</p>
                {blocker && (
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-teal text-center mt-1.5 leading-relaxed max-w-[325px] mx-auto text-balance transition-all animate-in fade-in duration-500">
                    {curr.blockerHelper[blocker]}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:gap-3 px-2">
              {curr.reminderOptions.map(opt => (
                <button 
                  key={opt.id}
                  onClick={() => setReminder(opt.id as ReminderPreference)}
                  className={`py-2.5 sm:py-4 px-4 sm:px-5 rounded-2xl border-2 transition-colors flex justify-between items-center ${reminder === opt.id ? 'border-teal bg-teal/10 shadow-[0_4px_15px_rgba(13,148,136,0.12)]' : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-teal/30'}`}
                >
                  <span className="text-sm sm:text-lg font-black text-earth dark:text-ivory">{opt.label}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${reminder === opt.id ? 'bg-teal border-teal text-white' : 'border-earth/20 dark:border-white/20'}`}>
                    {reminder === opt.id && <Check size={10} strokeWidth={4} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 10: // AUTH
        return (
          <div className="space-y-10 w-full animate-in fade-in duration-700">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-playful-purple/10 rounded-2xl flex items-center justify-center mx-auto text-playful-purple mb-4 shadow-[0_0_20px_rgba(109,40,217,0.1)]">
                <User size={28} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight">{curr.authTitle}</h2>
              <p className="text-xs sm:text-sm font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">{curr.authSub}</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 px-2 max-w-sm mx-auto">
              <div className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-earth/20 dark:text-ivory/20" size={18} />
                  <input 
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-white/50 dark:bg-charcoal/30 backdrop-blur-md border-2 border-earth/5 dark:border-white/5 rounded-2xl pl-12 pr-4 focus:border-playful-purple/50 focus:ring-4 focus:ring-playful-purple/5 outline-none transition-all text-earth dark:text-ivory font-bold placeholder:text-earth/20 dark:placeholder:text-ivory/20"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-earth/20 dark:text-ivory/20" size={18} />
                  <input 
                    type="password"
                    placeholder="Password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 bg-white/50 dark:bg-charcoal/30 backdrop-blur-md border-2 border-earth/5 dark:border-white/5 rounded-2xl pl-12 pr-4 focus:border-playful-purple/50 focus:ring-4 focus:ring-playful-purple/5 outline-none transition-all text-earth dark:text-ivory font-bold placeholder:text-earth/20 dark:placeholder:text-ivory/20"
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2 p-3 bg-coral/5 border border-coral/10 rounded-xl text-coral text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={14} />
                  <span>{authError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isAuthLoading}
                className={`w-full h-14 sm:h-16 rounded-[24px] shadow-lg flex items-center justify-center gap-3 transition-all ${isAuthLoading ? 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-wait border-none' : 'bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple hover:bg-playful-purple/10 shadow-[0_0_20px_rgba(109,40,217,0.1)] active:scale-95'}`}
              >
                {isAuthLoading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <span className="font-black uppercase tracking-widest text-sm sm:text-base">
                      {authMode === "signup" ? curr.authBtn : curr.authBtnSignin}
                    </span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>

              <div className="flex flex-col gap-4 items-center">
                <button 
                  type="button"
                  onClick={() => setAuthMode(m => m === "signup" ? "signin" : "signup")}
                  className="py-2 text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/90 dark:text-lavender-muted/90 hover:text-playful-purple transition-colors"
                  disabled={isAuthLoading}
                >
                  {authMode === "signup" ? curr.authModeSwitch : curr.authModeSwitchBack}
                </button>

                <button 
                  type="button"
                  onClick={() => setStep(11)}
                  className="py-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal hover:text-teal-500 transition-colors font-bold"
                  disabled={isAuthLoading}
                >
                  {appLanguage === 'es' ? 'CONTINUAR COMO INVITADO' : 'CONTINUE AS GUEST'}
                </button>

                {!isSupabaseConfigured && process.env.NODE_ENV !== 'production' && (
                  <div className="pt-4 border-t border-earth/5 dark:border-white/5 w-full flex flex-col items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setStep(11)}
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-teal hover:text-teal-400 transition-colors"
                    >
                      {appLanguage === 'es' ? 'Continuar en modo vista previa' : 'Continue in preview mode'}
                    </button>
                    <p className="text-[9px] font-medium text-earth-light/90 dark:text-ivory/20 text-center px-4 leading-tight">
                      {appLanguage === 'es' 
                        ? 'Supabase aún no está configurado. Esto solo omite la cuenta para revisar la app.' 
                        : 'Supabase is not configured yet. This only skips account creation for local preview.'}
                    </p>
                  </div>
                )}
                
                <button 
                  type="button"
                  onClick={prev}
                  className="h-12 flex items-center justify-center gap-2 text-earth-light/90 dark:text-ivory/90 font-black uppercase tracking-[0.2em] text-[10px] hover:text-teal transition-all"
                  disabled={isAuthLoading}
                >
                  <ChevronLeft size={14} />
                  {appLanguage === 'en' ? 'Back' : 'Atrás'}
                </button>
              </div>
            </form>
          </div>
        );

      case 11: // PREPARING
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
                      <span className="text-sm font-bold text-earth-light/90 dark:text-lavender-muted/90">{line}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {showFallback && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => {
                    setIsPreparing(false);
                    setStep(12);
                  }}
                  className="mt-8 text-[10px] font-black uppercase tracking-widest text-teal hover:underline"
                >
                  {appLanguage === 'en' ? 'Continue' : 'Continuar'}
                </motion.button>
              )}
            </div>
          </div>
        );

      case 12: // READY
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
                      <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/90 dark:text-ivory/90">
                        {appLanguage === 'es' ? 'TU SERIE' : 'YOUR PATH'}
                      </p>
                      <p className="text-xl font-serif font-black text-playful-purple">
                        {appLanguage === 'es' ? PATHS.find(p => p.id === selectedPathId)?.titleEs : PATHS.find(p => p.id === selectedPathId)?.title}
                      </p>
                    </div>
                  )}
                  {growthGoal && (
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/90 dark:text-ivory/90">
                        {appLanguage === 'es' ? 'ESTÁS AQUÍ PARA CULTIVAR' : "YOU'RE HERE TO GROW"}
                      </p>
                      <div className="space-y-1">
                        <p className="text-lg font-black text-earth dark:text-ivory leading-tight">
                          {growthGoal.label}
                        </p>
                        <p className="text-sm font-serif italic text-earth-light/90 dark:text-lavender-muted">
                          "{growthGoal.subline}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 13: // PAYWALL
        return (
          <div className="w-full h-full relative">
            <Paywall 
              state={{ primaryLanguage: appLanguage } as AppState}
              onSubscribe={() => handleFinish()}
            />
          </div>
        );

      default: return null;
    }
  };

  const isNextDisabled = () => {
    if (step === 4) return !selectedPathId;
    if (step === 5) return !rhythm;
    if (step === 6) return !growthGoal;
    if (step === 7) return !blocker;
    if (step === 9) return !reminder;
    if (step === 10) return !user;
    return false;
  };

  if (step === 13) {
    return (
      <Paywall 
        state={{ primaryLanguage: appLanguage } as AppState}
        onSubscribe={() => handleFinish()}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-parchment dark:bg-espresso flex flex-col items-center justify-start transition-colors duration-500 overflow-hidden pt-safe pb-safe">
      {step < 13 && renderProgress()}
      
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar pb-44 sm:pb-36">
        <div className="w-full max-w-md mx-auto flex flex-col justify-start sm:justify-center px-4 sm:px-6 py-6 sm:py-10 min-h-[60vh] sm:min-h-[70vh]">
          <AnimatePresence mode="wait">
            {isPreparing ? (
              <motion.div 
                key="preparing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-grow flex flex-col items-center justify-center w-full"
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
                className="flex-grow flex flex-col items-center justify-center w-full"
              >
                <div className="w-full flex flex-col items-center justify-center">
                  {renderStep()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Navigation Footer */}
      {!isPreparing && step < 13 && step !== 10 && step !== 11 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-parchment via-parchment/90 to-transparent dark:from-espresso dark:via-espresso/90 pt-4 pb-4 sm:pt-8 sm:pb-6 px-4 flex flex-col items-center pointer-events-none">
          <div className="w-full max-w-sm pointer-events-auto flex flex-col gap-2.5">
            {step === 12 ? (
              <button 
                onClick={next}
                className="w-full h-12 sm:h-14 bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple rounded-2xl shadow-[0_0_20px_rgba(109,40,217,0.1)] flex items-center justify-center gap-3 hover:bg-playful-purple/10 active:scale-95 transition-all px-6"
              >
                <span className="font-black uppercase tracking-tight sm:tracking-normal text-sm sm:text-base whitespace-nowrap">{curr.readyBtn}</span>
                <ChevronRight size={16} className="shrink-0" />
              </button>
            ) : (
              <button 
                onClick={next}
                disabled={isNextDisabled()}
                className={`w-full h-12 sm:h-14 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all ${isNextDisabled() ? 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-not-allowed border-none' : 'bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple hover:bg-playful-purple/10 shadow-[0_0_20px_rgba(109,40,217,0.1)] active:scale-95'}`}
              >
                <span className="font-black uppercase tracking-[0.1em] text-sm sm:text-base">
                  {step === 1 ? (appLanguage === 'en' ? 'Continue' : 'Continuar') : curr.continue}
                </span>
                <ChevronRight size={16} />
              </button>
            )}

            {step > 1 && (
              <button 
                onClick={prev}
                className="h-10 flex items-center justify-center gap-2 text-earth-light/90 dark:text-ivory/90 font-black uppercase tracking-[0.2em] text-[10px] hover:text-teal transition-all"
              >
                <ChevronLeft size={12} />
                {appLanguage === 'en' ? 'Back' : 'Atrás'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

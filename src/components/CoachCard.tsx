import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Brain, Clock, Star, RefreshCw, MessageCircle } from "lucide-react";
import { AppState } from "../types";

interface CoachCardProps {
  state: AppState;
  type: 'encouragement' | 'suggestion' | 'reflection' | 'tip';
  verseReference: string;
  verseText: string;
  stage: number;
  status: 'struggling' | 'succeeding' | 'completed';
  onAction?: (action: string) => void;
}

const ENCOURAGEMENT_BANK = {
  en: [
    "You’re on the right track. Keep practicing.",
    "One more round.",
    "Nice work. Keep going.",
    "You’re getting closer.",
    "You’re almost there.",
    "Small steps lead to big treasures.",
    "You've got this. Keep it up.",
    "Every repetition hides it deeper in your heart."
  ],
  es: [
    "Vas por buen camino. Sigue practicando.",
    "Una ronda más.",
    "Muy bien. Sigue así.",
    "Estás cada vez más cerca.",
    "Ya casi lo tienes.",
    "Un paso más.",
    "Repásalo una vez más.",
    "Cada repetición lo guarda más profundo en tu corazón."
  ]
};

const REFLECTION_BANK = {
  en: [
    "Which word from this verse resonates most with you today?",
    "What part of this verse do you want to remember tonight?",
    "Which phrase feels strongest to you right now?",
    "What is one word you do not want to forget?",
    "What part of this verse stood out most today?",
    "How does this verse change your perspective today?",
    "If you had to summarize this verse in one word, what would it be?"
  ],
  es: [
    "¿Qué palabra de este versículo resuena más contigo hoy?",
    "¿Qué parte de este versículo quieres recordar esta noche?",
    "¿Qué frase sientes con más fuerza en este momento?",
    "¿Cuál es la palabra que no quieres olvidar?",
    "¿Qué parte de este versículo destacó más hoy?",
    "¿Cómo cambia este versículo tu perspectiva hoy?",
    "Si tuvieras que resumir este verso en una palabra, ¿cuál sería?"
  ]
};

const SUGGESTION_BANK = {
  en: [
    "Try saying it out loud to lock it in.",
    "Visualize the words as you say them.",
    "Take a deep breath and try one more time.",
    "Focus on the rhythm of the words.",
    "Try to recall the reference first."
  ],
  es: [
    "Intenta decirlo en voz alta para grabarlo.",
    "Visualiza las palabras mientras las dices.",
    "Toma un respiro profundo e inténtalo una vez más.",
    "Enfócate en el ritmo de las palabras.",
    "Intenta recordar la cita primero."
  ]
};

const TIP_BANK = {
  en: [
    "Try saying the verse out loud while walking.",
    "Write it down on a sticky note for today.",
    "Think about this verse before you sleep.",
    "Share this verse with a friend today.",
    "Pray this verse back to God."
  ],
  es: [
    "Prueba a decir el verso en voz alta mientras caminas.",
    "Escríbelo en una nota adhesiva para hoy.",
    "Piensa en este verso antes de dormir.",
    "Comparte este verso con un amigo hoy.",
    "Haz de este verso una oración."
  ]
};

export default function CoachCard({ state, type, verseReference, verseText, stage, status, onAction }: CoachCardProps) {
  const message = useMemo(() => {
    const isEs = state.primaryLanguage === 'es';
    const lang = isEs ? 'es' : 'en';
    
    // Use a hash of the verse reference and stage to pick a consistent but "rotating" message
    const seed = (verseReference.length + stage + type.length) % 5;
    
    if (status === 'completed' || type === 'reflection') {
      return REFLECTION_BANK[lang][seed % REFLECTION_BANK[lang].length];
    }

    if (status === 'struggling') {
      return isEs ? "No te preocupes, la repetición es la clave. ¡Tú puedes!" : "Don't worry, repetition is the key. You've got this!";
    }

    switch (type) {
      case 'encouragement':
        return ENCOURAGEMENT_BANK[lang][seed % ENCOURAGEMENT_BANK[lang].length];
      case 'suggestion':
        return SUGGESTION_BANK[lang][seed % SUGGESTION_BANK[lang].length];
      case 'tip':
        return TIP_BANK[lang][seed % TIP_BANK[lang].length];
      default:
        return isEs ? "Sigue adelante con tu memorización." : "Keep going with your memorization.";
    }
  }, [type, verseReference, stage, status, state.primaryLanguage]);

  const getIcon = () => {
    switch (type) {
      case 'encouragement': return <Sparkles size={18} className="text-golden" />;
      case 'suggestion': return <Clock size={18} className="text-sky-blue" />;
      case 'reflection': return <Star size={18} className="text-coral" />;
      case 'tip': return <RefreshCw size={18} className="text-teal" />;
      default: return <MessageCircle size={18} />;
    }
  };

  const getLabel = () => {
    if (state.primaryLanguage === 'es') {
      switch (type) {
        case 'encouragement': return "Ánimo";
        case 'suggestion': return "Sugerencia";
        case 'reflection': return "Reflexión";
        case 'tip': return "Consejo";
        default: return "Ayuda";
      }
    } else {
      switch (type) {
        case 'encouragement': return "Encouragement";
        case 'suggestion': return "Suggestion";
        case 'reflection': return "Reflection";
        case 'tip': return "Tip";
        default: return "Help";
      }
    }
  };

  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="w-full bg-white/50 dark:bg-charcoal/50 backdrop-blur-sm border border-earth/5 dark:border-white/5 rounded-2xl p-4 flex items-start gap-4 shadow-sm"
        >
          <div className="mt-1 p-2 bg-white dark:bg-charcoal rounded-xl shadow-sm border border-earth/5 dark:border-white/5">
            {getIcon()}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted/60">
                {getLabel()}
              </span>
            </div>
            <p className="text-sm font-medium text-earth dark:text-ivory leading-snug">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

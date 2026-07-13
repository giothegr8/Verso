import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState } from "../types";
import { BrandIcon } from "./ui";

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
    "Si tuvieras que resumir este versículo en una palabra, ¿cuál sería?"
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
    "Intenta recordar la cita bíblica primero."
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
    "Prueba a decir el versículo en voz alta mientras caminas.",
    "Escríbelo en una nota adhesiva para hoy.",
    "Piensa en este versículo antes de dormir.",
    "Comparte este versículo con un amigo hoy.",
    "Haz de este versículo una oración."
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
          className="w-full bg-deep-slate border border-(--line) rounded-[18px] p-[18px] md:p-6 flex items-center gap-3.5"
        >
          <BrandIcon name="narrative-plant" size={34} className="shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h3 className="font-hanken text-[15px] font-semibold text-cool-white leading-snug">
              {getLabel()}
            </h3>
            <p className="font-hanken text-base text-cold-grey leading-snug">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

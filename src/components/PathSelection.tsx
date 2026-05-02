import { motion } from "motion/react";
import { AppState, Path } from "../types";
import { PATHS } from "../constants";
import { ArrowLeft, Compass, Clock, ChevronRight, Sprout } from "lucide-react";

interface PathSelectionProps {
  state: AppState;
  onSelectPath: (pathId: string) => void;
  onBack: () => void;
}

export default function PathSelection({ state, onSelectPath, onBack }: PathSelectionProps) {
  const isEs = state.primaryLanguage === "es";

  return (
    <div className="flex flex-col space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-earth/50 dark:text-ivory/50 hover:text-playful-purple transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-bold uppercase tracking-widest">
            {isEs ? "Volver" : "Back"}
          </span>
        </button>

        <div className="space-y-2">
          <h2 className="text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
            {isEs ? "¿Qué estás viviendo en este momento?" : "What are you going through right now?"}
          </h2>
          <p className="text-lg text-earth-light/80 dark:text-lavender-muted/80 font-medium">
            {isEs ? "Elige un camino y vuelve cada día a la Palabra." : "Choose a path and return daily to the Word."}
          </p>
        </div>
      </div>

      {/* Path Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PATHS.map((path, index) => (
          <motion.button
            key={path.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectPath(path.id)}
            className="group relative flex flex-col items-start p-6 bg-white dark:bg-charcoal border border-earth/10 dark:border-white/10 rounded-3xl shadow-sm hover:shadow-xl hover:border-amber-500/30 transition-all text-left overflow-hidden ring-1 ring-amber-500/5"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Compass size={80} className="text-amber-500 transform rotate-12" />
            </div>

            <div className="flex justify-between items-start w-full mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-golden">
                <Sprout size={20} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-earth/5 dark:bg-white/5 rounded-full border border-earth/10 dark:border-white/10">
                <Clock size={12} className="text-earth/40 dark:text-ivory/40" />
                <span className="text-[10px] font-black uppercase tracking-widest text-earth/60 dark:text-ivory/60">
                  {path.duration} {isEs ? "días" : "days"}
                </span>
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-xl font-serif font-black text-earth dark:text-ivory group-hover:text-amber-600 dark:group-hover:text-golden transition-colors">
                {isEs ? path.titleEs : path.title}
              </h3>
              <p className="text-sm text-earth-light/70 dark:text-lavender-muted/60 leading-relaxed line-clamp-2">
                {isEs ? path.descriptionEs : path.description}
              </p>
            </div>

            <div className="mt-8 flex items-center gap-2 text-amber-600 dark:text-golden font-bold text-sm tracking-tight group-hover:gap-3 transition-all relative z-10">
              <span>{isEs ? path.ctaEs : path.cta}</span>
              <ChevronRight size={16} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, Path } from "../types";
import { PATHS } from "../constants";
import { ArrowLeft, Compass, Clock, ChevronRight, Sprout, CheckCircle2, Lock, Flower2 } from "lucide-react";

interface PathSelectionProps {
  state: AppState;
  onSelectPath: (pathId: string) => void;
  onBack: () => void;
}

export default function PathSelection({ state, onSelectPath, onBack }: PathSelectionProps) {
  const isEs = state.primaryLanguage === "es";
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const selectedPathId = state.pathProgress.selectedPathId;

  // Sort paths to move currently selected path to the top
  const sortedPaths = [...PATHS].sort((a, b) => {
    if (a.id === selectedPathId) return -1;
    if (b.id === selectedPathId) return 1;
    return 0; // Maintain original curated order
  });

  if (selectedPath) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col space-y-8 pb-12"
      >
        {/* Detail Header */}
        <div className="space-y-6">
          <button 
            onClick={() => setSelectedPath(null)}
            className="flex items-center gap-2 text-earth/50 dark:text-ivory/50 hover:text-teal transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest">
              {isEs ? "Todos los caminos" : "All Paths"}
            </span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-teal/10 flex items-center justify-center text-teal mb-2">
                <Sprout size={24} />
              </div>
              <h2 className="text-4xl sm:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                {isEs ? selectedPath.titleEs : selectedPath.title}
              </h2>
              <p className="text-lg text-earth-light/80 dark:text-lavender-muted/80 font-medium max-w-xl">
                {isEs ? selectedPath.descriptionEs : selectedPath.description}
              </p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl border border-amber-500/20 dark:border-amber-400/30">
                <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-300/80">
                  {selectedPath.duration} {isEs ? "días" : "days"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Day Grid */}
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-earth/40 dark:text-ivory/40 border-b border-earth/5 pb-2">
            {isEs ? "Recorrido diario" : "Daily Journey"}
          </h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {Array.from({ length: selectedPath.duration }).map((_, i) => {
              const dayNum = i + 1;
              const dayData = selectedPath.days?.find(d => d.day === dayNum);
              
              // Robust completion detection
              const pathSaved = (state.pathProgress?.savedProgress || {})[selectedPath.id];
              const isCompleted = pathSaved?.completedDays.includes(dayNum) || 
                                (state.pathProgress?.selectedPathId === selectedPath.id && (state.pathProgress?.currentDay || 1) > dayNum);
              const isActive = (selectedPathId === selectedPath.id) && (state.pathProgress?.currentDay === dayNum);
              
              return (
                <div 
                  key={dayNum}
                  className={`p-5 rounded-[24px] border transition-all flex items-start gap-4 ${
                    isCompleted 
                      ? "bg-teal/5 border-teal/20 shadow-sm" 
                      : isActive
                        ? "bg-teal/10 border-teal-400/30 dark:border-teal-400/40 shadow-lg shadow-teal/5 ring-1 ring-teal/20"
                        : "bg-white/40 dark:bg-charcoal/40 border-earth/5 dark:border-white/5 group hover:border-teal/20"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black ${
                    isCompleted 
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                      : isActive
                        ? "bg-teal text-white shadow-[0_0_15px_rgba(45,212,191,0.4)]"
                        : "bg-earth/5 dark:bg-white/5 text-earth/20 dark:text-ivory/20"
                  }`}>
                    {isCompleted ? <Flower2 size={20} className="text-amber-600 dark:text-amber-400" /> : dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                      isCompleted ? "text-amber-600/60 dark:text-amber-400/60" : isActive ? "text-teal" : "text-earth-light/30"
                    }`}>
                      {isEs ? `Día ${dayNum}` : `Day ${dayNum}`}
                    </span>
                    <span className={`font-serif font-bold text-lg ${isActive ? "text-teal-900 dark:text-teal-50" : isCompleted ? "text-earth/60 dark:text-ivory/60" : "text-earth dark:text-ivory"}`}>
                      {dayData?.reference || (isEs ? "Versículo" : "Verse")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-8 sticky bottom-0 bg-gradient-to-t from-parchment dark:from-espresso to-transparent pb-4">
          <button
            onClick={() => onSelectPath(selectedPath.id)}
            className="w-full relative overflow-hidden group flex items-center justify-center gap-3 py-5 px-10 bg-teal/10 dark:bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 rounded-[28px] font-bold border-2 border-teal/30 dark:border-teal/40 transition-all shadow-[0_0_30px_rgba(45,212,191,0.15)] active:scale-95"
          >
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              <span className="text-xl font-serif font-black tracking-tight group-hover:tracking-wide transition-all">
                {state.pathProgress.selectedPathId === selectedPath.id ? (isEs ? "Continuar camino" : "Continue path") : (isEs ? selectedPath.ctaEs : selectedPath.cta)}
              </span>
              <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </div>
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div id="paths-content" className="flex flex-col pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header - Refined for Consistency and Left Aligned */}
      <div className="w-full mb-8 sm:mb-12">
        <div className="flex flex-col space-y-1 sm:space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-blue animate-pulse" />
            <span className="text-[11px] sm:text-[12px] font-black uppercase tracking-[0.3em] text-sky-blue leading-none">
              {isEs ? 'CAMINOS' : 'PATHS'}
            </span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
            {isEs ? 'Tu Jardín Secreto' : 'Your Secret Garden'}
          </h2>
          
          <p className="text-xs sm:text-sm text-earth-light/70 dark:text-lavender-muted/70 font-medium tracking-tight">
            {isEs 
              ? 'Elige dónde quieres crecer en tu caminar espiritual' 
              : 'Choose where you want to grow in your spiritual journey'}
          </p>
        </div>
      </div>

      {/* Path Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPaths.map((path, index) => {
          const isActive = path.id === selectedPathId;
          
          return (
            <motion.button
              key={path.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedPath(path)}
              className={`group relative flex flex-col items-start p-6 bg-white dark:bg-charcoal border transition-all text-left overflow-hidden ring-1 ${
                isActive 
                  ? "border-sky-blue/50 ring-sky-blue/20 bg-teal/[0.02] shadow-lg" 
                  : "border-earth/10 dark:border-white/10 ring-sky-blue/5 shadow-sm hover:shadow-xl hover:border-sky-blue/30"
              } rounded-[32px]`}
            >
              {/* Selected Indicator */}
              {isActive && (
                <div className="absolute top-0 right-0 pt-3 pr-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-teal text-white rounded-full shadow-lg shadow-teal/20 border border-white/20">
                    <CheckCircle2 size={10} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                      {isEs ? "Actual" : "Current"}
                    </span>
                  </div>
                </div>
              )}

              {/* Background Accent */}
              <div className="absolute -top-4 -right-4 p-8 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
                <Compass size={120} className="text-sky-blue transform rotate-12" />
              </div>

              <div className="flex justify-between items-start w-full mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isActive ? "bg-teal text-white shadow-xl shadow-teal/20 scale-110" : "bg-teal/10 text-teal group-hover:scale-110"
                }`}>
                  <Sprout size={24} />
                </div>
                {!isActive && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal/5 dark:bg-teal/10 rounded-full border border-teal/10 dark:border-teal/20">
                    <Clock size={12} className="text-amber-500/80 dark:text-amber-400/80" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      {path.duration} {isEs ? "días" : "days"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3 relative z-10 w-full mb-6">
                <h3 className="text-2xl font-serif font-black transition-colors leading-tight text-earth dark:text-ivory min-h-[4rem] line-clamp-2">
                  {isEs ? path.titleEs : path.title}
                </h3>
                <p className="text-sm text-earth-light/70 dark:text-lavender-muted/60 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                  {isEs ? path.descriptionEs : path.description}
                </p>
              </div>

              <div className="mt-auto flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-colors text-earth-light/40 dark:text-ivory/30 group-hover:text-earth-light/60">
                <span>{isEs ? "Ver detalles" : "View details"}</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

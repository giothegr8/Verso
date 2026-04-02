import React from "react";
import { motion } from "motion/react";
import { Sparkles, Check, Crown, ArrowRight, Lock } from "lucide-react";
import { AppState } from "../types";

interface PaywallProps {
  state: AppState;
  onSubscribe: () => void;
}

export default function Paywall({ state, onSubscribe }: PaywallProps) {
  const isSpanish = state.primaryLanguage === "es";

  const features = isSpanish 
    ? [
        "Acceso ilimitado a todos los versículos",
        "Asistente de memoria con IA",
        "Sincronización en todos tus dispositivos",
        "Experiencia premium sin distracciones"
      ]
    : [
        "Unlimited access to all verses",
        "AI Memory Assistant",
        "Sync across all your devices",
        "Premium distraction-free experience"
      ];

  return (
    <div className="fixed inset-0 z-[100] bg-parchment dark:bg-espresso flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-white dark:bg-charcoal rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 overflow-hidden"
      >
        <div className="p-8 sm:p-12 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-playful-purple/10 rounded-3xl flex items-center justify-center text-playful-purple mx-auto mb-6">
              <Crown size={40} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
              {isSpanish ? "Tu prueba gratuita ha terminado" : "Your free trial has ended"}
            </h2>
            <p className="text-earth-light dark:text-lavender-muted font-medium">
              {isSpanish 
                ? "Suscríbete para continuar tu viaje de memorización con todas las funciones premium." 
                : "Subscribe to continue your memorization journey with all premium features."}
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-4 bg-earth/5 dark:bg-white/5 p-6 rounded-3xl border border-earth/5 dark:border-white/5">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-6 h-6 bg-teal/10 rounded-full flex items-center justify-center text-teal flex-shrink-0">
                  <Check size={14} />
                </div>
                <span className="text-sm font-bold text-earth/80 dark:text-ivory/80">{feature}</span>
              </motion.div>
            ))}
          </div>

          {/* Pricing & CTA */}
          <div className="space-y-4">
            <button 
              onClick={onSubscribe}
              className="btn-primary w-full h-16 text-lg shadow-xl shadow-playful-purple/20 group"
            >
              <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
              {isSpanish ? "Suscribirse ahora" : "Subscribe Now"}
              <ArrowRight size={20} className="ml-auto group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40">
              {isSpanish ? "$4.99 / mes — Cancela en cualquier momento" : "$4.99 / month — Cancel anytime"}
            </p>
          </div>

          {/* Secondary Action */}
          <div className="pt-4 text-center">
            <button 
              onClick={() => window.location.reload()}
              className="text-xs font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted hover:text-playful-purple transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <Lock size={12} />
              {isSpanish ? "Restaurar compra" : "Restore Purchase"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

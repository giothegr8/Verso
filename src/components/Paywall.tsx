import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Check, Crown, ArrowRight, Lock, Loader2, Star, Shield, Zap } from "lucide-react";
import { AppState } from "../types";
import { trackPaywallEvent } from "../services/marketingService";

interface PaywallProps {
  state: AppState;
  onSubscribe: (planId: string) => void;
  onClose?: () => void;
  isDismissible?: boolean;
}

const PLANS = [
  { 
    id: 'verso_weekly_499', 
    price: '$4.99', 
    periodEn: 'week', 
    periodEs: 'semana',
    nameEn: 'Weekly',
    nameEs: 'Semanal',
    labelEn: null,
    labelEs: null
  },
  { 
    id: 'verso_monthly_1199', 
    price: '$11.99', 
    periodEn: 'month', 
    periodEs: 'mes',
    nameEn: 'Monthly',
    nameEs: 'Mensual',
    labelEn: null,
    labelEs: null
  },
  { 
    id: 'verso_quarterly_2999', 
    price: '$29.99', 
    periodEn: '3 months', 
    periodEs: '3 meses',
    nameEn: '3-Month',
    nameEs: '3 Meses',
    labelEn: 'Most popular', 
    labelEs: 'Más popular',
    isPopular: true
  },
  { 
    id: 'verso_annual_7999', 
    price: '$79.99', 
    periodEn: 'year', 
    periodEs: 'año',
    nameEn: 'Annual',
    nameEs: 'Anual',
    labelEn: 'Best value', 
    labelEs: 'Mejor valor',
    isBestValue: true,
    default: true 
  },
];

export default function Paywall({ state, onSubscribe, onClose, isDismissible = false }: PaywallProps) {
  const isSpanish = state.primaryLanguage === "es";
  const [selectedPlanId, setSelectedPlanId] = useState(PLANS.find(p => p.default)?.id || PLANS[3].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);

  const features = isSpanish 
    ? [
        { icon: <Crown size={16} />, text: "Series guiadas" },
        { icon: <Shield size={16} />, text: "Protección de racha" },
        { icon: <Zap size={16} />, text: "Memorización profunda" },
        { icon: <Star size={16} />, text: "Repaso y estadísticas" }
      ]
    : [
        { icon: <Crown size={16} />, text: "Guided Paths" },
        { icon: <Shield size={16} />, text: "Streak Protection" },
        { icon: <Zap size={16} />, text: "Deep memorization tools" },
        { icon: <Star size={16} />, text: "Expanded review and stats" }
      ];

  const handleSubscribe = async () => {
    setIsProcessing(true);
    trackPaywallEvent("checkout_started", selectedPlanId);
    
    // Simulate RevenueCat / Stripe checkout
    setTimeout(() => {
      setIsProcessing(false);
      localStorage.setItem('verso_test_premium', 'true');
      trackPaywallEvent("checkout_succeeded_test", selectedPlanId);
      onSubscribe(selectedPlanId);
    }, 2000);
  };

  const handlePlanSelect = (id: string) => {
    setSelectedPlanId(id);
    trackPaywallEvent("plan_selected", id);
  };

  const visiblePlans = showAllPlans ? PLANS : PLANS.filter(p => p.isPopular || p.isBestValue);

  return (
    <div className="fixed inset-0 z-[100] bg-parchment dark:bg-espresso flex items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white/80 dark:bg-charcoal/80 backdrop-blur-xl rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 overflow-hidden my-8"
      >
        <div className="p-8 sm:p-12 space-y-8 relative">
          {isDismissible && onClose && (
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-earth/20 dark:text-white/20 hover:text-earth/40 dark:hover:text-white/40 transition-colors"
            >
              <Lock size={18} />
            </button>
          )}

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-playful-purple/10 rounded-2xl flex items-center justify-center text-playful-purple mx-auto mb-6">
              <Crown size={32} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
              {isSpanish ? "Sigue cultivando la Palabra." : "Keep growing in Scripture."}
            </h2>
            <p className="text-earth-light dark:text-lavender-muted font-medium text-balance">
              {isSpanish 
                ? "Ya empezaste este hábito. Sigue volviendo, un versículo a la vez." 
                : "You’ve planted the habit. Keep showing up, one verse at a time."}
            </p>
          </div>

          {/* Trial Timeline */}
          <div className="bg-earth/5 dark:bg-white/5 p-6 rounded-3xl border border-earth/5 dark:border-white/5 space-y-4">
            <div className="flex flex-col gap-4">
              {[
                { 
                  day: isSpanish ? "Hoy" : "Today", 
                  text: isSpanish ? "Empieza gratis" : "Start free",
                  sub: isSpanish ? "Acceso total inmediato" : "Full access immediately"
                },
                { 
                  day: isSpanish ? "Día 2" : "Day 2", 
                  text: isSpanish ? "Te recordamos antes de que termine" : "We'll remind you before it ends",
                  sub: isSpanish ? "Trial reminder before trial ends" : "Trial reminder before trial ends"
                },
                { 
                  day: isSpanish ? "Día 3" : "Day 3", 
                  text: isSpanish ? "Sigues solo si quieres" : "Continue only if you choose",
                  sub: isSpanish ? "La suscripción empieza después" : "Subscription starts after trial"
                }
              ].map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-teal shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                    {i < 2 && <div className="w-0.5 h-8 bg-teal/20" />}
                  </div>
                  <div className="flex-1 -mt-1">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase tracking-widest text-teal">{step.day}</span>
                       <span className="text-[9px] font-bold text-earth-light/60 dark:text-ivory/40 uppercase tracking-widest">{step.text}</span>
                    </div>
                    <p className="text-[10px] font-medium text-earth-light/40 dark:text-lavender-muted/40">{step.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Selector */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <AnimatePresence mode="popLayout">
                {visiblePlans.map((plan) => (
                  <motion.button
                    layout
                    key={plan.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all relative ${
                      selectedPlanId === plan.id 
                        ? 'border-playful-purple bg-playful-purple/5 shadow-lg' 
                        : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-playful-purple/30'
                    }`}
                  >
                    {(isSpanish ? plan.labelEs : plan.labelEn) && (
                      <div className="absolute -top-2 right-4 px-2 py-0.5 bg-playful-purple text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                        {isSpanish ? plan.labelEs : plan.labelEn}
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-black text-earth dark:text-ivory uppercase tracking-widest">
                          {isSpanish ? plan.nameEs : plan.nameEn}
                        </p>
                        <p className="text-[10px] font-bold text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                          {plan.price} / {isSpanish ? plan.periodEs : plan.periodEn}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedPlanId === plan.id 
                          ? 'bg-playful-purple border-playful-purple text-white' 
                          : 'border-earth/20 dark:border-white/20'
                      }`}>
                        {selectedPlanId === plan.id && <Check size={12} strokeWidth={4} />}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>

            {!showAllPlans && (
              <button 
                onClick={() => setShowAllPlans(true)}
                className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-lavender-muted/40 hover:text-playful-purple transition-colors"
              >
                {isSpanish ? "Ver todos los planes" : "View all plans"}
              </button>
            )}

            <div className="space-y-3">
              <button 
                disabled={isProcessing}
                onClick={handleSubscribe}
                className={`w-full h-14 sm:h-16 rounded-[24px] shadow-lg flex items-center justify-center transition-all mt-4 px-8 ${isProcessing ? 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-wait border-none' : 'bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple hover:bg-playful-purple/10 shadow-[0_0_20px_rgba(109,40,217,0.1)] active:scale-95'}`}
              >
                {isProcessing ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <Sparkles size={20} className="shrink-0" />
                    <span className="font-black uppercase tracking-widest text-sm sm:text-base whitespace-nowrap px-2">
                      {isSpanish ? "EMPEZAR PRUEBA GRATIS" : "START FREE TRIAL"}
                    </span>
                    <ArrowRight size={20} className="shrink-0" />
                  </div>
                )}
              </button>
              <p className="text-center text-[9px] font-medium text-earth-light/40 dark:text-lavender-muted/40 px-6">
                {isSpanish ? "3 días gratis. Puedes cancelar antes de que termine la prueba." : "3 days free. Cancel before the trial ends."}
              </p>
            </div>

            <p className="text-center text-[10px] font-black uppercase tracking-widest text-earth-light/40 dark:text-lavender-muted/40 animate-pulse">
              {isSpanish ? "MODO DE PRUEBA ACTIVO" : "TEST MODE ACTIVE"}
            </p>
          </div>

          {/* Secondary Action */}
          <div className="pt-4 text-center">
            <button 
              className="text-xs font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted hover:text-playful-purple transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <Lock size={12} />
              {isSpanish ? "RESTAURAR COMPRA" : "RESTORE PURCHASE"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

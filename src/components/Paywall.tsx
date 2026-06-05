import React, { useState } from "react";
import { motion } from "motion/react";
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
    labelEs: null,
    trialEn: 'Starts immediately, no free trial',
    trialEs: 'Comienza de inmediato, sin prueba gratis',
    hasTrial: false
  },
  { 
    id: 'verso_monthly_1199', 
    price: '$11.99', 
    periodEn: 'month', 
    periodEs: 'mes',
    nameEn: 'Monthly',
    nameEs: 'Mensual',
    labelEn: null,
    labelEs: null,
    trialEn: 'Starts immediately, no free trial',
    trialEs: 'Comienza de inmediato, sin prueba gratis',
    hasTrial: false
  },
  { 
    id: 'verso_quarterly_2999', 
    price: '$27.99', 
    periodEn: '3 months', 
    periodEs: '3 meses',
    nameEn: '3-Month',
    nameEs: '3 Meses',
    labelEn: 'MOST POPULAR', 
    labelEs: 'MÁS POPULAR',
    isPopular: true,
    trialEn: '3-day free trial',
    trialEs: '3 días de prueba gratis',
    hasTrial: true,
    breakdownEn: '$9.33/month',
    breakdownEs: '$9.33/mes'
  },
  { 
    id: 'verso_annual_7999', 
    price: '$79.99', 
    periodEn: 'year', 
    periodEs: 'año',
    nameEn: 'Annual',
    nameEs: 'Anual',
    labelEn: 'BEST VALUE', 
    labelEs: 'MEJOR VALOR',
    isBestValue: true,
    default: true,
    trialEn: '3-day free trial',
    trialEs: '3 días de prueba gratis',
    hasTrial: true,
    breakdownEn: '$6.67/month',
    breakdownEs: '$6.67/mes'
  },
];

export default function Paywall({ state, onSubscribe, onClose, isDismissible = false }: PaywallProps) {
  const isSpanish = state.primaryLanguage === "es";
  const [selectedPlanId, setSelectedPlanId] = useState(PLANS.find(p => p.default)?.id || PLANS[PLANS.length - 1].id);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId);
  const hasTrial = selectedPlan ? selectedPlan.hasTrial : false;
  const isTrialPlanSelected = selectedPlanId === 'verso_quarterly_2999' || selectedPlanId === 'verso_annual_7999';

  const getCtaText = (planId: string, isSpanish: boolean) => {
    if (planId === 'verso_weekly_499') {
      return isSpanish ? "CONTINUAR CON PLAN SEMANAL" : "CONTINUE WITH WEEKLY";
    }
    if (planId === 'verso_monthly_1199') {
      return isSpanish ? "CONTINUAR CON PLAN MENSUAL" : "CONTINUE WITH MONTHLY";
    }
    return isSpanish ? "COMENZAR PRUEBA GRATIS de 3 Días" : "Start 3-Day Free Trial";
  };

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

  return (
    <div className="fixed inset-0 z-[100] bg-parchment dark:bg-espresso overflow-y-auto custom-scrollbar flex flex-col justify-start items-center py-4 sm:py-12 px-4 sm:px-6 pb-safe pt-safe">
      <motion.div 
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white/85 dark:bg-charcoal/85 backdrop-blur-xl rounded-[40px] shadow-2xl border border-earth/10 dark:border-white/10 overflow-hidden my-4 sm:my-auto py-2"
      >
        <div className="p-6 sm:p-10 space-y-6 relative">
          {isDismissible && onClose && (
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-earth/20 dark:text-white/20 hover:text-earth/40 dark:hover:text-white/40 transition-colors"
            >
              <Lock size={18} />
            </button>
          )}

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-playful-purple/10 rounded-2xl flex items-center justify-center text-playful-purple mx-auto mb-4">
              <Crown size={28} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-earth dark:text-ivory tracking-tight leading-tight">
              {isTrialPlanSelected 
                ? (isSpanish ? "Sigue creciendo en la Escritura." : "Keep growing in Scripture.")
                : (isSpanish ? "Empieza a memorizar hoy." : "Start memorizing today.")
              }
            </h2>
            <p className="text-sm dark:text-lavender-muted text-earth-light font-medium text-balance">
              {isSpanish 
                ? "Ya empezaste este hábito. Sigue volviendo, un versículo a la vez." 
                : "You’ve planted the habit. Keep showing up, one verse at a time."}
            </p>
          </div>

          {/* Trial Timeline */}
          {isTrialPlanSelected && (
            <div className="bg-earth/5 dark:bg-white/5 p-5 rounded-2xl border border-earth/5 dark:border-white/5 space-y-3">
              <div className="flex flex-col gap-3">
                {[
                  { 
                    day: isSpanish ? "Hoy" : "Today", 
                    text: isSpanish ? "Empieza gratis" : "Start free",
                    sub: isSpanish ? "Acceso total inmediato" : "Full access immediately"
                  },
                  { 
                    day: isSpanish ? "Día 2" : "Day 2", 
                    text: isSpanish ? "Te recordamos antes de que termine" : "We'll remind you before it ends",
                    sub: isSpanish ? "Aviso de recordatorio de prueba" : "Trial reminder before trial ends"
                  },
                  { 
                    day: isSpanish ? "Día 3" : "Day 3", 
                    text: isSpanish ? "Sigues solo si quieres" : "Continue only if you choose",
                    sub: isSpanish ? "La suscripción empieza después" : "Subscription starts after trial"
                  }
                ].map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-teal shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                      {i < 2 && <div className="w-0.5 h-6 bg-teal/20" />}
                    </div>
                    <div className="flex-1 -mt-1">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase tracking-widest text-teal">{step.day}</span>
                         <span className="text-[9px] font-bold text-earth-light/90 dark:text-ivory/90 uppercase tracking-widest">{step.text}</span>
                      </div>
                      <p className="text-[10px] font-medium text-earth-light/90 dark:text-lavender-muted/90">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Selector - Stable transitions with larger readable subtexts */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-playful-purple bg-playful-purple/5 shadow-md' 
                        : 'border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal/50 hover:border-playful-purple/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="space-y-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-earth dark:text-ivory uppercase tracking-widest">
                            {isSpanish ? plan.nameEs : plan.nameEn}
                          </p>
                          {(isSpanish ? plan.labelEs : plan.labelEn) && (
                            <span className="px-1.5 py-0.5 bg-playful-purple text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                              {isSpanish ? plan.labelEs : plan.labelEn}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-0.5">
                          <p className="text-sm sm:text-base font-extrabold text-earth dark:text-ivory">
                            {plan.price} <span className="text-xs sm:text-sm font-normal text-earth-light/80 dark:text-lavender-muted/80">/ {isSpanish ? plan.periodEs : plan.periodEn}</span>
                          </p>
                          
                          {(isSpanish ? plan.breakdownEs : plan.breakdownEn) && (
                            <p className="text-xs font-bold text-teal dark:text-teal-400">
                              {isSpanish ? plan.breakdownEs : plan.breakdownEn}
                            </p>
                          )}
                          
                          <p className="text-[11px] sm:text-xs font-medium text-earth-light/95 dark:text-lavender-muted font-serif italic">
                            {isSpanish ? plan.trialEs : plan.trialEn}
                          </p>
                        </div>
                      </div>
                      
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-playful-purple border-playful-purple text-white' 
                          : 'border-earth/20 dark:border-white/20'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={4} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <button 
                disabled={isProcessing}
                onClick={handleSubscribe}
                className={`w-full h-14 sm:h-16 rounded-[24px] shadow-lg flex items-center justify-center transition-all mt-4 px-6 ${isProcessing ? 'bg-earth/10 text-earth/20 dark:bg-white/5 dark:text-white/10 cursor-wait border-none' : 'bg-playful-purple/5 border-2 border-playful-purple/30 text-playful-purple hover:bg-playful-purple/10 shadow-[0_0_20px_rgba(109,40,217,0.1)] active:scale-95'}`}
              >
                {isProcessing ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <Sparkles size={20} className="shrink-0 text-playful-purple" />
                    <span className="font-black uppercase tracking-widest text-xs sm:text-sm whitespace-nowrap px-2 text-playful-purple">
                      {getCtaText(selectedPlanId, isSpanish)}
                    </span>
                    <ArrowRight size={20} className="shrink-0 text-playful-purple" />
                  </div>
                )}
              </button>
              
              <p className="text-center text-[10px] font-medium text-earth-light/90 dark:text-lavender-muted/90 px-6">
                {hasTrial ? (
                  isSpanish ? "3 días gratis. Cancela antes de que termine para no ser cobrado." : "3 days free. Cancel before ending to avoid charges."
                ) : (
                  isSpanish ? "Sin periodo de prueba. La suscripción comienza de inmediato." : "No free trial. Subscription starts immediately."
                )}
              </p>
            </div>

            <p className="text-center text-[10px] font-black uppercase tracking-widest text-earth-light/90 dark:text-lavender-muted/90 animate-pulse pt-2">
              {isSpanish ? "MODO DE PRUEBA ACTIVO" : "TEST MODE ACTIVE"}
            </p>
          </div>

          {/* Secondary Action */}
          <div className="pt-2 text-center">
            <button 
              className="text-xs font-black uppercase tracking-widest text-earth-light/90 dark:text-lavender-muted hover:text-playful-purple transition-colors flex items-center justify-center gap-2 mx-auto"
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

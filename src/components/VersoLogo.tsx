import React from "react";
import { motion } from "motion/react";
import { BookOpen, Sprout } from "lucide-react";

interface VersoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "app" | "onboarding";
  mode?: "standard" | "white";
}

export default function VersoLogo({ 
  size = "md", 
  showText = true, 
  variant = "app",
  mode = "standard"
}: VersoLogoProps) {
  const sizes = {
    sm: { icon: 16, container: "w-8 h-8", text: "text-xl", plant: 8 },
    md: { icon: 24, container: "w-12 h-12", text: "text-3xl", plant: 12 },
    lg: { icon: 32, container: "w-16 h-16", text: "text-4xl", plant: 16 },
    xl: { icon: 48, container: "w-24 h-24", text: "text-5xl", plant: 24 }
  };

  const current = sizes[size];
  const isOnboarding = variant === "onboarding";
  const isWhite = mode === "white";

  return (
    <div className={`flex ${isOnboarding ? 'flex-col gap-4' : 'flex-row gap-3'} items-center`}>
      <div className={`
        relative ${current.container} rounded-[30%] flex items-center justify-center transition-all duration-500
        ${isWhite ? 'bg-white/10 text-white' : 'bg-earth/[0.03] dark:bg-white/[0.07] border border-earth/5 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]'}
      `}>
        <BookOpen 
          size={current.icon} 
          className={isWhite ? 'text-white' : 'text-playful-purple dark:text-playful-purple'} 
          strokeWidth={isWhite ? 1.5 : (isOnboarding ? 1.5 : 2)} 
        />
        {isOnboarding && (
          <motion.div 
            className="absolute -top-1 -right-1 bg-white dark:bg-charcoal rounded-full p-1 shadow-md"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Sprout size={current.plant} className="text-teal" />
          </motion.div>
        )}
      </div>
      {showText && (
        <h1 className={`
          ${current.text} font-serif font-black tracking-tighter leading-none transition-colors duration-500
          ${isWhite ? 'text-white' : 'text-playful-purple'}
        `}>
          Verso
        </h1>
      )}
    </div>
  );
}

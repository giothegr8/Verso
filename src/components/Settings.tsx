import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, TRANSLATION_PAIRS, LanguageMode, TRANSLATION_DETAILS, Translation, TranslationMode, ReminderSettings, TranslationPair } from "../types";
import { X, Moon, Sun, Monitor, Languages, Palette, Trash2, Info, ChevronRight, BookOpen, Settings2, Check, Globe, Sparkles, MessageSquare, Save, Book, Shield, FileText } from "lucide-react";
import { getCurrentTranslationPair } from "../utils/verseUtils";
import CoachCard from "./CoachCard";
import PrivacyPolicyModal from "./PrivacyPolicyModal";
import TermsOfServiceModal from "./TermsOfServiceModal";

interface SettingsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onClose: () => void;
  onShowTour: () => void;
}

export default function Settings({ state, setState, onClose, onShowTour }: SettingsProps) {
  const [localState, setLocalState] = useState(state);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);

  const activePair = getCurrentTranslationPair(localState);

  const handleSave = async () => {
    setState(localState);
    
    setShowSavedToast(true);
    // Faster feedback and closure
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 600);
  };

  const handleSpanishTranslationChange = (translation: Translation) => {
    setLocalState(s => ({
      ...s,
      selectedTranslations: { ...s.selectedTranslations, es: translation }
    }));
  };

  const handleEnglishTranslationChange = (translation: Translation) => {
    setLocalState(s => ({
      ...s,
      selectedTranslations: { ...s.selectedTranslations, en: translation }
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-earth/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        className="w-full max-w-2xl bg-white dark:bg-charcoal rounded-[40px] overflow-hidden shadow-2xl border border-earth/5 dark:border-white/10 flex flex-col max-h-[90vh] relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Save Confirmation Toast */}
        <AnimatePresence>
          {showSavedToast && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] bg-teal text-white px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2"
            >
              <Check size={20} />
              {localState.primaryLanguage === 'es' ? 'Cambios guardados' : 'Settings saved'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="p-8 border-b border-earth/10 dark:border-white/10 flex justify-between items-center bg-white dark:bg-charcoal sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-playful-purple/10 rounded-2xl flex items-center justify-center text-playful-purple">
              <Settings2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-black text-earth dark:text-ivory tracking-tight">
                {localState.primaryLanguage === 'es' ? 'Ajustes' : 'Settings'}
              </h2>
              <p className="text-[10px] font-black text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                {localState.primaryLanguage === 'es' ? 'Personaliza tu experiencia' : 'Customize your experience'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon bg-earth/5 dark:bg-white/5 hover:bg-earth/10 dark:hover:bg-white/10 transition-colors border-none shadow-none"
          >
            <X size={24} className="text-earth/40 dark:text-lavender-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
          {/* 1. App Language */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Languages size={20} className="text-playful-purple" />
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-widest text-earth dark:text-ivory">
                  {localState.primaryLanguage === 'es' ? 'Idioma de la App' : 'App Language'}
                </h3>
                <p className="text-[10px] font-bold text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Idioma de la interfaz' : 'Language of the app UI'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'es', label: 'Español' },
                { id: 'en', label: 'English' }
              ].map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setLocalState(s => ({ ...s, primaryLanguage: lang.id as 'es' | 'en' }))}
                  className={`h-16 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-3 ${localState.primaryLanguage === lang.id ? 'bg-playful-purple text-white border-playful-purple shadow-lg shadow-playful-purple/20' : 'bg-earth/5 dark:bg-white/5 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10'}`}
                >
                  {localState.primaryLanguage === lang.id && <Check size={18} />}
                  {lang.label}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Bilingual Memorization */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-teal" />
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-widest text-earth dark:text-ivory">
                  {localState.primaryLanguage === 'es' ? 'Memorización Bilingüe' : 'Bilingual Memorization'}
                </h3>
                <p className="text-[10px] font-bold text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Idiomas para memorizar' : 'Whether you memorize in Spanish, English, or both'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'es', label: localState.primaryLanguage === 'es' ? 'Solo Español' : 'Spanish Only' },
                { id: 'en', label: localState.primaryLanguage === 'es' ? 'Solo Inglés' : 'English Only' },
                { id: 'both', label: localState.primaryLanguage === 'es' ? 'Ambos idiomas' : 'Both Languages' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setLocalState(s => ({ ...s, memorizeMode: mode.id as any }))}
                  className={`h-16 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 flex items-center justify-between ${localState.memorizeMode === mode.id ? 'bg-teal text-white border-teal shadow-lg shadow-teal/20' : 'bg-earth/5 dark:bg-white/5 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10'}`}
                >
                  <span>{mode.label}</span>
                  {localState.memorizeMode === mode.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </section>

          {/* 3. Translations */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <Book size={20} className="text-sky-blue" />
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-widest text-earth dark:text-ivory">
                  {localState.primaryLanguage === 'es' ? 'Traducciones' : 'Translations'}
                </h3>
                <p className="text-[10px] font-bold text-earth-light/60 dark:text-lavender-muted uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Selecciona las versiones de la Biblia' : 'Select which Bible versions to use'}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Spanish Translations */}
              {(localState.memorizeMode === 'es' || localState.memorizeMode === 'both') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted px-1">
                    {localState.primaryLanguage === 'es' ? 'Traducción al Español' : 'Spanish Translation'}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'RVR1960', label: 'Reina-Valera 1960' },
                      { id: 'NVI', label: 'NVI' },
                      { id: 'NBLA', label: 'NBLA' }
                    ].map((trans) => (
                      <button
                        key={trans.id}
                        onClick={() => handleSpanishTranslationChange(trans.id as Translation)}
                        className={`h-16 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 flex items-center justify-between ${activePair.es === trans.id ? 'bg-sky-blue text-white border-sky-blue shadow-lg shadow-sky-blue/20' : 'bg-earth/5 dark:bg-white/5 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10'}`}
                      >
                        <span>{trans.label}</span>
                        {activePair.es === trans.id && <Check size={20} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* English Translations */}
              {(localState.memorizeMode === 'en' || localState.memorizeMode === 'both') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-earth-light/60 dark:text-lavender-muted px-1">
                    {localState.primaryLanguage === 'es' ? 'Traducción al Inglés' : 'English Translation'}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'KJV', label: 'KJV' },
                      { id: 'NIV', label: 'NIV' },
                      { id: 'NASB', label: 'NASB' }
                    ].map((trans) => (
                      <button
                        key={trans.id}
                        onClick={() => handleEnglishTranslationChange(trans.id as Translation)}
                        className={`h-16 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border-2 flex items-center justify-between ${activePair.en === trans.id ? 'bg-golden text-white border-golden shadow-lg shadow-golden/20' : 'bg-earth/5 dark:bg-white/5 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10'}`}
                      >
                        <span>{trans.label}</span>
                        {activePair.en === trans.id && <Check size={20} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. Appearance */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Palette size={20} className="text-coral" />
              <h3 className="text-sm font-black uppercase tracking-widest text-earth dark:text-ivory">
                {localState.primaryLanguage === 'es' ? 'Apariencia' : 'Appearance'}
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'light', icon: <Sun size={20} />, label: localState.primaryLanguage === 'es' ? 'Claro' : 'Light' },
                { id: 'dark', icon: <Moon size={20} />, label: localState.primaryLanguage === 'es' ? 'Oscuro' : 'Dark' },
                { id: 'system', icon: <Monitor size={20} />, label: localState.primaryLanguage === 'es' ? 'Auto' : 'Auto' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setLocalState(s => ({ ...s, theme: theme.id as any }));
                    // Live preview of the theme change
                    setState(s => ({ ...s, theme: theme.id as any }));
                  }}
                  className={`h-24 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${localState.theme === theme.id ? 'bg-coral text-white border-coral shadow-lg shadow-coral/20' : 'bg-earth/5 dark:bg-white/5 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10'}`}
                >
                  {theme.icon}
                  <span className="text-[10px] font-black uppercase tracking-widest">{theme.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 5. Legal */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-earth-light/60" />
              <h3 className="text-sm font-black uppercase tracking-widest text-earth dark:text-ivory">
                {localState.primaryLanguage === 'es' ? 'Legal' : 'Legal'}
              </h3>
            </div>
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="w-full h-16 px-6 rounded-2xl bg-earth/5 dark:bg-white/5 border-2 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-earth-light/40" />
                <span className="font-black text-sm uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
                </span>
              </div>
              <ChevronRight size={18} className="text-earth-light/40 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setShowTermsOfService(true)}
              className="w-full h-16 px-6 rounded-2xl bg-earth/5 dark:bg-white/5 border-2 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-earth-light/40" />
                <span className="font-black text-sm uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Términos de Servicio' : 'Terms of Service'}
                </span>
              </div>
              <ChevronRight size={18} className="text-earth-light/40 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onShowTour}
              className="w-full h-16 px-6 rounded-2xl bg-earth/5 dark:bg-white/5 border-2 border-transparent text-earth/60 dark:text-lavender-muted hover:bg-earth/10 dark:hover:bg-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-earth-light/40" />
                <span className="font-black text-sm uppercase tracking-widest">
                  {localState.primaryLanguage === 'es' ? 'Ver recorrido de la app' : 'View app tour'}
                </span>
              </div>
              <ChevronRight size={18} className="text-earth-light/40 group-hover:translate-x-1 transition-transform" />
            </button>
          </section>
        </div>

        {/* Action Footer */}
        <div className="p-8 border-t border-earth/10 dark:border-white/10 bg-white dark:bg-charcoal flex gap-4">
          <button 
            onClick={handleSave}
            className="btn-primary flex-1 shadow-xl shadow-playful-purple/20"
          >
            <Save size={20} />
            {localState.primaryLanguage === 'es' ? 'Guardar Cambios' : 'Save Changes'}
          </button>
        </div>
      </motion.div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal 
        isOpen={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
        primaryLanguage={localState.primaryLanguage}
      />

      {/* Terms of Service Modal */}
      <TermsOfServiceModal 
        isOpen={showTermsOfService} 
        onClose={() => setShowTermsOfService(false)} 
        primaryLanguage={localState.primaryLanguage}
      />
    </motion.div>
  );
}

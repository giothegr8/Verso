import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, CustomPath, CustomPathVerse, Translation, TRANSLATION_DETAILS } from "../types";
import { ArrowLeft, Plus, Search, Loader2, X, ChevronUp, ChevronDown, Trash2, Save, AlertCircle, Info, BookOpen, Sparkles } from "lucide-react";
import { searchVerse } from "../services/bibleService";
import { getLocalizedBookName } from "../utils/verseUtils";
import VersoLogo from "./VersoLogo";

interface CustomPathCreateProps {
  state: AppState;
  onSave: (path: CustomPath) => void;
  onBack: () => void;
  initialPath?: CustomPath; // For editing
}

export default function CustomPathCreate({ state, onSave, onBack, initialPath }: CustomPathCreateProps) {
  const isEs = state.primaryLanguage === "es";
  
  const [title, setTitle] = useState(initialPath?.title || "");
  const [description, setDescription] = useState(initialPath?.description || "");
  const [verses, setVerses] = useState<CustomPathVerse[]>(initialPath?.verses || []);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTranslation, setSearchTranslation] = useState<Translation | "">(isEs ? "RVR1960" : "NIV");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Validation
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const translation = searchTranslation || (isEs ? state.selectedTranslations.es : state.selectedTranslations.en);
      const result = await searchVerse(searchQuery, translation as Translation);
      
      if (result) {
        // Add to list
        const text = isEs ? result.text.es[translation as Translation] : result.text.en[translation as Translation];
        
        const newVerse: CustomPathVerse = {
          id: `custom-v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          dayNumber: verses.length + 1,
          reference: `${getLocalizedBookName(result.book, state.memorizeMode)} ${result.chapter}:${result.verse}`,
          translation: translation as Translation,
          text: text,
          copyright: result.copyright,
          source: "api-bible",
          createdAt: new Date().toISOString()
        };

        // Duplicate check
        if (verses.some(v => v.reference === newVerse.reference)) {
          setLookupError(isEs ? "Este versículo ya está en tu Serie." : "This verse is already in your Path.");
        } else {
          setVerses([...verses, newVerse]);
          setSearchQuery("");
          setShowSearch(false);
        }
      } else {
        setSearchError(isEs ? "Versículo no encontrado. Prueba 'Juan 3:16'." : "Verse not found. Try 'John 3:16'.");
      }
    } catch (e) {
      setSearchError(isEs ? "Error al buscar." : "Error searching.");
    } finally {
      setIsSearching(false);
    }
  };

  const setLookupError = (msg: string) => {
    setSearchError(msg);
    setTimeout(() => setSearchError(null), 3000);
  };

  const moveVerse = (index: number, direction: 'up' | 'down') => {
    const newVerses = [...verses];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= verses.length) return;
    
    const temp = newVerses[index];
    newVerses[index] = newVerses[targetIndex];
    newVerses[targetIndex] = temp;
    
    // Refresh day numbers
    const reordered = newVerses.map((v, i) => ({
      ...v,
      dayNumber: i + 1
    }));
    
    setVerses(reordered);
  };

  const removeVerse = (id: string) => {
    const filtered = verses.filter(v => v.id !== id);
    const reordered = filtered.map((v, i) => ({
      ...v,
      dayNumber: i + 1
    }));
    setVerses(reordered);
  };

  const handleFinalSave = () => {
    if (!title.trim()) {
      setErrorMessage(isEs ? "Ponle un nombre a tu Serie antes de guardarla." : "Name your Path before saving.");
      return;
    }
    if (verses.length === 0) {
      setErrorMessage(isEs ? "Agrega al menos un versículo." : "Add at least one verse.");
      return;
    }

    const path: CustomPath = {
      id: initialPath?.id || `custom-path-${Date.now()}`,
      type: "custom",
      title: title.trim(),
      description: description.trim(),
      language: state.primaryLanguage,
      createdAt: initialPath?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verses: verses
    };

    onSave(path);
  };

  return (
    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-[100] bg-parchment dark:bg-espresso flex flex-col overflow-hidden transition-colors duration-500 shadow-2xl border-x border-earth/5 dark:border-white/5">
      {/* Top Header */}
      <div className="flex items-center justify-between p-6 bg-white/50 dark:bg-charcoal/50 backdrop-blur-md sticky top-0 z-20">
        <button 
          onClick={onBack}
          className="p-3 rounded-2xl bg-earth/5 dark:bg-white/5 text-earth/60 dark:text-ivory/60 hover:text-teal transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-serif font-black text-lg text-earth dark:text-ivory">
          {initialPath ? (isEs ? "Editar Serie Personalizada" : "Edit Custom Path") : (isEs ? "Crear Serie Personalizada" : "Create Custom Path")}
        </span>
        <button 
          onClick={handleFinalSave}
          className="p-3 rounded-2xl bg-teal/10 text-teal hover:bg-teal/20 transition-all"
        >
          <Save size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
        {/* Intro */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-earth dark:text-ivory tracking-tight">
            {isEs ? "Tu Nueva Serie" : "Your New Path"}
          </h1>
          <p className="text-sm sm:text-base font-medium text-earth-light/60 dark:text-lavender-muted/60 leading-relaxed max-w-sm">
            {isEs ? "Crea una secuencia de versículos para una prédica, clase, estudio o etapa personal." : "Build a verse sequence for a sermon, class, study, or personal season."}
          </p>
        </div>

        {/* Inputs */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-ivory/30 ml-1">
              {isEs ? "TÍTULO DE LA SERIE" : "PATH TITLE"}
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.substring(0, 60))}
              placeholder={isEs ? "Ej: Clase bíblica o Paz para esta semana" : "e.g. Sunday School or Peace for This Week"}
              className="w-full bg-white dark:bg-charcoal/50 border border-earth/10 dark:border-white/10 rounded-2xl p-4 text-base font-bold text-earth dark:text-ivory focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-earth-light/35 dark:placeholder:text-ivory/20"
            />
            <div className="flex justify-end pr-2">
              <span className={`text-[9px] font-black tracking-widest transition-colors ${title.length >= 55 ? 'text-coral' : title.length > 0 ? 'text-golden-dark dark:text-golden' : 'text-earth-light/30 dark:text-ivory/20'}`}>
                {title.length}/60
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-earth-light/40 dark:text-ivory/30 ml-1">
              {isEs ? "DESCRIPCIÓN (OPCIONAL)" : "DESCRIPTION (OPTIONAL)"
            }</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value.substring(0, 180))}
              placeholder={isEs ? "¿De qué se trata esta Serie?" : "What is this Path about?"}
              rows={3}
              className="w-full bg-white dark:bg-charcoal/50 border border-earth/10 dark:border-white/10 rounded-2xl p-4 text-sm font-medium text-earth dark:text-ivory focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-earth-light/35 dark:placeholder:text-ivory/20 resize-none"
            />
            <div className="flex justify-end pr-2">
              <span className="text-[9px] font-black text-earth-light/30 dark:text-ivory/20 tracking-widest">{description.length}/180</span>
            </div>
          </div>
        </div>

        {/* Verse Builder */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-teal/60 dark:text-teal/40 ml-1">
              {isEs ? "VERSÍCULOS" : "VERSES"}
            </label>
            <span className="text-[10px] font-black text-golden-dark/60 dark:text-golden/40 bg-golden/5 px-2 py-0.5 rounded-full">
              {verses.length} / 30
            </span>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {verses.map((v, index) => (
                <motion.div 
                  key={v.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-charcoal/50 border border-earth/10 dark:border-white/10 rounded-[24px] p-4 flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal/5 flex items-center justify-center text-teal font-black text-xs shrink-0">
                    {v.dayNumber}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-serif font-black text-earth dark:text-ivory leading-tight truncate">
                      {v.reference}
                    </p>
                    <p className="text-[10px] text-earth-light/60 dark:text-lavender-muted/60 lowercase italic truncate">
                      {v.text ? (v.text.length > 40 ? v.text.substring(0, 40) + '...' : v.text) : (isEs ? "Vista previa no disponible" : "Preview unavailable")}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-0.5 sm:gap-1 opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                    <button 
                      onClick={() => moveVerse(index, 'up')}
                      disabled={index === 0}
                      className="p-2 hover:text-teal disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button 
                      onClick={() => moveVerse(index, 'down')}
                      disabled={index === verses.length - 1}
                      className="p-2 hover:text-teal disabled:opacity-20 cursor-pointer"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <div className="w-px h-4 bg-earth/10 mx-1" />
                    <button 
                      onClick={() => removeVerse(v.id)}
                      className="p-2 hover:text-coral transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {verses.length < 30 ? (
              <button 
                onClick={() => setShowSearch(true)}
                className="w-full h-16 rounded-[24px] border-2 border-dashed border-teal/10 dark:border-white/5 text-earth-light/40 dark:text-ivory/20 flex items-center justify-center gap-3 hover:border-teal/30 hover:bg-teal/[0.02] hover:text-teal transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-teal/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-teal/10 transition-colors">
                  <Plus size={18} />
                </div>
                <span className="font-black uppercase tracking-widest text-xs">
                  {isEs ? "AGREGAR VERSÍCULO" : "ADD VERSE"}
                </span>
              </button>
            ) : (
              <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-3">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold leading-relaxed">
                  {isEs ? "Por ahora puedes agregar hasta 30 versículos." : "You can add up to 30 verses for now."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Global Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-coral/10 rounded-2xl border border-coral/20 text-coral flex items-start gap-3"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm font-bold leading-relaxed">{errorMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save Button Floating */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-parchment dark:from-espresso via-parchment/85 dark:via-espresso/85 to-transparent z-30 pt-10"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button 
          onClick={handleFinalSave}
          className="w-full h-12 bg-teal/10 hover:bg-teal/20 text-teal dark:text-teal-400 border border-teal/20 dark:border-teal-400/30 rounded-xl px-6 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50"
        >
          <Save size={16} />
          <span>
            {initialPath ? (isEs ? "Guardar cambios" : "Save Changes") : (isEs ? "Guardar Serie" : "Save Path")}
          </span>
        </button>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSearch(false)}
              className="absolute inset-0 bg-espresso/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white dark:bg-charcoal rounded-t-[40px] sm:rounded-[40px] shadow-2xl border-t sm:border border-earth/10 dark:border-white/10 overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-serif font-black text-earth dark:text-ivory">
                    {isEs ? "Agregar versículo" : "Add Verse"}
                  </h3>
                  <button 
                    onClick={() => setShowSearch(false)}
                    className="p-2 text-earth/30 hover:text-earth transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Translation Selection */}
                  <div className="flex flex-wrap gap-2">
                    {(isEs ? ["RVR1960", "NVI", "NBLA"] : ["KJV", "NIV", "NASB"]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSearchTranslation(t as Translation)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                          searchTranslation === t 
                            ? "bg-teal/10 text-teal border-teal/40"
                            : "bg-earth/5 dark:bg-white/5 text-earth/40 dark:text-ivory/40 border-earth/10 dark:border-white/10 hover:border-teal/30"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-earth-light/40">
                      <Search size={18} />
                    </div>
                    <input 
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder={isEs ? "Ej: Juan 3:16" : "e.g. John 3:16"}
                      className="w-full bg-earth/5 dark:bg-white/10 border-none rounded-2xl py-4 pl-12 pr-4 text-earth dark:text-ivory font-bold focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                    />
                    {isSearching ? (
                      <div className="absolute inset-y-0 right-4 flex items-center">
                        <Loader2 className="animate-spin text-teal" size={18} />
                      </div>
                    ) : (
                      <button 
                        onClick={handleSearch}
                        className="absolute inset-y-0 right-2 px-4 flex items-center text-teal font-black text-[10px] uppercase tracking-widest"
                      >
                        {isEs ? "BUSCAR" : "SEARCH"}
                      </button>
                    )}
                  </div>

                  {searchError && (
                    <div className="p-4 bg-coral/10 rounded-2xl flex items-center gap-3 text-coral border border-coral/20">
                      <AlertCircle size={18} />
                      <p className="text-sm font-bold">{searchError}</p>
                    </div>
                  )}

                  <div className="flex items-start gap-4 p-5 bg-teal/5 rounded-3xl">
                     <Info size={16} className="text-teal mt-0.5 shrink-0" />
                     <p className="text-[11px] font-bold text-teal/80 leading-relaxed">
                        {isEs 
                          ? "Escribe el nombre del libro y la cita. Usaremos la versión seleccionada para buscar el texto." 
                          : "Enter the book name and reference. We'll use your selected translation to find the text."
                        }
                     </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

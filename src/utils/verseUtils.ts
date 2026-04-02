import { AppState, TranslationPair, TRANSLATION_PAIRS, Verse, Translation } from "../types";

/**
 * Gets the current translation pair based on the app state.
 */
export function getCurrentTranslationPair(state: AppState): TranslationPair {
  if (state.translationMode === "default") {
    return TRANSLATION_PAIRS[state.activePairIndex] || TRANSLATION_PAIRS[0];
  }
  return state.customPair;
}

/**
 * Validates if a verse has the required text for a specific translation.
 */
export function validateVerseTranslation(verse: Verse, lang: "es" | "en", translation: Translation): { isValid: boolean; error?: string } {
  const text = verse.text[lang][translation];
  if (!text || text.trim() === "") {
    return { 
      isValid: false, 
      error: lang === "es" 
        ? `Este versículo no está disponible en la traducción ${translation}.` 
        : `This verse is unavailable in the selected translation (${translation}).` 
    };
  }
  return { isValid: true };
}

/**
 * Gets the verse text for a specific language and translation, with strict validation.
 * Returns null if the translation is missing.
 */
export function getSafeVerseText(verse: Verse, lang: "es" | "en", translation: Translation): string | null {
  const validation = validateVerseTranslation(verse, lang, translation);
  if (!validation.isValid) {
    return null;
  }
  return verse.text[lang][translation];
}

/**
 * Rebuilds a verse object or ensures it's fresh for the current translations.
 * (In this mock setup, it mostly serves as a validation layer)
 */
export function getValidatedVerse(verse: Verse, state: AppState): { 
  esText: string | null; 
  enText: string | null; 
  esError?: string; 
  enError?: string;
  activePair: TranslationPair;
} {
  const activePair = getCurrentTranslationPair(state);
  
  const esResult = validateVerseTranslation(verse, "es", activePair.es);
  const enResult = validateVerseTranslation(verse, "en", activePair.en);
  
  return {
    esText: esResult.isValid ? verse.text.es[activePair.es] : null,
    enText: enResult.isValid ? verse.text.en[activePair.en] : null,
    esError: esResult.error,
    enError: enResult.error,
    activePair
  };
}

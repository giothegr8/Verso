import { AppState, TranslationPair, TRANSLATION_PAIRS, Verse, Translation } from "../types";

/**
 * Gets the current translation pair based on the app state.
 */
export function getCurrentTranslationPair(state: AppState): TranslationPair {
  return state.selectedTranslations;
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
  
  const esResult = (state.memorizeMode === 'es' || state.memorizeMode === 'both') 
    ? validateVerseTranslation(verse, "es", activePair.es)
    : { isValid: false };
    
  const enResult = (state.memorizeMode === 'en' || state.memorizeMode === 'both')
    ? validateVerseTranslation(verse, "en", activePair.en)
    : { isValid: false };
  
  return {
    esText: esResult.isValid ? verse.text.es[activePair.es] : null,
    enText: enResult.isValid ? verse.text.en[activePair.en] : null,
    esError: esResult.error,
    enError: enResult.error,
    activePair
  };
}

/**
 * Gets the localized book name based on the memorize mode.
 */
export function getLocalizedBookName(book: string, mode: "es" | "en" | "both"): string {
  const parts = book.split(' / ');
  const esBook = parts[0];
  const enBook = parts[1] || parts[0];
  
  if (mode === 'es') return esBook;
  if (mode === 'en') return enBook;
  return book; // Return both for 'both' mode
}

/**
 * Gets the current local date in YYYY-MM-DD format.
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Standard layout constants for the verse to ensure visual consistency.
 */
export const VERSE_LAYOUT = {
  MAX_CHARS_PER_LINE: 28, // Slightly more generous for natural flow
  FONT_SIZE_CLASSES: "text-xl sm:text-2xl md:text-3xl",
  LINE_HEIGHT: "leading-relaxed",
  FONT_WEIGHT: "font-medium",
  CHAR_HEIGHT: "h-8 sm:h-10", // Stable height for underlines
};

/**
 * Splits a verse text into lines of roughly equal length, respecting word boundaries.
 * This ensures consistent layout across different views.
 */
export function getVerseLines(text: string | null | undefined, maxCharsPerLine: number = VERSE_LAYOUT.MAX_CHARS_PER_LINE): string[] {
  if (!text) return [];
  
  // If text already has line breaks, respect them
  if (text.includes('\n')) {
    return text.split('\n');
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = "";

  words.forEach(word => {
    if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  return lines;
}

/**
 * Removes accents and diacritics from a string.
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

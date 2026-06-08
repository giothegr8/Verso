import { Verse, AppState, Translation } from "../types";
import { getVerseFromApiBible, BIBLE_VERSIONS, parseReference, BOOK_TO_USFM, findSuggestedBook, CANONICAL_USFM_NAMES } from "./apiBible";
import { BIBLE_VERSE_COUNTS } from "../utils/bibleVerseCounts";

/**
 * Bible Service
 * Handles verse lookups using API.Bible with mock fallbacks.
 */

/**
 * Normalized Bible API Response Interface
 */
export interface BibleApiResponse {
  data: {
    id: string;
    orgId: string;
    bookId: string;
    chapterId: string;
    bibleId: string;
    reference: string;
    content: string;
    verseCount: number;
    copyright: string;
    next?: { id: string; number: string };
    previous?: { id: string; number: string };
  };
}

/**
 * Normalizes a Bible reference for matching.
 */
export function normalizeReference(ref: string): string {
  if (!ref) return "";
  
  let normalized = ref.toLowerCase().trim();
  
  // 1. Remove accents/diacritics
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 2. Replace dots and semicolons with colons
  normalized = normalized.replace(/[.;]/g, ":");
  
  // 3. Remove punctuation that isn't colon or hyphen
  normalized = normalized.replace(/[,/#!$%\^&*{}=\-_`~()]/g, "");
  
  // 4. Normalize spacing around colons
  normalized = normalized.replace(/\s*:\s*/g, ":");
  
  // 5. Normalize multiple spaces to single
  normalized = normalized.replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    "jn": "john",
    "juan": "john",
    "john": "john",
    "rom": "romans",
    "romanos": "romans",
    "romans": "romans",
    "ps": "psalm",
    "pss": "psalm",
    "psa": "psalm",
    "psalms": "psalm",
    "psalm": "psalm",
    "salmo": "psalm",
    "salmos": "psalm"
  };

  const parts = normalized.split(" ");
  if (parts.length > 1) {
    const bookPart = parts.slice(0, -1).join(" ");
    const chapterVerse = parts[parts.length - 1];
    
    if (aliases[bookPart]) {
      return `${aliases[bookPart]} ${chapterVerse}`;
    }
  }

  return normalized;
}

const CANONICAL_MOCK_DATA: Record<string, string> = {
  "john 3:16": "John 3:16",
  "romans 8:28": "Romans 8:28",
  "psalm 23:1": "Psalm 23:1",
  "juan 3:16": "Juan 3:16",
  "romanos 8:28": "Romanos 8:28"
};

const MOCK_BIBLE_DATA: Record<string, Verse> = {
  "John 3:16": {
    id: "custom-john-3-16",
    book: "John",
    chapter: 3,
    verse: 16,
    text: {
      en: {
        KJV: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
        NIV: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
        NASB: "For God so loved the world, that He gave His only begotten Son, that whoever believes in Him shall not perish, but have eternal life.",
        RVR1960: "", NVI: "", NBLA: ""
      },
      es: {
        RVR1960: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
        NVI: "Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.",
        NBLA: "Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que todo aquel que cree en Él, no se pierda, sino que tenga vida eterna.",
        KJV: "", NIV: "", NASB: ""
      }
    }
  },
  "Juan 3:16": {
    id: "custom-john-3-16",
    book: "Juan",
    chapter: 3,
    verse: 16,
    text: {
      en: {
        KJV: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
        NIV: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
        NASB: "For God so loved the world, that He gave His only begotten Son, that whoever believes in Him shall not perish, but have eternal life.",
        RVR1960: "", NVI: "", NBLA: ""
      },
      es: {
        RVR1960: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
        NVI: "Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.",
        NBLA: "Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que todo aquel que cree en Él, no se pierda, sino que tenga vida eterna.",
        KJV: "", NIV: "", NASB: ""
      }
    }
  },
  "Romans 8:28": {
    id: "custom-romans-8-28",
    book: "Romans",
    chapter: 8,
    verse: 28,
    text: {
      en: {
        KJV: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
        NIV: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
        NASB: "And we know that God causes all things to work together for good to those who love God, to those who are called according to His purpose.",
        RVR1960: "", NVI: "", NBLA: ""
      },
      es: {
        RVR1960: "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.",
        NVI: "Ahora bien, sabemos que Dios dispone todas las cosas para el bien de quienes lo aman, los que han sido llamados de acuerdo con su propósito.",
        NBLA: "Y sabemos que para los que aman a Dios, todas las cosas cooperan para bien, esto es, para los que son llamados conforme a Su propósito.",
        KJV: "", NIV: "", NASB: ""
      }
    }
  },
  "Romanos 8:28": {
    id: "custom-romans-8-28",
    book: "Romanos",
    chapter: 8,
    verse: 28,
    text: {
      en: {
        KJV: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
        NIV: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
        NASB: "And we know that God causes all things to work together for good to those who love God, to those who are called according to His purpose.",
        RVR1960: "", NVI: "", NBLA: ""
      },
      es: {
        RVR1960: "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.",
        NVI: "Ahora bien, sabemos que Dios dispone todas las cosas para el bien de quienes lo aman, los que han sido llamados de acuerdo con su propósito.",
        NBLA: "Y sabemos que para los que aman a Dios, todas las cosas cooperan para bien, esto es, para los que son llamados conforme a Su propósito.",
        KJV: "", NIV: "", NASB: ""
      }
    }
  },
  "Psalm 23:1": {
    id: "custom-psalm-23-1",
    book: "Psalm",
    chapter: 23,
    verse: 1,
    text: {
      en: {
        KJV: "The LORD is my shepherd; I shall not want.",
        NIV: "The LORD is my shepherd, I lack nothing.",
        NASB: "The LORD is my shepherd, I shall not want.",
        RVR1960: "", NVI: "", NBLA: ""
      },
      es: {
        RVR1960: "Jehová es mi pastor; nada me faltará.",
        NVI: "El SEÑOR es mi pastor, nada me falta.",
        NBLA: "El SEÑOR es mi pastor, nada me faltará.",
        KJV: "", NIV: "", NASB: ""
      }
    }
  }
};

/**
 * Real Bible API Lookup
 */
async function fetchVerseFromApi(reference: string, translation: string): Promise<Verse | null> {
  const versionId = BIBLE_VERSIONS[translation] || BIBLE_VERSIONS.en;
  const result = await getVerseFromApiBible(reference, versionId);

  if (!result) return null;

  // Partial mapping back to Verse object
  const isSpanish = translation.includes('RVR') || translation.includes('NVI') || translation.includes('NBLA');
  
  const initialEn: Record<Translation, string> = {
    KJV: "", NIV: "", NASB: "", RVR1960: "", NVI: "", NBLA: ""
  };
  const initialEs: Record<Translation, string> = {
    KJV: "", NIV: "", NASB: "", RVR1960: "", NVI: "", NBLA: ""
  };

  if (isSpanish) {
    initialEs[translation as Translation] = result.text;
  } else {
    initialEn[translation as Translation] = result.text;
  }

  let bookName = result.reference.split(' ').slice(0, -1).join(' ') || result.reference.split(' ')[0] || "Verse";
  let ch = 1;
  let vs = 1;
  const match = result.reference.match(/(\d+)\s*[:.]\s*([\d\-]+)\s*$/);
  if (match) {
    ch = parseInt(match[1]) || 1;
    vs = parseInt(match[2].split('-')[0]) || 1;
  }

  return {
    id: `api-bible-${reference.replace(/\s+/g, '-')}-${translation}`,
    book: bookName,
    chapter: ch,
    verse: vs,
    text: {
      en: initialEn,
      es: initialEs
    },
    copyright: result.copyright,
    source: "api-bible"
  };
}

/**
 * Main search function used by UI
 */
export async function searchVerse(reference: string, translation?: string): Promise<Verse | null> {
  const isSpanish = translation && (translation.includes('RVR') || translation.includes('NVI') || translation.includes('NBLA'));
  
  const normalizedInput = normalizeReference(reference);
  if (!normalizedInput) return null;

  // 1. Try mock data first
  const canonicalKey = CANONICAL_MOCK_DATA[normalizedInput];
  const mockVerse = canonicalKey ? MOCK_BIBLE_DATA[canonicalKey] : null;
  if (mockVerse) return mockVerse;

  // 2. Validate exact Bible reference parsing
  const parsed = parseReference(reference);

  if (!parsed || !parsed.book) {
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? "Formato de cita bíblica no válido. Citas válidas ej: 'Efesios 2:8', 'eph 2 8' o 'EPH.2.8'." 
        : "Invalid Bible reference format. Valid examples: 'Ephesians 2:8', 'eph 2 8', or 'EPH.2.8'.")
    );
  }

  const bookCleaned = parsed.book.toLowerCase().trim();
  
  // Custom case-insensitive and accent-insensitive book lookup helper
  const findUsfmForBook = (bookName: string): string | null => {
    const cleanWord = bookName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    
    for (const [key, usfm] of Object.entries(BOOK_TO_USFM)) {
      const cleanKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      if (cleanKey === cleanWord) {
        return usfm;
      }
    }
    return null;
  };

  const usfmBook = findUsfmForBook(bookCleaned);

  if (!usfmBook) {
    const suggestedBook = findSuggestedBook(parsed.book, !!isSpanish);
    if (suggestedBook) {
      const ch = parsed.chapter || "1";
      const vs = parsed.verse || "1";
      const suggestedRef = `${suggestedBook} ${ch}:${vs}`;
      const err = new Error(
        "PARSE_ERROR:" + (isSpanish 
          ? `Libro bíblico no reconocido: "${parsed.book}". ¿Quisiste decir "${suggestedBook}"?` 
          : `Unrecognized Bible book name: "${parsed.book}". Did you mean "${suggestedBook}"?`)
      );
      (err as any).suggestion = suggestedRef;
      throw err;
    }
    
    // Fallback/example suggestions are ONLY used when the input cannot be understood as any valid book
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `Libro bíblico no reconocido: "${parsed.book}". Intenta verificar la ortografía o prueba con un ejemplo como "Juan 3:16".` 
        : `Unrecognized Bible book name: "${parsed.book}". Please check your spelling or try searching "John 3:16".`)
    );
  }

  const canonicalNames = CANONICAL_USFM_NAMES[usfmBook];
  const bookNameDisplay = isSpanish ? canonicalNames.es : canonicalNames.en;

  // 3. Validate chapter
  if (parsed.chapter === null) {
    const err = new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `Por favor, especifica un capítulo para ${bookNameDisplay}, por ejemplo: "${bookNameDisplay} 1:1".` 
        : `Please specify a chapter for ${bookNameDisplay}, e.g. "${bookNameDisplay} 1:1".`)
    );
    (err as any).suggestion = `${bookNameDisplay} 1:1`;
    throw err;
  }

  const chapterNum = parseInt(parsed.chapter);
  const chapterCounts = BIBLE_VERSE_COUNTS[usfmBook];
  if (!chapterCounts) {
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `Error interno al validar ${bookNameDisplay}.` 
        : `Internal error validating ${bookNameDisplay}.`)
    );
  }

  const maxChapters = chapterCounts.length;
  if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > maxChapters) {
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `${bookNameDisplay} solo tiene ${maxChapters} capítulos.` 
        : `${bookNameDisplay} only has ${maxChapters} chapters.`)
    );
  }

  // 4. Validate verse
  if (parsed.verse === null) {
    const err = new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `Por favor, especifica un versículo para ${bookNameDisplay} ${chapterNum}, por ejemplo: "${bookNameDisplay} ${chapterNum}:1".` 
        : `Please specify a verse for ${bookNameDisplay} ${chapterNum}, e.g. "${bookNameDisplay} ${chapterNum}:1".`)
    );
    (err as any).suggestion = `${bookNameDisplay} ${chapterNum}:1`;
    throw err;
  }

  // Support ranges like 16-18 by extracting and validating the first digit segment
  const firstVerseMatch = String(parsed.verse).match(/^(\d+)/);
  if (!firstVerseMatch) {
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `Versículo no válido para ${bookNameDisplay} ${chapterNum}.` 
        : `Invalid verse for ${bookNameDisplay} ${chapterNum}.`)
    );
  }

  const firstVerseNum = parseInt(firstVerseMatch[1]);
  const maxVerses = chapterCounts[chapterNum - 1];

  if (isNaN(firstVerseNum) || firstVerseNum < 1 || firstVerseNum > maxVerses) {
    throw new Error(
      "PARSE_ERROR:" + (isSpanish 
        ? `${bookNameDisplay} ${chapterNum} solo tiene ${maxVerses} versículos.` 
        : `${bookNameDisplay} ${chapterNum} only has ${maxVerses} verses.`)
    );
  }

  // Now reference is 100% valid!
  const stdRef = `${canonicalNames.en} ${chapterNum}:${parsed.verse}`;
  const stdRefEs = `${canonicalNames.es} ${chapterNum}:${parsed.verse}`;

  // Try mock data with clean canonical names
  const secondMockCheck = MOCK_BIBLE_DATA[stdRef] || MOCK_BIBLE_DATA[stdRefEs];
  if (secondMockCheck) return secondMockCheck;

  // 5. Fallback to API.Bible
  return await fetchVerseFromApi(stdRef, translation || "KJV");
}

/**
 * Loads a verse's Spanish and English texts from the API/Proxy and merges it into the app state's customVerses list.
 */
export async function loadVerseAndMerge(
  reference: string,
  verseId: string,
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>
) {
  const activePair = state.selectedTranslations;
  
  const esTrans = activePair.es;
  const enTrans = activePair.en;
  
  const keyEs = `${verseId}_${esTrans}`;
  const keyEn = `${verseId}_${enTrans}`;

  // Mark as loading immediately
  setState(prev => ({
    ...prev,
    loadingTranslations: {
      ...(prev.loadingTranslations || {}),
      [keyEs]: true,
      [keyEn]: true
    }
  }));

  let esRes: { text: string; reference: string; copyright: string } | null = null;
  let enRes: { text: string; reference: string; copyright: string } | null = null;

  try {
    try {
      const esBibleId = BIBLE_VERSIONS[esTrans] || BIBLE_VERSIONS.es;
      esRes = await getVerseFromApiBible(reference, esBibleId);
    } catch (error) {
      console.error("Spanish verse fetching failed:", error);
    }

    try {
      const enBibleId = BIBLE_VERSIONS[enTrans] || BIBLE_VERSIONS.en;
      enRes = await getVerseFromApiBible(reference, enBibleId);
    } catch (error) {
      console.error("English verse fetching failed:", error);
    }
    
    const bookName = (esRes?.reference || enRes?.reference || reference).split(' ').slice(0, -1).join(' ');
    const chAndV = (esRes?.reference || enRes?.reference || reference).split(' ').pop() || "1:1";
    const [chapter, verseNum] = chAndV.split(':').map(n => parseInt(n) || 1);
    
    const initialEs: Record<Translation, string> = {
      RVR1960: esTrans === "RVR1960" ? (esRes ? esRes.text : "Error al cargar la traducción en Español.") : "",
      NVI: esTrans === "NVI" ? (esRes ? esRes.text : "Error al cargar la traducción en Español.") : "",
      NBLA: esTrans === "NBLA" ? (esRes ? esRes.text : "Error al cargar la traducción en Español.") : "",
      KJV: "", NIV: "", NASB: ""
    };

    const initialEn: Record<Translation, string> = {
      KJV: enTrans === "KJV" ? (enRes ? enRes.text : "Error loading English translation.") : "",
      NIV: enTrans === "NIV" ? (enRes ? enRes.text : "Error loading English translation.") : "",
      NASB: enTrans === "NASB" ? (enRes ? enRes.text : "Error loading English translation.") : "",
      RVR1960: "", NVI: "", NBLA: ""
    };

    const esUpdate = { [esTrans]: esRes ? esRes.text : "Error al cargar la traducción en Español." } as Partial<Record<Translation, string>>;
    const enUpdate = { [enTrans]: enRes ? enRes.text : "Error loading English translation." } as Partial<Record<Translation, string>>;

    const verseObj: Verse = {
      id: verseId,
      book: bookName,
      chapter,
      verse: verseNum,
      text: {
        es: initialEs,
        en: initialEn
      },
      copyright: esRes?.copyright || enRes?.copyright,
      source: "api-bible"
    };
    
    setState(prev => {
      const exists = prev.customVerses.some(v => v.id === verseId);
      let updatedCustom;
      if (exists) {
        updatedCustom = prev.customVerses.map(v => {
          if (v.id === verseId) {
            return {
              ...v,
              text: {
                es: { ...v.text.es, ...esUpdate },
                en: { ...v.text.en, ...enUpdate }
              }
            };
          }
          return v;
        });
      } else {
        updatedCustom = [...prev.customVerses, verseObj];
      }
      
      const newLoading = { ...(prev.loadingTranslations || {}) };
      delete newLoading[keyEs];
      delete newLoading[keyEn];
        
      return {
        ...prev,
        loadingTranslations: newLoading,
        customVerses: updatedCustom,
        selectedCustomVerse: prev.activeSource === "custom" && prev.selectedCustomVerse?.id === verseId
          ? {
              ...prev.selectedCustomVerse,
              text: {
                es: { ...prev.selectedCustomVerse.text.es, ...esUpdate },
                en: { ...prev.selectedCustomVerse.text.en, ...enUpdate }
              }
            }
          : prev.selectedCustomVerse
      };
    });
  } catch (err) {
    console.error("General error inside loadVerseAndMerge:", err);
    setState(prev => {
      const newLoading = { ...(prev.loadingTranslations || {}) };
      delete newLoading[keyEs];
      delete newLoading[keyEn];
      return {
        ...prev,
        loadingTranslations: newLoading
      };
    });
  }
}

import { Verse } from "../types";

/**
 * Bible Service
 * Handles verse lookups and prepares for real API integration.
 * Currently uses mock data for MVP.
 */

// TODO: Define your Bible API key in .env (server-side only)
// BIBLE_API_KEY=your_key_here

/**
 * Normalized Bible API Response Interface
 * Future-proofing for real API results (e.g., API.Bible or ESV API)
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
 * Handles: case, extra whitespace, dots, abbreviations, accents, Spanish/English.
 */
export function normalizeReference(ref: string): string {
  if (!ref) return "";
  
  let normalized = ref.toLowerCase().trim();
  
  // 1. Remove accents/diacritics
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 2. Replace dots with colons (John 3.16 -> john 3:16)
  normalized = normalized.replace(/\./g, ":");
  
  // 3. Remove punctuation that isn't colon or hyphen
  normalized = normalized.replace(/[,/#!$%\^&\*;{}=\-_`~()]/g, "");
  
  // 4. Normalize spacing around colons
  normalized = normalized.replace(/\s*:\s*/g, ":");
  
  // 5. Normalize multiple spaces to single
  normalized = normalized.replace(/\s+/g, " ");

  // 6. Handle common abbreviations and aliases
  const aliases: Record<string, string> = {
    // John / Juan
    "jn": "john",
    "juan": "john",
    "john": "john",
    // Romans / Romanos
    "rom": "romans",
    "romanos": "romans",
    "romans": "romans",
    // Psalms / Salmos
    "ps": "psalm",
    "pss": "psalm",
    "psa": "psalm",
    "psalms": "psalm",
    "psalm": "psalm",
    "salmo": "psalm",
    "salmos": "psalm"
  };

  // Find if book part matches an alias
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

// Canonical lookup keys should also be normalized
const CANONICAL_MOCK_DATA: Record<string, string> = {
  "john 3:16": "John 3:16",
  "romans 8:28": "Romans 8:28",
  "psalm 23:1": "Psalm 23:1"
};

// Mock Bible API implementation for MVP
// John 3:16, Romans 8:28, Psalm 23:1
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
 * Real Bible API Lookup (Placeholder)
 * This will eventually call the server-side API proxy to fetch verses
 * without exposing sensitive API keys to the client.
 */
async function fetchVerseFromApi(reference: string, translation: string): Promise<Verse | null> {
  try {
    // TODO: Implement server-side proxy call in /api/bible
    // const response = await fetch(`/api/bible/verse?ref=${encodeURIComponent(reference)}&translation=${translation}`);
    // if (!response.ok) throw new Error("API call failed");
    // const data = await response.json();
    // return mapApiResultToVerse(data);
    
    console.log(`API simulation: looking up ${reference} in ${translation}`);
    return null; // Return null until implemented
  } catch (error) {
    console.error("Bible API Error:", error);
    return null;
  }
}

/**
 * Main search function used by UI
 */
export async function searchVerse(reference: string, translation?: string): Promise<Verse | null> {
  const normalizedInput = normalizeReference(reference);
  if (!normalizedInput) return null;

  // 1. Try mock data first (MVP behavior preserved)
  const canonicalKey = CANONICAL_MOCK_DATA[normalizedInput];
  const mockVerse = canonicalKey ? MOCK_BIBLE_DATA[canonicalKey] : null;
  if (mockVerse) {
    // Simulation of network delay for API readiness
    await new Promise(resolve => setTimeout(resolve, 600));
    return mockVerse;
  }

  // 2. Fallback to placeholder API call (Integration-readiness)
  return await fetchVerseFromApi(normalizedInput, translation || "KJV");
}

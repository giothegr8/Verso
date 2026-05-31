/**
 * API.Bible Service
 * Handles verse fetching, caching, and copyright.
 */

// @ts-ignore
const API_KEY = import.meta.env.VITE_API_BIBLE_KEY || (import.meta as any).env?.VITE_API_BIBLE_KEY;
const API_BASE = "https://api.scripture.api.bible/v1";

// Cache settings
const CACHE_KEY = "verso_bible_cache";
const CACHE_MAX_ITEMS = 500;
const CACHE_EXPIRY_DAYS = 14;

interface CachedVerse {
  content: string;
  reference: string;
  copyright: string;
  timestamp: number;
}

/**
 * Bible Version IDs for API.Bible
 * Note: Some versions like NIV or certain RVR editions may require Pro licensing.
 */
export const BIBLE_VERSIONS: Record<string, string> = {
  KJV: "de4e12af7f895945-01",
  ASV: "06125ad3dfee5834-01",
  RVR1960: "592420522e16049f-01",
  NVI: "5da0108dbd6d3761-01",
  NBLA: "c309477e163c81e9-01",
  NASB: "301b5fa8dbd6c376-01",
  NIV: "bba9f40182ba81d4-01",
  // Fallbacks
  en: "de4e12af7f895945-01", 
  es: "592420522e16049f-01"
};

export const BOOK_TO_USFM: Record<string, string> = {
  // Pentateuch
  "genesis": "GEN", "gen": "GEN", "ge": "GEN", "gn": "GEN", "gênesis": "GEN",
  "exodo": "EXO", "exodus": "EXO", "exo": "EXO", "ex": "EXO", "éxodo": "EXO",
  "levitico": "LEV", "leviticus": "LEV", "lev": "LEV", "le": "LEV", "lv": "LEV", "levítico": "LEV",
  "numeros": "NUM", "numbers": "NUM", "num": "NUM", "nu": "NUM", "nm": "NUM", "números": "NUM",
  "deuteronomio": "DEU", "deuteronomy": "DEU", "deu": "DEU", "de": "DEU", "dt": "DEU",
  // Historical
  "josue": "JOS", "joshua": "JOS", "jos": "JOS", "jsh": "JOS", "josué": "JOS",
  "jueces": "JDG", "judges": "JDG", "jdg": "JDG", "jg": "JDG", "jue": "JDG",
  "rut": "RUT", "ruth": "RUT", "ru": "RUT", "rt": "RUT",
  "1 samuel": "1SA", "1samuel": "1SA", "1-samuel": "1SA", "1 sam": "1SA", "1sam": "1SA", "1s": "1SA", "1 s": "1SA",
  "2 samuel": "2SA", "2samuel": "2SA", "2-samuel": "2SA", "2 sam": "2SA", "2sam": "2SA", "2s": "2SA", "2 s": "2SA",
  "1 reyes": "1KI", "1kings": "1KI", "1-kings": "1KI", "1 rey": "1KI", "1rey": "1KI", "1ki": "1KI", "1k": "1KI", "1 k": "1KI",
  "2 reyes": "2KI", "2kings": "2KI", "2-kings": "2KI", "2 rey": "2KI", "2rey": "2KI", "2ki": "2KI", "2k": "2KI", "2 k": "2KI",
  "1 cronicas": "1CH", "1chronicles": "1CH", "1-cronicas": "1CH", "1-chronicles": "1CH", "1 chr": "1CH", "1chr": "1CH", "1 cro": "1CH", "1cro": "1CH", "1ch": "1CH", "1 crónicas": "1CH",
  "2 cronicas": "2CH", "2chronicles": "2CH", "2-cronicas": "2CH", "2-chronicles": "2CH", "2 chr": "2CH", "2chr": "2CH", "2 cro": "2CH", "2cro": "2CH", "2ch": "2CH", "2 crónicas": "2CH",
  "esdras": "EZR", "ezra": "EZR", "ezr": "EZR", "esd": "EZR",
  "nehemias": "NEH", "nehemiah": "NEH", "neh": "NEH", "ne": "NEH", "nehemías": "NEH",
  "ester": "EST", "esther": "EST", "est": "EST", "es": "EST",
  // Poetic
  "job": "JOB", "jb": "JOB",
  "salmos": "PSA", "salmo": "PSA", "psalms": "PSA", "psalm": "PSA", "ps": "PSA", "psa": "PSA", "pss": "PSA", "sal": "PSA",
  "proverbios": "PRO", "proverbs": "PRO", "pro": "PRO", "pr": "PRO", "prv": "PRO", "prov": "PRO",
  "eclesiastes": "ECC", "ecclesiastes": "ECC", "ecc": "ECC", "ec": "ECC", "ecl": "ECC", "eclesiastés": "ECC",
  "cantares": "SNG", "cantares de salomon": "SNG", "song of solomon": "SNG", "song of songs": "SNG", "song": "SNG", "sng": "SNG", "cant": "SNG", "cnt": "SNG",
  // Major Prophets
  "isaias": "ISA", "isaiah": "ISA", "isa": "ISA", "is": "ISA", "isaías": "ISA",
  "jeremias": "JER", "jeremiah": "JER", "jer": "JER", "je": "JER", "jeremías": "JER",
  "lamentaciones": "LAM", "lamentations": "LAM", "lam": "LAM", "la": "LAM",
  "ezequiel": "EZK", "ezekiel": "EZK", "ezk": "EZK", "eze": "EZK", "ez": "EZK",
  "daniel": "DAN", "dan": "DAN", "dn": "DAN",
  // Minor Prophets
  "oseas": "HOS", "hosea": "HOS", "hos": "HOS", "os": "HOS",
  "joel": "JOL", "jol": "JOL", "jl": "JOL",
  "amos": "AMO", "amo": "AMO", "am": "AMO",
  "abdias": "OBA", "obadiah": "OBA", "oba": "OBA", "ob": "OBA", "abd": "OBA", "abdías": "OBA",
  "jonas": "JON", "jonah": "JON", "jon": "JON", "jonás": "JON",
  "miqueas": "MIC", "micah": "MIC", "mic": "MIC", "miq": "MIC",
  "nahum": "NAM", "nam": "NAM", "nah": "NAM",
  "habacuc": "HAB", "habakkuk": "HAB", "hab": "HAB",
  "sofonias": "ZEP", "zephaniah": "ZEP", "zep": "ZEP", "sof": "ZEP", "sofonías": "ZEP",
  "hageo": "HAG", "haggai": "HAG", "hag": "HAG",
  "zacarias": "ZEC", "zechariah": "ZEC", "zec": "ZEC", "zac": "ZEC", "zacarías": "ZEC",
  "malaquias": "MAL", "malachi": "MAL", "mal": "MAL", "malaquías": "MAL",
  // Gospels & Acts
  "mateo": "MAT", "matthew": "MAT", "mat": "MAT", "mt": "MAT",
  "marcos": "MRK", "mark": "MRK", "mrk": "MRK", "mk": "MRK", "mar": "MRK", "mc": "MRK",
  "lucas": "LUK", "luke": "LUK", "luk": "LUK", "lk": "LUK", "luc": "LUK", "lc": "LUK",
  "juan": "JHN", "john": "JHN", "jhn": "JHN", "jn": "JHN",
  "hechos": "ACT", "hechos de los apostoles": "ACT", "acts": "ACT", "acts of the apostles": "ACT", "act": "ACT", "hch": "ACT",
  // Epistles
  "romanos": "ROM", "romans": "ROM", "rom": "ROM", "ro": "ROM",
  "1 corintios": "1CO", "1corintios": "1CO", "1-corintios": "1CO", "1 corinthians": "1CO", "1-corinthians": "1CO", "1 cor": "1CO", "1cor": "1CO", "1co": "1CO",
  "2 corintios": "2CO", "2corintios": "2CO", "2-corintios": "2CO", "2 corinthians": "2CO", "2-corinthians": "2CO", "2 cor": "2CO", "2cor": "2CO", "2co": "2CO",
  "galatas": "GAL", "galatians": "GAL", "gal": "GAL", "ga": "GAL", "gálatas": "GAL",
  "efesios": "EPH", "ephesians": "EPH", "eph": "EPH", "ep": "EPH", "ef": "EPH",
  "filipenses": "PHP", "philippians": "PHP", "php": "PHP", "phil": "PHP", "fil": "PHP", "flp": "PHP",
  "colosenses": "COL", "colossians": "COL", "col": "COL", "co": "COL",
  "1 tesalonicenses": "1TH", "1tesalonicenses": "1TH", "1-tesalonicenses": "1TH", "1 thessalonians": "1TH", "1-thessalonians": "1TH", "1 th": "1TH", "1th": "1TH", "1 tes": "1TH", "1te": "1TH",
  "2 tesalonicenses": "2TH", "2tesalonicenses": "2TH", "2-tesalonicenses": "2TH", "2 thessalonians": "2TH", "2-thessalonians": "2TH", "2 th": "2TH", "2th": "2TH", "2 tes": "2TH", "2te": "2TH",
  "1 timoteo": "1TI", "1timoteo": "1TI", "1-timoteo": "1TI", "1 timothy": "1TI", "1-timothy": "1TI", "1 tim": "1TI", "1tim": "1TI", "1ti": "1TI",
  "2 timoteo": "2TI", "2timoteo": "2TI", "2-timoteo": "2TI", "2 timothy": "2TI", "2-timothy": "2TI", "2 tim": "2TI", "2tim": "2TI", "2ti": "2TI",
  "tito": "TIT", "titus": "TIT", "tit": "TIT", "ti": "TIT",
  "filemon": "PHM", "philemon": "PHM", "phm": "PHM", "phlm": "PHM", "flm": "PHM", "filemón": "PHM",
  "hebreos": "HEB", "hebrews": "HEB", "heb": "HEB", "he": "HEB",
  "santiago": "JAS", "james": "JAS", "jas": "JAS", "jam": "JAS", "stg": "JAS", "sant": "JAS",
  "1 pedro": "1PE", "1pedro": "1PE", "1-pedro": "1PE", "1 peter": "1PE", "1-peter": "1PE", "1 pet": "1PE", "1pet": "1PE", "1pe": "1PE", "1 ped": "1PE",
  "2 pedro": "2PE", "2pedro": "2PE", "2-pedro": "2PE", "2 peter": "2PE", "2-peter": "2PE", "2 pet": "2PE", "2pet": "2PE", "2pe": "2PE", "2 ped": "2PE",
  "1 juan": "1JN", "1juan": "1JN", "1-juan": "1JN", "1 john": "1JN", "1-john": "1JN", "1 jn": "1JN", "1jn": "1JN", "1 jhn": "1JN",
  "2 juan": "2JN", "2juan": "2JN", "2-juan": "2JN", "2 john": "2JN", "2-john": "2JN", "2 jn": "2JN", "2jn": "2JN", "2 jhn": "2JN",
  "3 juan": "3JN", "3juan": "3JN", "3-juan": "3JN", "3 john": "3JN", "3-john": "3JN", "3 jn": "3JN", "3jn": "3JN", "3 jhn": "3JN",
  "judas": "JUD", "jude": "JUD", "jud": "JUD", "jd": "JUD",
  "apocalipsis": "REV", "revelation": "REV", "rev": "REV", "ap": "REV", "apo": "REV", "apoc": "REV"
};

// Maps USFM code to a canonical display name in English and Spanish
export const CANONICAL_USFM_NAMES: Record<string, { en: string; es: string }> = {
  GEN: { en: "Genesis", es: "Génesis" },
  EXO: { en: "Exodus", es: "Éxodo" },
  LEV: { en: "Leviticus", es: "Levítico" },
  NUM: { en: "Numbers", es: "Números" },
  DEU: { en: "Deuteronomy", es: "Deuteronomio" },
  JOS: { en: "Joshua", es: "Josué" },
  JDG: { en: "Judges", es: "Jueces" },
  RUT: { en: "Ruth", es: "Rut" },
  "1SA": { en: "1 Samuel", es: "1 Samuel" },
  "2SA": { en: "2 Samuel", es: "2 Samuel" },
  "1KI": { en: "1 Kings", es: "1 Reyes" },
  "2KI": { en: "2 Kings", es: "2 Reyes" },
  "1CH": { en: "1 Chronicles", es: "1 Crónicas" },
  "2CH": { en: "2 Chronicles", es: "2 Crónicas" },
  EZR: { en: "Ezra", es: "Esdras" },
  NEH: { en: "Nehemiah", es: "Nehemías" },
  EST: { en: "Esther", es: "Ester" },
  JOB: { en: "Job", es: "Job" },
  PSA: { en: "Psalms", es: "Salmos" },
  PRO: { en: "Proverbs", es: "Proverbios" },
  ECC: { en: "Ecclesiastes", es: "Eclesiastés" },
  SNG: { en: "Song of Solomon", es: "Cantares" },
  ISA: { en: "Isaiah", es: "Isaías" },
  JER: { en: "Jeremiah", es: "Jeremías" },
  LAM: { en: "Lamentations", es: "Lamentaciones" },
  EZK: { en: "Ezekiel", es: "Ezequiel" },
  DAN: { en: "Daniel", es: "Daniel" },
  HOS: { en: "Hosea", es: "Oseas" },
  JOL: { en: "Joel", es: "Joel" },
  AMO: { en: "Amos", es: "Amós" },
  OBA: { en: "Obadiah", es: "Abdías" },
  JON: { en: "Jonah", es: "Jonás" },
  MIC: { en: "Micah", es: "Miqueas" },
  NAM: { en: "Nahum", es: "Nahúm" },
  HAB: { en: "Habakkuk", es: "Habacuc" },
  ZEP: { en: "Zephaniah", es: "Sofonías" },
  HAG: { en: "Haggai", es: "Hageo" },
  ZEC: { en: "Zechariah", es: "Zacarías" },
  MAL: { en: "Malachi", es: "Malaquías" },
  MAT: { en: "Matthew", es: "Mateo" },
  MRK: { en: "Mark", es: "Marcos" },
  LUK: { en: "Luke", es: "Lucas" },
  JHN: { en: "John", es: "Juan" },
  ACT: { en: "Acts", es: "Hechos" },
  ROM: { en: "Romans", es: "Romanos" },
  "1CO": { en: "1 Corinthians", es: "1 Corintios" },
  "2CO": { en: "2 Corinthians", es: "2 Corintios" },
  GAL: { en: "Galatians", es: "Gálatas" },
  EPH: { en: "Ephesians", es: "Efesios" },
  PHP: { en: "Philippians", es: "Filipenses" },
  COL: { en: "Colossians", es: "Colosenses" },
  "1TH": { en: "1 Thessalonians", es: "1 Tesalonicenses" },
  "2TH": { en: "2 Thessalonians", es: "2 Tesalonicenses" },
  "1TI": { en: "1 Timothy", es: "1 Timoteo" },
  "2TI": { en: "2 Timothy", es: "2 Timoteo" },
  TIT: { en: "Titus", es: "Tito" },
  PHM: { en: "Philemon", es: "Filemón" },
  HEB: { en: "Hebrews", es: "Hebreos" },
  JAS: { en: "James", es: "Santiago" },
  "1PE": { en: "1 Peter", es: "1 Pedro" },
  "2PE": { en: "2 Peter", es: "2 Pedro" },
  "1JN": { en: "1 John", es: "1 Juan" },
  "2JN": { en: "2 John", es: "2 Juan" },
  "3JN": { en: "3 John", es: "3 Juan" },
  JUD: { en: "Jude", es: "Judas" },
  REV: { en: "Revelation", es: "Apocalipsis" }
};

export function levenshtein(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = Array.from({ length: s1.length + 1 }, () => 
    new Array(s2.length + 1).fill(0)
  );

  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s1.length][s2.length];
}

export function findSuggestedBook(userInput: string, isSpanish: boolean): string | null {
  const cleanInput = userInput.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  if (cleanInput.length < 2) return null;

  let bestMatch: string | null = null;
  let bestScore = 0; // 0 to 1, higher is closer

  for (const [key, usfm] of Object.entries(BOOK_TO_USFM)) {
    // Only match against longer keys (at least 3 chars) to avoid suggesting small abbreviations
    if (key.length < 3) continue;

    const levDist = levenshtein(cleanInput, key);
    const score = 1 - (levDist / Math.max(cleanInput.length, key.length));

    if (score > bestScore) {
      bestScore = score;
      bestMatch = usfm;
    }
  }

  if (bestMatch && bestScore > 0.5) {
    const names = CANONICAL_USFM_NAMES[bestMatch];
    return isSpanish ? names.es : names.en;
  }

  return null;
}

export function preprocessReference(ref: string): string {
  if (!ref) return "";
  
  // Normalize spacing, trim, and handle semicolons
  let cleaned = ref.trim().replace(/;/g, ':').replace(/,/g, ':');
  
  // If there's no colon or dot separating the chapter and verse, but there is a space separating two ending numbers.
  // e.g. "genesis 11 1" or "1 corinthians 13 4" or "1 cor 13 4" or "gen 11 1-2"
  const trailingDigitsRegex = /\s+(\d+)\s+(\d+([\d\-]*))\s*$/;
  if (!cleaned.includes(':') && !cleaned.includes('.') && trailingDigitsRegex.test(cleaned)) {
    cleaned = cleaned.replace(trailingDigitsRegex, (match, ch, vs) => ` ${ch}:${vs}`);
  }

  // Replace dots with colons
  cleaned = cleaned.replace(/\./g, ":");

  // Normalize spacing around colons
  cleaned = cleaned.replace(/\s*:\s*/g, ":");

  // Normalize multiple spaces to single
  cleaned = cleaned.replace(/\s+/g, " ");

  return cleaned;
}

export function parseReference(ref: string) {
  if (!ref) return null;
  const originalRef = ref.trim();
  
  // Match chapter and verse at the end, allowing separators like space, colon, period, semicolon, comma
  const regex = /(?:^|\s+|[:.,;]+)(\d+)\s*[:.,;\s]\s*([\d\-]+)\s*$/;
  const match = originalRef.match(regex);
  if (!match) return null;
  
  const matchIndex = match.index || 0;
  // Extract book name part
  let bookPart = originalRef.slice(0, matchIndex).trim();
  
  // Clean up any trailing separators from the book name
  bookPart = bookPart.replace(/[:.,;]+$/, "").trim();
  
  const chapter = match[1];
  const verse = match[2];
  
  // Strip accents/diacritics from the book name
  const bookCleaned = bookPart.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  return {
    book: bookCleaned,
    chapter,
    verse
  };
}

function formatBookForDeno(book: string): string {
  let b = book.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // removes accents
    .replace(/\s+/g, "-");           // replaces spaces with hyphens (e.g. "1 juan" -> "1-juan")
  
  const enToEs: Record<string, string> = {
    "john": "juan", "matthew": "mateo", "mark": "marcos", "luke": "lucas", "acts": "hechos", "romans": "romanos",
    "galatians": "galatas", "ephesians": "efesios", "philippians": "filipenses", "colossians": "colosenses",
    "titus": "tito", "philemon": "filemon", "hebrews": "hebreos", "james": "santiago", "jude": "judas",
    "revelation": "apocalipsis", "genesis": "genesis", "exodus": "exodo", "leviticus": "levitico",
    "numbers": "numeros", "deuteronomy": "deuteronomio", "joshua": "josue", "judges": "jueces",
    "ruth": "rut", "job": "job", "psalms": "salmos", "psalm": "salmos", "proverbs": "proverbios",
    "ecclesiastes": "eclesiastes", "song-of-solomon": "cantares", "canticles": "cantares",
    "isaiah": "isaias", "jeremiah": "jeremias", "lamentations": "lamentaciones", "ezekiel": "ezequiel",
    "daniel": "daniel", "hosea": "oseas", "joel": "joel", "amos": "amos", "obadiah": "abdias",
    "jonah": "jonas", "micah": "miqueas", "nahum": "nahum", "habakkuk": "habacuc", "zephaniah": "sofonias",
    "haggai": "hageo", "zechariah": "zacarias", "malachi": "malaquias",
    // books with numbers
    "1-corinthians": "1-corintios", "2-corinthians": "2-corintios",
    "1-thessalonians": "1-tesalonicenses", "2-thessalonians": "2-tesalonicenses",
    "1-timothy": "1-timoteo", "2-timothy": "2-timoteo",
    "1-samuel": "1-samuel", "2-samuel": "2-samuel",
    "1-kings": "1-reyes", "2-kings": "2-reyes",
    "1-chronicles": "1-cronicas", "2-chronicles": "2-cronicas",
    "1-peter": "1-pedro", "2-peter": "2-pedro",
    "1-john": "1-juan", "2-john": "2-juan", "3-john": "3-juan"
  };

  if (enToEs[b]) {
    return enToEs[b];
  }
  return b;
}

async function fetchFallbackVerse(
  reference: string,
  versionId: string
): Promise<{ text: string; reference: string; copyright: string } | null> {
  const isSpanish = versionId === BIBLE_VERSIONS.RVR1960 || versionId === BIBLE_VERSIONS.NVI || versionId === BIBLE_VERSIONS.NBLA || versionId === BIBLE_VERSIONS.es;

  if (isSpanish) {
    try {
      const parsed = parseReference(reference);
      if (parsed) {
        const denoBook = formatBookForDeno(parsed.book);
        const isNvi = versionId === BIBLE_VERSIONS.NVI;
        const denoVersion = isNvi ? "nvi" : "rv1960";
        const copyrightLabel = isNvi ? "Nueva Versión Internacional" : "Reina-Valera 1960";
        
        const url = `https://bible-api.deno.dev/api/read/${denoVersion}/${denoBook}/${parsed.chapter}/${parsed.verse}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.verse === "string") {
            const formattedBook = parsed.book.charAt(0).toUpperCase() + parsed.book.slice(1);
            return {
              text: data.verse.trim(),
              reference: `${formattedBook} ${parsed.chapter}:${parsed.verse}`,
              copyright: copyrightLabel
            };
          } else if (data && Array.isArray(data)) {
            const text = data.map((v: any) => (v.verse || "").trim()).join(" ");
            const bookName = parsed.book.charAt(0).toUpperCase() + parsed.book.slice(1);
            return {
              text,
              reference: `${bookName} ${parsed.chapter}:${parsed.verse}`,
              copyright: copyrightLabel
            };
          }
        }
      }
    } catch (e) {
      console.warn("Spanish Fallback API failed:", e);
    }
    // Spanish requests must not fall through to English!
    return null;
  }

  // Common or English fallback (bible-api.com)
  try {
    const translation = versionId === BIBLE_VERSIONS.ASV ? "asv" : "kjv";
    const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return {
        text: data.text.trim(),
        reference: data.reference,
        copyright: data.translation_note || "Public Domain"
      };
    }
  } catch (e) {
    console.warn("English Fallback API failed:", e);
  }

  return null;
}

/**
 * Fetches a verse from API.Bible
 */
export async function getVerseFromApiBible(
  reference: string, 
  versionId: string = BIBLE_VERSIONS.KJV
): Promise<{ text: string; reference: string; copyright: string } | null> {
  const parsed = parseReference(reference);
  let refToUse = reference;
  
  if (parsed) {
    const bookKey = parsed.book.toLowerCase().trim();
    const usfmBook = BOOK_TO_USFM[bookKey];
    if (usfmBook) {
      const isSpanish = versionId === BIBLE_VERSIONS.RVR1960 || versionId === BIBLE_VERSIONS.NVI || versionId === BIBLE_VERSIONS.NBLA || versionId === BIBLE_VERSIONS.es;
      const canonicalBookName = CANONICAL_USFM_NAMES[usfmBook]?.[isSpanish ? 'es' : 'en'] || parsed.book;
      refToUse = `${canonicalBookName} ${parsed.chapter}:${parsed.verse}`;
    }
  }

  // Check cache first using standardized refToUse
  const cached = getFromCache(refToUse, versionId);
  if (cached) return cached;

  // 1. First try the secure proxy endpoint (no direct API.Bible call from frontend)
  if (parsed) {
    const bookKey = parsed.book.toLowerCase().trim();
    const usfmBook = BOOK_TO_USFM[bookKey];
    if (usfmBook) {
      const firstVerse = parsed.verse.split("-")[0];
      const verseId = `${usfmBook}.${parsed.chapter}.${firstVerse}`;
      try {
        const response = await fetch(`/api/bible/verse?verseId=${verseId}&bibleId=${versionId}`);
        if (response.ok) {
          const payload = await response.json();
          if (payload && payload.data) {
            const rawContent = payload.data.content || "";
            // Remove the verse number span if present (e.g. <span ...>8</span>)
            let text = rawContent.replace(/<span[^>]*>\s*\d+\s*<\/span>/gi, "");
            // Remove all other HTML tags safely
            text = text.replace(/<[^>]*>/g, " ");
            // Compact whitespace and trim
            text = text.replace(/\s+/g, " ").trim();
            
            const result = {
              text: text,
              reference: payload.data.reference || refToUse,
              copyright: payload.data.copyright || "Provided by API.Bible"
            };
            saveToCache(refToUse, versionId, result);
            return result;
          }
        } else {
          console.warn(`Proxy returned status ${response.status} for ${verseId}. Trying fallback...`);
        }
      } catch (error) {
        console.warn("Proxy Fetch Error, trying fallback...", error);
      }
    }
  }

  // 2. Direct fallback to search endpoint if API_KEY is local (e.g. dev workspace)
  if (API_KEY) {
    try {
      // API.Bible search endpoint
      const url = `${API_BASE}/bibles/${versionId}/search?query=${encodeURIComponent(refToUse)}`;
      const response = await fetch(url, {
        headers: { "api-key": API_KEY }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.verses && data.data.verses.length > 0) {
          const verse = data.data.verses[0];
          const result = {
            text: verse.text.replace(/\[\d+\]/g, "").trim(), // Remove verse numbers if present
            reference: verse.reference,
            copyright: data.meta?.fumsId ? "Provided by API.Bible" : "© Bible Translation Owner"
          };
          saveToCache(refToUse, versionId, result);
          return result;
        }
      } else {
        console.warn(`API.Bible returned status ${response.status} for ${refToUse}. Trying fallback...`);
      }
    } catch (error) {
      console.warn("API.Bible Fetch Error, trying fallback...", error);
    }
  }

  // 3. Fallback to keyless public APIs
  const fallbackResult = await fetchFallbackVerse(refToUse, versionId);
  if (fallbackResult) {
    let cleanText = fallbackResult.text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const cleanedResult = { ...fallbackResult, text: cleanText };
    saveToCache(refToUse, versionId, cleanedResult);
    return cleanedResult;
  }

  return null;
}

function getFromCache(ref: string, version: string) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const cache = JSON.parse(raw);
    const key = `${version}:${ref.toLowerCase()}`;
    const entry = cache[key];

    if (!entry) return null;

    // Check expiry
    const now = Date.now();
    const expiry = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (now - entry.timestamp > expiry) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

function saveToCache(ref: string, version: string, data: any) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    let cache = raw ? JSON.parse(raw) : {};
    const key = `${version}:${ref.toLowerCase()}`;

    // Manage cache size
    const keys = Object.keys(cache);
    if (keys.length >= CACHE_MAX_ITEMS) {
      delete cache[keys[0]]; // Simple FIFO
    }

    cache[key] = {
      ...data,
      timestamp: Date.now()
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Cache Save Error:", e);
  }
}

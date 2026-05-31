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

const BOOK_TO_USFM: Record<string, string> = {
  // Pentateuch
  "genesis": "GEN",
  "exodo": "EXO", "exodus": "EXO",
  "levitico": "LEV", "leviticus": "LEV",
  "numeros": "NUM", "numbers": "NUM",
  "deuteronomio": "DEU", "deuteronomy": "DEU",
  // Historical
  "josue": "JOS", "joshua": "JOS",
  "jueces": "JDG", "judges": "JDG",
  "rut": "RUT", "ruth": "RUT",
  "1 samuel": "1SA", "1samuel": "1SA", "1-samuel": "1SA",
  "2 samuel": "2SA", "2samuel": "2SA", "2-samuel": "2SA",
  "1 reyes": "1KI", "1kings": "1KI", "1-kings": "1KI",
  "2 reyes": "2KI", "2kings": "2KI", "2-kings": "2KI",
  "1 cronicas": "1CH", "1chronicles": "1CH", "1-cronicas": "1CH", "1-chronicles": "1CH",
  "2 cronicas": "2CH", "2chronicles": "2CH", "2-cronicas": "2CH", "2-chronicles": "2CH",
  "esdras": "EZR", "ezra": "EZR",
  "nehemias": "NEH", "nehemiah": "NEH",
  "ester": "EST", "esther": "EST",
  // Poetic
  "job": "JOB",
  "salmos": "PSA", "salmo": "PSA", "psalms": "PSA", "psalm": "PSA",
  "proverbios": "PRO", "proverbs": "PRO",
  "eclesiastes": "ECC", "ecclesiastes": "ECC",
  "cantares": "SNG", "cantares de salomon": "SNG", "song of solomon": "SNG", "song of songs": "SNG",
  // Major Prophets
  "isaias": "ISA", "isaiah": "ISA",
  "jeremias": "JER", "jeremiah": "JER",
  "lamentaciones": "LAM", "lamentations": "LAM",
  "ezequiel": "EZK", "ezekiel": "EZK",
  "daniel": "DAN",
  // Minor Prophets
  "oseas": "HOS", "hosea": "HOS",
  "joel": "JOL",
  "amos": "AMO",
  "abdias": "OBA", "obadiah": "OBA",
  "jonas": "JON", "jonah": "JON",
  "miqueas": "MIC", "micah": "MIC",
  "nahum": "NAM",
  "habacuc": "HAB", "habakkuk": "HAB",
  "sofonias": "ZEP", "zephaniah": "ZEP",
  "hageo": "HAG", "haggai": "HAG",
  "zacarias": "ZEC", "zechariah": "ZEC",
  "malaquias": "MAL", "malachi": "MAL",
  // Gospels & Acts
  "mateo": "MAT", "matthew": "MAT",
  "marcos": "MRK", "mark": "MRK",
  "lucas": "LUK", "luke": "LUK",
  "juan": "JHN", "john": "JHN",
  "hechos": "ACT", "hechos de los apostoles": "ACT", "acts": "ACT", "acts of the apostles": "ACT",
  // Epistles
  "romanos": "ROM", "romans": "ROM",
  "1 corintios": "1CO", "1corintios": "1CO", "1-corintios": "1CO", "1 corinthians": "1CO", "1-corinthians": "1CO",
  "2 corintios": "2CO", "2corintios": "2CO", "2-corintios": "2CO", "2 corinthians": "2CO", "2-corinthians": "2CO",
  "galatas": "GAL", "galatians": "GAL",
  "efesios": "EPH", "ephesians": "EPH",
  "filipenses": "PHP", "philippians": "PHP",
  "colosenses": "COL", "colossians": "COL",
  "1 tesalonicenses": "1TH", "1tesalonicenses": "1TH", "1-tesalonicenses": "1TH", "1 thessalonians": "1TH", "1-thessalonians": "1TH",
  "2 tesalonicenses": "2TH", "2tesalonicenses": "2TH", "2-tesalonicenses": "2TH", "2 thessalonians": "2TH", "2-thessalonians": "2TH",
  "1 timoteo": "1TI", "1timoteo": "1TI", "1-timoteo": "1TI", "1 timothy": "1TI", "1-timothy": "1TI",
  "2 timoteo": "2TI", "2timoteo": "2TI", "2-timoteo": "2TI", "2 timothy": "2TI", "2-timothy": "2TI",
  "tito": "TIT", "titus": "TIT",
  "filemon": "PHM", "philemon": "PHM",
  "hebreos": "HEB", "hebrews": "HEB",
  "santiago": "JAS", "james": "JAS",
  "1 pedro": "1PE", "1pedro": "1PE", "1-pedro": "1PE", "1 peter": "1PE", "1-peter": "1PE",
  "2 pedro": "2PE", "2pedro": "2PE", "2-pedro": "2PE", "2 peter": "2PE", "2-peter": "2PE",
  "1 juan": "1JN", "1juan": "1JN", "1-juan": "1JN", "1 john": "1JN", "1-john": "1JN",
  "2 juan": "2JN", "2juan": "2JN", "2-juan": "2JN", "2 john": "2JN", "2-john": "2JN",
  "3 juan": "3JN", "3juan": "3JN", "3-juan": "3JN", "3 john": "3JN", "3-john": "3JN",
  "judas": "JUD", "jude": "JUD",
  "apocalipsis": "REV", "revelation": "REV"
};

function parseReference(ref: string) {
  const regex = /^\s*(?:(\d+)\s+)?([\w\u00C0-\u017F]+(?:(?:\s+|[-_])[\w\u00C0-\u017F]+)?)\s+(\d+)\s*[:.]\s*([\d\-]+)/i;
  const match = ref.match(regex);
  if (!match) return null;
  
  const num = match[1] ? match[1] + " " : "";
  const name = match[2].trim();
  const chapter = match[3];
  const verse = match[4];
  
  return {
    book: (num + name).toLowerCase().trim(),
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
        const url = `https://bible-api.deno.dev/api/read/rvr1960/${denoBook}/${parsed.chapter}/${parsed.verse}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.text === "string") {
            return {
              text: data.text.trim(),
              reference: `${data.book} ${data.chapter}:${data.vers}`,
              copyright: "Reina-Valera 1960"
            };
          } else if (data && Array.isArray(data)) {
            const text = data.map((v: any) => v.text.trim()).join(" ");
            const bookName = data[0]?.book || parsed.book;
            const chap = data[0]?.chapter || parsed.chapter;
            const verses = data.map((v: any) => v.vers).join("-");
            return {
              text,
              reference: `${bookName} ${chap}:${verses}`,
              copyright: "Reina-Valera 1960"
            };
          }
        }
      }
    } catch (e) {
      console.warn("Spanish Fallback API failed:", e);
    }
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
  // Check cache first
  const cached = getFromCache(reference, versionId);
  if (cached) return cached;

  // 1. First try the secure proxy endpoint (no direct API.Bible call from frontend)
  const parsed = parseReference(reference);
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
              reference: payload.data.reference || `${parsed.book} ${parsed.chapter}:${parsed.verse}`,
              copyright: payload.data.copyright || "Provided by API.Bible"
            };
            saveToCache(reference, versionId, result);
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
      const url = `${API_BASE}/bibles/${versionId}/search?query=${encodeURIComponent(reference)}`;
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
          saveToCache(reference, versionId, result);
          return result;
        }
      } else {
        console.warn(`API.Bible returned status ${response.status} for ${reference}. Trying fallback...`);
      }
    } catch (error) {
      console.warn("API.Bible Fetch Error, trying fallback...", error);
    }
  }

  // 3. Fallback to keyless public APIs
  const fallbackResult = await fetchFallbackVerse(reference, versionId);
  if (fallbackResult) {
    saveToCache(reference, versionId, fallbackResult);
    return fallbackResult;
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

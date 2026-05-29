/**
 * API.Bible Service
 * Handles verse fetching, caching, and copyright.
 */

const API_KEY = (import.meta as any).env.VITE_API_BIBLE_KEY;
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
  // Fallbacks
  en: "de4e12af7f895945-01", 
  es: "592420522e16049f-01"
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
  const isSpanish = versionId === BIBLE_VERSIONS.RVR1960 || versionId === BIBLE_VERSIONS.NVI || versionId === BIBLE_VERSIONS.es;

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
  } else {
    console.log("VITE_API_BIBLE_KEY is missing. Trying fallback...");
  }

  // Fallback to keyless public APIs
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

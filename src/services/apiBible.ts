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

/**
 * Fetches a verse from API.Bible
 */
export async function getVerseFromApiBible(
  reference: string, 
  versionId: string = BIBLE_VERSIONS.KJV
): Promise<{ text: string; reference: string; copyright: string } | null> {
  if (!API_KEY) {
    console.warn("VITE_API_BIBLE_KEY is missing.");
    return null;
  }

  // Check cache first
  const cached = getFromCache(reference, versionId);
  if (cached) return cached;

  try {
    // API.Bible search endpoint
    const url = `${API_BASE}/bibles/${versionId}/search?query=${encodeURIComponent(reference)}`;
    const response = await fetch(url, {
      headers: { "api-key": API_KEY }
    });

    if (!response.ok) throw new Error(`API.Bible error: ${response.status}`);

    const data = await response.json();
    if (!data.data || !data.data.verses || data.data.verses.length === 0) {
      return null;
    }

    const verse = data.data.verses[0];
    
    // API.Bible doesn't always return full copyright in search results, 
    // so we might need a separate call for bible info if not present.
    // For MVP, we'll use a placeholder if missing.
    const result = {
      text: verse.text.replace(/\[\d+\]/g, "").trim(), // Remove verse numbers if present
      reference: verse.reference,
      copyright: data.meta?.fumsId ? "Provided by API.Bible" : "© Bible Translation Owner"
    };

    saveToCache(reference, versionId, result);
    return result;
  } catch (error) {
    console.error("API.Bible Fetch Error:", error);
    return null;
  }
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

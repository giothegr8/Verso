import { MOCK_VERSES } from "../constants";
import { Verse, Translation } from "../types";

/**
 * Temporary mock verse text for development only. 
 * Replace with API.Bible or licensed provider before production.
 */

export interface VerseRequest {
  reference: string;
  id?: string;
}

export function getVerseText(request: VerseRequest): Verse | null {
  // If we have an ID, try that first (legacy/mock compatibility)
  if (request.id) {
    const verse = MOCK_VERSES.find(v => v.id === request.id);
    if (verse) return verse;
  }

  // Try to find by normalized reference
  // This is a simple mock implementation. In the future, this would call an API.
  const normalizedSearch = request.reference.toLowerCase().trim();
  
  const found = MOCK_VERSES.find(v => {
    const bookParts = v.book.toLowerCase().split("/");
    const matchBook = bookParts.some(p => normalizedSearch.includes(p.trim()));
    const matchNum = normalizedSearch.includes(`${v.chapter}:${v.verse}`);
    return matchBook && matchNum;
  });

  if (found) return found;

  // If not found in mock, return a placeholder object for "Verse text coming soon"
  // The UI should handle missing text.
  return null;
}

export function getFallbackMessage(lang: 'es' | 'en'): string {
  return lang === 'es' ? 'Texto del versículo próximamente.' : 'Verse text coming soon.';
}

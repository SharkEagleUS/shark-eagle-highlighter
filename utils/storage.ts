import type { HighlightPosition, PageHighlights } from './types';
import { getXPath, getElementByXPath } from './xpath';

// Re-export types for backward compatibility
export type { HighlightColor } from './types';
export type { HighlightPosition, PageHighlights } from './types';

// Re-export XPath utilities for backward compatibility
export { getXPath, getElementByXPath } from './xpath';

// Generate a unique ID
export function generateId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Normalize URL for storage key
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash and trailing slash
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return url;
  }
}

// Storage key prefix
const STORAGE_PREFIX = 'highlights_';

// Get storage key for a URL
export function getStorageKey(url: string): string {
  return STORAGE_PREFIX + normalizeUrl(url);
}

// Save highlights for a page
export async function saveHighlights(url: string, highlights: HighlightPosition[]): Promise<void> {
  const key = getStorageKey(url);
  const data: PageHighlights = { url: normalizeUrl(url), highlights };
  await chrome.storage.local.set({ [key]: data });
}

// Load highlights for a page
export async function loadHighlights(url: string): Promise<HighlightPosition[]> {
  const key = getStorageKey(url);
  const result = await chrome.storage.local.get(key);
  const data = result[key] as PageHighlights | undefined;
  return data?.highlights || [];
}

// Add a new highlight
export async function addHighlight(url: string, highlight: HighlightPosition): Promise<void> {
  const highlights = await loadHighlights(url);
  highlights.push(highlight);
  await saveHighlights(url, highlights);
}

// Remove a highlight by ID
export async function removeHighlight(url: string, highlightId: string): Promise<void> {
  const highlights = await loadHighlights(url);
  const filtered = highlights.filter(h => h.id !== highlightId);
  await saveHighlights(url, filtered);
}

// Get all highlights across all pages
export async function getAllHighlights(): Promise<PageHighlights[]> {
  const result = await chrome.storage.local.get(null);
  const pages: PageHighlights[] = [];
  
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith(STORAGE_PREFIX)) {
      pages.push(value as PageHighlights);
    }
  }
  
  return pages;
}

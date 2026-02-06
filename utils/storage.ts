import type { HighlightPosition, PageHighlights } from './types';

// Generate a unique ID
export function generateId(): string {
  return `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Common tracking/marketing parameters to remove
const TRACKING_PARAMS = new Set([
  // Google Analytics
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  '_ga', '_gid', '_gac', 'gclid', 'gclsrc',
  // Facebook
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
  // Microsoft/Bing
  'msclkid', 'mc_cid', 'mc_eid',
  // Mailchimp
  'mc_cid', 'mc_eid',
  // Twitter
  'twclid', 'tw_source', 'tw_medium', 'tw_campaign',
  // LinkedIn
  'li_fat_id', 'lipi',
  // Pinterest
  'epik',
  // TikTok
  'ttclid',
  // Reddit
  'rdt_cid',
  // HubSpot
  'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
  // General tracking
  'ref', 'referrer', 'source', 'campaign', 'medium', 'content', 'term',
  // Session/tracking IDs
  'sessionid', 'session_id', '_hsenc', '_hsmi',
  // Adobe/Marketo
  'mkt_tok',
  // Other common ones
  'igshid', 'yclid', 'gbraid', 'wbraid',
]);

// Normalize URL for storage key
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Get search params and filter out tracking parameters
    const searchParams = new URLSearchParams(parsed.search);
    const cleanedParams = new URLSearchParams();
    
    // Keep only non-tracking parameters and sort them alphabetically
    const sortedKeys = Array.from(searchParams.keys())
      .filter(key => !TRACKING_PARAMS.has(key.toLowerCase()))
      .sort();
    
    sortedKeys.forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        cleanedParams.append(key, value);
      }
    });
    
    // Reconstruct URL without hash, trailing slash, and with cleaned params
    const queryString = cleanedParams.toString();
    const pathname = parsed.pathname.replace(/\/$/, '');
    
    return `${parsed.origin}${pathname}${queryString ? '?' + queryString : ''}`;
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

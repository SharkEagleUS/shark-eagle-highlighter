import { authService } from './auth';
import { syncService, type LocalHighlight } from './sync';

export interface HighlightPosition {
  text: string;
  xpath: string;
  startOffset: number;
  endOffset: number;
  beforeContext: string;
  afterContext: string;
  id: string;
  createdAt: number;
  comment?: string;
  tags?: string[];
  color?: 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple';
}

export interface PageHighlights {
  url: string;
  highlights: HighlightPosition[];
}

const STORAGE_PREFIX = 'highlights_';

/**
 * Unified storage service that handles both local and cloud storage
 */
export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Normalize URL for consistent storage keys
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    } catch {
      return url;
    }
  }

  /**
   * Get storage key for URL
   */
  private getStorageKey(url: string): string {
    return STORAGE_PREFIX + this.normalizeUrl(url);
  }

  /**
   * Get highlights for a specific URL
   * Merges local and cloud data when authenticated
   */
  async getHighlightsForUrl(url: string): Promise<HighlightPosition[]> {
    const normalizedUrl = this.normalizeUrl(url);
    const key = this.getStorageKey(url);
    
    // Get local highlights
    const result = await chrome.storage.local.get(key);
    const localData = result[key] as PageHighlights | undefined;
    const localHighlights = localData?.highlights || [];

    // If authenticated, merge with cloud highlights
    const isAuth = await authService.isAuthenticated();
    if (isAuth) {
      try {
        const { highlights: cloudHighlights, error } = await syncService.pullHighlightsForUrl(normalizedUrl);
        
        if (!error && cloudHighlights.length > 0) {
          // Merge local and cloud highlights, preferring cloud version for duplicates
          const mergedMap = new Map<string, HighlightPosition>();
          
          // Add local highlights first
          localHighlights.forEach(h => mergedMap.set(h.id, h));
          
          // Override with cloud highlights (cloud is source of truth)
          cloudHighlights.forEach(h => mergedMap.set(h.id, h as HighlightPosition));
          
          const merged = Array.from(mergedMap.values());
          
          // Update local storage with merged data
          await chrome.storage.local.set({
            [key]: { url: normalizedUrl, highlights: merged }
          });
          
          return merged;
        }
      } catch (error) {
        console.error('Failed to merge cloud highlights:', error);
        // Fall back to local highlights on error
      }
    }

    return localHighlights;
  }

  /**
   * Save a highlight
   * Saves to local storage and syncs to cloud if authenticated
   */
  async saveHighlight(url: string, highlight: HighlightPosition): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const key = this.getStorageKey(url);
      
      // Get existing highlights
      const highlights = await this.getHighlightsForUrl(url);
      
      // Add new highlight
      highlights.push(highlight);
      
      // Save to local storage
      await chrome.storage.local.set({
        [key]: { url: normalizedUrl, highlights }
      });

      // Sync to cloud if authenticated
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        try {
          await syncService.pushHighlight(normalizedUrl, highlight as LocalHighlight);
        } catch (error) {
          console.error('Failed to sync highlight to cloud:', error);
          // Don't fail the save operation if cloud sync fails
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to save highlight:', error);
      return false;
    }
  }

  /**
   * Update a highlight's comment and tags
   * Updates in local storage and syncs to cloud if authenticated
   */
  async updateHighlight(url: string, highlightId: string, updates: { comment?: string; tags?: string[] }): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const key = this.getStorageKey(url);
      
      // Get existing highlights
      const highlights = await this.getHighlightsForUrl(url);
      
      // Find and update the highlight
      const highlightIndex = highlights.findIndex(h => h.id === highlightId);
      if (highlightIndex === -1) {
        console.error('Highlight not found:', highlightId);
        return false;
      }
      
      // Update the highlight
      highlights[highlightIndex] = {
        ...highlights[highlightIndex],
        comment: updates.comment,
        tags: updates.tags
      };
      
      // Save to local storage
      await chrome.storage.local.set({
        [key]: { url: normalizedUrl, highlights }
      });

      // Sync to cloud if authenticated
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        try {
          await syncService.updateHighlight(normalizedUrl, highlights[highlightIndex] as LocalHighlight);
        } catch (error) {
          console.error('Failed to sync highlight update to cloud:', error);
          // Don't fail the update operation if cloud sync fails
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update highlight:', error);
      return false;
    }
  }

  /**
   * Remove a highlight
   * Removes from local storage and cloud if authenticated
   */
  async removeHighlight(url: string, highlightId: string): Promise<boolean> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const key = this.getStorageKey(url);
      
      // Get existing highlights
      const highlights = await this.getHighlightsForUrl(url);
      
      // Filter out the highlight to remove
      const filtered = highlights.filter(h => h.id !== highlightId);
      
      // Save to local storage
      await chrome.storage.local.set({
        [key]: { url: normalizedUrl, highlights: filtered }
      });

      // Delete from cloud if authenticated
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        try {
          await syncService.deleteHighlight(highlightId);
        } catch (error) {
          console.error('Failed to delete highlight from cloud:', error);
          // Don't fail the remove operation if cloud delete fails
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to remove highlight:', error);
      return false;
    }
  }

  /**
   * Get all highlights across all pages
   */
  async getAllHighlights(): Promise<PageHighlights[]> {
    const result = await chrome.storage.local.get(null);
    const pages: PageHighlights[] = [];
    
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(STORAGE_PREFIX)) {
        pages.push(value as PageHighlights);
      }
    }
    
    return pages;
  }

  /**
   * Perform full sync with cloud
   * Pushes all local highlights to cloud and pulls all cloud highlights
   */
  async performFullSync(): Promise<{ success: boolean; error: string | null }> {
    const isAuth = await authService.isAuthenticated();
    if (!isAuth) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Push all local highlights to cloud
      const result = await syncService.performFullSync();
      
      if (!result.success) {
        return result;
      }

      // Pull all cloud highlights and merge with local
      const { highlights: cloudHighlightsByUrl, error } = await syncService.pullAllHighlights();
      
      if (error) {
        return { success: false, error };
      }

      // Update local storage with cloud data
      for (const [url, cloudHighlights] of cloudHighlightsByUrl.entries()) {
        const key = this.getStorageKey(url);
        const localResult = await chrome.storage.local.get(key);
        const localData = localResult[key] as PageHighlights | undefined;
        const localHighlights = localData?.highlights || [];

        // Merge local and cloud, preferring cloud for duplicates
        const mergedMap = new Map<string, HighlightPosition>();
        localHighlights.forEach(h => mergedMap.set(h.id, h));
        cloudHighlights.forEach(h => mergedMap.set(h.id, h as HighlightPosition));

        const merged = Array.from(mergedMap.values());
        await chrome.storage.local.set({
          [key]: { url, highlights: merged }
        });
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Clear all local highlights (does not affect cloud)
   */
  async clearLocalHighlights(): Promise<void> {
    const result = await chrome.storage.local.get(null);
    const keysToRemove: string[] = [];
    
    for (const key of Object.keys(result)) {
      if (key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  }

  /**
   * Import highlights from cloud (overwrites local)
   */
  async importFromCloud(): Promise<{ success: boolean; error: string | null }> {
    const isAuth = await authService.isAuthenticated();
    if (!isAuth) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Clear local highlights first
      await this.clearLocalHighlights();

      // Pull all cloud highlights
      const { highlights: cloudHighlightsByUrl, error } = await syncService.pullAllHighlights();
      
      if (error) {
        return { success: false, error };
      }

      // Save cloud highlights to local storage
      for (const [url, cloudHighlights] of cloudHighlightsByUrl.entries()) {
        const key = this.getStorageKey(url);
        await chrome.storage.local.set({
          [key]: { url, highlights: cloudHighlights as HighlightPosition[] }
        });
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();

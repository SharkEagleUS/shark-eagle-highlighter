import { getSupabaseClient } from '../client/supabase';
import { authService } from './auth';
import type { Database } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

type HighlightRow = Database['public']['Tables']['highlights']['Row'];
type HighlightInsert = Database['public']['Tables']['highlights']['Insert'];
type HighlightUpdate = Database['public']['Tables']['highlights']['Update'];

export interface LocalHighlight {
  id: string;
  text: string;
  xpath: string;
  startOffset: number;
  endOffset: number;
  beforeContext: string;
  afterContext: string;
  createdAt: number;
  comment?: string;
  tags?: string[];
  color?: 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple';
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  error: string | null;
}

/**
 * Sync service for managing cloud synchronization of highlights
 */
export class SyncService {
  private static instance: SyncService;
  private syncChannel: RealtimeChannel | null = null;
  private syncStatusListeners: ((status: SyncStatus) => void)[] = [];
  private deviceId: string = '';

  private constructor() {
    this.initDeviceId();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Initialize device ID for tracking sync metadata
   */
  private async initDeviceId() {
    const result = await chrome.storage.local.get('deviceId');
    if (result.deviceId) {
      this.deviceId = result.deviceId;
    } else {
      this.deviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId: this.deviceId });
    }
  }

  /**
   * Subscribe to sync status changes
   */
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(
        listener => listener !== callback
      );
    };
  }

  /**
   * Notify sync status listeners
   */
  private notifySyncStatus(status: SyncStatus) {
    this.syncStatusListeners.forEach(listener => listener(status));
    chrome.storage.local.set({ syncStatus: status });
  }

  /**
   * Convert local highlight to Supabase format
   */
  private localToSupabase(url: string, highlight: LocalHighlight, userId: string): HighlightInsert {
    return {
      id: highlight.id,
      user_id: userId,
      url: url,
      text: highlight.text,
      xpath: highlight.xpath,
      start_offset: highlight.startOffset,
      end_offset: highlight.endOffset,
      before_context: highlight.beforeContext,
      after_context: highlight.afterContext,
      comment: highlight.comment || null,
      tags: highlight.tags || null,
      color: highlight.color || 'yellow',
      created_at: new Date(highlight.createdAt).toISOString(),
    };
  }

  /**
   * Convert Supabase highlight to local format
   */
  private supabaseToLocal(highlight: HighlightRow): LocalHighlight {
    return {
      id: highlight.id,
      text: highlight.text,
      xpath: highlight.xpath,
      startOffset: highlight.start_offset,
      endOffset: highlight.end_offset,
      beforeContext: highlight.before_context,
      afterContext: highlight.after_context,
      createdAt: new Date(highlight.created_at).getTime(),
      comment: highlight.comment || undefined,
      tags: highlight.tags || undefined,
      color: highlight.color || 'yellow',
    };
  }

  /**
   * Push a single highlight to Supabase
   */
  async pushHighlight(url: string, highlight: LocalHighlight): Promise<{ success: boolean; error: string | null }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const supabase = getSupabaseClient();
      const supabaseHighlight = this.localToSupabase(url, highlight, user.id);

      const { error } = await supabase
        .from('highlights')
        .upsert(supabaseHighlight, { onConflict: 'id' });

      if (error) {
        console.error('Failed to push highlight:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Failed to push highlight:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Update a highlight in Supabase
   */
  async updateHighlight(url: string, highlight: LocalHighlight): Promise<{ success: boolean; error: string | null }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const supabase = getSupabaseClient();
      const supabaseHighlight = this.localToSupabase(url, highlight, user.id);

      // Use upsert to update the highlight
      const { error } = await supabase
        .from('highlights')
        .upsert(supabaseHighlight, { onConflict: 'id' });

      if (error) {
        console.error('Failed to update highlight:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Failed to update highlight:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Pull highlights for a specific URL from Supabase
   */
  async pullHighlightsForUrl(url: string): Promise<{ highlights: LocalHighlight[]; error: string | null }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { highlights: [], error: 'User not authenticated' };
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('url', url);

      if (error) {
        console.error('Failed to pull highlights:', error);
        return { highlights: [], error: error.message };
      }

      const highlights = (data || []).map(h => this.supabaseToLocal(h));
      return { highlights, error: null };
    } catch (error) {
      console.error('Failed to pull highlights:', error);
      return { highlights: [], error: String(error) };
    }
  }

  /**
   * Pull all highlights from Supabase
   */
  async pullAllHighlights(): Promise<{ highlights: Map<string, LocalHighlight[]>; error: string | null }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { highlights: new Map(), error: 'User not authenticated' };
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to pull all highlights:', error);
        return { highlights: new Map(), error: error.message };
      }

      // Group highlights by URL
      const highlightsByUrl = new Map<string, LocalHighlight[]>();
      (data || []).forEach(h => {
        const local = this.supabaseToLocal(h);
        const existing = highlightsByUrl.get(h.url) || [];
        existing.push(local);
        highlightsByUrl.set(h.url, existing);
      });

      return { highlights: highlightsByUrl, error: null };
    } catch (error) {
      console.error('Failed to pull all highlights:', error);
      return { highlights: new Map(), error: String(error) };
    }
  }

  /**
   * Delete a highlight from Supabase
   */
  async deleteHighlight(highlightId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const user = await authService.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to delete highlight:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Perform full sync: push local changes and pull remote changes
   */
  async performFullSync(): Promise<{ success: boolean; error: string | null }> {
    try {
      this.notifySyncStatus({ isSyncing: true, lastSyncAt: null, error: null });

      const user = await authService.getUser();
      if (!user) {
        const error = 'User not authenticated';
        this.notifySyncStatus({ isSyncing: false, lastSyncAt: null, error });
        return { success: false, error };
      }

      // Get all local highlights
      const localResult = await chrome.storage.local.get(null);
      const localHighlights: { url: string; highlights: LocalHighlight[] }[] = [];
      
      for (const [key, value] of Object.entries(localResult)) {
        if (key.startsWith('highlights_')) {
          const pageData = value as { url: string; highlights: LocalHighlight[] };
          localHighlights.push(pageData);
        }
      }

      // Push all local highlights to Supabase
      for (const page of localHighlights) {
        for (const highlight of page.highlights) {
          await this.pushHighlight(page.url, highlight);
        }
      }

      // Update sync metadata
      const supabase = getSupabaseClient();
      await supabase
        .from('sync_metadata')
        .upsert({
          user_id: user.id,
          device_id: this.deviceId,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: 'user_id,device_id' });

      const now = new Date();
      this.notifySyncStatus({ isSyncing: false, lastSyncAt: now, error: null });

      return { success: true, error: null };
    } catch (error) {
      const errorMsg = String(error);
      this.notifySyncStatus({ isSyncing: false, lastSyncAt: null, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Enable real-time sync for highlights
   */
  async enableRealtimeSync(): Promise<void> {
    const user = await authService.getUser();
    if (!user) {
      console.warn('Cannot enable realtime sync: user not authenticated');
      return;
    }

    if (this.syncChannel) {
      console.warn('Realtime sync already enabled');
      return;
    }

    const supabase = getSupabaseClient();
    
    this.syncChannel = supabase
      .channel('highlights-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'highlights',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime change detected:', payload);
          // Notify listeners about the change
          chrome.runtime.sendMessage({
            action: 'highlightChanged',
            payload: payload,
          });
        }
      )
      .subscribe();
  }

  /**
   * Disable real-time sync
   */
  async disableRealtimeSync(): Promise<void> {
    if (this.syncChannel) {
      await this.syncChannel.unsubscribe();
      this.syncChannel = null;
    }
  }

  /**
   * Get sync status from storage
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const result = await chrome.storage.local.get('syncStatus');
    return result.syncStatus || { isSyncing: false, lastSyncAt: null, error: null };
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();

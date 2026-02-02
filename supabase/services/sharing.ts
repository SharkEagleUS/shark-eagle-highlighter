import { getSupabaseClient } from '../client/supabase';
import { HighlightPosition } from '../../utils/storage';

const supabase = getSupabaseClient();

export interface SharedHighlight {
  id: string;
  highlight_id: string;
  owner_id: string;
  shared_with_email: string;
  share_token: string;
  expires_at: string | null;
  created_at: string;
}

export interface ShareOptions {
  expiresInDays?: number; // Optional expiration (null = never expires)
}

class SharingService {
  /**
   * Share a highlight with someone via email
   */
  async shareHighlight(
    highlightId: string,
    recipientEmail: string,
    options: ShareOptions = {}
  ): Promise<{ success: boolean; shareToken?: string; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Generate share token
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_share_token');
      if (tokenError || !tokenData) {
        return { success: false, error: 'Failed to generate share token' };
      }

      const shareToken = tokenData as string;

      // Calculate expiration date if specified
      let expiresAt: string | null = null;
      if (options.expiresInDays) {
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + options.expiresInDays);
        expiresAt = expireDate.toISOString();
      }

      // Insert share record
      const { error: insertError } = await supabase
        .from('shared_highlights')
        .insert({
          highlight_id: highlightId,
          owner_id: user.id,
          shared_with_email: recipientEmail.toLowerCase(),
          share_token: shareToken,
          expires_at: expiresAt
        });

      if (insertError) {
        // Check if already shared
        if (insertError.code === '23505') { // Unique violation
          return { success: false, error: 'Already shared with this email' };
        }
        return { success: false, error: insertError.message };
      }

      return { success: true, shareToken };
    } catch (error) {
      console.error('Error sharing highlight:', error);
      return { success: false, error: 'Failed to share highlight' };
    }
  }

  /**
   * Get all shares for a specific highlight
   */
  async getSharesForHighlight(highlightId: string): Promise<SharedHighlight[]> {
    try {
      const { data, error } = await supabase
        .from('shared_highlights')
        .select('*')
        .eq('highlight_id', highlightId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shares:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching shares:', error);
      return [];
    }
  }

  /**
   * Revoke a share (delete it)
   */
  async revokeShare(shareId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('shared_highlights')
        .delete()
        .eq('id', shareId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error revoking share:', error);
      return { success: false, error: 'Failed to revoke share' };
    }
  }

  /**
   * Get highlight by share token (public access)
   */
  async getHighlightByToken(shareToken: string): Promise<HighlightPosition | null> {
    try {
      // First get the share record
      const { data: shareData, error: shareError } = await supabase
        .from('shared_highlights')
        .select('highlight_id, expires_at')
        .eq('share_token', shareToken)
        .single();

      if (shareError || !shareData) {
        return null;
      }

      // Check if expired
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return null;
      }

      // Get the highlight
      const { data: highlight, error: highlightError } = await supabase
        .from('highlights')
        .select('*')
        .eq('id', shareData.highlight_id)
        .single();

      if (highlightError || !highlight) {
        return null;
      }

      // Convert to HighlightPosition format
      return {
        id: highlight.id,
        text: highlight.text,
        xpath: highlight.xpath,
        startOffset: highlight.start_offset,
        endOffset: highlight.end_offset,
        beforeContext: highlight.before_context,
        afterContext: highlight.after_context,
        comment: highlight.comment,
        tags: highlight.tags || [],
        color: highlight.color || 'yellow',
        createdAt: new Date(highlight.created_at).getTime()
      };
    } catch (error) {
      console.error('Error getting highlight by token:', error);
      return null;
    }
  }

  /**
   * Send email notification (placeholder - needs backend email service)
   * For now, this generates a shareable link
   */
  async generateShareLink(shareToken: string): Promise<string> {
    // In production, this would be your extension's share page URL
    // For now, we'll use a data URL that can be copied
    const baseUrl = 'chrome-extension://YOUR_EXTENSION_ID/share.html';
    return `${baseUrl}?token=${shareToken}`;
  }

  /**
   * Copy share link to clipboard
   */
  async copyShareLinkToClipboard(shareToken: string): Promise<boolean> {
    try {
      const shareLink = await this.generateShareLink(shareToken);
      await navigator.clipboard.writeText(shareLink);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }

  /**
   * Clean up expired shares
   */
  async cleanupExpiredShares(): Promise<void> {
    try {
      await supabase.rpc('cleanup_expired_shares');
    } catch (error) {
      console.error('Error cleaning up expired shares:', error);
    }
  }
}

export const sharingService = new SharingService();

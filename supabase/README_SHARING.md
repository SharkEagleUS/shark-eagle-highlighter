# Highlight Sharing Feature

## Overview

The sharing feature allows authenticated users to share their highlights with others via email. When you share a highlight, recipients receive a secure link that allows them to view the highlight without needing an account.

## Features

- **Email-based Sharing**: Share highlights with anyone by entering their email address
- **Secure Tokens**: Each share uses a unique, cryptographically secure token
- **Optional Expiration**: Set shares to expire after 7, 30, or 90 days, or never
- **Shareable Links**: Copy share links to clipboard for easy distribution
- **Access Control**: Only highlight owners can create or revoke shares
- **RLS Protection**: Database-level security ensures users can only share their own highlights

## How to Use

### Sharing a Highlight

1. **Sign in** to your account (required for sharing)
2. Navigate to the **Current Page** or **All Highlights** tab in the side panel
3. Find the highlight you want to share
4. Click the **📧 Share** button next to the highlight
5. Enter the recipient's **email address**
6. Choose an **expiration period** (or "Never expires")
7. Click **Share**
8. A share link will be generated - you can copy it to clipboard

### Viewing Shared Highlights

Recipients can view shared highlights by:
1. Clicking the share link you send them
2. The highlight will be displayed in their browser
3. No account required to view (public access via token)

### Revoking Shares

To revoke access to a shared highlight:
```typescript
import { sharingService } from './supabase/services/sharing';

// Get shares for a highlight
const shares = await sharingService.getSharesForHighlight(highlightId);

// Revoke a specific share
await sharingService.revokeShare(shareId);
```

## Database Schema

### `shared_highlights` Table

```sql
CREATE TABLE shared_highlights (
  id UUID PRIMARY KEY,
  highlight_id UUID REFERENCES highlights(id),
  owner_id UUID REFERENCES auth.users(id),
  shared_with_email TEXT,
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

## Security

### Row Level Security (RLS)

The sharing feature implements strict RLS policies:

1. **Owner View**: Owners can view all shares they've created
2. **Owner Create**: Only owners can create shares for their highlights
3. **Owner Delete**: Only owners can revoke shares
4. **Public Token Access**: Anyone with a valid, non-expired token can view the shared highlight

### Token Generation

- Tokens are generated using `gen_random_bytes(32)`
- Base64 encoded for URL safety
- 256-bit entropy ensures unpredictability
- Each token is unique (database constraint)

### Expiration

- Shares can be configured to expire after a set number of days
- Expired shares are automatically rejected
- Run `cleanup_expired_shares()` periodically to delete expired records

## API Reference

### `SharingService` Methods

#### `shareHighlight(highlightId, recipientEmail, options)`

Share a highlight with someone.

```typescript
const result = await sharingService.shareHighlight(
  'highlight-uuid',
  'friend@example.com',
  { expiresInDays: 7 }
);

if (result.success) {
  console.log('Share token:', result.shareToken);
}
```

**Parameters:**
- `highlightId` (string): UUID of the highlight to share
- `recipientEmail` (string): Email address of the recipient
- `options.expiresInDays` (number | undefined): Days until expiration (optional)

**Returns:**
- `{ success: boolean, shareToken?: string, error?: string }`

#### `getSharesForHighlight(highlightId)`

Get all shares for a specific highlight.

```typescript
const shares = await sharingService.getSharesForHighlight('highlight-uuid');
```

**Returns:** `SharedHighlight[]`

#### `revokeShare(shareId)`

Revoke a share (delete it).

```typescript
const result = await sharingService.revokeShare('share-uuid');
```

**Returns:** `{ success: boolean, error?: string }`

#### `getHighlightByToken(shareToken)`

Get a highlight using its share token (public access).

```typescript
const highlight = await sharingService.getHighlightByToken('token-string');
```

**Returns:** `HighlightPosition | null`

#### `generateShareLink(shareToken)`

Generate a shareable link for a token.

```typescript
const link = await sharingService.generateShareLink('token-string');
// Returns: chrome-extension://YOUR_EXTENSION_ID/share.html?token=...
```

#### `copyShareLinkToClipboard(shareToken)`

Copy a share link to the clipboard.

```typescript
const copied = await sharingService.copyShareLinkToClipboard('token-string');
```

**Returns:** `boolean`

#### `cleanupExpiredShares()`

Clean up expired shares from the database.

```typescript
await sharingService.cleanupExpiredShares();
```

## Migration

To enable sharing in your Supabase instance, run:

```bash
# Apply the sharing migration
psql -h your-project.supabase.co -U postgres -d postgres -f supabase/migrations/004_add_sharing.sql
```

This creates:
- `shared_highlights` table
- RLS policies
- Helper functions (`generate_share_token`, `cleanup_expired_shares`)
- Necessary indexes

## Limitations

- Users must be authenticated to share highlights
- Recipients don't need an account to view (public token access)
- Share links are permanent until expired or revoked
- Email notifications require separate backend implementation (not included)

## Future Enhancements

Potential improvements:
- Email notifications when highlights are shared
- Bulk sharing (share multiple highlights at once)
- Share collections or pages
- Analytics on share views
- Commenting on shared highlights
- Share with specific users (account-based, not email-based)

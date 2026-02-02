-- Migration to add sharing functionality
-- Allows users to share highlights via email

-- Create shared_highlights table
CREATE TABLE IF NOT EXISTS shared_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(highlight_id, shared_with_email)
);

-- Create indexes for shared_highlights
CREATE INDEX IF NOT EXISTS idx_shared_highlights_highlight_id ON shared_highlights(highlight_id);
CREATE INDEX IF NOT EXISTS idx_shared_highlights_owner_id ON shared_highlights(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_highlights_email ON shared_highlights(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_shared_highlights_token ON shared_highlights(share_token);

-- Enable Row Level Security
ALTER TABLE shared_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_highlights table
-- Owners can view their shared highlights
CREATE POLICY "Owners can view their shared highlights"
  ON shared_highlights FOR SELECT
  USING (auth.uid() = owner_id);

-- Owners can create shares
CREATE POLICY "Owners can create shares"
  ON shared_highlights FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owners can delete shares
CREATE POLICY "Owners can delete shares"
  ON shared_highlights FOR DELETE
  USING (auth.uid() = owner_id);

-- Public view for shared highlights by token (no auth required)
CREATE POLICY "Anyone can view highlights with valid token"
  ON highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_highlights
      WHERE shared_highlights.highlight_id = highlights.id
      AND (shared_highlights.expires_at IS NULL OR shared_highlights.expires_at > NOW())
    )
    OR auth.uid() = user_id
  );

-- Function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired shares
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
  DELETE FROM shared_highlights
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

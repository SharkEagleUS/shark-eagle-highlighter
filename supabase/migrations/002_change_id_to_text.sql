-- Migration to change highlights.id from UUID to TEXT
-- This allows the extension to use custom string IDs like "hl_1769941018441_im7exo70w"

-- Drop the existing id column and recreate it as TEXT
-- Note: This will delete existing data in the highlights table
ALTER TABLE highlights DROP COLUMN id;
ALTER TABLE highlights ADD COLUMN id TEXT PRIMARY KEY;

-- Recreate the index on id (implicit via PRIMARY KEY, but ensuring it exists)
-- The other indexes remain unchanged

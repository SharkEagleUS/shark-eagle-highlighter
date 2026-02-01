-- Migration to change highlights.id from TEXT to UUID
-- This reverts the previous migration and uses proper UUID type

-- First, we need to convert existing TEXT IDs to UUIDs
-- Since existing IDs are in custom format (hl_timestamp_random), we'll generate new UUIDs for them
-- Note: This will break references to old highlights, but ensures data integrity

-- Drop the existing primary key constraint
ALTER TABLE highlights DROP CONSTRAINT highlights_pkey;

-- Change the column type to UUID, generating new UUIDs for existing rows
ALTER TABLE highlights 
  ALTER COLUMN id TYPE UUID 
  USING gen_random_uuid();

-- Re-add the primary key constraint
ALTER TABLE highlights ADD PRIMARY KEY (id);

-- Update the default value for new inserts
ALTER TABLE highlights 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

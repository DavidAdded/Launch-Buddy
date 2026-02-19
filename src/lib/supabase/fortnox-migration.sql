-- Fortnox OAuth tokens storage
-- Run this in the Supabase SQL Editor

-- Create fortnox_tokens table
CREATE TABLE IF NOT EXISTS fortnox_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE fortnox_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own tokens
CREATE POLICY "Users can read own fortnox tokens"
  ON fortnox_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fortnox tokens"
  ON fortnox_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fortnox tokens"
  ON fortnox_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fortnox tokens"
  ON fortnox_tokens FOR DELETE
  USING (auth.uid() = user_id);

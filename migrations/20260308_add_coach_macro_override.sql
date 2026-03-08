-- Add coach_macro_override column to clients table
-- This column tracks when a coach manually overrides nutrition targets,
-- preventing auto-apply from overwriting the coach's decisions.
-- Run this in Supabase SQL Editor if the column doesn't exist.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_macro_override JSONB DEFAULT NULL;

-- Format: { "locked_at": "ISO date", "locked_fields": ["calories_target","protein_target",...], "previous_values": {...} }
-- NULL = unlocked (system can auto-adjust)

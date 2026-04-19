-- Add newsletter opt-in column to clients table
-- Default false = opt-in only, PDPA compliant
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;

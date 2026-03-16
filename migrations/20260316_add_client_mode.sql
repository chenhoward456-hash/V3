-- Migration: Add client_mode column to replace dual-boolean system
-- (competition_enabled / health_mode_enabled)
--
-- client_mode: 'standard' | 'health' | 'bodybuilding' | 'athletic'
-- Old boolean columns are NOT dropped — sync trigger maintains backward compatibility.

-- 1. Add client_mode column
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_mode TEXT DEFAULT 'standard';

-- 2. Data migration: map existing booleans to client_mode
UPDATE clients SET client_mode = 'bodybuilding' WHERE competition_enabled = true;
UPDATE clients SET client_mode = 'health' WHERE health_mode_enabled = true;
-- Clients with neither boolean remain 'standard' (the default)

-- 3. Add CHECK constraint for valid values
ALTER TABLE clients ADD CONSTRAINT chk_client_mode
  CHECK (client_mode IN ('standard', 'health', 'bodybuilding', 'athletic'));

-- 4. Drop the old mutual-exclusion constraint (if it exists)
-- The old constraint prevented both booleans from being true simultaneously.
-- client_mode inherently solves this, so we no longer need it.
DO $$
BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_mode_exclusive;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 5. Sync trigger: when client_mode is updated, sync old boolean columns
--    This ensures backward compatibility during the transition period.
CREATE OR REPLACE FUNCTION sync_client_mode_booleans()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if client_mode actually changed
  IF NEW.client_mode IS DISTINCT FROM OLD.client_mode THEN
    NEW.competition_enabled := (NEW.client_mode IN ('bodybuilding', 'athletic'));
    NEW.health_mode_enabled := (NEW.client_mode = 'health');
  END IF;

  -- Reverse sync: if old booleans are updated directly, sync client_mode
  -- This handles legacy code that still writes to the old columns
  IF NEW.competition_enabled IS DISTINCT FROM OLD.competition_enabled
     AND NEW.client_mode IS NOT DISTINCT FROM OLD.client_mode THEN
    IF NEW.competition_enabled = true THEN
      NEW.client_mode := 'bodybuilding';
      NEW.health_mode_enabled := false;
    ELSIF NEW.health_mode_enabled = false THEN
      NEW.client_mode := 'standard';
    END IF;
  END IF;

  IF NEW.health_mode_enabled IS DISTINCT FROM OLD.health_mode_enabled
     AND NEW.client_mode IS NOT DISTINCT FROM OLD.client_mode THEN
    IF NEW.health_mode_enabled = true THEN
      NEW.client_mode := 'health';
      NEW.competition_enabled := false;
    ELSIF NEW.competition_enabled = false THEN
      NEW.client_mode := 'standard';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_client_mode ON clients;
CREATE TRIGGER trg_sync_client_mode
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_mode_booleans();

-- 6. Index for common queries filtering by client_mode
CREATE INDEX IF NOT EXISTS idx_clients_client_mode ON clients (client_mode);

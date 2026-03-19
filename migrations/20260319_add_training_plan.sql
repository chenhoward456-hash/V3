-- Add training_plan JSONB column to clients table
-- Stores weekly training plan assigned by coach
-- Schema: { name: string, days: [{ dayOfWeek: 1-7, label: string, exercises: [...] }] }
ALTER TABLE clients ADD COLUMN IF NOT EXISTS training_plan JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN clients.training_plan IS 'Weekly training plan JSON: { name, days: [{ dayOfWeek (1=Mon..7=Sun), label, exercises: [{ name, sets, reps, rpe, note }] }] }';

-- Add 'upper_body' to training_logs training_type CHECK constraint
-- This value was already in the UI and API but missing from the DB constraint

ALTER TABLE training_logs DROP CONSTRAINT IF EXISTS training_logs_training_type_check;

ALTER TABLE training_logs ADD CONSTRAINT training_logs_training_type_check
  CHECK (training_type IN ('push', 'pull', 'legs', 'full_body', 'upper_body', 'cardio', 'rest', 'chest', 'shoulder', 'arms'));

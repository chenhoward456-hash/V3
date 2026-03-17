-- Athletic Phase Refactor: merge training_camp + weight_cut -> preparation
-- Add weigh_in_gap_hours for rebound calculation
--
-- References:
--   Reale et al. 2017 - "Fighting Weight" (chronic + acute weight loss protocols)
--   Garthe et al. 2011 - Slow vs fast weight loss in athletes
--   Thomas et al. 2016 - ACSM nutrition for athletes
--   Artioli et al. 2016 - Rapid weight loss in combat sports

-- 1. Merge old phases into 'preparation'
UPDATE clients
SET prep_phase = 'preparation'
WHERE prep_phase IN ('training_camp', 'weight_cut');

-- 2. Add weigh_in_gap_hours column (hours between weigh-in and competition)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS weigh_in_gap_hours INTEGER;

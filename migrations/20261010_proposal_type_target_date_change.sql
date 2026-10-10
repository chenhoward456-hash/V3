-- 目標日到不了 → 起草改目標日（lib/goal-feasibility-cron.ts），套用＝只改 clients.target_date
ALTER TABLE pending_proposals DROP CONSTRAINT IF EXISTS pending_proposals_proposal_type_check;
ALTER TABLE pending_proposals ADD CONSTRAINT pending_proposals_proposal_type_check
  CHECK (proposal_type = ANY (ARRAY['macro_adjustment','cardio_change','personal_note','retest_request','body_profile_entry','coach_summary_draft','target_date_change']));

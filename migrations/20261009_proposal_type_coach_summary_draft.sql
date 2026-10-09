-- 抽血後自動起草教練補充（lib/coach-summary-draft.ts），套用＝覆寫 clients.coach_summary／health_goals
ALTER TABLE pending_proposals DROP CONSTRAINT IF EXISTS pending_proposals_proposal_type_check;
ALTER TABLE pending_proposals ADD CONSTRAINT pending_proposals_proposal_type_check
  CHECK (proposal_type = ANY (ARRAY['macro_adjustment','cardio_change','personal_note','retest_request','body_profile_entry','coach_summary_draft']));

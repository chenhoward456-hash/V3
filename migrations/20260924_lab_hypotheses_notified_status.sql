-- 預測對答案的通知去重：上次通知時的判決；跟現在重算的判決不同才再通知（每天早上 cron）
alter table public.lab_hypotheses add column if not exists notified_status text;

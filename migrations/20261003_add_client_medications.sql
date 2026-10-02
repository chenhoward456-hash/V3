-- 目前用藥（2026-10-03）。起因：Howard 在吃口服 A 酸（isotretinoin），會拉高 CK、肝指數、血脂，
-- 但血檢判讀完全不知道 → 把藥物造成的偏高當成要處理的問題。
-- 格式：[{ "key": "isotretinoin", "name": "口服 A 酸", "since": "2026-08-01", "until": null }]
-- key 對 lib/medication-effects.ts 的已知藥物表；until 為 null＝還在吃。
alter table public.clients add column if not exists medications jsonb not null default '[]'::jsonb;

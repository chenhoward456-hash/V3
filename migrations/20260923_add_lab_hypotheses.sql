-- 血檢「預測 → 驗收」：每個真實變化記下推測原因、行動、預期、重測日；
-- 下次抽血由 lib/longevity-lens.ts 的 gradeHypothesis() 自動對答案（不存判決，每次重算）。
-- V3 初衷：不讓「紅字還是紅字」——每個紅字都是一個有驗收的小實驗。
create table if not exists public.lab_hypotheses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  marker text not null,                      -- lab_results.test_name（canonical 中文名）
  baseline_date date not null,               -- 以哪一次抽血當起點
  baseline_value numeric not null,
  cause text,                                -- 推測原因
  action text,                               -- 要做什麼
  expected_direction text not null check (expected_direction in ('up', 'down', 'stable')),
  expected_value numeric,                    -- 目標值（可空）；up → ≥、down → ≤
  retest_by date,                            -- 預計重測日
  note text,                                 -- 教練補充（例如：必須同一家實驗室）
  created_at timestamptz not null default now()
);

create index if not exists lab_hypotheses_client_marker_idx on public.lab_hypotheses (client_id, marker);

-- 全站走 service_role；開 RLS 不給 policy＝anon/authenticated 一律擋（同其他表的做法）
alter table public.lab_hypotheses enable row level security;

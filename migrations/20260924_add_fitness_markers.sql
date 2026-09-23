-- 身體能力指標（Attia：心肺與肌力本身就是預測壽命的指標，跟血檢並列）。
-- 不同量法的數字不能直接比（Garmin 估算 vs 實驗室氣體分析），所以 method 必填，趨勢只比同一種量法。
create table if not exists public.fitness_markers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('vo2max', 'grip')),
  date date not null,
  value numeric not null check (value > 0),
  method text not null,                -- 例：Garmin 估算／實驗室氣體分析／握力計（慣用手最佳）
  note text,
  created_at timestamptz not null default now()
);
create index if not exists fitness_markers_client_kind_idx on public.fitness_markers (client_id, kind, date);
alter table public.fitness_markers enable row level security;

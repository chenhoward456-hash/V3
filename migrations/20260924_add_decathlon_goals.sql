-- 百歲十項全能（Attia《Outlive》）：學員 90 歲想做到的事，對到一種能力，接上現在的指標。
-- 教練跟學員聊過之後在後台記；學員在「健康」分頁看得到。
create table if not exists public.decathlon_goals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  event text not null check (char_length(event) between 2 and 120),
  capacity text not null check (capacity in ('strength', 'cardio', 'mobility', 'balance')),
  created_at timestamptz not null default now()
);
create index if not exists decathlon_goals_client_idx on public.decathlon_goals (client_id);
alter table public.decathlon_goals enable row level security;

-- Mission journal: one row per start / win / fail / death / quit, for every player (guests too).
-- Shows which missions people abandon or fail most (bot: /missions, morning summary).
create table if not exists public.nf_missions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ver text, sid text, ep smallint, ch smallint, title text, mtype text,
  ev text, reason text, secs int, tries smallint, device text, mods text, stars smallint, tester boolean default false
);
alter table public.nf_missions enable row level security;
create policy nf_missions_ins on public.nf_missions for insert to anon, authenticated with check (
  ev in ('start','win','fail','death','quit') and coalesce(length(ver),0) < 20 and coalesce(length(sid),0) < 24 and coalesce(length(title),0) < 100
  and coalesce(length(mtype),0) < 24 and coalesce(length(reason),0) < 80 and coalesce(length(device),0) < 60 and coalesce(length(mods),0) < 80
);
grant insert on public.nf_missions to anon, authenticated;
grant usage, select on sequence public.nf_missions_id_seq to anon, authenticated;
create index if not exists nf_missions_created on public.nf_missions (created_at desc);
create index if not exists nf_missions_epch on public.nf_missions (ep, ch);

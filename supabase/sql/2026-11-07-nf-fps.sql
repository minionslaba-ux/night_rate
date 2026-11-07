-- FPS during real play (drive / on foot): the game sends one row per session after ~60 s of play.
-- Used to find devices where the game lags (bot /loads, daily check).
create table if not exists public.nf_fps (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ver text, device text, os text, browser text, gpu text,
  mem real, cores int, dpr real,
  fps real, fps_low real, pr real, level int, gfx text, secs int
);
alter table public.nf_fps enable row level security;
create policy nf_fps_ins on public.nf_fps for insert to anon, authenticated with check (
  coalesce(length(ver),0) < 20 and coalesce(length(device),0) < 60 and coalesce(length(os),0) < 60 and coalesce(length(browser),0) < 60 and coalesce(length(gpu),0) < 120 and coalesce(length(gfx),0) < 10
);
grant insert on public.nf_fps to anon, authenticated;
grant usage, select on sequence public.nf_fps_id_seq to anon, authenticated;
create index if not exists nf_fps_created on public.nf_fps (created_at desc);

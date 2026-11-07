-- Ad journal: every attempt to show the Yandex fullscreen ad and what came back (shown / error with its text / closed).
create table if not exists public.nf_ads (
  id bigserial primary key, created_at timestamptz not null default now(),
  ver text, net text, ev text, note text, device text, browser text
);
alter table public.nf_ads enable row level security;
create policy nf_ads_ins on public.nf_ads for insert to anon, authenticated with check (
  ev in ('try','shown','error','closed','skip') and coalesce(length(note),0) < 200 and coalesce(length(net),0) < 20 and coalesce(length(ver),0) < 20 and coalesce(length(device),0) < 60 and coalesce(length(browser),0) < 60);
grant insert on public.nf_ads to anon, authenticated;
grant usage, select on sequence public.nf_ads_id_seq to anon, authenticated;

-- Воронка входа гостей: показано предложение, нажата кнопка, вход удался/не удался, «Играть без входа».
create table if not exists public.nf_login (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ver text, sid text, ev text not null, method text, place text, note text, device text, browser text
);
alter table public.nf_login enable row level security;
create policy nf_login_ins on public.nf_login for insert to anon, authenticated with check (
  ev = any (array['offer','click','ok','fail','skip','close']) and coalesce(length(ver),0) < 20 and coalesce(length(sid),0) < 20
  and coalesce(length(method),0) < 20 and coalesce(length(place),0) < 30 and coalesce(length(note),0) < 200
  and coalesce(length(device),0) < 60 and coalesce(length(browser),0) < 60);
grant insert on public.nf_login to anon, authenticated;
create index if not exists nf_login_created on public.nf_login (created_at);
-- журнал запусков: постоянный id устройства и пометка «гость»
alter table public.nf_loads add column if not exists sid text, add column if not exists guest boolean;

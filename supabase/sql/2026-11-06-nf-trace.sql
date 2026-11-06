-- Журнал шагов входа через бота (Telegram/MAX) с телефонов: игра только пишет, читает сервер/владелец.
create table if not exists public.nf_trace (id bigserial primary key, created_at timestamptz not null default now(), sid text not null, ver text, ev text not null);
alter table public.nf_trace enable row level security;
create policy "nf_trace insert" on public.nf_trace for insert to anon, authenticated with check (length(ev) <= 300 and length(sid) <= 16 and length(coalesce(ver,'')) <= 16);
revoke select, update, delete, truncate on public.nf_trace from anon, authenticated;

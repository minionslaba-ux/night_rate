-- Публичные флаги для игры: игра читает, пишет только сервер (бот, ключ service_role).
-- reload — метка времени команды /reload: игры, видевшие старую метку, очищают кэш и перезагружаются.
create table if not exists public.nf_public (k text primary key, v text not null, updated_at timestamptz not null default now());
alter table public.nf_public enable row level security;
create policy "nf_public read" on public.nf_public for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.nf_public from anon, authenticated;
insert into public.nf_public (k, v) values ('reload', '0') on conflict (k) do nothing;

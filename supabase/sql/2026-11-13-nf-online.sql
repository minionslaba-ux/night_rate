-- кто сейчас в игре: строка на устройство, игра обновляет её раз в минуту через nf_ping (бот: /online_pikabu)
create table if not exists public.nf_online (sid text primary key, app text, device text, browser text, ver text, mode text, ep int, ch int, title text, started_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.nf_online enable row level security;
create index if not exists nf_online_upd on public.nf_online (updated_at desc);
-- функция nf_ping(p_sid, p_app, p_device, p_browser, p_ver, p_mode, p_ep, p_ch, p_title): security definer, upsert по sid, чистка строк старше 2 дней; execute — anon, authenticated

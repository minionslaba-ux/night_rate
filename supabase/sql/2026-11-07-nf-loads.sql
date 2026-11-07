-- Замеры загрузки игры с устройств игроков (применено миграцией nf_loads) и утренняя сводка владельцу.
create table if not exists public.nf_loads (
  id bigserial primary key, created_at timestamptz not null default now(),
  ver text, device text, os text, browser text, app text, net text, mem real, cores int, dpr real, scr text,
  cached boolean, ok boolean not null default true, stage text, t_html int, t_kit int, t_world int, t_menu int, t_first int, note text);
alter table public.nf_loads enable row level security;
create policy "nf_loads insert" on public.nf_loads for insert to anon, authenticated with check (coalesce(length(note), 0) <= 300 and coalesce(length(device), 0) <= 40 and coalesce(length(browser), 0) <= 40);
revoke select, update, delete, truncate on public.nf_loads from anon, authenticated;
create index if not exists nf_loads_t on public.nf_loads (created_at);
select cron.schedule('nf-loads-daily', '47 6 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-bot', body := jsonb_build_object('loads', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000)$$);

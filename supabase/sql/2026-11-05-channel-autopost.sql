-- Канал @nightfaregame: настройки бота, учёт автопостов и расписание ежедневного поста (19:07 МСК = 16:07 UTC)
create table if not exists public.nf_settings (k text primary key, v text);
create table if not exists public.nf_posts (day date primary key, kind text, message_id bigint, created_at timestamptz not null default now());
alter table public.nf_settings enable row level security;
alter table public.nf_posts enable row level security;
revoke all on public.nf_settings, public.nf_posts from anon, authenticated;
insert into public.nf_settings (k, v) values ('cron_key', md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)) on conflict (k) do nothing;
insert into public.nf_settings (k, v) values ('autopost', 'on') on conflict (k) do nothing;
create extension if not exists pg_cron;
select cron.unschedule('nf-daily-post') where exists (select 1 from cron.job where jobname = 'nf-daily-post');
select cron.schedule('nf-daily-post', '7 16 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-bot', body := jsonb_build_object('daily', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000)$$);
-- дубль постов на стену группы ВК: номер поста ВК
alter table public.nf_posts add column if not exists vk_id bigint;

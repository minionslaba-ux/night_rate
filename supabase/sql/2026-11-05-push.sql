-- Пуш-уведомления браузера: подписки игроков и ключи VAPID (только для сервера). Функция nf-push.
create table if not exists public.nf_push_subs (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) < 1000),
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete cascade,
  state jsonb,
  state_at timestamptz,
  created_at timestamptz not null default now(),
  last_sent timestamptz,
  sent integer not null default 0
);
create index if not exists nf_push_subs_user on public.nf_push_subs (user_id);
alter table public.nf_push_subs enable row level security;
revoke all on public.nf_push_subs from anon, authenticated;
create table if not exists public.nf_push_keys (id smallint primary key default 1 check (id = 1), pub text not null, priv text not null);
alter table public.nf_push_keys enable row level security;
revoke all on public.nf_push_keys from anon, authenticated;
-- рассылка: 06:40, 10:40, 16:40 UTC = 09:40, 13:40, 19:40 по Москве; ключ запуска — nf_settings.cron_key
select cron.schedule('nf-push-morning', '40 6 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-push', body := jsonb_build_object('key', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 60000)$$);
select cron.schedule('nf-push-day', '40 10 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-push', body := jsonb_build_object('key', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 60000)$$);
select cron.schedule('nf-push-evening', '40 16 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-push', body := jsonb_build_object('key', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 60000)$$);

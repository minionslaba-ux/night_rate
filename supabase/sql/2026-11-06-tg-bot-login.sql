-- вход на сайте через бота Telegram: одноразовая метка из ссылки t.me/night_fare_bot?start=login_<метка>
-- (применено в проекте xqgibyazilueurdqufso 2026-11-06)
create table if not exists public.nf_tg_auth (
  nonce text primary key,
  tg_id bigint,
  name text,
  username text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  used_at timestamptz
);
alter table public.nf_tg_auth enable row level security;   -- только серверные функции (service role); политик для клиентов нет
create index if not exists nf_tg_auth_created on public.nf_tg_auth (created_at);

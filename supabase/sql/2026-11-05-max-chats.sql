-- Каналы MAX, где админ бот игры: chat_id приходит только в событиях (bot_added, пост в канале), список API не отдаёт.
create table if not exists public.nf_max_chats (
  chat_id bigint primary key,
  is_channel boolean not null default false,
  title text,
  enabled boolean not null default true,
  added_at timestamptz not null default now(),
  last_post timestamptz,
  pin_mid text
);
alter table public.nf_max_chats enable row level security;
revoke all on public.nf_max_chats from anon, authenticated;

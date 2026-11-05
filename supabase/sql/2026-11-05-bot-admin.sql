-- Telegram bot @night_fare_bot: owner commands (only nf_admins), ideas, bot subscribers, drafts awaiting «Отправить»
create table if not exists public.nf_admins (tg_id bigint primary key, name text, created_at timestamptz not null default now());
create table if not exists public.nf_ideas (id bigint generated always as identity primary key, tg_id bigint not null, text text not null, status text not null default 'new' check (status in ('new','in_progress','done','skipped','question')), reply text, created_at timestamptz not null default now());
create table if not exists public.nf_bot_users (tg_id bigint primary key, name text, username text, started_at timestamptz not null default now(), blocked boolean not null default false);
create table if not exists public.nf_drafts (id bigint generated always as identity primary key, tg_id bigint not null, kind text not null, payload jsonb, created_at timestamptz not null default now());
alter table public.nf_admins enable row level security;
alter table public.nf_ideas enable row level security;
alter table public.nf_bot_users enable row level security;
alter table public.nf_drafts enable row level security;
revoke all on public.nf_admins, public.nf_ideas, public.nf_bot_users, public.nf_drafts from anon, authenticated;
-- the owner (Telegram ID); add more admins the same way
insert into public.nf_admins (tg_id, name) values (344759585, 'владелец') on conflict do nothing;
create extension if not exists pg_net;

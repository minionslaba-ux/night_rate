-- v144: the daily challenge ranking on Пикабу (written by the nf-pikabu function after checking the player's signature; applied 15.11.2026)
create table if not exists public.nf_daily_pk (day date not null, player_id text not null, name text not null default 'Игрок', secs int not null, updated_at timestamptz not null default now(), primary key (day, player_id));
alter table public.nf_daily_pk enable row level security;
create index if not exists nf_daily_pk_day_secs on public.nf_daily_pk (day, secs, updated_at);

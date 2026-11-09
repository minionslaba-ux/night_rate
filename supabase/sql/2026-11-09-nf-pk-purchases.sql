-- Покупки на Пикабу Играх (функция nf-pikabu): одна строка на покупку, повторная проверка той же покупки строку не добавляет.
create table if not exists public.nf_pk_purchases (
  purchase_id text primary key,
  player_id text,
  product_id text not null,
  consumable boolean,
  test boolean,
  created_at timestamptz not null default now()
);
alter table public.nf_pk_purchases enable row level security;
revoke all on public.nf_pk_purchases from anon, authenticated;

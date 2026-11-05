-- вход на сайте через бота MAX: одноразовая метка, подтверждённая нажатием «Начать» в боте
create table if not exists public.nf_max_auth (nonce text primary key, max_id bigint, name text, created_at timestamptz not null default now(), done_at timestamptz, used_at timestamptz);
alter table public.nf_max_auth enable row level security;
revoke all on public.nf_max_auth from anon, authenticated;
create index if not exists nf_max_auth_created on public.nf_max_auth (created_at);
alter table public.nf_max_auth add column if not exists code text;
create index if not exists nf_max_auth_code on public.nf_max_auth (code);

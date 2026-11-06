-- Покупка монет за деньги (Робокасса, только сайт).
-- Номер счёта Робокассы (InvId) = inv_id. Строку создаёт и меняет только функция nf-pay (service role):
-- new → paid (проверенное уведомление Робокассы) → claimed (игра забрала монеты в профиль, ровно один раз).
create table if not exists public.nf_payments (
  inv_id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack text not null,
  rub integer not null check (rub > 0),
  coins integer not null check (coins > 0),
  status text not null default 'new' check (status in ('new', 'paid', 'claimed')),
  test boolean not null default true,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  claimed_at timestamptz
);
create index if not exists nf_payments_user_status on public.nf_payments (user_id, status);
alter table public.nf_payments enable row level security;
-- игрок видит только свои платежи (история в профиле); писать может только функция
drop policy if exists nf_payments_own_read on public.nf_payments;
create policy nf_payments_own_read on public.nf_payments for select to authenticated using (user_id = auth.uid());

-- Сложность глав: попытки (nf_runs), множитель урона по главам (nf_diff), ночная подстройка nf_tune (pg_cron 'nf-tune', 03:13 МСК).
create table if not exists public.nf_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ch_key text not null check (ch_key ~ '^[0-9]{1,2}:[a-z0-9]{1,4}$'),
  result text not null check (result in ('win', 'death', 'fail')),
  reason text check (char_length(reason) <= 60),
  tries smallint not null default 0,
  mult real,
  created_at timestamptz not null default now()
);
create index if not exists nf_runs_key_time on public.nf_runs (ch_key, created_at);
alter table public.nf_runs enable row level security;
revoke all on public.nf_runs from anon;
grant insert on public.nf_runs to authenticated;
create policy nf_runs_insert_own on public.nf_runs for insert to authenticated with check (user_id = auth.uid());
create table if not exists public.nf_diff (
  ch_key text primary key,
  mult real not null default 1 check (mult between 0.4 and 1),
  pass real, attempts integer, updated_at timestamptz not null default now()
);
alter table public.nf_diff enable row level security;
grant select on public.nf_diff to anon, authenticated;
create policy nf_diff_read on public.nf_diff for select to anon, authenticated using (true);
create or replace function public.nf_tune() returns void language sql security definer set search_path = public as $$
  with s as (
    select ch_key, count(*) n, count(*) filter (where result = 'win')::real / count(*) pass
    from nf_runs where created_at > now() - interval '14 days' group by ch_key having count(*) >= 15
  )
  insert into nf_diff (ch_key, mult, pass, attempts, updated_at)
  select s.ch_key,
         case when s.pass < 0.75 then greatest(0.5, coalesce(d.mult, 1) - 0.1)
              when s.pass > 0.9 then least(1, coalesce(d.mult, 1) + 0.05)
              else coalesce(d.mult, 1) end,
         s.pass, s.n, now()
  from s left join nf_diff d using (ch_key)
  on conflict (ch_key) do update set mult = excluded.mult, pass = excluded.pass, attempts = excluded.attempts, updated_at = excluded.updated_at;
$$;
revoke all on function public.nf_tune() from public, anon, authenticated;
select cron.schedule('nf-tune', '13 0 * * *', $$select public.nf_tune()$$);
-- стартовые облегчения по автотесту 05.11.2026 (самые смертельные пешие главы)
insert into nf_diff (ch_key, mult) values
 ('2:c4',0.75),('3:c6',0.75),('4:c4',0.75),('5:c3',0.5),('5:c6',0.75),('7:c4',0.75),('7:c6',0.75),('8:c6',0.75),('10:c2',0.75),
 ('11:c3',0.65),('11:c6',0.75),('12:c1',0.6),('12:c5',0.75),('13:c3',0.75),('13:c6',0.75),('13:c10',0.65),('14:c3',0.6),('14:c8',0.75),('14:c10',0.75)
on conflict (ch_key) do update set mult = excluded.mult;

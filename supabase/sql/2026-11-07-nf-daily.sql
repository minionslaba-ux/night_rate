-- Daily challenge: best time per player per day; access only through the two functions.
create table if not exists public.nf_daily (
  day date not null, user_id uuid not null references auth.users(id) on delete cascade,
  secs int not null, tries int not null default 1, updated_at timestamptz not null default now(),
  primary key (day, user_id)
);
alter table public.nf_daily enable row level security;
create or replace function public.nf_daily_submit(p_day date, p_secs int)
returns table(place bigint, best int, improved boolean)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'Europe/Moscow')::date; old int;
begin
  if uid is null then raise exception 'login required'; end if;
  if p_day not in (today, today - 1) then raise exception 'wrong day'; end if;
  if p_secs < 15 or p_secs > 3600 then raise exception 'bad time'; end if;
  select secs into old from nf_daily where day = p_day and user_id = uid;
  if old is null then insert into nf_daily(day, user_id, secs) values (p_day, uid, p_secs);
  else update nf_daily set secs = least(secs, p_secs), tries = tries + 1, updated_at = now() where day = p_day and user_id = uid; end if;
  return query
    with r as (select d.user_id, d.secs, row_number() over (order by d.secs, d.updated_at) as pl
               from nf_daily d join profiles p on p.id = d.user_id where d.day = p_day and not coalesce(p.is_tester, false))
    select coalesce((select pl from r where r.user_id = uid), 0::bigint), (select secs from nf_daily where day = p_day and user_id = uid), (old is null or p_secs < old);
end $$;
create or replace function public.nf_daily_top(p_day date, lim int default 10)
returns table(place bigint, name text, secs int, me boolean)
language sql security definer set search_path = public as $$
  with r as (select d.user_id, d.secs, coalesce(nullif(trim(p.name), ''), 'Таксист') as nm, row_number() over (order by d.secs, d.updated_at) as place
             from nf_daily d join profiles p on p.id = d.user_id where d.day = p_day and not coalesce(p.is_tester, false))
  select place, left(split_part(nm, ' ', 1), 16) || case when split_part(nm, ' ', 2) <> '' then ' ' || left(split_part(nm, ' ', 2), 1) || '.' else '' end,
         secs, coalesce(user_id = auth.uid(), false)
  from r where place <= least(greatest(lim, 1), 50) or user_id = auth.uid() order by place;
$$;
revoke all on function public.nf_daily_submit(date, int) from public, anon;
grant execute on function public.nf_daily_submit(date, int) to authenticated;
grant execute on function public.nf_daily_top(date, int) to anon, authenticated;

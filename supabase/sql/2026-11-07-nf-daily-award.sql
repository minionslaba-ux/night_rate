-- Призы за задание дня: 500 / 300 / 200 монет тройке лучших (без тестеров).
-- Запускается в 00:05 МСК за вчерашний день; повторный запуск ничего не дублирует.
create or replace function public.nf_daily_award(p_day date default ((now() at time zone 'Europe/Moscow')::date - 1))
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int := 0; r record;
begin
  if exists (select 1 from nf_gifts where reason like 'daily_%:' || p_day::text) then return 0; end if;
  for r in
    select d.user_id, row_number() over (order by d.secs, d.updated_at) as place
    from nf_daily d join profiles p on p.id = d.user_id where d.day = p_day and not coalesce(p.is_tester, false)
    order by d.secs, d.updated_at limit 3
  loop
    insert into nf_gifts(user_id, coins, reason) values (r.user_id, (array[500, 300, 200])[r.place], 'daily_' || r.place || ':' || p_day::text);
    n := n + 1;
  end loop;
  return n;
end $function$;
revoke all on function public.nf_daily_award(date) from public, anon, authenticated;

select cron.schedule('nf-daily-award', '5 21 * * *', $$select public.nf_daily_award()$$);
-- Пост о задании дня в ТГ / ВК / MAX: проверка каждый день в 15:00 МСК, бот публикует не чаще раза в 5 дней.
select cron.schedule('nf-daily-task-post', '0 12 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-bot', body := jsonb_build_object('dtask', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000)$$);

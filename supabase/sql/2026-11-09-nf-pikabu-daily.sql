-- v115: площадка в замерах скорости и ежедневная сводка по Пикабу в 20:00 МСК (17:00 UTC)
alter table nf_fps add column if not exists app text;
select cron.schedule('nf-pikabu-daily', '0 17 * * *', $$select net.http_post(url := 'https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-bot', body := jsonb_build_object('pikabu', (select v from public.nf_settings where k = 'cron_key')), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000)$$);

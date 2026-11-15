-- v142: where exactly a mission ended, and what a slow device runs into (applied 15.11.2026)
alter table public.nf_missions add column if not exists detail text;
alter table public.nf_fps add column if not exists js_ms real, add column if not exists draw_ms real, add column if not exists frame_ms real, add column if not exists slow_pct real;
drop policy if exists nf_missions_ins on public.nf_missions;
create policy nf_missions_ins on public.nf_missions for insert to anon, authenticated with check ((ev = any (array['start','win','fail','death','quit'])) and coalesce(length(ver),0) < 20 and coalesce(length(sid),0) < 24 and coalesce(length(title),0) < 100 and coalesce(length(mtype),0) < 24 and coalesce(length(reason),0) < 80 and coalesce(length(device),0) < 60 and coalesce(length(mods),0) < 80 and coalesce(length(detail),0) < 200);

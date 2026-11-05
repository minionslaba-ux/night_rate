// Пуш-уведомления браузера «Ночного тарифа» (по образцу push-subscribe и push-send из «Выжить до пятницы»).
// • GET — открытый ключ VAPID. Пару ключей функция создаёт сама при первом обращении и хранит в закрытой таблице nf_push_keys:
//   закрытый ключ никуда не передаётся (ни в браузер, ни в репозиторий).
// • POST { action: 'on', sub, access_token? } — сохранить подписку (по токену — к профилю игрока); 'off' — удалить;
//   'state' — что сейчас у игрока (водитель, машина, бензин, грязь, главы) для личных напоминаний.
// • POST { key } — рассылка по расписанию (pg_cron 3 раза в день: 09:40, 13:40, 19:40 МСК). key — nf_settings.cron_key.
//   Каждому подписчику 1–3 уведомления в день (сколько и в какие слоты — хэш подписки и даты). Кто играл последние 3 часа —
//   не беспокоим. 6 из 10 — личные, если игра прислала состояние. Протухшие подписки (404/410) удаляются.
// • POST { key, custom: { t, b }, only_users? } — свой текст всем или только указанным профилям (команды /push и /pushtest в боте).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { GENERAL, PERSONAL, type Msg } from './texts.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const h32 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

async function vapid() {
  const { data } = await db.from('nf_push_keys').select('pub, priv').eq('id', 1).maybeSingle();
  if (data?.pub) return data as { pub: string; priv: string };
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const priv = (await crypto.subtle.exportKey('jwk', kp.privateKey)).d!;
  await db.from('nf_push_keys').upsert({ id: 1, pub, priv }, { onConflict: 'id', ignoreDuplicates: true });
  const { data: again } = await db.from('nf_push_keys').select('pub, priv').eq('id', 1).single();   // две функции создали ключи одновременно — берём сохранённый
  return again as { pub: string; priv: string };
}

type St = { hero?: string; nick?: string; g?: string; car?: string; fuel?: number; dirt?: number; cond?: number; ch?: number; lastPlay?: string | null };
const awayDays = (st: St | null, at: string | null) => Math.max(0, (Date.now() - (Date.parse(st?.lastPlay || '') || Date.parse(at || '') || Date.now())) / 864e5);
function personal(st: St | null, at: string | null, seed: number): (Msg & { cat: string }) | null {
  if (!st || !st.hero || !at || (Date.now() - Date.parse(at)) / 864e5 > 21) return null;
  const away = awayDays(st, at), urgent: string[] = [];
  if ((st.fuel ?? 100) < 25) urgent.push('fuel_low');
  if ((st.cond ?? 100) < 40) urgent.push('damaged');
  if ((st.dirt ?? 0) > 0.6) urgent.push('dirty');
  const extra = [(st.ch ?? 0) > 0 ? 'story' : 'start_story', 'hero_miss', st.car ? 'car_miss' : 'hero_miss'];
  const miss = away >= 1 ? ['hero_miss', st.car ? 'car_miss' : 'hero_miss'] : [];
  const cat = miss.length && seed % 10 < 6 ? miss[(seed >>> 4) % miss.length] : urgent.length && seed % 10 < 7 ? urgent[(seed >>> 4) % urgent.length] : extra[(seed >>> 4) % extra.length];
  const list = PERSONAL[cat]; if (!list?.length) return null;
  const p = list[(seed >>> 8) % list.length], f = st.g === 'f';
  const fill = (s: string) => s.replace(/\{hero\}/g, st.hero || 'Водитель').replace(/\{nick\}/g, st.nick || '').replace(/\{car\}/g, st.car || 'Машина')
    .replace(/\{fuel\}/g, String(Math.round(st.fuel ?? 0))).replace(/\{ch\}/g, String(st.ch ?? 0)).replace(/\{а\}/g, f ? 'а' : '');
  return { t: fill(p.t).slice(0, 80), b: fill(p.b).slice(0, 200), cat };
}

async function send(s: any, payload: string, ttl: number) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: ttl, urgency: 'normal' });
    await db.from('nf_push_subs').update({ last_sent: new Date().toISOString(), sent: (s.sent || 0) + 1 }).eq('endpoint', s.endpoint);
    return 'sent';
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) { await db.from('nf_push_subs').delete().eq('endpoint', s.endpoint); return 'gone'; }
    return 'err';
  }
}
async function sendAll(list: any[], make: (s: any) => string | null, ttl: number) {
  let sent = 0, gone = 0, err = 0;
  for (let i = 0; i < list.length; i += 25) {
    const r = await Promise.all(list.slice(i, i + 25).map(async (s) => { const p = make(s); return p ? send(s, p, ttl) : 'skip'; }));
    for (const x of r) { if (x === 'sent') sent++; else if (x === 'gone') gone++; else if (x === 'err') err++; }
  }
  return { sent, gone, err };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method === 'GET') return json({ pub: (await vapid()).pub });
    const body = await req.json().catch(() => ({}));
    const { action, sub, endpoint, state, key } = body;

    // ---- от игры ----
    if (action === 'on') {
      const ep = sub?.endpoint, p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
      if (typeof ep !== 'string' || !/^https:\/\//.test(ep) || ep.length > 990 || typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return json({ error: 'bad_sub' }, 400);
      const uid = typeof body.access_token === 'string' ? (await db.auth.getUser(body.access_token)).data.user?.id || null : null;
      const { error } = await db.from('nf_push_subs').upsert({ endpoint: ep, p256dh, auth, ...(uid ? { user_id: uid } : {}) }, { onConflict: 'endpoint' });
      return error ? json({ error: error.message }, 500) : json({ ok: true });
    }
    if (action === 'off') {
      if (typeof endpoint === 'string') await db.from('nf_push_subs').delete().eq('endpoint', endpoint);
      return json({ ok: true });
    }
    if (action === 'state') {   // только короткие поля, без лишнего
      if (typeof endpoint !== 'string' || !state || typeof state !== 'object') return json({ error: 'bad_state' }, 400);
      const s = (v: unknown, n = 30) => (typeof v === 'string' ? v.slice(0, n) : '');
      const num = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));
      const lp = typeof state.lastPlay === 'string' && Number.isFinite(Date.parse(state.lastPlay)) ? new Date(Math.min(Date.parse(state.lastPlay), Date.now())).toISOString() : null;
      const clean = { hero: s(state.hero, 16), nick: s(state.nick, 16), g: state.g === 'f' ? 'f' : 'm', car: s(state.car, 30), fuel: num(state.fuel, 0, 100), dirt: num(state.dirt, 0, 1), cond: num(state.cond, 0, 100), ch: num(state.ch, 0, 999), lastPlay: lp };
      await db.from('nf_push_subs').update({ state: clean, state_at: new Date().toISOString() }).eq('endpoint', endpoint);
      return json({ ok: true });
    }

    // ---- от расписания и бота: нужен ключ ----
    const { data: ck } = await db.from('nf_settings').select('v').eq('k', 'cron_key').maybeSingle();
    if (!ck?.v || key !== ck.v) return json({ error: 'forbidden' }, 403);
    const k = await vapid();
    webpush.setVapidDetails('mailto:piter_00000@mail.ru', k.pub, k.priv);

    if (body.count) {   // для бота: сколько подписчиков
      const { count } = await db.from('nf_push_subs').select('endpoint', { count: 'exact', head: true });
      const { count: withUser } = await db.from('nf_push_subs').select('endpoint', { count: 'exact', head: true }).not('user_id', 'is', null);
      return json({ total: count || 0, with_profile: withUser || 0 });
    }

    if (body.custom && typeof body.custom.t === 'string' && typeof body.custom.b === 'string') {
      let q = db.from('nf_push_subs').select('endpoint, p256dh, auth, sent').limit(20000);
      if (Array.isArray(body.only_users)) q = q.in('user_id', body.only_users.slice(0, 50));
      const { data: list } = await q;
      const payload = JSON.stringify({ t: body.custom.t.slice(0, 80), b: body.custom.b.slice(0, 200), url: '/?utm_source=push&utm_medium=web&utm_campaign=manual' });
      const r = await sendAll(list || [], () => payload, 12 * 3600);
      return json({ custom: true, total: list?.length || 0, ...r });
    }

    // ---- по расписанию ----
    const msk = new Date(Date.now() + 3 * 3600e3), hour = msk.getUTCHours(), dow = msk.getUTCDay(), date = msk.toISOString().slice(0, 10);
    const slot = typeof body.slot === 'number' ? body.slot : hour < 12 ? 0 : hour < 17 ? 1 : 2;
    const dayNo = Math.floor(msk.getTime() / 864e5), weekend = dow === 0 || dow === 6;
    const pool = weekend ? GENERAL.weekend : GENERAL[(['morning', 'day', 'evening'] as const)[slot]];
    const { data: subs } = await db.from('nf_push_subs').select('endpoint, p256dh, auth, user_id, sent, state, state_at').limit(20000);
    // кто играл последние 3 часа (профиль сохранялся) — не беспокоим
    const ids = [...new Set((subs || []).map((s: any) => s.user_id).filter(Boolean))];
    const active = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const { data: ps } = await db.from('profiles').select('id').in('id', ids.slice(i, i + 500)).gt('updated_at', new Date(Date.now() - 3 * 3600e3).toISOString());
      for (const p of ps || []) active.add(p.id);
    }
    let skipped = 0;
    const todo = (subs || []).filter((s: any) => {
      if (body.test) return true;
      const h = h32(s.endpoint + date), n = 1 + (h % 3);   // сегодня 1, 2 или 3 уведомления
      const on = n === 3 || (n === 2 ? slot !== (h >>> 4) % 3 : slot === (h >>> 6) % 3);
      if (!on || (s.user_id && active.has(s.user_id))) { skipped++; return false; }
      return true;
    });
    const r = await sendAll(todo, (s) => {
      const seed = h32(s.endpoint + date + slot);
      const away = s.state ? awayDays(s.state, s.state_at) >= 1 : false;   // давно не заходил — личное чаще: 8 из 10 вместо 6
      const pm = seed % 10 < (away ? 8 : 6) ? personal(s.state, s.state_at, seed >>> 4) : null;
      const msg = pm || pool[(h32(s.endpoint) + dayNo * 3 + slot) % pool.length];
      return JSON.stringify({ t: msg.t, b: msg.b, url: `/?utm_source=push&utm_medium=web&utm_campaign=${pm ? pm.cat : weekend ? 'weekend' : ['morning', 'day', 'evening'][slot]}` });
    }, 6 * 3600);
    return json({ slot, dow, total: subs?.length || 0, skipped, ...r });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

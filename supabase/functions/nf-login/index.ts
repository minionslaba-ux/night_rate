// «Ночной тариф»: вход через площадки и один аккаунт на всех площадках (основа — tg-login из «Выжить до пятницы»).
// • Telegram Mini App: initData подписан токеном бота (секрет TELEGRAM_BOT_TOKEN).
// • Telegram Login на сайте: данные входа подписаны тем же токеном (ключ — SHA-256 токена). Аккаунт тот же, что в Mini App.
// • VK Mini App: параметры запуска vk_* подписаны защищённым ключом приложения (секрет VK_APP_SECRET).
// • VK ID на сайте (кнопка «Войти через ВК», приложение VK ID 54878563): браузер получает токен VK ID, сервер сам спрашивает у VK,
//   чей это токен (id.vk.com/oauth2/user_info), и только тогда входит. Аккаунт тот же, что в мини-приложении ВК (один vk_id).
// • MAX Mini App: initData (WebAppData) подписан токеном бота MAX тем же способом, что в Telegram (секрет MAX_BOT_TOKEN).
// Секреты добавляет владелец в Supabase → Edge Functions → Secrets; пока их нет, вход этой площадки отвечает not_configured.
// Аккаунт площадки — пользователь Supabase Auth с служебным адресом tg<id>@tg.nightfare.invalid (писем не шлём) и строка profiles;
// выдаём обычную сессию Supabase (как после входа по ссылке из письма).
// Коды: action 'link_code' + access_token — выдать одноразовый код (8 символов, 10 минут);
//   code + подтверждение площадки — эта площадка навсегда привязывается к аккаунту кода; code без площадки (сайт) — вход в аккаунт кода.
// action 'delete_account' + access_token — удалить аккаунт целиком (правила VK Mini Apps: удаление прямо из приложения).
// action 'links' + access_token — какие площадки привязаны к аккаунту; action 'link' + access_token + подтверждение площадки —
//   привязать площадку к своему аккаунту. Если она уже входила в другой, пустой аккаунт (без прогресса), тот удаляется; с прогрессом — отказ.
// • MAX на сайте (бота @se14877440_1_bot): action 'max_start' выдаёт одноразовую метку и ссылку max.ru/<бот>?start=<метка>.
//   Игрок открывает бота и жмёт «Начать»; MAX присылает сюда вебхук bot_started с меткой и user_id (заголовок X-Max-Bot-Api-Secret
//   сверяется с секретом, выведенным из MAX_BOT_TOKEN). Сайт опрашивает { max_nonce }: пока игрок не подтвердил — { pending: true },
//   потом — обычный вход MAX (тот же max_id, что в мини-приложении). Метка живёт 10 минут и срабатывает один раз.
//   Подписка вебхука: GET …/nf-login?max_setup=1.
// action 'tg_config' — номер бота для кнопки «Войти через Telegram» (публичная часть токена до двоеточия, не секрет).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const enc = new TextEncoder();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
const DAY = 86400;

// Telegram / MAX initData: HMAC-SHA256(HMAC-SHA256('WebAppData', token), отсортированные поля)
async function initDataUser(token: string, initData: string) {
  const p = new URLSearchParams(initData), hash = p.get('hash') || '';
  p.delete('hash');
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  if (hex(await hmac(await hmac(enc.encode('WebAppData'), token), check)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 7 * DAY) return null;
  return JSON.parse(p.get('user') || 'null');
}
// Telegram Login (сайт): HMAC-SHA256(SHA-256(token), отсортированные поля), hex; данные не старше суток
async function widgetUser(token: string, w: any) {
  if (!w || typeof w !== 'object' || typeof w.hash !== 'string') return null;
  const fields = Object.entries(w).filter(([k, v]) => k !== 'hash' && v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]).sort(([a], [b]) => (a < b ? -1 : 1));
  const check = fields.map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(token)));
  if (hex(await hmac(secret, check)) !== w.hash) return null;
  if (Date.now() / 1000 - Number(w.auth_date || 0) > DAY) return null;
  const id = Number(w.id);
  return id > 0 ? { id, first_name: w.first_name, last_name: w.last_name, username: w.username } : null;
}
// VK Mini App: подпись — HMAC-SHA256 от отсортированных vk_*-параметров, base64url без «=»
async function vkLaunchUser(v: any) {
  const secret = (Deno.env.get('VK_APP_SECRET') || '').trim();
  if (!secret || !v || typeof v.params !== 'string') return null;
  const q = new URLSearchParams(v.params.replace(/^\?/, ''));
  const vkp = [...q.entries()].filter(([k]) => k.startsWith('vk_')).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(new URLSearchParams(vkp).toString())));
  const sign = btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (sign !== q.get('sign')) return null;
  const ts = Number(q.get('vk_ts') || 0);
  if (ts && Date.now() / 1000 - ts > 7 * DAY) return null;
  const id = Number(q.get('vk_user_id'));
  return id > 0 ? { id, first_name: String(v.name || '').replace(/[<>]/g, '').slice(0, 24) } : null;
}
// VK ID (сайт): токен проверяет сам VK; он выдан только нашему приложению VK ID, поэтому чужой токен не подойдёт
const VKID_APP = '54878563';
async function vkIdUser(token: unknown) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return null;
  // VK ID moved to vk.ru; the old .com address stays as a fallback
  let j: any = null;
  for (const host of ['id.vk.ru', 'id.vk.com']) {
    try {
      const r = await fetch(`https://${host}/oauth2/user_info`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: VKID_APP, access_token: token }) });
      j = await r.json().catch(() => null);
      if (j && (j.user || j.error)) break;
    } catch (_) { /* try the next address */ }
  }
  const u = j && j.user, id = Number(u && u.user_id);
  return id > 0 ? { id, first_name: String(u.first_name || '').slice(0, 24), last_name: String(u.last_name || '').slice(0, 24) } : null;
}

// ---- MAX: бот и вебхук ----
const MAX_BOT = 'se14877440_1_bot', MAX_HOSTS = ['https://platform-api.max.ru', 'https://platform-api2.max.ru'];
const maxToken = () => (Deno.env.get('MAX_BOT_TOKEN') || '').trim();
const maxSecret = async () => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('nf-max-hook:' + maxToken())))).slice(0, 48);
// platform-api first (platform-api2 may use a certificate the runtime does not trust), the other as a fallback
const maxApi = async (path: string, init: RequestInit = {}) => {
  let last: any = null;
  for (const host of MAX_HOSTS) {
    try { const r = await fetch(host + path, { ...init, headers: { Authorization: maxToken(), 'Content-Type': 'application/json', ...(init.headers || {}) } }); return await r.json().catch(() => ({ status: r.status })); }
    catch (e) { last = { error: String(e).slice(0, 200), host }; }
  }
  return last;
};
const maxSay = (userId: number, text: string) => maxApi(`/messages?user_id=${userId}`, { method: 'POST', body: JSON.stringify({ text }) }).catch(() => null);
const NONCE_RE = /^[A-Za-z0-9]{32}$/;
const newNonce = () => [...crypto.getRandomValues(new Uint8Array(32))].map((x) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[x % 62]).join('');
// вебхук MAX: «Начать» по ссылке входа (или метка, присланная текстом)
async function maxHook(db: any, up: any) {
  const ty = up?.update_type;
  // каналы MAX, где админ бот игры (для постов с кнопкой «Играть»): chat_id приходит только в событиях
  const chatTitle = async (id: number) => { const c = await maxApi(`/chats/${id}`); return c?.title ? String(c.title).slice(0, 100) : null; };
  if (ty === 'bot_added' && up.chat_id) { await db.from('nf_max_chats').upsert({ chat_id: Number(up.chat_id), is_channel: !!up.is_channel, enabled: true, title: await chatTitle(Number(up.chat_id)) }); return; }
  if (ty === 'bot_removed' && up.chat_id) { await db.from('nf_max_chats').update({ enabled: false }).eq('chat_id', up.chat_id); return; }
  if (ty === 'chat_title_changed' && up.chat_id) { await db.from('nf_max_chats').update({ title: String(up.title || '').slice(0, 100) }).eq('chat_id', up.chat_id); return; }
  const rcp = up?.message?.recipient;
  if (ty === 'message_created' && rcp?.chat_type && rcp.chat_type !== 'dialog') {   // пост в канале или сообщение в чате — не личка боту
    if (rcp.chat_type === 'channel' && rcp.chat_id) {
      const { data } = await db.from('nf_max_chats').select('chat_id').eq('chat_id', rcp.chat_id).maybeSingle();
      if (!data) await db.from('nf_max_chats').upsert({ chat_id: Number(rcp.chat_id), is_channel: true, enabled: true, title: await chatTitle(Number(rcp.chat_id)) });
    }
    return;
  }
  const user = ty === 'bot_started' ? up.user : ty === 'message_created' ? up.message?.sender : null;
  const uid = Number(user?.user_id); if (!(uid > 0) || user?.is_bot) return;
  const raw = String(ty === 'bot_started' ? up.payload || '' : up.message?.body?.text || '').trim().replace(/^\/start\s+/, '');
  const short = raw.replace(/[\s-]/g, '');
  if (NONCE_RE.test(raw) || /^\d{6}$/.test(short)) {   // метка из ссылки или 6 цифр с экрана сайта
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').slice(0, 24) || user.username || 'MAX';
    const { data } = await db.from('nf_max_auth').update({ max_id: uid, name, done_at: new Date().toISOString() })
      .eq(NONCE_RE.test(raw) ? 'nonce' : 'code', NONCE_RE.test(raw) ? raw : short).is('max_id', null).gt('created_at', new Date(Date.now() - 600e3).toISOString()).select('nonce');
    await maxSay(uid, data?.length ? '✅ Вход в «Ночной тариф» подтверждён. Вернитесь на сайт — игра продолжится сама.' : 'Ссылка для входа устарела. Нажмите «Войти через MAX» на сайте ещё раз.');
    return;
  }
  if (ty === 'bot_started' || ty === 'message_created') await maxSay(uid, '🚕 «Ночной тариф» — ночной город, такси, погони и перестрелки. Играть — кнопкой мини-приложения этого бота.\n\nВходите на сайте? Отправьте сюда 6 цифр с экрана входа.');
}
// сайт: метка подтверждена в MAX → пользователь MAX (один раз)
async function maxNonceUser(db: any, nonce: string) {
  const { data } = await db.from('nf_max_auth').select('max_id, name, used_at, created_at').eq('nonce', nonce).maybeSingle();
  if (!data || data.used_at || Date.now() - Date.parse(data.created_at) > 600e3) return { gone: true };
  if (!data.max_id) return { pending: true };
  const { data: took } = await db.from('nf_max_auth').update({ used_at: new Date().toISOString() }).eq('nonce', nonce).is('used_at', null).select('nonce');
  return took?.length ? { user: { id: Number(data.max_id), first_name: data.name } } : { gone: true };
}

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => CODE_ABC[x % CODE_ABC.length]).join('');
const URL0 = Deno.env.get('SUPABASE_URL')!, OPTS = { auth: { persistSession: false, autoRefreshToken: false } };

// обычная сессия Supabase для аккаунта uid
async function sessionFor(db: any, uid: string, name: string) {
  const email = (await db.auth.admin.getUserById(uid)).data.user?.email || '';
  if (!email) return json({ error: 'no_account' }, 404);
  const gl = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (gl.error) return json({ error: gl.error.message }, 500);
  const auth = createClient(URL0, Deno.env.get('SUPABASE_ANON_KEY')!, OPTS);
  const { data: s, error } = await auth.auth.verifyOtp({ type: 'magiclink', token_hash: gl.data.properties.hashed_token });
  if (error || !s.session) return json({ error: error?.message || 'no_session' }, 500);
  return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token, expires_at: s.session.expires_at, name });
}
// одноразовый код → аккаунт; использованный или старше 10 минут не подходит
async function useCode(db: any, code: string): Promise<string | null> {
  if (!/^[A-Z0-9]{8}$/.test(code)) return null;
  const since = new Date(Date.now() - 600e3).toISOString();
  const { data } = await db.from('link_codes').update({ used_at: new Date().toISOString() }).eq('code', code).is('used_at', null).gt('created_at', since).select('user_id');
  return data?.[0]?.user_id || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method === 'GET') {
      const qs = new URL(req.url).searchParams;
      if (qs.get('max_check') === '1') {   // диагностика без секретов: какие подписки видит MAX и есть ли метки входа
        if (!maxToken()) return json({ error: 'not_configured' }, 503);
        const subs = await maxApi('/subscriptions');
        return json({ subscriptions: (subs?.subscriptions || []).map((x: any) => ({ url: x.url, time: x.time, update_types: x.update_types, version: x.version })), raw_error: subs?.subscriptions ? null : subs });
      }
      if (qs.get('max_setup') !== '1') return json({ ok: true });
      if (!maxToken()) return json({ error: 'not_configured' }, 503);
      const me = await maxApi('/me');
      const sub = await maxApi('/subscriptions', { method: 'POST', body: JSON.stringify({ url: `${URL0}/functions/v1/nf-login`, secret: await maxSecret(), update_types: ['bot_started', 'message_created', 'bot_added', 'bot_removed', 'chat_title_changed'] }) });
      return json({ bot: me?.username || me?.name || null, subscribed: sub });
    }
    const hookSecret = req.headers.get('x-max-bot-api-secret');
    if (hookSecret !== null) {   // вебхук MAX
      if (!maxToken() || hookSecret !== (await maxSecret())) return json({ error: 'forbidden' }, 403);
      const up = await req.json().catch(() => null);
      try { await maxHook(createClient(URL0, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, OPTS), up); } catch (e) { console.error('max hook', e); }
      return json({ ok: true });
    }
    const body = await req.json();
    if (body.action === 'tg_config') {
      const t = (Deno.env.get('TELEGRAM_BOT_TOKEN') || '').trim();
      return t ? json({ bot_id: t.split(':')[0] }) : json({ error: 'not_configured' }, 503);
    }
    const db = createClient(URL0, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, OPTS);
    const me = async () => (body.access_token ? (await db.auth.getUser(String(body.access_token))).data.user : null);

    if (body.action === 'link_code') {
      const cur = await me(); if (!cur) return json({ error: 'bad_session' }, 401);
      const { count } = await db.from('link_codes').select('code', { count: 'exact', head: true }).eq('user_id', cur.id).gt('created_at', new Date(Date.now() - 3600e3).toISOString());
      if ((count || 0) >= 10) return json({ error: 'too_often' }, 429);
      for (let i = 0; i < 5; i++) { const code = newCode(); const { error } = await db.from('link_codes').insert({ code, user_id: cur.id }); if (!error) return json({ code, expires_in: 600 }); }
      return json({ error: 'code_failed' }, 500);
    }
    if (body.action === 'delete_account') {
      const cur = await me(); if (!cur) return json({ error: 'bad_session' }, 401);
      const { data: p } = await db.from('profiles').select('is_tester').eq('id', cur.id).maybeSingle();
      if (p?.is_tester) return json({ error: 'tester' }, 403);   // тестовый профиль из игры не удаляется
      const { error } = await db.auth.admin.deleteUser(cur.id);   // profiles, связки и коды удаляются каскадом
      return error ? json({ error: 'delete_failed' }, 500) : json({ deleted: true });
    }

    if (body.action === 'links') {
      const cur = await me(); if (!cur) return json({ error: 'bad_session' }, 401);
      const has = async (t: string) => ((await db.from(t).select('user_id', { count: 'exact', head: true }).eq('user_id', cur.id)).count || 0) > 0;
      return json({ tg: await has('tg_accounts'), vk: await has('vk_accounts'), max: await has('max_accounts') });
    }
    if (body.action === 'max_start') {
      if (!maxToken()) return json({ error: 'not_configured' }, 503);
      const nonce = newNonce(), since = new Date(Date.now() - 600e3).toISOString();
      let short = '';
      for (let i = 0; i < 6 && !short; i++) {   // 6 цифр, не совпадающие с другими действующими
        const c = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        const { count } = await db.from('nf_max_auth').select('nonce', { count: 'exact', head: true }).eq('code', c).gt('created_at', since);
        if (!count) short = c;
      }
      const { error } = await db.from('nf_max_auth').insert({ nonce, code: short || null });
      return error ? json({ error: 'start_failed' }, 500) : json({ nonce, code: short, url: `https://max.ru/${MAX_BOT}?start=${nonce}`, expires_in: 600 });
    }

    const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const widget = body.tg_widget && typeof body.tg_widget === 'object';
    const vkid = typeof body.vkid_token === 'string' && body.vkid_token;
    const maxNonce = typeof body.max_nonce === 'string' && NONCE_RE.test(body.max_nonce) ? body.max_nonce : '';
    const plat = (typeof body.max_init === 'string' && body.max_init) || maxNonce ? 'max' : body.vk_launch || vkid ? 'vk' : (typeof body.initData === 'string' && body.initData) || widget ? 'tg' : '';
    if (code && !plat) { const target = await useCode(db, code); return target ? await sessionFor(db, target, '') : json({ error: 'bad_code' }, 403); }
    if (!plat) return json({ error: 'no_proof' }, 400);

    let u: any = null;
    if (plat === 'tg') {
      const t = (Deno.env.get('TELEGRAM_BOT_TOKEN') || '').trim(); if (!t) return json({ error: 'not_configured' }, 503);
      u = widget ? await widgetUser(t, body.tg_widget) : await initDataUser(t, body.initData);
    }
    else if (plat === 'max') {
      const t = maxToken(); if (!t) return json({ error: 'not_configured' }, 503);
      if (maxNonce) { const r: any = await maxNonceUser(db, maxNonce); if (r.pending) return json({ pending: true }); if (r.gone) return json({ error: 'expired' }, 410); u = r.user; }
      else u = await initDataUser(t, body.max_init);
    }
    else if (vkid) u = await vkIdUser(body.vkid_token);
    else { if (!(Deno.env.get('VK_APP_SECRET') || '').trim()) return json({ error: 'not_configured' }, 503); u = await vkLaunchUser(body.vk_launch); }
    if (!u?.id) return json({ error: 'bad_signature' }, 403);

    const T = plat === 'max' ? { table: 'max_accounts', key: 'max_id' } : plat === 'vk' ? { table: 'vk_accounts', key: 'vk_id' } : { table: 'tg_accounts', key: 'tg_id' };
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 24) || u.username || (plat === 'max' ? 'MAX' : plat === 'vk' ? 'VK' : 'Telegram');
    const extra = plat === 'tg' ? { username: String(u.username || '').slice(0, 64) } : {};
    const { data: link } = await db.from(T.table).select('user_id').eq(T.key, u.id).maybeSingle();

    if (body.action === 'link') {   // привязать эту площадку к аккаунту, в который игрок уже вошёл
      const cur = await me(); if (!cur) return json({ error: 'bad_session' }, 401);
      if (link && link.user_id === cur.id) return json({ linked: true, already: true });
      if (link) {
        const { data: other } = await db.from('profiles').select('data, progress, is_tester').eq('id', link.user_id).maybeSingle();
        const st = (other?.data && other.data.st) || {}, pr = other?.progress || {};
        const busy = !!other?.is_tester || Number(st.earned || 0) > 0 || Number(st.chapters || 0) > 0 || Number(st.fares || 0) > 0 || Object.keys(pr.eps || {}).length > 0 || !!pr.last;
        if (busy) return json({ error: 'linked_other' }, 409);
        await db.auth.admin.deleteUser(link.user_id);   // пустой аккаунт этой площадки: удаляем вместе со связкой (каскад)
      }
      const { error } = await db.from(T.table).upsert({ [T.key]: u.id, user_id: cur.id, name, ...extra });
      return error ? json({ error: 'link_failed' }, 500) : json({ linked: true });
    }

    if (code) {   // эта площадка теперь входит в аккаунт кода
      const target = await useCode(db, code); if (!target) return json({ error: 'bad_code' }, 403);
      if (link && link.user_id !== target) await db.from(T.table).delete().eq(T.key, u.id);
      const { error } = await db.from(T.table).upsert({ [T.key]: u.id, user_id: target, name, ...extra });
      if (error) return json({ error: 'already_linked' }, 409);
      return await sessionFor(db, target, name);
    }

    let uid = link?.user_id as string | undefined;
    if (!uid) {
      const email = `${plat}${u.id}@${plat}.nightfare.invalid`;
      const made = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { [T.key]: u.id, name } });
      if (made.error || !made.data.user) return json({ error: 'create_failed' }, 500);
      uid = made.data.user.id;
      await db.from(T.table).insert({ [T.key]: u.id, user_id: uid, name, ...extra });
      await db.from('profiles').insert({ id: uid, login: `${plat}${u.id}`.slice(0, 24), name });
    } else await db.from(T.table).update({ name, ...extra }).eq(T.key, u.id);
    return await sessionFor(db, uid, name);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

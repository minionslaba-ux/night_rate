// Разовый кросс-промо пост в каналы «Ночного тарифа» (Telegram @nightfaregame и каналы MAX из nf_max_chats).
// Запуск только из базы (pg_net) с ключом расписания nf_settings.cron_key; каждый пост — один раз (метка nf_settings promo_<id>).
// Владелец подтвердил пост про «Мутацию» 10.11.2026.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TG = Deno.env.get('TELEGRAM_BOT_TOKEN') || '', MAXT = (Deno.env.get('MAX_BOT_TOKEN') || '').trim();
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
const setting = async (k: string) => ((await db.from('nf_settings').select('v').eq('k', k).maybeSingle()).data?.v ?? null) as string | null;

const PROMOS: Record<string, { img: string[]; tg: string; max: string }> = {
  mutaciya: {
    img: ['1-mutaciya', '2-mutanty', '3-skrimer', '4-ispytaniya'].map((n) => `https://minionslaba-ux.github.io/mutaciya/promo/${n}.jpg`),
    tg: `<b>🧪 «Мутация» — хоррор-головоломка прямо в браузере</b>

Бросай мутантов в банку с формалином. Две одинаковые твари сливаются в новую форму — от Капли до Матки. А каждая новая форма встречает тебя скримером.

— 15 мутантов и вирусы как под электронным микроскопом
— утечки формалина, трещины в стекле и кукла, которая смеётся
— 5 испытаний: лазер, дезинфекция, ультрафиолет, центрифуга, криокамера
— дневной забег и общая таблица рекордов

<a href="https://minionslaba-ux.github.io/mutaciya/">▶️ Играть бесплатно</a> — без установки. На телефоне можно добавить на главный экран, работает и офлайн.`,
    max: `🧪 «Мутация» — хоррор-головоломка прямо в браузере

Бросай мутантов в банку с формалином. Две одинаковые твари сливаются в новую форму — от Капли до Матки. А каждая новая форма встречает тебя скримером.

— 15 мутантов и вирусы как под электронным микроскопом
— утечки формалина, трещины в стекле и кукла, которая смеётся
— 5 испытаний: лазер, дезинфекция, ультрафиолет, центрифуга, криокамера
— дневной забег и общая таблица рекордов

Играть бесплатно, без установки: https://minionslaba-ux.github.io/mutaciya/`,
  },
};

async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, description: 'bad json' }));
}
async function maxApi(path: string, init: RequestInit = {}) {
  let last: any = null;
  for (const h of ['https://platform-api.max.ru', 'https://platform-api2.max.ru']) {
    try {
      const r = await fetch(h + path, { ...init, headers: { Authorization: MAXT, 'Content-Type': 'application/json', ...(init.headers || {}) } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      last = { error: j.message || j.code || `http ${r.status}` }; if (r.status < 500) return last;
    } catch (e) { last = { error: String(e).slice(0, 120) }; }
  }
  return last || { error: 'unknown' };
}
// картинка в MAX: загрузка файла через /uploads (тип image) → токен вложения
async function maxImage(url: string) {
  const up = await maxApi('/uploads?type=image', { method: 'POST' });
  if (!up?.url) return { error: 'uploads: ' + JSON.stringify(up).slice(0, 120) };
  const img = await fetch(url); if (!img.ok) return { error: 'image http ' + img.status };
  const fd = new FormData(); fd.append('data', new Blob([await img.arrayBuffer()], { type: 'image/jpeg' }), 'promo.jpg');
  const r = await fetch(up.url, { method: 'POST', body: fd, headers: { Authorization: MAXT } }); const j = await r.json().catch(() => ({}));
  const payload = j.photos ? { photos: j.photos } : j.token ? { token: j.token } : null;
  return payload ? { payload } : { error: 'upload result: ' + JSON.stringify(j).slice(0, 120) };
}

Deno.serve(async (req) => {
  const b = await req.json().catch(() => null), key = await setting('cron_key');
  if (!b || !key || b.key !== key || !PROMOS[b.promo]) return json({ error: 'forbidden' }, 403);
  const id = b.promo, P = PROMOS[id], mark = 'promo_' + id;
  if (await setting(mark)) return json({ skipped: 'already', at: await setting(mark) });
  await db.from('nf_settings').upsert({ k: mark, v: 'sending ' + new Date().toISOString() });
  const out: any = { tg: null, max: [] };
  // Telegram: альбом из 4 фото, подпись у первого; не вышло — одно фото с подписью; не вышло — текст
  let r = await tg('sendMediaGroup', { chat_id: '@nightfaregame', media: P.img.map((u, i) => (i ? { type: 'photo', media: u } : { type: 'photo', media: u, caption: P.tg, parse_mode: 'HTML' })) });
  if (r.ok) out.tg = { ok: true, ids: r.result.map((m: any) => m.message_id) };
  else {
    const e1 = r.description; r = await tg('sendPhoto', { chat_id: '@nightfaregame', photo: P.img[0], caption: P.tg, parse_mode: 'HTML' });
    out.tg = r.ok ? { ok: true, ids: [r.result.message_id], note: 'одно фото (альбом: ' + e1 + ')' } : { ok: false, error: e1 + ' / ' + r.description };
  }
  // MAX: каждый подключённый канал, фото 1 + текст; без фото — только текст
  if (MAXT) {
    const { data: chats } = await db.from('nf_max_chats').select('chat_id, title').eq('enabled', true).eq('is_channel', true).limit(10);
    const im = await maxImage(P.img[0]);
    for (const c of chats || []) {
      const body: any = { text: P.max };
      if ('payload' in im) body.attachments = [{ type: 'image', payload: im.payload }];
      let m = await maxApi(`/messages?chat_id=${c.chat_id}`, { method: 'POST', body: JSON.stringify(body) });
      let note = 'error' in im ? 'без фото: ' + im.error : '';
      if (!m?.message?.body?.mid && body.attachments) { note = 'без фото: ' + (m?.error || m?.message || '?'); m = await maxApi(`/messages?chat_id=${c.chat_id}`, { method: 'POST', body: JSON.stringify({ text: P.max }) }); }
      out.max.push({ chat: c.title || c.chat_id, mid: m?.message?.body?.mid || null, error: m?.message?.body?.mid ? null : (m?.error || '?'), note });
    }
  } else out.max = 'нет токена MAX';
  await db.from('nf_settings').upsert({ k: mark, v: JSON.stringify(out).slice(0, 900) });
  return json(out);
});

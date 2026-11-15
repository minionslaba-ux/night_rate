// Пикабу Игры: покупки и рейтинг задания дня.
// Покупки: игра присылает signedData покупки (JWT HS256, подписан секретным ключом игры из Студии), функция проверяет подпись
// ключом PIKABU_SECRET (секрет функций Supabase, его добавляет владелец), проверяет товар и записывает покупку в nf_pk_purchases
// (одна покупка — одна строка: повтор не создаёт второй записи). Ответ: { ok, productId, purchaseId, consumable, fresh }.
// Рейтинг задания дня (v144): { daily: { day, secs, name }, playerSigned } — подпись игрока (sdk.player.getSignedData()) проверяется
// тем же ключом, лучшее время дня хранится в nf_daily_pk; { dailyTop: day, me } — десятка лучших (чтение без подписи).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SECRET = (Deno.env.get('PIKABU_SECRET') || '').trim();
const PRODUCTS = new Set(['starter', 'coins5', 'coins20', 'noads', 'pass']);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function verify(token: string): Promise<Record<string, unknown> | null> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !SECRET) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0])));
    if (head.alg !== 'HS256') return null;   // only HS256, as the platform says
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    return JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1])));
  } catch (_) { return null; }
}

// the day by Moscow time; a finish just after midnight may still carry yesterday
const mskDay = (k = 0) => new Date(Date.now() + 3 * 3600e3 + k * 864e5).toISOString().slice(0, 10);
const cleanName = (s: unknown) => String(s || 'Игрок').replace(/[<>&"'\u0000-\u001f]/g, '').trim().slice(0, 24) || 'Игрок';

async function top(day: string, me: string) {
  const { data } = await db.from('nf_daily_pk').select('player_id, name, secs').eq('day', day).order('secs').order('updated_at').limit(10);
  return (data || []).map((r: any, i: number) => ({ place: i + 1, name: r.name, secs: r.secs, me: !!me && r.player_id === me }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: true, ready: !!SECRET });
  const b = await req.json().catch(() => null);
  // the day's ranking: read
  if (b && b.dailyTop) {
    const day = String(b.dailyTop).slice(0, 10);
    if (day !== mskDay() && day !== mskDay(-1)) return json({ ok: false, error: 'day' }, 400);
    return json({ ok: true, rows: await top(day, String(b.me || '').slice(0, 100)) });
  }
  if (!SECRET) return json({ ok: false, error: 'not_configured' }, 503);
  // the day's ranking: a finish (the player's signature from Пикабу)
  if (b && b.daily) {
    const p = await verify(b.playerSigned);
    if (!p) return json({ ok: false, error: 'bad_signature' }, 403);
    const pid = String(p.playerId || p.id || p.userId || '').slice(0, 100);
    const day = String(b.daily.day || '').slice(0, 10), secs = Math.round(Number(b.daily.secs));
    if (!pid) return json({ ok: false, error: 'no_player' }, 400);
    if (day !== mskDay() && day !== mskDay(-1)) return json({ ok: false, error: 'day' }, 400);
    if (!(secs >= 10 && secs <= 3600)) return json({ ok: false, error: 'secs' }, 400);
    const name = cleanName(p.name || p.nickname || b.daily.name);
    const { data: old } = await db.from('nf_daily_pk').select('secs').eq('day', day).eq('player_id', pid).maybeSingle();
    const improved = !old || secs < old.secs;
    if (improved) await db.from('nf_daily_pk').upsert({ day, player_id: pid, name, secs, updated_at: new Date().toISOString() }, { onConflict: 'day,player_id' });
    else await db.from('nf_daily_pk').update({ name }).eq('day', day).eq('player_id', pid);
    const best = improved ? secs : old!.secs;
    const { count } = await db.from('nf_daily_pk').select('player_id', { count: 'exact', head: true }).eq('day', day).lt('secs', best);
    return json({ ok: true, place: (count || 0) + 1, improved, best, rows: await top(day, pid) });
  }
  // a purchase
  const p = await verify(b && b.signedData);
  if (!p) return json({ ok: false, error: 'bad_signature' }, 403);
  const purchaseId = String(p.purchaseId || ''), productId = String(p.productId || '');
  if (!purchaseId || !PRODUCTS.has(productId)) return json({ ok: false, error: 'unknown_product' }, 400);
  const { data, error } = await db.from('nf_pk_purchases').upsert({ purchase_id: purchaseId, player_id: String(p.playerId || '').slice(0, 100), product_id: productId, consumable: !!p.isConsumable, test: !!p.isTestPurchase }, { onConflict: 'purchase_id', ignoreDuplicates: true }).select('purchase_id');
  if (error) return json({ ok: false, error: 'db' }, 500);
  return json({ ok: true, productId, purchaseId, consumable: !!p.isConsumable, test: !!p.isTestPurchase, fresh: !!(data && data.length) });
});

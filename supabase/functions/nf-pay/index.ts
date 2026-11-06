// Покупка монет через Робокассу — только на сайте.
// Секреты (добавляет владелец в Supabase → Edge Functions → Secrets, не в коде):
//   RK_LOGIN — идентификатор магазина, RK_PASS1 / RK_PASS2 — пароли #1 и #2
//   (в тестовом режиме — тестовые пароли из кабинета), RK_TEST = '1' — тестовые платежи.
// В кабинете Робокассы: Result URL = https://xqgibyazilueurdqufso.supabase.co/functions/v1/nf-pay (метод POST),
// Success URL = https://nightfaregame.com/?pay=ok, Fail URL = https://nightfaregame.com/?pay=fail, алгоритм подписи MD5.
//
// action 'packs'                      — список пакетов (цены — только здесь, клиенту не доверяем);
// action 'create' + access_token+pack — новый счёт, ответ { url } на оплату;
// action 'claim'  + access_token      — забрать оплаченные монеты: строки paid → claimed, ответ { coins };
// POST от Робокассы (form: OutSum, InvId, SignatureValue) — проверка подписи паролем #2, счёт → paid, ответ «OK<InvId>».
import { createClient } from 'npm:@supabase/supabase-js@2';
import { crypto as std } from 'jsr:@std/crypto@1';

const PACKS: Record<string, { rub: number; coins: number }> = {
  p100: { rub: 100, coins: 300 },
  p300: { rub: 300, coins: 1000 },
  p500: { rub: 500, coins: 1750 },
  p1000: { rub: 1000, coins: 3800 },
  p2000: { rub: 2000, coins: 8000 },
};
const env = (k: string) => Deno.env.get(k) || '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const md5 = async (s: string) => Array.from(new Uint8Array(await std.subtle.digest('MD5', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const ctype = req.headers.get('content-type') || '';

  // ---- уведомление Робокассы об оплате (form-urlencoded) ----
  if (!ctype.includes('application/json')) {
    const f = new URLSearchParams(await req.text());
    const outSum = f.get('OutSum') || '', invId = f.get('InvId') || '', sig = (f.get('SignatureValue') || '').toLowerCase();
    if (!env('RK_PASS2') || !outSum || !/^\d+$/.test(invId)) return new Response('bad request', { status: 400 });
    // пользовательских Shp_-параметров мы не передаём, поэтому подпись — OutSum:InvId:Пароль#2
    if ((await md5(`${outSum}:${invId}:${env('RK_PASS2')}`)) !== sig) return new Response('bad sign', { status: 403 });
    const { data: row } = await db.from('nf_payments').select('inv_id, rub, status').eq('inv_id', Number(invId)).maybeSingle();
    if (!row) return new Response('no invoice', { status: 404 });
    if (Math.abs(Number(outSum) - row.rub) > 0.009) return new Response('bad sum', { status: 400 });
    if (row.status === 'new') await db.from('nf_payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('inv_id', row.inv_id).eq('status', 'new');
    return new Response('OK' + invId, { headers: { 'Content-Type': 'text/plain' } });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (body.action === 'packs') return json({ packs: PACKS, ready: !!(env('RK_LOGIN') && env('RK_PASS1') && env('RK_PASS2')), test: env('RK_TEST') === '1' });
  const user = body.access_token ? (await db.auth.getUser(String(body.access_token))).data.user : null;
  if (!user) return json({ error: 'bad_session' }, 401);

  if (body.action === 'create') {
    if (!env('RK_LOGIN') || !env('RK_PASS1') || !env('RK_PASS2')) return json({ error: 'not_configured' }, 503);
    const p = PACKS[String(body.pack)]; if (!p) return json({ error: 'bad_pack' }, 400);
    const test = env('RK_TEST') === '1';
    const { data: row, error } = await db.from('nf_payments').insert({ user_id: user.id, pack: String(body.pack), rub: p.rub, coins: p.coins, test }).select('inv_id').single();
    if (error || !row) return json({ error: 'db' }, 500);
    const outSum = p.rub.toFixed(2), inv = String(row.inv_id);
    const q = new URLSearchParams({ MerchantLogin: env('RK_LOGIN'), OutSum: outSum, InvId: inv, Description: `Ночной тариф: ${p.coins} монет`, Culture: 'ru', SignatureValue: await md5(`${env('RK_LOGIN')}:${outSum}:${inv}:${env('RK_PASS1')}`) });
    if (test) q.set('IsTest', '1');
    return json({ url: 'https://auth.robokassa.ru/Merchant/Index.aspx?' + q.toString(), inv_id: row.inv_id });
  }

  if (body.action === 'claim') {
    // paid → claimed одной операцией: одни и те же монеты не выдаются дважды, даже при двух вкладках
    const { data: rows, error } = await db.from('nf_payments').update({ status: 'claimed', claimed_at: new Date().toISOString() }).eq('user_id', user.id).eq('status', 'paid').select('coins');
    if (error) return json({ error: 'db' }, 500);
    return json({ coins: (rows || []).reduce((s: number, r: { coins: number }) => s + r.coins, 0), n: (rows || []).length });
  }
  return json({ error: 'action' }, 400);
});

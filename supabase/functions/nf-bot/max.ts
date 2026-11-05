// Канал игры в MAX: те же посты, что в Telegram-канале, но с кнопкой «▶ Играть», которая открывает игру прямо в MAX
// (мини-приложение бота se14877440_1_bot, вход без регистрации). Если MAX не примет такую кнопку — кнопка-ссылка на сайт.
// Токен бота — секрет MAX_BOT_TOKEN. Каналы — таблица nf_max_chats: их сохраняет вебхук MAX в функции nf-login
// (событие bot_added или пост в канале). Подписка вебхука — GET …/nf-login?max_setup=1 (её делает /maxsetup).
const HOSTS = ['https://platform-api.max.ru', 'https://platform-api2.max.ru'];
export const MAX_BOT = 'se14877440_1_bot';
const SITE = 'https://nightfaregame.com/?utm_source=max';
export const maxOn = () => !!(Deno.env.get('MAX_BOT_TOKEN') || '').trim();

export async function maxApi(path: string, init: RequestInit = {}): Promise<any> {
  const token = (Deno.env.get('MAX_BOT_TOKEN') || '').trim();
  if (!token) return { error: 'no_token' };
  let last: any = null;
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + path, { ...init, headers: { Authorization: token, 'Content-Type': 'application/json', ...(init.headers || {}) } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      last = { error: j.message || j.code || `http ${r.status}` };
      if (r.status < 500) return last;   // ошибка запроса — второй адрес не поможет
    } catch (e) { last = { error: String(e).slice(0, 120) }; }
  }
  return last || { error: 'unknown' };
}

const kb = (button: Record<string, string>) => [{ type: 'inline_keyboard', payload: { buttons: [[button]] } }];
// MAX понимает только простые теги; ссылки и <code> упрощаем
const toMaxHtml = (h: string) => h.replace(/<\/?code>/g, '').replace(/<a [^>]*>([^<]*)<\/a>/g, '$1');
// сообщение с кнопкой «▶ Играть» (open_app); не принял — кнопка-ссылка на сайт. Возвращает id сообщения или ошибку.
export async function maxSendPlay(chatId: number, html: string, start = 'channel'): Promise<{ mid?: string; error?: string }> {
  const send = (attachments: any) => maxApi(`/messages?chat_id=${chatId}`, { method: 'POST', body: JSON.stringify({ text: toMaxHtml(html).slice(0, 3900), format: 'html', attachments }) });
  let r = await send(kb({ type: 'open_app', text: '▶ Играть', web_app: MAX_BOT, payload: start }));
  if (!r?.message?.body?.mid) r = await send(kb({ type: 'link', text: '▶ Играть', url: SITE }));
  return r?.message?.body?.mid ? { mid: String(r.message.body.mid) } : { error: String(r?.error || r?.message || 'ошибка').slice(0, 160) };
}

// пост во все каналы MAX игры; daily — не чаще раза в день (по Москве). Итог одной строкой для владельца.
export async function maxBroadcast(db: any, html: string, daily = false): Promise<{ ok: number; note: string }> {
  if (!maxOn()) return { ok: 0, note: 'ℹ️ MAX: нет токена бота.' };
  const { data: all } = await db.from('nf_max_chats').select('chat_id, title, last_post').eq('enabled', true).eq('is_channel', true).limit(10);
  if (!all?.length) return { ok: 0, note: 'ℹ️ MAX: канал не подключён (/maxsetup).' };
  const day = (t: number) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
  const chats = all.filter((c: any) => !daily || !c.last_post || day(Date.parse(c.last_post)) < day(Date.now()));
  let ok = 0; const bad: string[] = [];
  for (const c of chats) {
    const r = await maxSendPlay(Number(c.chat_id), html);
    if (r.mid) { ok++; await db.from('nf_max_chats').update({ last_post: new Date().toISOString() }).eq('chat_id', c.chat_id); }
    else bad.push(`«${c.title || c.chat_id}»: ${r.error}`);
  }
  return { ok, note: bad.length ? `⚠️ MAX: ${bad.join('; ')}` : ok ? '✅ MAX: опубликовано в канале.' : 'ℹ️ MAX: сегодня пост уже был.' };
}

// закреплённое сообщение с кнопкой «Играть» в каналах MAX: публикуем заново и закрепляем
export async function maxPin(db: any, html: string): Promise<string[]> {
  const { data: chats } = await db.from('nf_max_chats').select('chat_id, title').eq('enabled', true).eq('is_channel', true).limit(10);
  const out: string[] = [];
  for (const c of chats || []) {
    const r = await maxSendPlay(Number(c.chat_id), html, 'pin');
    if (!r.mid) { out.push(`«${c.title || c.chat_id}»: ❌ ${r.error}`); continue; }
    const pin = await maxApi(`/chats/${c.chat_id}/pin`, { method: 'PUT', body: JSON.stringify({ message_id: r.mid, notify: false }) });
    await db.from('nf_max_chats').update({ pin_mid: r.mid }).eq('chat_id', c.chat_id);
    out.push(`«${c.title || c.chat_id}»: ✅ опубликовано${pin?.success ? ' и закреплено' : ` (закрепить не вышло: ${pin?.error || pin?.message || '?'} — закрепите вручную)`}`);
  }
  return out;
}

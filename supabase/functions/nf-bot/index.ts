// Бот @night_fare_bot «Ночной тариф»: вебхук Telegram (по образцу tg-bot из «Выжить до пятницы»).
// • Всем в личке: /start и /play — кнопка, открывающая игру.
// • Владельцу (таблица nf_admins, по Telegram ID): статистика, игроки, чат и жалобы, ошибки, идеи, рассылка, выгрузка. Список — /help.
//   Всё, что уходит людям (/broadcast), сначала показывается превью с кнопками «Отправить» / «Отмена» (черновик в nf_drafts).
// • Подключение вебхука и меню команд (один раз и после изменений): GET …/functions/v1/nf-bot?setup=1. Чужой вебхук не перезаписывается без &force=1.
// • Канал @nightfaregame: ежедневный пост (pg_cron, 19:07 МСК, POST {daily: ключ из nf_settings.cron_key}; не больше одного в день — nf_posts),
//   /news — новость в канал с превью, /postnow — сегодняшний пост сейчас, /autopost on|off, /pin — закреплённое сообщение с быстрым меню.
// Запросы от Telegram проверяются секретом, выведенным из токена бота (TELEGRAM_BOT_TOKEN в секретах функций; его добавляет владелец).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { dailyPost, msk as mskNow } from './posts.ts';

const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/nf-bot`;
const SITE = 'https://nightfaregame.com/';
const CHANNEL = '@nightfaregame', BOT_START = 'https://t.me/night_fare_bot?start=channel', VK_GROUP = 'https://vk.ru/club242985713';
// в канале нельзя кнопку web_app — только ссылки
const channelBtn = { inline_keyboard: [[{ text: '🚕 Играть в Telegram', url: BOT_START }], [{ text: '🌐 Играть на сайте', url: SITE }]] };
const setting = async (k: string) => ((await db.from('nf_settings').select('v').eq('k', k).maybeSingle()).data?.v ?? null) as string | null;
const setSetting = (k: string, v: string) => db.from('nf_settings').upsert({ k, v });
const toChannel = (text: string) => api('sendMessage', { chat_id: CHANNEL, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: channelBtn });
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const api = async (method: string, body: Record<string, unknown> = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
};
const secret = async () => {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nf-webhook:' + token)));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 48);
};
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const MSK = 3 * 3600e3;
const msk = (t?: string | null) => (t ? new Date(new Date(t).getTime() + MSK).toISOString().slice(0, 16).replace('T', ' ') : '—');
// начало суток по Москве, сдвиг в днях (0 — сегодня, -1 — вчера)
const mskDay = (d: number) => new Date(Math.floor((Date.now() + MSK) / 864e5) * 864e5 - MSK + d * 864e5).toISOString();
const n = (x: unknown) => Number(x || 0).toLocaleString('ru-RU');
const playBtn = { inline_keyboard: [[{ text: '🚕 Играть', web_app: { url: SITE } }], [{ text: 'Открыть в браузере', url: SITE }], [{ text: '📢 Канал игры', url: 'https://t.me/nightfaregame' }]] };
const kb = (rows: [string, string][][]) => ({ inline_keyboard: rows.map((r) => r.map(([text, callback_data]) => ({ text, callback_data }))) });

const PUBLIC_COMMANDS = [{ command: 'start', description: 'Открыть игру' }, { command: 'play', description: 'Кнопка «Играть»' }];
const ADMIN_COMMANDS = [
  { command: 'help', description: 'Все команды' },
  { command: 'stats', description: 'Отчёт за сегодня' },
  { command: 'yesterday', description: 'Отчёт за вчера' },
  { command: 'week', description: 'Отчёт за 7 дней' },
  { command: 'online', description: 'Кто играл последние 15 минут' },
  { command: 'new', description: 'Новые игроки за сегодня' },
  { command: 'top', description: 'Лучшие игроки' },
  { command: 'find', description: 'Найти игрока: /find имя' },
  { command: 'player', description: 'Карточка игрока: /player логин' },
  { command: 'chat', description: 'Последние сообщения чата' },
  { command: 'hide', description: 'Скрыть / вернуть сообщение: /hide номер' },
  { command: 'reports', description: 'Жалобы на чат и голос' },
  { command: 'ban', description: 'Закрыть чат игроку: /ban логин' },
  { command: 'unban', description: 'Открыть чат игроку: /unban логин' },
  { command: 'tester', description: 'Тестовый режим: /tester логин on|off' },
  { command: 'errors', description: 'Ошибки у игроков за 7 дней' },
  { command: 'health', description: 'Всё ли работает' },
  { command: 'news', description: 'Новость в канал: /news текст' },
  { command: 'postnow', description: 'Сегодняшний автопост в канал — сейчас' },
  { command: 'autopost', description: 'Автопосты в канал: /autopost on|off' },
  { command: 'pin', description: 'Закреплённое меню в канале' },
  { command: 'broadcast', description: 'Сообщение подписчикам бота: /broadcast текст' },
  { command: 'export', description: 'Игроки в Excel' },
  { command: 'idea', description: 'Что поправить в игре: /idea текст' },
  { command: 'ideas', description: 'Список идей и что с ними сделано' },
];
const HELP = `🛠 <b>Команды владельца «Ночного тарифа»</b>

📊 <b>Статистика</b>
/stats — сегодня · /yesterday — вчера · /week — 7 дней
/online — кто играл последние 15 минут
/new — новые игроки за сегодня
/top — лучшие игроки (заработано за всё время)
/find имя — найти игрока · /player логин — карточка игрока
/export — все игроки в Excel

💬 <b>Чат и модерация</b>
/chat — последние сообщения (с номерами)
/hide номер — скрыть сообщение (ещё раз — вернуть)
/reports — жалобы на сообщения и на голос
/ban логин · /unban логин — закрыть / открыть чат и голос игроку

🧪 <b>Игра</b>
/tester логин on|off — тестовый режим (бессмертие, все главы)
/errors — ошибки у игроков за 7 дней
/health — сайт, версия, база, вебхук

📢 <b>Канал @nightfaregame</b> (сначала превью, потом «Отправить»)
/news текст — новость в канал
/postnow — сегодняшний автопост сейчас (обычно сам выходит в 19:07 МСК)
/autopost on · off — включить или выключить ежедневные посты
/pin — опубликовать или обновить закреплённое меню с кнопками

📣 <b>Рассылка</b> (сначала превью, потом кнопка «Отправить»)
/broadcast текст — личное сообщение всем, кто нажал /start в боте

🛠 <b>Правки игры</b>
/idea текст — что поправить или добавить. Потом напишите в сессию Claude «посмотри идеи из бота»
/ideas — последние идеи и что с ними сделано`;

const IDEA_ST: Record<string, string> = { new: '🆕 ждёт', in_progress: '⏳ в работе', done: '✅ сделано', skipped: '⏭ не взято', question: '❓ нужен ответ' };

async function isAdmin(tg?: number) {
  if (!tg) return false;
  const { data } = await db.from('nf_admins').select('tg_id').eq('tg_id', tg).maybeSingle();
  return !!data;
}
async function findProfile(q: string) {
  const s = q.trim().replace(/^@/, '');
  if (!s) return null;
  let { data } = await db.from('profiles').select('*').eq('login', s).maybeSingle();
  if (!data && /^\d+$/.test(s)) { const t = await db.from('tg_accounts').select('user_id').eq('tg_id', +s).maybeSingle(); if (t.data) data = (await db.from('profiles').select('*').eq('id', t.data.user_id).maybeSingle()).data; }
  if (!data) { const t = await db.from('tg_accounts').select('user_id').ilike('username', s).maybeSingle(); if (t.data) data = (await db.from('profiles').select('*').eq('id', t.data.user_id).maybeSingle()).data; }
  return data;
}
const pName = (p: any) => `${esc(p.name || 'Игрок')} (<code>${esc(p.login || p.id.slice(0, 8))}</code>)`;

async function report(title: string, from: string, to: string) {
  const c = async (table: string, col: string, extra?: (q: any) => any) => {
    let q = db.from(table).select('*', { count: 'exact', head: true }).gte(col, from).lt(col, to);
    if (extra) q = extra(q);
    return (await q).count || 0;
  };
  const total = (await db.from('profiles').select('*', { count: 'exact', head: true })).count || 0;
  const [nw, act, msgs, errs, bots, ideas] = await Promise.all([c('profiles', 'created_at'), c('profiles', 'updated_at'), c('chat_messages', 'created_at'), c('client_errors', 'created_at'), c('nf_bot_users', 'started_at'), c('nf_ideas', 'created_at')]);
  const [tg, vk, mx] = await Promise.all(['tg_accounts', 'vk_accounts', 'max_accounts'].map((t) => c(t, 'created_at')));
  return `📊 <b>${title}</b>\n\n👥 Игроков всего: <b>${n(total)}</b>\n🆕 Новых: <b>${n(nw)}</b> (Telegram ${n(tg)} · ВК ${n(vk)} · MAX ${n(mx)})\n🚕 Заходили в игру: <b>${n(act)}</b>\n💬 Сообщений в чате: ${n(msgs)}\n⚠️ Ошибок у игроков: ${n(errs)}${errs ? ' — /errors' : ''}\n🤖 Новых подписчиков бота: ${n(bots)}\n📝 Идей: ${n(ideas)}`;
}

// итоги недели для воскресного поста — только настоящие цифры
async function weekStats() {
  const from = new Date(Date.now() - 7 * 864e5).toISOString();
  const { count: nw } = await db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', from);
  const { count: act } = await db.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', from);
  const { data } = await db.from('profiles').select('name, data').gte('updated_at', from).limit(2000);
  let fares = 0, tasks = 0; const top: [string, number][] = [];
  for (const p of data || []) { const st = (p.data && p.data.st) || {}; fares += Number(st.fares || 0); tasks += Number(st.tasks || 0); top.push([p.name || 'Игрок', Number(st.earned || 0)]); }
  top.sort((a, b) => b[1] - a[1]);
  const t3 = top.filter((x) => x[1] > 0).slice(0, 3).map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(x[0])} — ${n(x[1])} монет`).join('\n');
  return `📊 <b>Неделя в Порт-Северном</b>\n\n👥 Водителей за рулём: <b>${n(act)}</b>${nw ? ` (новых — ${n(nw)})` : ''}\n🚕 Поездок такси у них всего: ${n(fares)}\n📋 Выполнено заданий: ${n(tasks)}${t3 ? `\n\n<b>Лучшие водители</b> (заработано всего)\n${t3}` : ''}\n\nНовая неделя — новые заказы. До встречи на смене!`;
}
const PIN_TEXT = `🚕 <b>«Ночной тариф»</b> — ночной город, такси, погони и перестрелки.\n\n• Сюжет из 14 эпизодов\n• Открытый город: другие игроки, чат, группы с друзьями\n• 60 000 заданий, гараж и тюнинг\n\nИграйте в Telegram или на сайте — профиль общий. Новости игры — здесь, в канале.`;
const pinBtn = { inline_keyboard: [[{ text: '🚕 Играть в Telegram', url: BOT_START }], [{ text: '🌐 Играть на сайте', url: SITE }], [{ text: '👥 Группа ВКонтакте', url: VK_GROUP }]] };
async function pinMenu() {
  const old = Number(await setting('pin_msg')) || 0;
  if (old) { const r = await api('editMessageText', { chat_id: CHANNEL, message_id: old, text: PIN_TEXT, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: pinBtn }); if (r.ok || /not modified/.test(r.description || '')) return { ok: true, updated: true }; }
  const m = await api('sendMessage', { chat_id: CHANNEL, text: PIN_TEXT, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: pinBtn });
  if (!m.ok) return { ok: false, error: m.description };
  await setSetting('pin_msg', String(m.result.message_id));
  const pin = await api('pinChatMessage', { chat_id: CHANNEL, message_id: m.result.message_id, disable_notification: true });
  return { ok: true, pinned: pin.ok, error: pin.ok ? '' : pin.description };
}
// ежедневный пост: вызывает pg_cron; один пост в день
async function dailyRun(force = false) {
  if (!force && (await setting('autopost')) === 'off') return { skipped: 'off' };
  const day = mskNow().toISOString().slice(0, 10);
  const { data: done } = await db.from('nf_posts').select('day').eq('day', day).maybeSingle();
  if (done) return { skipped: 'already' };
  const text = await dailyPost(weekStats);
  const r = await toChannel(text);
  if (!r.ok) return { ok: false, error: r.description };
  await db.from('nf_posts').insert({ day, kind: 'daily', message_id: r.result.message_id });
  return { ok: true };
}

async function exportUsers(chatId: number) {
  const { data: ps } = await db.from('profiles').select('id, login, name, data, is_tester, chat_banned, created_at, updated_at').order('created_at').limit(10000);
  const { data: tgs } = await db.from('tg_accounts').select('user_id, tg_id, username');
  const tg = new Map((tgs || []).map((t: any) => [t.user_id, t]));
  const rows = (ps || []).map((p: any) => {
    const t: any = tg.get(p.id), st = p.data?.st || {};
    return { 'Имя': p.name, 'Логин': p.login, 'Telegram': t?.username ? '@' + t.username : '', 'Telegram ID': t?.tg_id || '', 'Регистрация (МСК)': msk(p.created_at), 'Последний визит (МСК)': msk(p.updated_at),
      'Монет': p.data?.coins ?? '', 'Заработано': st.earned ?? '', 'Глав пройдено': st.chapters ?? '', 'Поездок такси': st.fares ?? '', 'Машин': (p.data?.cars || []).length, 'Тестер': p.is_tester ? 'да' : '', 'Чат закрыт': p.chat_banned ? 'да' : '' };
  });
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [18, 16, 16, 13, 17, 17, 9, 11, 9, 9, 7, 7, 9].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Игроки');
  const day = msk(new Date().toISOString()).slice(0, 10), fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('caption', `👥 Игроки «Ночного тарифа» на ${day}: ${rows.length}. В файле личные данные — не пересылайте его посторонним.`);
  fd.append('document', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `igroki-${day}.xlsx`);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd });
}

async function adminCommand(cmd: string, rest: string, chatId: number, tg: number): Promise<boolean> {
  const say = (text: string, extra: Record<string, unknown> = {}) => api('sendMessage', { chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
  const arg = rest.trim();
  switch (cmd) {
    case 'help': await say(HELP); return true;
    case 'stats': case 'today': await say(await report('Сегодня', mskDay(0), new Date(Date.now() + 1000).toISOString())); return true;
    case 'yesterday': await say(await report('Вчера', mskDay(-1), mskDay(0))); return true;
    case 'week': await say(await report('7 дней', mskDay(-7), new Date(Date.now() + 1000).toISOString())); return true;
    case 'online': {
      const { data } = await db.from('profiles').select('id, login, name, updated_at').gte('updated_at', new Date(Date.now() - 15 * 60e3).toISOString()).order('updated_at', { ascending: false }).limit(30);
      await say(data?.length ? `🟢 <b>Играли последние 15 минут: ${data.length}</b>\n${data.map((p: any) => `• ${pName(p)} — ${msk(p.updated_at).slice(11)}`).join('\n')}\n\n<i>Считаются игроки с профилем: их прогресс сохранялся.</i>` : 'За последние 15 минут никто с профилем не играл.');
      return true;
    }
    case 'new': {
      const { data } = await db.from('profiles').select('id, login, name, created_at').gte('created_at', mskDay(0)).order('created_at', { ascending: false }).limit(40);
      await say(data?.length ? `🆕 <b>Новые за сегодня: ${data.length}</b>\n${data.map((p: any) => `• ${pName(p)} — ${msk(p.created_at).slice(11)}`).join('\n')}` : 'Сегодня новых игроков нет.');
      return true;
    }
    case 'top': {
      const { data } = await db.from('profiles').select('id, login, name, data').limit(2000);
      const top = (data || []).map((p: any) => ({ p, e: Number(p.data?.st?.earned || 0), ch: Number(p.data?.st?.chapters || 0) })).sort((a, b) => b.e - a.e).slice(0, 10);
      await say(top.length ? `🏆 <b>Лучшие игроки</b> (заработано за всё время)\n${top.map((x, i) => `${i + 1}. ${pName(x.p)} — ${n(x.e)} монет · глав ${x.ch}`).join('\n')}` : 'Пока пусто.');
      return true;
    }
    case 'find': {
      if (arg.length < 2) { await say('Напишите имя или логин: <code>/find Саня</code>'); return true; }
      const like = `%${arg.replace(/[%_]/g, '')}%`;
      const { data } = await db.from('profiles').select('id, login, name, updated_at').or(`name.ilike.${like},login.ilike.${like}`).limit(20);
      const { data: t } = await db.from('tg_accounts').select('user_id, username').ilike('username', like).limit(10);
      const extra = (t || []).filter((x: any) => !(data || []).some((p: any) => p.id === x.user_id)).map((x: any) => `• @${esc(x.username)} → /player ${esc(x.username)}`);
      const rows = (data || []).map((p: any) => `• ${pName(p)} — был ${msk(p.updated_at)}`).concat(extra);
      await say(rows.length ? `🔎 <b>Найдено: ${rows.length}</b>\n${rows.join('\n')}\n\nКарточка: /player логин` : 'Никого не нашёл.');
      return true;
    }
    case 'player': {
      const p = await findProfile(arg);
      if (!p) { await say('Не нашёл. Укажите логин, Telegram ID или @ник: <code>/player tg344759585</code>'); return true; }
      const { data: t } = await db.from('tg_accounts').select('tg_id, username').eq('user_id', p.id).maybeSingle();
      const { count: msgs } = await db.from('chat_messages').select('*', { count: 'exact', head: true }).eq('user_id', p.id);
      const { count: vr } = await db.from('voice_reports').select('*', { count: 'exact', head: true }).eq('reported', p.id);
      const d = p.data || {}, st = d.st || {};
      await say(`👤 <b>${esc(p.name || 'Игрок')}</b>\nЛогин: <code>${esc(p.login)}</code>${t ? `\nTelegram: ${t.username ? '@' + esc(t.username) : '—'} (<code>${t.tg_id}</code>)` : ''}\nРегистрация: ${msk(p.created_at)}\nПоследний визит: ${msk(p.updated_at)}\n\n💰 Монет: ${n(d.coins)} · заработано ${n(st.earned)}\n🚕 Машин: ${(d.cars || []).length} (сейчас «${esc(d.car || 'taxi')}») · поездок такси ${n(st.fares)}\n📖 Глав пройдено: ${n(st.chapters)} · сбито машин ${n(st.carKills)}\n💬 Сообщений в чате: ${n(msgs)} · жалоб на голос: ${n(vr)}\n${p.is_tester ? '🧪 Тестер (бессмертие, все главы)\n' : ''}${p.chat_banned ? '🔇 Чат и голос закрыты\n' : ''}`);
      return true;
    }
    case 'chat': {
      const { data } = await db.from('chat_messages').select('id, room, name, body, hidden, created_at').order('id', { ascending: false }).limit(20);
      await say(data?.length ? `💬 <b>Последние сообщения</b>\n${data.reverse().map((m: any) => `${m.hidden ? '🙈 ' : ''}<code>${m.id}</code> ${msk(m.created_at).slice(5)} <b>${esc(m.name)}</b>: ${esc(m.body)}`).join('\n')}\n\nСкрыть: /hide номер` : 'В чате пока пусто.');
      return true;
    }
    case 'hide': {
      const id = parseInt(arg, 10);
      if (!id) { await say('Укажите номер сообщения из /chat: <code>/hide 12</code>'); return true; }
      const { data: m } = await db.from('chat_messages').select('id, hidden, name, body').eq('id', id).maybeSingle();
      if (!m) { await say('Нет такого сообщения.'); return true; }
      await db.from('chat_messages').update({ hidden: !m.hidden }).eq('id', id);
      await say(`${m.hidden ? '👁 Вернул' : '🙈 Скрыл'} сообщение ${id} — <b>${esc(m.name)}</b>: ${esc(m.body)}`);
      return true;
    }
    case 'reports': {
      const { data: r } = await db.from('chat_reports').select('message_id, created_at').gte('created_at', mskDay(-7));
      const by = new Map<number, number>(); for (const x of r || []) by.set(x.message_id, (by.get(x.message_id) || 0) + 1);
      const ids = [...by.keys()].slice(0, 30);
      const { data: ms } = ids.length ? await db.from('chat_messages').select('id, user_id, name, body, hidden').in('id', ids) : { data: [] };
      const { data: v } = await db.from('voice_reports').select('reported, reason, created_at').gte('created_at', mskDay(-7)).order('created_at', { ascending: false }).limit(30);
      const vp = new Map<string, number>(); for (const x of v || []) vp.set(x.reported, (vp.get(x.reported) || 0) + 1);
      const { data: vprof } = vp.size ? await db.from('profiles').select('id, login, name').in('id', [...vp.keys()]) : { data: [] };
      const a = (ms || []).sort((x: any, y: any) => (by.get(y.id) || 0) - (by.get(x.id) || 0)).map((m: any) => `• ⚑${by.get(m.id)} ${m.hidden ? '🙈 ' : ''}<code>${m.id}</code> <b>${esc(m.name)}</b>: ${esc(m.body)}`);
      const b = (vprof || []).map((p: any) => `• 🎙 ${vp.get(p.id)} — ${pName(p)}`);
      await say(a.length || b.length ? `⚑ <b>Жалобы за 7 дней</b>\n${a.length ? '<b>Чат:</b>\n' + a.join('\n') : ''}${b.length ? '\n<b>Голос:</b>\n' + b.join('\n') : ''}\n\nСкрыть: /hide номер · закрыть чат: /ban логин` : 'Жалоб за неделю нет. 👍');
      return true;
    }
    case 'ban': case 'unban': {
      const p = await findProfile(arg);
      if (!p) { await say(`Укажите логин: <code>/${cmd} tg123456</code>`); return true; }
      await db.from('profiles').update({ chat_banned: cmd === 'ban' }).eq('id', p.id);
      await say(cmd === 'ban' ? `🔇 ${pName(p)}: чат и голос закрыты.` : `🔊 ${pName(p)}: чат и голос снова открыты.`);
      return true;
    }
    case 'tester': {
      const [who, mode] = arg.split(/\s+/);
      const p = await findProfile(who || '');
      if (!p || !/^(on|off)$/i.test(mode || '')) { await say('Так: <code>/tester tg344759585 on</code> или <code>off</code>'); return true; }
      await db.from('profiles').update({ is_tester: /on/i.test(mode) }).eq('id', p.id);
      await say(/on/i.test(mode) ? `🧪 ${pName(p)}: тестовый режим включён (бессмертие, все главы). Сработает при следующем входе.` : `${pName(p)}: тестовый режим выключен.`);
      return true;
    }
    case 'errors': {
      const { data } = await db.from('client_errors').select('ver, platform, browser, msg, created_at').gte('created_at', mskDay(-7)).order('created_at', { ascending: false }).limit(300);
      const g = new Map<string, { k: number; last: string; ver: string; dev: string }>();
      for (const e of data || []) { const k = String(e.msg).slice(0, 140); const x = g.get(k); if (x) x.k++; else g.set(k, { k: 1, last: e.created_at, ver: e.ver, dev: /iPhone|iPad/.test(e.browser) ? 'iPhone' : /Android/.test(e.browser) ? 'Android' : 'ПК' }); }
      const rows = [...g.entries()].sort((a, b) => b[1].k - a[1].k).slice(0, 15).map(([m, x]) => `• ×${x.k} <code>${esc(m)}</code>\n   ${x.ver} · ${x.dev} · последняя ${msk(x.last)}`);
      await say(rows.length ? `⚠️ <b>Ошибки за 7 дней: ${data!.length}</b>\n${rows.join('\n')}` : 'Ошибок за неделю нет. 👍');
      return true;
    }
    case 'health': {
      const t0 = Date.now();
      const site = await fetch(SITE, { headers: { 'cache-control': 'no-cache' } }).then(async (r) => ({ ok: r.ok, code: r.status, body: await r.text() })).catch((e) => ({ ok: false, code: 0, body: String(e) }));
      const ms = Date.now() - t0, ver = (site.body.match(/APP_VER = '([^']+)'/) || [])[1] || '?';
      const dbOk = !(await db.from('profiles').select('id', { head: true, count: 'exact' })).error;
      const wh = (await api('getWebhookInfo')).result || {};
      await say(`🩺 <b>Проверка</b>\n${site.ok ? '✅' : '❌'} Сайт: ${site.code} за ${ms} мс, версия <b>${esc(ver)}</b>\n${dbOk ? '✅' : '❌'} База данных\n${wh.url === SELF ? '✅' : '⚠️'} Вебхук бота${wh.pending_update_count ? ` · в очереди ${wh.pending_update_count}` : ''}${wh.last_error_message ? `\n⚠️ Последняя ошибка вебхука: ${esc(wh.last_error_message)} (${msk(new Date(wh.last_error_date * 1000).toISOString())})` : ''}`);
      return true;
    }
    case 'news': {
      if (arg.length < 3) { await say('Напишите текст: <code>/news Вышло обновление: погода и времена года!</code>\nСначала покажу превью, потом кнопка «Отправить» опубликует в канал @nightfaregame.'); return true; }
      const { data } = await db.from('nf_drafts').insert({ tg_id: tg, kind: 'news', payload: { text: arg.slice(0, 3500) } }).select('id').single();
      await say(`📢 <b>Превью новости для канала</b>:\n\n${esc(arg)}`, { reply_markup: kb([[['✅ Опубликовать', `adm:${data!.id}:send`], ['✖ Отмена', `adm:${data!.id}:cancel`]], [['Только мне (проверка)', `adm:${data!.id}:me`]]]) });
      return true;
    }
    case 'postnow': {
      const text = await dailyPost(weekStats);
      const { data } = await db.from('nf_drafts').insert({ tg_id: tg, kind: 'post', payload: { html: text } }).select('id').single();
      await say(`📅 <b>Сегодняшний автопост</b> (обычно выходит сам в 19:07 МСК):\n\n${text}`, { reply_markup: kb([[['✅ Опубликовать сейчас', `adm:${data!.id}:send`], ['✖ Отмена', `adm:${data!.id}:cancel`]]]) });
      return true;
    }
    case 'autopost': {
      const v = arg.toLowerCase();
      if (v === 'on' || v === 'off') { await setSetting('autopost', v); await say(v === 'on' ? '✅ Автопосты в канал включены: каждый день в 19:07 МСК.' : '⏸ Автопосты в канал выключены. Включить — /autopost on'); return true; }
      await say(`Автопосты сейчас: <b>${(await setting('autopost')) === 'off' ? 'выключены' : 'включены'}</b>. Изменить: <code>/autopost on</code> или <code>/autopost off</code>`); return true;
    }
    case 'pin': {
      const r = await pinMenu();
      await say(r.ok ? (r.updated ? '📌 Закреплённое меню в канале обновлено.' : r.pinned ? '📌 Меню опубликовано и закреплено в канале.' : `📌 Меню опубликовано, но закрепить не вышло: ${esc(r.error)}. Дайте боту в канале право «Закреплять сообщения» (или «Редактировать сообщения») и повторите /pin.`) : `Не удалось опубликовать в канал: ${esc(r.error)}. Проверьте, что бот — админ канала с правом публикации.`);
      return true;
    }
    case 'broadcast': {
      if (arg.length < 3) { await say('Напишите текст: <code>/broadcast Вышла новая глава — «Северный экспресс»!</code>\nСначала покажу превью.'); return true; }
      const { count } = await db.from('nf_bot_users').select('*', { count: 'exact', head: true }).eq('blocked', false);
      const { data } = await db.from('nf_drafts').insert({ tg_id: tg, kind: 'broadcast', payload: { text: arg.slice(0, 3500) } }).select('id').single();
      await say(`📣 <b>Превью рассылки</b> — получат ${n(count)} подписчиков бота (кто нажал /start):\n\n${esc(arg)}`, { reply_markup: kb([[['✅ Отправить', `adm:${data!.id}:send`], ['✖ Отмена', `adm:${data!.id}:cancel`]], [['Только мне (проверка)', `adm:${data!.id}:me`]]]) });
      return true;
    }
    case 'export': await exportUsers(chatId); return true;
    case 'idea': {
      if (arg.length < 3) { await say('Напишите, что поправить: <code>/idea на АЗС слишком дорогой бензин</code>\nЧем конкретнее (где, что не так, как должно быть), тем точнее правка.'); return true; }
      const { data, error } = await db.from('nf_ideas').insert({ tg_id: tg, text: arg.slice(0, 3000) }).select('id').single();
      if (error) { await say(`Не сохранилось: ${esc(error.message)}`); return true; }
      const { count } = await db.from('nf_ideas').select('id', { count: 'exact', head: true }).eq('status', 'new');
      await say(`📝 Идея №${data.id} записана. В очереди: ${count ?? 1}.\nЧтобы Claude её сделал, напишите в сессию Claude «посмотри идеи из бота».`);
      return true;
    }
    case 'ideas': {
      const { data } = await db.from('nf_ideas').select('id, text, status, reply').order('id', { ascending: false }).limit(15);
      const rows = (data || []).map((x: any) => `№${x.id} ${IDEA_ST[x.status] || x.status} — ${esc(x.text.slice(0, 120))}${x.reply ? `\n   ↳ ${esc(x.reply.slice(0, 200))}` : ''}`);
      await say(rows.length ? `🛠 <b>Идеи</b>\n${rows.join('\n')}` : 'Идей пока нет. Напишите /idea текст.');
      return true;
    }
  }
  return false;
}

async function onCallback(cq: any) {
  const m = String(cq.data || '').match(/^adm:(\d+):(\w+)$/); if (!m) return;
  const tg = cq.from?.id, chatId = cq.message?.chat?.id;
  if (!(await isAdmin(tg))) return api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Только для владельца' });
  const { data: d } = await db.from('nf_drafts').select('*').eq('id', +m[1]).eq('tg_id', tg).maybeSingle();
  const done = async (text: string) => { await api('answerCallbackQuery', { callback_query_id: cq.id, text }); await api('editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }); };
  if (!d) return done('Черновик уже обработан');
  if (m[2] === 'cancel') { await db.from('nf_drafts').delete().eq('id', d.id); return done('Отменено'); }
  if (d.kind === 'news' || d.kind === 'post') {
    const html = d.kind === 'post' ? String(d.payload?.html || '') : `📢 ${esc(d.payload?.text)}`;
    if (m[2] === 'me') { await api('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', reply_markup: channelBtn }); return api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Отправил только вам' }); }
    if (m[2] !== 'send') return;
    await db.from('nf_drafts').delete().eq('id', d.id);
    const r = await toChannel(html);
    if (r.ok && d.kind === 'post') await db.from('nf_posts').upsert({ day: mskNow().toISOString().slice(0, 10), kind: 'daily', message_id: r.result.message_id });
    await done(r.ok ? 'Опубликовано' : 'Ошибка');
    return api('sendMessage', { chat_id: chatId, text: r.ok ? '✅ Опубликовано в канале @nightfaregame.' : `Не удалось опубликовать: ${r.description}. Проверьте, что бот — админ канала.` });
  }
  const text = `🚕 <b>Ночной тариф</b>\n\n${esc(d.payload?.text)}`;
  if (m[2] === 'me') { await api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: playBtn }); return api('answerCallbackQuery', { callback_query_id: cq.id, text: 'Отправил только вам' }); }
  if (m[2] !== 'send') return;
  await db.from('nf_drafts').delete().eq('id', d.id);
  await done('Отправляю…');
  const { data: users } = await db.from('nf_bot_users').select('tg_id').eq('blocked', false).limit(20000);
  let ok = 0, off = 0;
  for (const u of users || []) {
    const r = await api('sendMessage', { chat_id: u.tg_id, text, parse_mode: 'HTML', reply_markup: playBtn });
    if (r.ok) ok++; else if (r.error_code === 403) { off++; await db.from('nf_bot_users').update({ blocked: true }).eq('tg_id', u.tg_id); }
    await new Promise((res) => setTimeout(res, 40));  // ≤ 25 сообщений в секунду
  }
  await api('sendMessage', { chat_id: chatId, text: `📣 Рассылка отправлена: ${ok}${off ? `, бот заблокирован у ${off}` : ''}.` });
}

async function onMessage(msg: any) {
  const chat = msg.chat; if (chat?.type !== 'private') return;  // в группах бот пока молчит
  const m = String(msg.text || '').match(/^\/(\w+)(?:@\w+)?/); if (!m) return;
  const cmd = m[1].toLowerCase(), rest = String(msg.text || '').replace(/^\/\w+(@\w+)?\s*/, ''), from = msg.from || {};
  if (cmd === 'start' || cmd === 'play') {
    await db.from('nf_bot_users').upsert({ tg_id: from.id, name: [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 64), username: from.username || null, blocked: false }, { onConflict: 'tg_id' });
    await api('sendMessage', { chat_id: chat.id, parse_mode: 'HTML', reply_markup: playBtn,
      text: cmd === 'play' ? '🚕 «Ночной тариф» — жми «Играть».' : '🚕 <b>«Ночной тариф»</b> — ночной город, такси, погони и перестрелки.\n\nСюжет из 14 эпизодов, а в «Открытом городе» — другие игроки, чат, заказы такси и 60 000 заданий. Вход через Telegram — прогресс сохраняется.' });
    if (await isAdmin(from.id)) await api('sendMessage', { chat_id: chat.id, text: 'Вы владелец: команды — /help' });
    return;
  }
  if (await isAdmin(from.id)) { if (!(await adminCommand(cmd, rest, chat.id, from.id))) await api('sendMessage', { chat_id: chat.id, text: 'Не знаю такой команды. Все команды — /help' }); }
}

async function setup(force: boolean) {
  if (!token) return json({ error: 'not_configured: нет TELEGRAM_BOT_TOKEN' }, 503);
  const info = (await api('getWebhookInfo')).result || {};
  if (info.url && info.url !== SELF && !force) return json({ error: 'webhook_busy', url: info.url, hint: 'добавьте &force=1, чтобы перенастроить на nf-bot' }, 409);
  const wh = await api('setWebhook', { url: SELF, secret_token: await secret(), allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  const pub = await api('setMyCommands', { commands: PUBLIC_COMMANDS });
  const { data: admins } = await db.from('nf_admins').select('tg_id');
  const adm = [];
  for (const a of admins || []) adm.push((await api('setMyCommands', { commands: ADMIN_COMMANDS, scope: { type: 'chat', chat_id: a.tg_id } })).ok);
  return json({ webhook: wh.ok, description: wh.description, public_commands: pub.ok, admin_menus: adm });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.get('setup') === '1') return setup(url.searchParams.get('force') === '1');
    return json({ ok: true });
  }
  if (!token) return json({ error: 'not_configured' }, 503);
  if (!req.headers.get('x-telegram-bot-api-secret-token')) {   // не Telegram: расписание (pg_cron) с ключом из базы
    const b = await req.clone().json().catch(() => null);
    const key = await setting('cron_key');
    if (b && key && b.daily === key) return json(await dailyRun());
    return json({ error: 'forbidden' }, 403);
  }
  if (req.headers.get('x-telegram-bot-api-secret-token') !== (await secret())) return json({ error: 'forbidden' }, 403);
  const u = await req.json().catch(() => null);
  try {
    if (u?.message) await onMessage(u.message);
    else if (u?.callback_query) await onCallback(u.callback_query);
  } catch (e) { console.error('nf-bot', e); }
  return json({ ok: true });
});

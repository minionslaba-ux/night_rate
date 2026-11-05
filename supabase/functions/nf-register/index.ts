// Регистрация по логину и паролю отключена (v48): вход только через Telegram, ВКонтакте или MAX (функция nf-login).
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve((req) => req.method === 'OPTIONS'
  ? new Response('ok', { headers: cors })
  : new Response(JSON.stringify({ error: 'Регистрация по логину и паролю отключена. Войдите через Telegram, ВКонтакте или MAX.' }), { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } }));

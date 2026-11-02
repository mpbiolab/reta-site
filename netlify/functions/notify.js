// Relais Telegram : le token reste côté serveur (variables d'environnement Netlify)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { statusCode: 500, body: 'Server not configured' };

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

  const text = String(data.text || '').slice(0, 3500);
  if (!text) return { statusCode: 400, body: 'Empty message' };

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
    return { statusCode: r.ok ? 200 : 502, body: r.ok ? 'ok' : 'Telegram error' };
  } catch {
    return { statusCode: 502, body: 'Relay error' };
  }
};

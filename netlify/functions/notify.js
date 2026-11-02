// Relais Telegram : le token reste côté serveur (variables d'environnement Netlify).
// Variables requises : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

const ALLOWED_HOSTS = ['xn--rta-bma.com', 'reta-site.netlify.app'];
const hits = new Map(); // limitation simple par IP (par instance)

const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body });

function originAllowed(headers) {
  const src = headers.origin || headers.referer || '';
  let host = '';
  try { host = new URL(src).hostname; } catch { return false; }
  return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h) || host.endsWith('--reta-site.netlify.app'));
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 5 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, 'Method Not Allowed');
  if (!originAllowed(event.headers || {})) return reply(403, 'Forbidden');

  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return reply(429, 'Too Many Requests');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID manquants'); return reply(500, 'Not configured'); }

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch { return reply(400, 'Bad JSON'); }
  const text = String(data.text || '').trim().slice(0, 3500);
  if (!text) return reply(400, 'Empty message');

  try {
    // Texte brut (pas de parse_mode) : aucun caractère saisi par un client ne peut faire échouer l'envoi
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error('Telegram a refusé le message:', r.status, detail);
      return reply(502, 'Telegram error');
    }
    return reply(200, 'ok');
  } catch (e) {
    console.error('Erreur réseau Telegram:', e.message);
    return reply(502, 'Relay error');
  }
};

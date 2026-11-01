// Compteur privé de Vytoxx Best Finds — Cloudflare Worker + base D1 (liaison « DB »).
// Secrets à définir dans Cloudflare (Paramètres > Variables et secrets) :
//   PASS : le mot de passe du tracker      KEY : une longue phrase aléatoire (signe les connexions)
// Le site envoie des compteurs anonymes (POST /hit) ; seul le tracker connecté peut les lire (GET /stats).
const ORIGINS = ['https://best-finds-vytoxx.github.io', 'http://localhost:8765'];
const CODES = new Set(['s', 'v', 'n', 'o', 'b', 'sh', 'po', 'p', 'q', 'app', 'mob', 'pc', 'rtg', 'rig', 'rsc', 'rtt', 'rwa', 'rweb', 'rdir']);
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const today = () => new Date().toISOString().slice(0, 10);

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
// comparaison à temps constant
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function tokenOk(env, req) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(env.KEY, `tracker.${exp}`));
}

async function setup(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS c (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, k))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS fails (ip TEXT NOT NULL, hour TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, hour))'),
  ]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    try {
      // le site : un ou plusieurs compteurs à +1 pour aujourd'hui
      if (url.pathname === '/hit' && req.method === 'POST') {
        const o = req.headers.get('Origin') || '';
        if (o && !ORIGINS.includes(o)) return json(req, { ok: false }, 403);
        let body = {};
        try { body = JSON.parse(await req.text()); } catch {}
        const ks = [...new Set([].concat(body.k || []))].filter((k) => CODES.has(k)).slice(0, 8);
        if (!ks.length) return json(req, { ok: false }, 400);
        const d = today();
        const run = () => env.DB.batch(ks.map((k) => env.DB.prepare('INSERT INTO c (day, k, n) VALUES (?1, ?2, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1').bind(d, k)));
        try { await run(); } catch { await setup(env); await run(); }
        return json(req, { ok: true });
      }
      // le tracker : connexion avec le mot de passe -> jeton valable 90 jours sur cet appareil
      if (url.pathname === '/login' && req.method === 'POST') {
        await setup(env);
        const ip = req.headers.get('CF-Connecting-IP') || '?', hour = new Date().toISOString().slice(0, 13);
        const f = await env.DB.prepare('SELECT n FROM fails WHERE ip = ?1 AND hour = ?2').bind(ip, hour).first();
        if (f && f.n >= 8) return json(req, { ok: false, error: 'Trop d’essais. Réessaie dans une heure.' }, 429);
        let pw = '';
        try { pw = String(JSON.parse(await req.text()).pw || ''); } catch {}
        if (!env.PASS || !same(await hmac(env.KEY, pw), await hmac(env.KEY, env.PASS))) {
          await env.DB.prepare('INSERT INTO fails (ip, hour, n) VALUES (?1, ?2, 1) ON CONFLICT(ip, hour) DO UPDATE SET n = n + 1').bind(ip, hour).run();
          await new Promise((r) => setTimeout(r, 800));
          return json(req, { ok: false, error: 'Mot de passe incorrect.' }, 401);
        }
        const exp = String(Date.now() + 90 * 864e5);
        return json(req, { ok: true, token: `${exp}.${await hmac(env.KEY, `tracker.${exp}`)}` });
      }
      // le tracker : les chiffres, jour par jour
      if (url.pathname === '/stats' && req.method === 'GET') {
        if (!(await tokenOk(env, req))) return json(req, { ok: false, error: 'Connexion expirée.' }, 401);
        await setup(env);
        const { results } = await env.DB.prepare('SELECT day, k, n FROM c ORDER BY day').all();
        const days = {};
        for (const r of results) (days[r.day] ||= { date: r.day })[r.k] = r.n;
        const first = results.length ? results[0].day : today();
        return json(req, { ok: true, now: new Date().toISOString(), since: first, days: Object.values(days) });
      }
      return json(req, { ok: true, service: 'compteur Vytoxx' });
    } catch (e) {
      return json(req, { ok: false, error: 'Erreur du serveur.' }, 500);
    }
  },
};

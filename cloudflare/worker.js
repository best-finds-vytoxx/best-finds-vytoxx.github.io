// Compteur privé de Vytoxx Best Finds — Cloudflare Worker + base D1 (liaison « DB »).
// Secrets à définir dans Cloudflare (Paramètres > Variables et secrets) :
//   PASS : le mot de passe du tracker      KEY : une longue phrase aléatoire (signe les connexions)
// Le site envoie des compteurs anonymes (POST /hit) ; seul le tracker connecté peut les lire (GET /stats).
const ORIGINS = ['https://best-finds-vytoxx.github.io', 'http://localhost:8765'];
const CODES = new Set(['s', 'v', 'n', 'o', 'b', 'sh', 'po', 'p', 'q', 'app', 'mob', 'pc', 'rtg', 'rig', 'rsc', 'rtt', 'rwa', 'rweb', 'rdir']);
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// jour et heure à l'heure de Paris
const paris = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const today = () => paris().day;
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...cors(req) } });
// anti-spam des compteurs : au plus 300 envois par appareil et par 10 minutes (mémoire du serveur, sans rien enregistrer)
const seen = new Map();
function tooMany(ip) {
  const slot = Math.floor(Date.now() / 6e5), key = `${slot}|${ip}`;
  if (seen.size > 5000) for (const k of seen.keys()) if (!k.startsWith(`${slot}|`)) seen.delete(k);
  const n = (seen.get(key) || 0) + 1; seen.set(key, n);
  return n > 300;
}

async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
// comparaison à temps constant
const same = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function tokenOk(env, req) {
  if (!env.PASS || !env.KEY) return false;
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || !Number.isFinite(Number(exp)) || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(env.KEY, `tracker.${exp}.${env.PASS}`));
}

async function setup(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS c (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, k))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS h (day TEXT NOT NULL, hour INTEGER NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, hour, k))'),
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
        // seulement depuis le site, petits envois, et pas de rafales
        if (!ORIGINS.includes(req.headers.get('Origin') || '')) return json(req, { ok: false }, 403);
        if (Number(req.headers.get('Content-Length') || 0) > 1000) return json(req, { ok: false }, 413);
        if (tooMany(req.headers.get('CF-Connecting-IP') || '?')) return json(req, { ok: false }, 429);
        let body = {};
        try { body = JSON.parse((await req.text()).slice(0, 1000)); } catch {}
        const ks = [...new Set([].concat(body.k || []))].filter((k) => CODES.has(k)).slice(0, 8);
        if (!ks.length) return json(req, { ok: false }, 400);
        const { day: d, hour } = paris();
        const run = () => env.DB.batch(ks.flatMap((k) => [
          env.DB.prepare('INSERT INTO c (day, k, n) VALUES (?1, ?2, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1').bind(d, k),
          env.DB.prepare('INSERT INTO h (day, hour, k, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, hour, k) DO UPDATE SET n = n + 1').bind(d, hour, k),
        ]));
        try { await run(); } catch { await setup(env); await run(); }
        return json(req, { ok: true });
      }
      // le tracker : connexion avec le mot de passe -> jeton valable 90 jours sur cet appareil
      if (url.pathname === '/login' && req.method === 'POST') {
        if (!env.PASS || !env.KEY) return json(req, { ok: false, error: 'Compteur mal configuré.' }, 500);
        await setup(env);
        // l'adresse IP n'est jamais enregistrée en clair : seulement une empreinte
        const ip = await hmac(env.KEY, `ip.${req.headers.get('CF-Connecting-IP') || '?'}`), hour = new Date().toISOString().slice(0, 13);
        const f = await env.DB.prepare('SELECT n FROM fails WHERE ip = ?1 AND hour = ?2').bind(ip, hour).first();
        const all = await env.DB.prepare('SELECT SUM(n) AS n FROM fails WHERE hour = ?1').bind(hour).first();
        // 8 essais ratés par heure et par appareil, 60 au total : deviner le mot de passe est impossible
        if ((f && f.n >= 8) || (all && all.n >= 60)) return json(req, { ok: false, error: 'Trop d’essais. Réessaie dans une heure.' }, 429);
        let pw = '';
        try { pw = String(JSON.parse((await req.text()).slice(0, 2000)).pw || '').slice(0, 200); } catch {}
        if (!same(await hmac(env.KEY, pw), await hmac(env.KEY, env.PASS))) {
          await env.DB.prepare('INSERT INTO fails (ip, hour, n) VALUES (?1, ?2, 1) ON CONFLICT(ip, hour) DO UPDATE SET n = n + 1').bind(ip, hour).run();
          await env.DB.prepare('DELETE FROM fails WHERE hour < ?1').bind(new Date(Date.now() - 2 * 36e5).toISOString().slice(0, 13)).run();
          await new Promise((r) => setTimeout(r, 800));
          return json(req, { ok: false, error: 'Mot de passe incorrect.' }, 401);
        }
        const exp = String(Date.now() + 90 * 864e5);
        return json(req, { ok: true, token: `${exp}.${await hmac(env.KEY, `tracker.${exp}.${env.PASS}`)}` });
      }
      // le tracker : les chiffres, jour par jour
      if (url.pathname === '/stats' && req.method === 'GET') {
        if (!(await tokenOk(env, req))) return json(req, { ok: false, error: 'Connexion expirée.' }, 401);
        await setup(env);
        const { results } = await env.DB.prepare('SELECT day, k, n FROM c ORDER BY day').all();
        const days = {};
        for (const r of results) (days[r.day] ||= { date: r.day })[r.k] = r.n;
        const first = results.length ? results[0].day : today();
        // heure par heure sur la période demandée (au plus 93 jours)
        let from = url.searchParams.get('from'), to = url.searchParams.get('to') || today();
        if (!isDay(from)) from = to;
        if (!isDay(to)) to = today();
        if ((Date.parse(to) - Date.parse(from)) / 864e5 > 92) from = new Date(Date.parse(to) - 92 * 864e5).toISOString().slice(0, 10);
        const hr = (await env.DB.prepare('SELECT day, hour, k, n FROM h WHERE day >= ?1 AND day <= ?2 ORDER BY day, hour').bind(from, to).all()).results;
        const hours = {};
        for (const r of hr) (hours[`${r.day} ${r.hour}`] ||= { date: r.day, h: r.hour })[r.k] = r.n;
        return json(req, { ok: true, now: new Date().toISOString(), today: today(), since: first, days: Object.values(days), hours: Object.values(hours) });
      }
      return json(req, { ok: true, service: 'compteur Vytoxx' });
    } catch (e) {
      return json(req, { ok: false, error: 'Erreur du serveur.' }, 500);
    }
  },
};

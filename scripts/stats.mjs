// Relève les statistiques du site (compteurs anonymes par jour) et écrit data/stats.enc.json, lu par le tracker privé
// (tracker.html). Chaque jour est chiffré à part avec la clé publique scripts/stats-key.json (RSA-OAEP + AES-GCM) :
// le robot peut écrire mais pas relire ; seul le tracker, avec le mot de passe de Léonard, peut déchiffrer.
//   s   visites                     v   visiteurs (une fois par personne et par jour)
//   n   nouveaux visiteurs          o   fiches ouvertes          b   clics vers LoveGoBuy
//   sh  partages                    po  fenêtre 500 € ouverte    p   clics sur le lien d'inscription (500 €)
//   q   questions au chat bot       app ouvertures depuis l'écran d'accueil
//   mob / pc                        appareil
//   rtg rig rsc rtt rwa rweb rdir   provenance : Telegram, Instagram, Snapchat, TikTok, WhatsApp, autre site, lien direct
import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'data', 'stats.enc.json');
const KEY = path.join(ROOT, 'scripts', 'stats-key.json');
const CONFIG = path.join(ROOT, 'assets', 'config.js');
const API = 'https://abacus.jasoncameron.dev';
const KEYS = ['s', 'v', 'n', 'o', 'b', 'sh', 'po', 'p', 'q', 'app', 'mob', 'pc', 'rtg', 'rig', 'rsc', 'rtt', 'rwa', 'rweb', 'rdir'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = async (f, fb) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fb; } };
const iso = (d) => d.toISOString().slice(0, 10);

async function getCount(ns, key) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}/get/${ns}/${key}`).catch(() => null);
    if (r && r.status === 404) return 0; // personne ce jour-là
    if (r && r.ok) return Number((await r.json()).value) || 0;
    await sleep(r && r.status === 429 ? 11000 : 2000 * (i + 1)); // limite du service : 30 requêtes / 10 s
  }
  return null;
}

async function seal(pub, obj) {
  const s = webcrypto.subtle;
  const aes = await s.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = await s.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const key = await s.encrypt({ name: 'RSA-OAEP' }, pub, await s.exportKey('raw', aes));
  const b64 = (b) => Buffer.from(b).toString('base64');
  return { k: b64(key), iv: b64(iv), d: b64(data) };
}

async function main() {
  const src = await readFile(CONFIG, 'utf8').catch(() => '');
  const ns = (src.match(/namespace:\s*'([\w.-]{3,64})'/) || [])[1] || 'bestfinds-vytoxx';
  const pub = await webcrypto.subtle.importKey('jwk', JSON.parse(await readFile(KEY, 'utf8')), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const prev = await readJson(OUT, { days: {} });
  const days = { ...(prev.days || {}) };

  // aujourd'hui et hier à chaque passage (hier se termine après minuit), et les 5 jours d'avant s'ils manquent
  const dates = [];
  for (let k = 0; k < 7; k++) {
    const date = iso(new Date(Date.now() - k * 864e5));
    if (k < 2 || !days[date]) dates.push(date);
  }
  let failed = 0, last = null;
  for (const date of dates) {
    const row = { date };
    let miss = 0;
    for (const k of KEYS) {
      const n = await getCount(ns, `d${date.replace(/-/g, '')}-${k}`);
      if (n == null) miss++;
      else row[k] = n;
      await sleep(380);
    }
    failed += miss;
    // un jour lu en entier remplace l'ancien ; un jour lu en partie ne remplace pas un jour déjà complet
    if (!miss || (!days[date] && miss < KEYS.length)) days[date] = await seal(pub, row);
    if (date === dates[0]) last = row;
  }
  const since = prev.since || iso(new Date());
  for (const d of Object.keys(days)) if (d < since) delete days[d];
  await writeFile(OUT, JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), since, days }));
  console.log(`Stats chiffrées : ${Object.keys(days).length} jour(s) ; aujourd'hui ${last?.v || 0} visiteur(s)${failed ? ` (${failed} compteurs non lus)` : ''}`);
}

main().catch((e) => console.warn('Relevé des stats impossible :', e.message));

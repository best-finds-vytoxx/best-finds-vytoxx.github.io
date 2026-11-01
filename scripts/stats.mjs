// Relève les statistiques du site (compteurs anonymes par jour) et écrit data/stats.json,
// lu par le tableau de bord privé de Léonard. Aucune donnée personnelle : seulement des totaux.
//   s   visites                     v   visiteurs (une fois par personne et par jour)
//   n   nouveaux visiteurs          o   fiches ouvertes          b   clics vers LoveGoBuy
//   sh  partages                    po  fenêtre 500 € ouverte    p   clics sur le lien d'inscription (500 €)
//   q   questions au chat bot       app ouvertures depuis l'écran d'accueil
//   mob / pc                        appareil
//   rtg rig rsc rtt rwa rweb rdir   provenance : Telegram, Instagram, Snapchat, TikTok, WhatsApp, autre site, lien direct
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'data', 'stats.json');
const CLICKS = path.join(ROOT, 'data', 'clicks.json');
const ARTICLES = path.join(ROOT, 'data', 'articles.json');
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

async function main() {
  const src = await readFile(CONFIG, 'utf8').catch(() => '');
  const ns = (src.match(/namespace:\s*'([\w.-]{3,64})'/) || [])[1] || 'bestfinds-vytoxx';
  const prev = await readJson(OUT, { days: [] });
  const byDate = new Map((prev.days || []).map((d) => [d.date, d]));

  // aujourd'hui et hier à chaque passage (hier se termine après minuit), et les 5 jours d'avant s'ils manquent
  const dates = [];
  for (let k = 0; k < 7; k++) {
    const date = iso(new Date(Date.now() - k * 864e5));
    if (k < 2 || !byDate.has(date)) dates.push(date);
  }
  let failed = 0;
  for (const date of dates) {
    const row = { ...(byDate.get(date) || {}), date };
    for (const k of KEYS) {
      const n = await getCount(ns, `d${date.replace(/-/g, '')}-${k}`);
      if (n == null) failed++;
      else row[k] = n;
      await sleep(380);
    }
    byDate.set(date, row);
  }
  const first = (prev.since && prev.since) || iso(new Date());
  const days = [...byDate.values()].filter((d) => d.date >= first).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);

  // articles les plus cliqués (30 derniers jours), avec leur nom, pour le tableau de bord
  const clicks = await readJson(CLICKS, {});
  const { articles = [] } = await readJson(ARTICLES, {});
  const byId = new Map(articles.map((a) => [String(a.id), a]));
  const top = Object.entries(clicks.period || {})
    .map(([id, n]) => ({ id: Number(id), article: byId.get(id)?.title || `Article ${id}`, marque: byId.get(id)?.brand || '', categorie: byId.get(id)?.category || '', clics: n }))
    .sort((a, b) => b.clics - a.clics).slice(0, 25);

  const out = { updatedAt: new Date().toISOString(), since: first, days, top };
  await writeFile(OUT, JSON.stringify(out));
  const t = days.at(-1) || {};
  console.log(`Stats : ${days.length} jour(s) ; aujourd'hui ${t.v || 0} visiteur(s), ${t.s || 0} visite(s), ${t.b || 0} clic(s) LoveGoBuy${failed ? ` (${failed} compteurs non lus)` : ''}`);
}

main().catch((e) => console.warn('Relevé des stats impossible :', e.message));

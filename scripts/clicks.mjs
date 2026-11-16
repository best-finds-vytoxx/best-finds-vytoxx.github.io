// Relève les compteurs de clics de chaque article et publie data/clicks.json pour le « Top du moment ».
// Les compteurs (un par article) sont incrémentés par le site à chaque clic vers LoveGoBuy.
// On garde une photo des totaux par jour : le classement = clics des N derniers jours.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ARTICLES = path.join(ROOT, 'data', 'articles.json');
const OUT = path.join(ROOT, 'data', 'clicks.json');
const CONFIG = path.join(ROOT, 'assets', 'config.js');
const API = 'https://abacus.jasoncameron.dev';
const MIN_INTERVAL_MIN = Number(process.env.CLICKS_EVERY_MIN ?? 10); // relevé à chaque passage du robot (toutes les 15 min)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = async (f, fb) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fb; } };

async function settings() {
  const src = await readFile(CONFIG, 'utf8').catch(() => '');
  const ns = (src.match(/namespace:\s*'([\w.-]{3,64})'/) || [])[1] || 'bestfinds-vytoxx';
  const days = Number((src.match(/days:\s*(\d+)/) || [])[1] || 30);
  return { ns, days };
}

async function getCount(ns, id) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}/get/${ns}/a${id}`).catch(() => null);
    if (r && r.status === 404) return 0; // personne n'a encore cliqué
    if (r && r.ok) return Number((await r.json()).value) || 0;
    await sleep(r && r.status === 429 ? 11000 : 2000 * (i + 1)); // limite : 30 requêtes / 10 s
  }
  return null; // inconnu cette fois-ci
}

async function main() {
  const prev = await readJson(OUT, { totals: {}, history: [] });
  if (prev.updatedAt && Date.now() - new Date(prev.updatedAt) < MIN_INTERVAL_MIN * 60e3 && !process.env.FORCE) {
    console.log('Clics relevés il y a moins de 10 minutes, rien à faire.');
    return;
  }
  const { ns, days } = await settings();
  const { articles = [] } = await readJson(ARTICLES, {});
  const totals = { ...prev.totals };
  let failed = 0;
  for (const a of articles) {
    const n = await getCount(ns, a.id);
    if (n == null) failed++;
    else totals[a.id] = n;
    await sleep(380); // ~26 requêtes / 10 s, sous la limite du service
  }

  // Photo du jour (une par jour, la dernière de la journée l'emporte)
  const today = new Date().toISOString().slice(0, 10);
  const history = (prev.history || []).filter((h) => h.date !== today);
  history.push({ date: today, totals });
  history.sort((x, y) => x.date.localeCompare(y.date));
  const cutoff = new Date(Date.now() - (days + 2) * 864e5).toISOString().slice(0, 10);
  const kept = history.filter((h) => h.date >= cutoff);

  // Clics sur la période = total actuel - total au début de la période (ou depuis le début s'il n'y a pas d'historique assez ancien)
  const startDate = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const base = [...kept].reverse().find((h) => h.date <= startDate) || null;
  const period = {};
  for (const [id, n] of Object.entries(totals)) {
    const d = n - ((base && base.totals[id]) || 0);
    if (d > 0) period[id] = d;
  }

  const sameNumbers = JSON.stringify(totals) === JSON.stringify(prev.totals) && JSON.stringify(period) === JSON.stringify(prev.period);
  const out = { updatedAt: new Date().toISOString(), namespace: ns, days, period, totals, history: kept };
  if (sameNumbers && (prev.history || []).some((h) => h.date === today)) {
    console.log('Aucun nouveau clic.');
    return;
  }
  await writeFile(OUT, JSON.stringify(out));
  const topList = Object.entries(period).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${id}:${n}`).join(' ');
  console.log(`Clics relevés pour ${articles.length - failed}/${articles.length} articles. Top : ${topList || 'aucun clic pour l\'instant'}`);
}

main().catch((e) => {
  // Le classement n'est jamais bloquant : en cas de souci, le site garde le précédent
  console.warn('Relevé des clics impossible :', e.message);
});

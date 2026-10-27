// Récupère les articles du canal Telegram et met à jour data/articles.json + images/.
// Lancé automatiquement par GitHub Actions (.github/workflows/update.yml), ou à la main : npm run scrape
//
// - 1er passage : lit tout l'historique du canal, puis traite les articles par lots (les plus récents d'abord)
//   pour que chaque passage reste court ; les passages suivants terminent l'historique.
// - Ensuite : lit les dernières pages et ajoute chaque nouvel article.
// - Pour chaque article : photos téléchargées et compressées, photo principale détourée (fond supprimé).
// - Aucun prix n'est jamais enregistré.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { writeFileSync as require_writeFileSync, readFileSync } from 'node:fs';
const require_readFileSync = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { parseMessages, parseChannel, toArticles, minId } from './parse.mjs';

const CHANNEL = process.env.CHANNEL || 'lovegobuy_france';
const RECENT_PAGES = Number(process.env.RECENT_PAGES || 3); // une fois l'historique complet, les dernières pages suffisent
const MAX_PAGES = Number(process.env.MAX_PAGES || 400); // garde-fou pour la lecture de l'historique
const BATCH = Number(process.env.BATCH || 40); // articles traités au maximum par passage (détourage ≈ 6 s/photo)
const MAX_PHOTOS = 10;
const CUTOUT_TRIES = Number(process.env.CUTOUT_TRIES ?? 4); // si la 1re photo se détoure mal, on essaie les suivantes

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'data', 'articles.json');
const CHANNEL_FILE = path.join(ROOT, 'data', 'channel.json');
const IMAGES = path.join(ROOT, 'images');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'text', tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9' } });
      if (r.status === 429) throw new Error('HTTP 429 (trop de requêtes)');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return as === 'buffer' ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      if (i === tries) throw new Error(`${url} → ${e.message}`);
      await sleep(2000 * i);
    }
  }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

/** Lit le canal page par page (du plus récent au plus ancien). */
async function readChannel(maxPages) {
  const pages = [];
  let html = await get(`https://t.me/s/${CHANNEL}`);
  pages.push(html);
  const channel = parseChannel(html);
  let before = minId(parseMessages(html));
  for (let i = 1; i < maxPages && before && before > 1; i++) {
    await sleep(700);
    html = await get(`https://t.me/s/${CHANNEL}?before=${before}`);
    const msgs = parseMessages(html);
    if (!msgs.length) break;
    pages.push(html);
    const next = minId(msgs);
    if (next >= before) break;
    before = next;
  }
  return { channel, messages: pages.flatMap(parseMessages), pages: pages.length };
}

/** Télécharge les photos d'un article (version web + original gardé pour le détourage). */
async function downloadPhotos(a, tmp) {
  const dir = path.join(IMAGES, String(a.id));
  await mkdir(dir, { recursive: true });
  const photos = [];
  const sources = [];
  for (const [i, url] of a.photosRemote.slice(0, MAX_PHOTOS).entries()) {
    try {
      const buf = await get(url, 'buffer');
      const file = `${i + 1}.webp`;
      await sharp(buf).rotate().resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(dir, file));
      photos.push(`images/${a.id}/${file}`);
      if (sources.length < CUTOUT_TRIES) {
        const src = path.join(tmp, `${a.id}_${i + 1}.img`);
        await writeFile(src, buf);
        sources.push(src);
      }
    } catch (e) {
      console.warn(`  photo ignorée (${a.id} #${i + 1}) : ${e.message}`);
    }
  }
  return { photos, sources };
}

/**
 * Détoure les articles dans un processus séparé. Si ce processus plante, on le relance
 * pour les articles restants ; l'article sur lequel il a planté est passé (il garde ses photos d'origine).
 */
function runCutouts(jobs, tmp) {
  const result = new Map();
  if (!jobs.length || CUTOUT_TRIES === 0) return result;
  const jobsFile = path.join(tmp, 'jobs.json');
  require_writeFileSync(jobsFile, JSON.stringify(jobs));
  const worker = path.join(path.dirname(new URL(import.meta.url).pathname), 'cutout-worker.mjs');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = spawnSync(process.execPath, [worker, jobsFile], { stdio: 'inherit', timeout: 40 * 60e3 });
    const lines = require_readFileSync(`${jobsFile}.done`).split('\n').filter(Boolean);
    const state = new Map();
    for (const l of lines) { const [id, st] = l.split(':'); state.set(Number(id), st); }
    for (const [id, st] of state) if (st === 'ok' || st === 'none') result.set(id, st === 'ok');
    const pending = jobs.filter((j) => !result.has(j.id));
    if (!pending.length) break;
    // l'article « en cours » au moment du plantage est abandonné pour le détourage
    for (const [id, st] of state) if (st === 'start' && !result.has(id)) { result.set(id, false); console.warn(`  ${id} : le détourage a planté, photos d'origine conservées`); }
    if (r.status === 0 && !jobs.some((j) => !result.has(j.id))) break;
    console.warn(`  détourage interrompu (code ${r.status ?? r.signal}), reprise ${attempt}/3…`);
  }
  for (const j of jobs) if (!result.has(j.id)) result.set(j.id, false);
  return result;
}

async function main() {
  const existing = await readJson(DATA, { articles: [] });
  const known = new Map(existing.articles.map((a) => [a.id, a]));
  const historyDone = existing.historyComplete === true;

  // 1. Lire le canal
  const { channel, messages, pages } = await readChannel(historyDone ? RECENT_PAGES : MAX_PAGES);
  const found = toArticles(messages, CHANNEL);
  console.log(`${found.length} articles lus sur ${pages} page(s) ; ${known.size} déjà sur le site`);

  // 2. Articles déjà connus : mise à jour du texte si le post a été modifié (les images ne bougent pas)
  for (const a of found) {
    const old = known.get(a.id);
    if (!old) continue;
    const { photosRemote, ...info } = a;
    known.set(a.id, { ...old, ...info, photos: old.photos, cover: old.cover });
  }

  // 3. Nouveaux articles, les plus récents d'abord, par lot
  const todo = found.filter((a) => !known.has(a.id)).sort((x, y) => y.id - x.id);
  const batch = todo.slice(0, BATCH);
  const tmp = path.join(os.tmpdir(), `bestfinds-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  const downloaded = [];
  for (const a of batch) {
    const { photos, sources } = await downloadPhotos(a, tmp);
    if (!photos.length) {
      console.warn(`- ${a.id} ${a.title} : aucune photo récupérée, réessai au prochain passage`);
      continue;
    }
    downloaded.push({ a, photos, sources });
  }
  const jobs = downloaded.filter((d) => d.sources.length).map((d) => ({ id: d.a.id, inputs: d.sources, out: path.join(IMAGES, String(d.a.id), 'cover.webp') }));
  if (jobs.length) console.log(`Détourage de ${jobs.length} article(s)…`);
  const cut = runCutouts(jobs, tmp);
  for (const { a, photos } of downloaded) {
    const { photosRemote, ...info } = a;
    const cover = cut.get(a.id) ? `images/${a.id}/cover.webp` : null;
    known.set(a.id, { ...info, photos, cover, addedAt: new Date().toISOString() });
    console.log(`+ ${a.id} ${a.title} (${photos.length} photos${cover ? ', détourée' : ''})`);
  }
  await rm(tmp, { recursive: true, force: true });
  const remaining = todo.length - batch.length;
  if (remaining > 0) console.log(`${remaining} article(s) restant(s), traités aux prochains passages`);

  // 4. Enregistrer (les vues seules ne déclenchent pas de mise à jour du site)
  const kept = [...known.values()].map(({ price, ...a }) => a).sort((x, y) => y.id - x.id);
  const historyComplete = historyDone || remaining === 0;
  const noViews = (list) => JSON.stringify(list.map(({ views, ...rest }) => rest));
  if (noViews(kept) === noViews(existing.articles) && historyComplete === existing.historyComplete) {
    console.log('Rien de nouveau.');
    return;
  }
  await mkdir(path.dirname(DATA), { recursive: true });
  await writeFile(DATA, JSON.stringify({ updatedAt: new Date().toISOString(), channel: CHANNEL, historyComplete, articles: kept }, null, 1));

  // Avatar et nom du canal
  if (channel.avatar && !existsSync(path.join(IMAGES, 'avatar.webp'))) {
    try {
      await mkdir(IMAGES, { recursive: true });
      await sharp(await get(channel.avatar, 'buffer')).resize(256, 256).webp().toFile(path.join(IMAGES, 'avatar.webp'));
    } catch (e) { console.warn('avatar ignoré :', e.message); }
  }
  const ch = await readJson(CHANNEL_FILE, {});
  await writeFile(CHANNEL_FILE, JSON.stringify({ ...ch, title: channel.title, subscribers: channel.subscribers, username: CHANNEL }, null, 1));
  console.log(`Site mis à jour : ${kept.length} articles${historyComplete ? '' : ' (historique en cours)'}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

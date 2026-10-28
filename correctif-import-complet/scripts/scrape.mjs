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
import { nounFor, candidateOrder, shoeFront } from './pick.mjs';

const CHANNEL = process.env.CHANNEL || 'lovegobuy_france';
const RECENT_PAGES = Number(process.env.RECENT_PAGES || 3); // une fois l'historique complet, les dernières pages suffisent
const MAX_PAGES = Number(process.env.MAX_PAGES || 400); // garde-fou pour la lecture de l'historique
const BATCH = Number(process.env.BATCH || 1000); // nouveaux articles traités au maximum par passage (limités aussi par BUDGET_MIN)
const MAX_PHOTOS = 10;
const CUTOUT_TRIES = Number(process.env.CUTOUT_TRIES ?? 4); // 0 = pas de détourage
const RANK_PHOTOS = 9; // photos examinées pour choisir la couverture
const COVER_REV = 4; // version de la règle de choix de la couverture ; les anciennes couvertures sont refaites
const RECOVER = Number(process.env.RECOVER || 400); // couvertures anciennes refaites au plus par passage
const CHUNK = 40; // articles traités ensemble ; le site est enregistré après chaque groupe
const BUDGET = Number(process.env.BUDGET_MIN || 35) * 60e3; // temps de travail maximal par passage
const OVERRIDES_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'overrides.json');

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
      if (i < RANK_PHOTOS) { // originaux gardés le temps du passage pour choisir et détourer la couverture
        const src = path.join(tmp, `${a.id}_${i + 1}.img`);
        await writeFile(src, buf);
        sources.push({ n: i + 1, path: src });
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
function runCutouts(jobs, tmp, round = 1) {
  const result = new Map();
  if (!jobs.length || CUTOUT_TRIES === 0) return result;
  const jobsFile = path.join(tmp, `jobs-${round}.json`);
  require_writeFileSync(jobsFile, JSON.stringify(jobs));
  const worker = path.join(path.dirname(new URL(import.meta.url).pathname), 'cutout-worker.mjs');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = spawnSync(process.execPath, [worker, jobsFile], { stdio: 'inherit', timeout: 40 * 60e3 });
    const lines = require_readFileSync(`${jobsFile}.done`).split('\n').filter(Boolean);
    const state = new Map();
    for (const l of lines) { const [id, st, n] = l.split(':'); state.set(Number(id), { st, n: Number(n) || null }); }
    for (const [id, { st, n }] of state) if (st === 'ok' || st === 'none') result.set(id, st === 'ok' ? n || 1 : 0);
    const pending = jobs.filter((j) => !result.has(j.id));
    if (!pending.length) break;
    // l'article « en cours » au moment du plantage est abandonné pour le détourage
    for (const [id, { st }] of state) if (st === 'start' && !result.has(id)) { result.set(id, 0); console.warn(`  ${id} : le détourage a planté, photos d'origine conservées`); }
    if (r.status === 0 && !jobs.some((j) => !result.has(j.id))) break;
    console.warn(`  détourage interrompu (code ${r.status ?? r.signal}), reprise ${attempt}/3…`);
  }
  for (const j of jobs) if (!result.has(j.id)) result.set(j.id, 0);
  return result; // id → numéro de la photo détourée retenue (0 = aucune)
}

/** Lance le modèle de reconnaissance (processus séparé). Renvoie null s'il n'a pas pu tourner. */
function runRank(items, tmp, name) {
  if (!items.length) return {};
  if (process.env.RANK_FIXTURE) { // tests hors ligne : notes enregistrées à l'avance
    if (name !== 'rank') return null;
    const fx = JSON.parse(readFileSync(process.env.RANK_FIXTURE, 'utf8'));
    return Object.fromEntries(items.map((it) => [it.key, fx[it.key] || { scores: it.images.map(() => 0.5) }]));
  }
  const inFile = path.join(tmp, `${name}.json`), outFile = path.join(tmp, `${name}-out.json`);
  require_writeFileSync(inFile, JSON.stringify(items));
  const worker = path.join(path.dirname(new URL(import.meta.url).pathname), 'rank-worker.mjs');
  const r = spawnSync(process.execPath, [worker, inFile, outFile], { stdio: 'inherit', timeout: 30 * 60e3 });
  const out = require_readFileSync(outFile);
  if (!out) { console.warn(`  reconnaissance d'images indisponible (code ${r.status ?? r.signal}), choix par position`); return null; }
  return JSON.parse(out);
}

// Ordre par défaut si le modèle de reconnaissance ne tourne pas
const FALLBACK = { wear: [1, 3, 4], shoe: [2, 1, 3, 4], acc: [1, 3, 4, 2] };

/**
 * Choisit et détoure la couverture de chaque article :
 * 1. le modèle note chaque photo (le produit de face, pas son emballage, son étiquette ou son dos) ;
 * 2. la photo la mieux placée est détourée (contrôles de qualité du détourage, carton retiré pour les accessoires) ;
 * 3. le résultat est vérifié par le modèle : le produit doit être reconnu, sans emballage. Sinon, photo suivante.
 * items = [{ id, title, type, inputs: [{ n, path }] }] → Map id → { n: photo détourée (0 = aucune), front: meilleure photo }
 */
function makeCovers(items, tmp) {
  const result = new Map();
  if (!items.length || CUTOUT_TRIES === 0) return result;
  const ranks = runRank(items.map((it) => ({ key: it.id, title: it.title, type: it.type, images: it.inputs.map((i) => i.path) })), tmp, 'rank');
  const state = items.map((it) => {
    const nk = nounFor(it.title, it.type);
    const kind = it.kind || nk.kind;
    const r = ranks && ranks[it.id];
    const scores = r ? r.scores : null;
    const front = r && r.front && r.front.length === 2 ? shoeFront(r.front[0], r.front[1]) : null;
    let order = (scores ? candidateOrder(scores, kind, front) : FALLBACK[kind]).filter((n) => it.inputs.some((i) => i.n === n));
    // photo choisie à la main (data/overrides.json) : essayée en premier, quelle qu'elle soit
    if (it.forced && it.inputs.some((i) => i.n === it.forced)) order = [it.forced, ...order.filter((n) => n !== it.forced)];
    return { it, kind, box: !!nk.box, scores, order, exclude: [], done: false };
  });
  for (let round = 1; round <= 3; round++) {
    const todo = state.filter((s) => !s.done && s.order.some((n) => !s.exclude.includes(n)));
    if (!todo.length) break;
    const jobs = todo.map((s) => ({ id: s.it.id, type: s.it.type, kind: s.kind, box: s.box, forced: s.it.forced || null, order: s.order, exclude: s.exclude, inputs: s.it.inputs, out: path.join(tmp, `cover-${s.it.id}-${round}.webp`) }));
    console.log(`Détourage, essai ${round} : ${jobs.length} article(s)…`);
    const cut = runCutouts(jobs, tmp, round);
    const made = todo.filter((s) => cut.get(s.it.id));
    // vérification du résultat par le modèle
    const checks = ranks ? runRank(made.map((s) => ({ key: s.it.id, title: s.it.title, type: s.it.type, verify: true, images: [path.join(tmp, `cover-${s.it.id}-${round}.webp`)] })), tmp, `verify-${round}`) : null;
    for (const s of todo) {
      const n = cut.get(s.it.id) || 0;
      if (!n) { s.done = true; continue; } // aucune photo détourable dans l'ordre proposé
      const v = checks && checks[s.it.id];
      const source = s.scores ? s.scores[n - 1] : 0;
      // photo imposée à la main : on garde son détourage (les contrôles de qualité du détourage restent appliqués)
      const ok = !v || s.it.forced === n || ((s.box || v.packaging[0] < 0.5) && v.scores[0] >= Math.min(0.25, source * 0.5));
      if (ok) {
        s.done = true;
        result.set(s.it.id, { n, file: path.join(tmp, `cover-${s.it.id}-${round}.webp`) });
      } else {
        console.log(`  ${s.it.id} : détourage de la photo ${n} refusé à la vérification (produit ${v.scores[0]}, emballage ${v.packaging[0]})`);
        s.exclude.push(n);
      }
    }
  }
  for (const s of state) {
    const r = result.get(s.it.id) || { n: 0 };
    r.front = s.it.forced || s.order[0] || 1; // meilleure photo d'origine, affichée si aucune couverture détourée
    result.set(s.it.id, r);
  }
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

  // Corrections faites à la main (data/overrides.json) : { "id": { "cover": n°photo, "category": "Bas", "kind": "shoe" } }
  const overrides = await readJson(OVERRIDES_FILE, {});
  const ov = (id) => overrides[String(id)] || {};
  const WORD = { Hauts: 'un haut', Bas: 'un bas', Ensembles: 'un ensemble', Accessoires: 'un accessoire' };
  const fixCat = (a) => {
    const cat = ov(a.id).category;
    if (!cat || a.category === cat) return a;
    const description = (a.description || '').replace(/ : (un|une) [^:.]*? sélectionné sur le canal\./, ` : ${WORD[cat] || 'un article'} sélectionné sur le canal.`);
    return { ...a, category: cat, type: cat, description };
  };

  // 2. Articles déjà connus : mise à jour du texte si le post a été modifié (les images ne bougent pas)
  for (const a of found) {
    const old = known.get(a.id);
    if (!old) continue;
    const { photosRemote, ...info } = a;
    known.set(a.id, fixCat({ ...old, ...info, photos: old.photos, cover: old.cover, front: old.front }));
  }
  for (const [id, a] of known) known.set(id, fixCat(a));

  const t0 = Date.now();
  const save = async (historyComplete) => {
    const kept = [...known.values()].map(({ price, ...a }) => a).sort((x, y) => y.id - x.id);
    await mkdir(path.dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify({ updatedAt: new Date().toISOString(), channel: CHANNEL, historyComplete, articles: kept }, null, 1));
    return kept;
  };

  // 3. Nouveaux articles (les plus récents d'abord), puis couvertures à refaire, par groupes,
  //    tant que le temps du passage le permet
  const todo = found.filter((a) => !known.has(a.id)).sort((x, y) => y.id - x.id).slice(0, BATCH);
  const needsRedo = (a) => a.photos?.length && (a.coverRev !== COVER_REV || (ov(a.id).cover || null) !== (a.coverPick || null) || (ov(a.id).kind || null) !== (a.kindPick || null));
  const redoList = [...known.values()].filter(needsRedo).sort((x, y) => y.id - x.id).slice(0, RECOVER);
  const work = [...todo.map((a) => ({ a, isNew: true })), ...redoList.map((a) => ({ a, isNew: false }))];
  let doneNew = 0;
  for (let g = 0; g < work.length; g += CHUNK) {
    if (Date.now() - t0 > BUDGET) { console.log('Temps du passage écoulé : la suite au prochain passage.'); break; }
    const group = work.slice(g, g + CHUNK);
    const tmp = path.join(os.tmpdir(), `bestfinds-${process.pid}-${g}`);
    await mkdir(tmp, { recursive: true });
    const downloaded = [];
    const items = [];
    for (const { a, isNew } of group) {
      const o = ov(a.id);
      if (isNew) {
        const { photos, sources } = await downloadPhotos(a, tmp);
        if (!photos.length) { console.warn(`- ${a.id} ${a.title} : aucune photo récupérée, réessai au prochain passage`); continue; }
        downloaded.push({ a, photos });
        if (sources.length) items.push({ id: a.id, title: a.title, type: a.type, inputs: sources, forced: o.cover || null, kind: o.kind || null });
      } else {
        const inputs = a.photos.slice(0, RANK_PHOTOS).map((p, i) => ({ n: i + 1, path: path.join(ROOT, p) })).filter((i) => existsSync(i.path));
        if (inputs.length) items.push({ id: a.id, title: a.title, type: a.type || a.category, inputs, forced: o.cover || null, kind: o.kind || null, redo: true });
      }
    }
    console.log(`Choix des couvertures pour ${items.length} article(s) (groupe ${g / CHUNK + 1})…`);
    const covers = makeCovers(items, tmp);
    const place = async (id) => {
      const c = covers.get(id) || { n: 0, front: ov(id).cover || 1 };
      const dest = path.join(IMAGES, String(id), 'cover.webp');
      if (c.n) await writeFile(dest, await readFile(c.file));
      else await rm(dest, { force: true });
      return { cover: c.n ? `images/${id}/cover.webp` : null, coverFrom: c.n || null, front: c.front, coverRev: COVER_REV, coverPick: ov(id).cover || null, kindPick: ov(id).kind || null };
    };
    for (const { a, photos } of downloaded) {
      const { photosRemote, ...info } = a;
      const c = await place(a.id);
      known.set(a.id, fixCat({ ...info, photos, ...c, addedAt: new Date().toISOString() }));
      doneNew++;
      console.log(`+ ${a.id} ${a.title} (${photos.length} photos, ${c.cover ? `détourée depuis la photo ${c.coverFrom}` : `photo ${c.front} d'origine en couverture`})`);
    }
    for (const it of items.filter((x) => x.redo)) {
      const old = known.get(it.id);
      const c = await place(it.id);
      known.set(it.id, { ...old, ...c });
      console.log(`~ ${it.id} ${old.title} : couverture refaite (${c.cover ? `photo ${c.coverFrom}` : `photo ${c.front} d'origine`})`);
    }
    await rm(tmp, { recursive: true, force: true });
    await save(historyDone || found.every((a) => known.has(a.id)));
  }
  const remaining = found.filter((a) => !known.has(a.id)).length;
  if (remaining > 0) console.log(`${remaining} article(s) restant(s), traités aux prochains passages`);
  void doneNew;

  // 4. Enregistrer (les vues seules ne déclenchent pas de mise à jour du site)
  const historyComplete = historyDone || remaining === 0;
  const kept = [...known.values()].map(({ price, ...a }) => a).sort((x, y) => y.id - x.id);
  const noViews = (list) => JSON.stringify(list.map(({ views, ...rest }) => rest));
  if (noViews(kept) === noViews(existing.articles) && historyComplete === existing.historyComplete) {
    console.log('Rien de nouveau.');
    return;
  }
  await save(historyComplete);

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

// Labo : choix automatique de la vue de côté sur toutes les chaussures du site, sans les réglages à la main.
// SHARD=i/n : part de la liste traitée par cette machine. Résultats dans out/ (vignettes + rapport).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { autoShoe, finish, shoeTraits } from '../scripts/shoe-cover.mjs';
import { nounFor } from '../scripts/pick.mjs';
import { stopVision } from '../scripts/vision.mjs';

const [shard, of] = (process.env.SHARD || '0/1').split('/').map(Number);
const { articles } = JSON.parse(await readFile('data/articles.json', 'utf8'));
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(Number)) : null;
const shoes = articles.filter((a) => a.category === 'Chaussures' && !a.hidden && !a.dupOf && (!only || only.has(a.id)))
  .filter((_, i) => i % of === shard);
await mkdir('out', { recursive: true });
const report = [];
for (const a of shoes) {
  const t0 = Date.now();
  const nk = nounFor(a.title, a.type || a.category);
  const tr = shoeTraits(a.title, nk.noun);
  const job = { id: a.id, inputs: a.photos.map((p, i) => ({ n: i + 1, path: p })), openBack: tr.openBack, minRatio: tr.boot ? 1 : null };
  const lines = [];
  let r = null;
  try { r = await autoShoe(job, { all: true, log: (l) => lines.push(l) }); } catch (e) { lines.push('erreur ' + e.message); }
  if (!r) { report.push({ id: a.id, title: a.title, lines, error: 'pas de résultat' }); continue; }
  const seen = [];
  for (const [k, c] of r.seen.entries()) {
    try { await sharp(await finish(c)).resize(320).webp({ quality: 85 }).toFile(`out/${a.id}-${k}.webp`); } catch {}
    const { cut, ...m } = c;
    seen.push({ k, ...m });
  }
  report.push({ id: a.id, title: a.title, traits: tr, pick: r.pick ? r.seen.indexOf(r.pick) : null, seen, lines, secs: Math.round((Date.now() - t0) / 1000) });
  console.log(a.id, a.title, 'candidates', seen.length, 'pick', r.pick ? r.pick.n : '-', Math.round((Date.now() - t0) / 1000) + ' s');
  await writeFile('out/report.json', JSON.stringify(report));
}
await writeFile('out/report.json', JSON.stringify(report));
stopVision();
process.exit(0);

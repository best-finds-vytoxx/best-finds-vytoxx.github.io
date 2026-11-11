// Labo : tenue complète, haut ou bas ? (guessOutfit, modèle CLIP) sur les titres « running » ambigus et des témoins.
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { vagueSet } from '../scripts/parse.mjs';
const { articles } = JSON.parse(readFileSync('data/articles.json', 'utf8'));
const extra = (process.env.CONTROLS || '4287,3384,3973,4646,5105,4380,4160,4555').split(',').map(Number);
const list = articles.filter((a) => !a.hidden && !a.dupOf && (vagueSet(a.title) || extra.includes(a.id)));
await mkdir('out', { recursive: true });
await writeFile('out/jobs.json', JSON.stringify(list.map((a) => ({ key: a.id, title: a.title, type: a.category, classify: true, outfit: true, debug: true, images: a.photos }))));
const r = spawnSync(process.execPath, ['scripts/rank-worker.mjs', 'out/jobs.json', 'out/res.json'], { stdio: 'inherit' });
const res = JSON.parse(readFileSync('out/res.json', 'utf8'));
for (const a of list) console.log(a.id, a.title.padEnd(40), 'site :', a.category.padEnd(10), '→ photos :', res[a.id]?.cat?.type || '(indécis)');
await writeFile('out/per.json', JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.per]))));
process.exit(r.status || 0);

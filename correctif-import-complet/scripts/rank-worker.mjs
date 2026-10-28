// Note chaque photo selon sa pertinence comme couverture (modèle CLIP), dans un processus séparé
// (le modèle de reconnaissance et celui du détourage ne peuvent pas être chargés dans le même processus).
// Usage : node scripts/rank-worker.mjs entree.json sortie.json
// entree.json = [{ key, title, type, images: [chemins], verify? }]
// sortie.json = { key: { scores: [note de chaque image], front: [avant photo 1, avant photo 2] (chaussures),
//                        packaging: [part « emballage » de chaque image] (mode vérification) } }
// Mode vérification (verify: true) : on contrôle une photo détourée — le produit est-il bien là, sans son emballage ?
// Les images transparentes (photos détourées) sont posées sur fond blanc avant d'être notées.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline, env, RawImage } from '@huggingface/transformers';
import { nounFor, labelsFor, SHOE_FRONT } from './pick.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
env.cacheDir = path.join(ROOT, '.cache', 'models'); // téléchargé au premier besoin (quelques secondes sur GitHub)
const MODEL = 'Xenova/clip-vit-base-patch32';

const [input, output] = process.argv.slice(2);
const jobs = JSON.parse(await readFile(input, 'utf8'));
const clf = await pipeline('zero-shot-image-classification', MODEL, { dtype: 'q8' });

async function load(file) {
  const img = await RawImage.read(file);
  if (img.channels !== 4) return img.rgb();
  // fond blanc sous la transparence
  const { data, width, height } = img;
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const a = data[i + 3] / 255;
    rgb[j] = data[i] * a + 255 * (1 - a);
    rgb[j + 1] = data[i + 1] * a + 255 * (1 - a);
    rgb[j + 2] = data[i + 2] * a + 255 * (1 - a);
  }
  return new RawImage(rgb, width, height, 3);
}

const out = {};
const score = (res, label) => Math.round((res.find((r) => r.label === label)?.score || 0) * 1000) / 1000;
for (const job of jobs) {
  const nk = nounFor(job.title, job.type);
  const r = { scores: [] };
  if (job.verify) {
    const labels = [labelsFor(nk)[0], 'a cardboard box or product packaging', 'a close-up of a label, tag or barcode', 'an empty white background'];
    r.packaging = [];
    for (const file of job.images) {
      try {
        const res = await clf(await load(file), labels);
        r.scores.push(score(res, labels[0]));
        r.packaging.push(score(res, labels[1]));
      } catch (e) { console.warn(`  vérification impossible pour ${path.basename(file)} : ${e.message}`); r.scores.push(0); r.packaging.push(1); }
    }
  } else {
    const labels = labelsFor(nk);
    for (const file of job.images) {
      try { r.scores.push(score(await clf(await load(file), labels), labels[0])); }
      catch (e) { console.warn(`  note impossible pour ${path.basename(file)} : ${e.message}`); r.scores.push(0); }
    }
    if (nk.kind === 'shoe' && job.images.length >= 2) {
      r.front = [];
      for (const file of job.images.slice(0, 2)) {
        try { r.front.push(score(await clf(await load(file), SHOE_FRONT), SHOE_FRONT[0])); } catch { r.front.push(0); }
      }
    }
  }
  out[job.key] = r;
}
await writeFile(output, JSON.stringify(out));
process.exit(0);

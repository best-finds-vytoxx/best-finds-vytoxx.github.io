// Processus séparé pour le détourage : si le moteur de détourage plante, seul ce processus s'arrête,
// et l'import des articles continue (l'article garde simplement ses photos d'origine).
// Usage : node scripts/cutout-worker.mjs jobs.json
// jobs.json = [{ id, type, kind, order: [numéros de photo à essayer, du plus pertinent au moins pertinent],
//               exclude: [photos déjà refusées], inputs: [{ n, path }], out: chemin du cover.webp }]
// Pour chaque article traité, une ligne « id:ok:n » (photo n retenue) ou « id:none » est ajoutée à jobs.json.done
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import sharp from 'sharp';
import { cutout } from './cutout.mjs';
import { stopVision } from './vision.mjs';

// L'ordre d'essai vient du modèle de reconnaissance (voir pick.mjs) : la photo la plus pertinente d'abord
// (vêtement de face, chaussures de face, le produit plutôt que son emballage).
// Si aucune ne se détoure proprement, pas de photo détourée : le site affiche la photo d'origine la plus pertinente.
// Vêtements du haut : une photo où l'article est plié est mise de côté si une vue à plat existe.
const TOPS = new Set(['Vestes', 'Doudounes', 'Sweats', 'Hauts']);

/** Forme de l'objet détouré : largeur / hauteur, et part de son cadre qu'il remplit. */
async function shape(webp) {
  const { data, info } = await sharp(webp).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1, n = 0;
  for (let y = 0; y < info.height; y += 2) for (let x = 0; x < info.width; x += 2) {
    if (data[y * info.width + x] > 128) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return { ratio: 1, fill: 0 };
  return { ratio: (x1 - x0) / (y1 - y0), fill: n / (((x1 - x0) / 2 + 1) * ((y1 - y0) / 2 + 1)) };
}
// Un haut plié forme un bloc large et plein ; posé à plat bras écartés, il est large aussi mais laisse des vides
const folded = (c) => c.ratio > 1.2 && c.fill > 0.8;

async function tryCut(job, n) {
  const input = job.inputs.find((i) => i.n === n);
  if (!input) return null;
  try {
    // chaussures et accessoires : boîte, carton et étiquettes posés à côté sont retirés (sauf si la boîte est le produit)
    // seconde méthode de détourage (vêtements blancs ou gris sur la table) : réservée aux vêtements,
    // elle ne sait pas séparer un petit objet de sa boîte
    let buf = await readFile(input.path);
    // recadrage choisi à la main (data/overrides.json, « crop » : [gauche, haut, droite, bas] en fractions de la photo),
    // appliqué à la photo imposée : isole le produit quand il est entouré de sa boîte et de ses papiers
    if (job.crop && n === job.forced) {
      const img = sharp(buf).rotate();
      const { width: W, height: H } = await sharp(await img.clone().toBuffer()).metadata();
      const [x0, y0, x1, y1] = job.crop;
      buf = await img.extract({ left: Math.round(x0 * W), top: Math.round(y0 * H), width: Math.round((x1 - x0) * W), height: Math.round((y1 - y0) * H) }).png().toBuffer();
    }
    const out = await cutout(buf, { dropPackaging: job.kind !== 'wear' && !job.box, rescue: job.kind === 'wear', prompt: job.prompt || null });
    if (!out) { console.log(`  ${job.id} : détourage de la photo ${n} jugé raté`); return null; }
    const sh = await shape(out);
    if (process.env.DEBUG_CUT) console.log(`  ${job.id} photo ${n} : largeur/hauteur ${sh.ratio.toFixed(2)}, remplissage ${sh.fill.toFixed(2)}`);
    return { n, out, ...sh };
  } catch (e) {
    console.warn(`  ${job.id} : détourage impossible (photo ${n}) : ${e.message}`);
    return null;
  }
}

async function choose(job) {
  const top = TOPS.has(job.type) && job.kind === 'wear';
  const order = (job.order || [1, 3, 4]).filter((n) => !(job.exclude || []).includes(n));
  let foldedPick = null;
  for (const n of order.slice(0, 4)) {
    const c = await tryCut(job, n);
    if (!c) continue;
    if (top && folded(c) && n !== job.forced) { foldedPick = foldedPick || c; continue; }
    return c;
  }
  return foldedPick; // un haut plié reste une vue de face : mieux que rien
}

const jobsFile = process.argv[2];
const jobs = JSON.parse(await readFile(jobsFile, 'utf8'));
const doneFile = `${jobsFile}.done`;
const done = new Set((await readFile(doneFile, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => l.split(':')[0]));

for (const job of jobs) {
  if (done.has(String(job.id))) continue;
  // marquer « en cours » : si le processus plante sur cet article, il ne sera pas retenté indéfiniment
  await appendFile(doneFile, `${job.id}:start\n`);
  const pick = await choose(job);
  if (pick) await writeFile(job.out, pick.out);
  else console.log(`  ${job.id} : aucune photo de face détourable, la photo 1 d'origine sera affichée`);
  await appendFile(doneFile, pick ? `${job.id}:ok:${pick.n}\n` : `${job.id}:none\n`);
}
// Sortie immédiate : évite certains plantages du moteur à la fermeture du processus
process.exit(0);

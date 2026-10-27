// Processus séparé pour le détourage : si le moteur de détourage plante, seul ce processus s'arrête,
// et l'import des articles continue (l'article garde simplement ses photos d'origine).
// Usage : node scripts/cutout-worker.mjs jobs.json
// jobs.json = [{ id, inputs: [chemins des photos d'origine], out: chemin du cover.webp }]
// Pour chaque article traité, une ligne « id:ok » ou « id:none » est ajoutée à jobs.json.done
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { cutout } from './cutout.mjs';

const jobsFile = process.argv[2];
const jobs = JSON.parse(await readFile(jobsFile, 'utf8'));
const doneFile = `${jobsFile}.done`;
const done = new Set((await readFile(doneFile, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => l.split(':')[0]));

for (const job of jobs) {
  if (done.has(String(job.id))) continue;
  // marquer « en cours » : si le processus plante sur cet article, il ne sera pas retenté indéfiniment
  await appendFile(doneFile, `${job.id}:start\n`);
  let ok = false;
  for (const [i, input] of job.inputs.entries()) {
    try {
      const out = await cutout(await readFile(input));
      if (out) { await writeFile(job.out, out); ok = true; break; }
      console.log(`  ${job.id} : détourage de la photo ${i + 1} jugé raté, photo suivante`);
    } catch (e) {
      console.warn(`  ${job.id} : détourage impossible (photo ${i + 1}) : ${e.message}`);
    }
  }
  await appendFile(doneFile, `${job.id}:${ok ? 'ok' : 'none'}\n`);
}
// Sortie immédiate : évite certains plantages du moteur à la fermeture du processus
process.exit(0);

// Contrôle qualité automatique, à chaque passage du robot, après la lecture du canal et le relevé des prix.
// Il relit tout le site comme le ferait Léonard : prix, détourage, fichiers, titre, lien, fraîcheur des relevés.
// Résultat dans data/health.json (affiché en haut du tracker) et dans le compte rendu du passage.
// Ce que le robot sait réparer seul est relancé par lui (scrape.mjs retente un détourage raté, prices.mjs un prix) ;
// seul ce qui résiste à plusieurs essais est marqué « à voir ».
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const H = 36e5;
export const COVER_TRIES = 3; // essais de détourage avant de laisser la photo d'origine (voir scrape.mjs)

/**
 * articles : data/articles.json ; prices : data/prices.json ; exists(chemin) → fichier présent ? ; prev : ancien health.json.
 * Renvoie { ok, counts, issues: [{ id, title, type, text, level: 'auto' | 'voir', since }] }.
 */
export async function audit({ articles, sweptAt, prices, exists, prev = {}, now = Date.now() }) {
  const items = prices?.items || {};
  const visible = articles.filter((a) => !a.hidden && !a.dupOf && !items[a.id]?.off);
  const issues = [];
  const add = (a, type, text, level) => issues.push({ id: a?.id ?? 0, title: a?.title || 'Robot', type, text, level });
  for (const a of visible) {
    const p = items[a.id];
    const age = a.addedAt ? (now - Date.parse(a.addedAt)) / H : 999;
    if (!(p && p.eur && (!p.pid || p.pid === a.productId))) {
      if (age > 3) add(a, 'prix', 'prix pas encore relevé', age > 48 ? 'voir' : 'auto');
    } else if (p.checked && (now - Date.parse(p.checked)) / H > 96) add(a, 'prix', 'prix non revérifié depuis 4 jours', 'auto');
    if (!a.link) add(a, 'lien', 'pas de lien LoveGoBuy', 'voir');
    if (!a.cover) add(a, 'photo', (a.coverTries || 0) >= COVER_TRIES ? 'détourage impossible, photo d’origine affichée' : 'détourage à refaire', (a.coverTries || 0) >= COVER_TRIES ? 'voir' : 'auto');
    else if (!(await exists(a.cover))) add(a, 'photo', 'fichier de couverture manquant', 'voir');
    if (!a.photos?.length) add(a, 'photo', 'aucune photo', 'voir');
    else if (!(await exists(a.photos[0]))) add(a, 'photo', 'photos manquantes', 'voir');
    if (!a.title || a.title.length < 3 || /[＀-￯　�]/.test(a.title)) add(a, 'titre', 'titre mal écrit', 'auto');
    if (!a.category) add(a, 'catégorie', 'sans catégorie', 'voir');
  }
  // le robot lui-même : relevés trop anciens = quelque chose est en panne
  if (sweptAt && (now - Date.parse(sweptAt)) / H > 12) add(null, 'robot', 'le canal n’a pas été relu en entier depuis plus de 12 h', 'voir');
  const lastPrice = Math.max(0, ...Object.values(items).map((p) => Date.parse(p.checked || 0) || 0));
  if (visible.length && lastPrice && (now - lastPrice) / H > 48) add(null, 'robot', 'aucun prix relevé depuis 2 jours', 'voir');
  // ancienneté de chaque problème (gardée d'un passage à l'autre)
  const before = new Map((prev.issues || []).map((i) => [`${i.id}:${i.type}:${i.text}`, i.since]));
  const iso = new Date(now).toISOString();
  for (const i of issues) i.since = before.get(`${i.id}:${i.type}:${i.text}`) || iso;
  const count = (f) => issues.filter(f).length;
  return { ok: !issues.length, counts: { articles: visible.length, auto: count((i) => i.level === 'auto'), voir: count((i) => i.level === 'voir') }, issues };
}

async function main() {
  const file = path.join(ROOT, 'data', 'health.json');
  const read = async (f, d) => JSON.parse(await readFile(path.join(ROOT, 'data', f), 'utf8').catch(() => d));
  const data = await read('articles.json', '{"articles":[]}');
  const prev = await read('health.json', '{}');
  const exists = (p) => access(path.join(ROOT, p)).then(() => true, () => false);
  const r = await audit({ articles: data.articles || [], sweptAt: data.sweptAt, prices: await read('prices.json', '{}'), exists, prev });
  console.log(`Contrôle qualité : ${r.counts.articles} articles, ${r.ok ? 'tout est en ordre' : `${r.counts.auto} point(s) que le robot corrige seul, ${r.counts.voir} à voir`}`);
  for (const i of r.issues.slice(0, 40)) console.log(`  ${i.level === 'voir' ? '!' : '·'} ${i.id || ''} ${i.title} : ${i.text}`);
  // fichier réécrit seulement si le résultat change (pas de mise en ligne inutile)
  const same = JSON.stringify({ ...prev, checkedAt: 0 }) === JSON.stringify({ checkedAt: 0, ...r, checkedAt: 0 });
  if (!same) await writeFile(file, JSON.stringify({ checkedAt: new Date().toISOString(), ...r }, null, 1) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => { console.error('Contrôle qualité impossible :', e.message); process.exit(0); });
}

// Prix des articles, relevés automatiquement à chaque passage du robot (data/prices.json).
// Lancé par le workflow après scrape.mjs, ou à la main : node scripts/prices.mjs
//
// - Prix en CNY : celui du vendeur Weidian, le même que sur la page LoveGoBuy de l'article
//   (vérifié sur 270 relevés faits à la main sur LoveGoBuy : identiques).
// - Prix en euros : calculé comme LoveGoBuy, avec son taux (4 décimales, centimes arrondis vers le bas).
//   Le taux de LoveGoBuy suit le dollar : taux = (CNY → USD du jour) × k, avec k mesuré sur les pages LoveGoBuy
//   (prices.json → rate.k). Si le cours du jour ne peut pas être lu, le dernier taux connu est gardé.
// - Chaque prix est revérifié environ une fois par jour ; un nouvel article (ou un lien changé) est relevé tout de suite.
// - Article introuvable ou épuisé chez le vendeur à deux relevés espacés d'au moins 20 h : « off », il quitte le site
//   jusqu'à son retour (le site le réaffiche dès qu'il est de nouveau disponible).
// - Les prix écrits dans les posts Telegram ne sont jamais utilisés.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PRICES = process.env.PRICES_FILE || path.join(ROOT, 'data', 'prices.json');
const ARTICLES = process.env.ARTICLES_FILE || path.join(ROOT, 'data', 'articles.json');
const REFRESH_H = Number(process.env.PRICE_REFRESH_H || 20); // âge maximal d'un prix avant nouvelle vérification
const MAX = Number(process.env.PRICE_MAX || 60); // produits interrogés au plus par passage
const MIN = 8; // produits interrogés au moins par passage (les plus anciens relevés) : sert aussi de contrôle
const OFF_H = 20; // écart minimal entre deux relevés « indisponible » avant de retirer l'article
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prix en euros affiché par LoveGoBuy : CNY × taux, centimes arrondis vers le bas (750 CNY × 0,1459 = 109,42 €). */
export const euros = (cny, rate) => Math.floor(cny * rate * 100 + 1e-6) / 100;
/** Date du jour à Paris, AAAA-MM-JJ. */
export const parisDay = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/** Cours CNY → USD du jour (banque centrale européenne, sinon un second service). null si illisible. */
export async function usdPerCny() {
  const sources = [
    ['https://api.frankfurter.app/latest?from=CNY&to=USD', (j) => j?.rates?.USD],
    ['https://open.er-api.com/v6/latest/CNY', (j) => j?.rates?.USD],
  ];
  for (const [url, pick] of sources) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const v = Number(pick(await r.json()));
      if (v > 0.05 && v < 0.5) return v;
    } catch {}
  }
  return null;
}

/** Prix d'un produit Weidian : { cny, stock } ; { missing: true } s'il est introuvable ; { error } si la lecture a échoué. */
export async function weidian(itemId) {
  const url = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=${encodeURIComponent(JSON.stringify({ itemId: String(itemId) }))}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://weidian.com/' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    if (j?.status?.code !== 0 || !j.result) return { error: `réponse ${j?.status?.code ?? '?'}` };
    const low = j.result.itemDiscountLowPrice;
    if (typeof low !== 'number' || low <= 0) return { missing: true };
    return { cny: Math.round(low) / 100, stock: typeof j.result.itemStock === 'number' ? j.result.itemStock : null };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Met à jour les prix. articles = liste de data/articles.json, prices = contenu de data/prices.json.
 * Renvoie le nouveau contenu de prices.json (même objet si rien n'a changé) et un compte rendu.
 */
export async function updatePrices({ articles, prices, now = Date.now(), fetchItem = weidian, fetchUsd = usdPerCny, wait = 300, log = console.log }) {
  const items = JSON.parse(JSON.stringify(prices.items || {}));
  const rate = { eurPerCny: 0.1459, k: 0.9729, ...(prices.rate || {}) };
  const day = parisDay(now), iso = new Date(now).toISOString();

  // 1. Taux du jour
  const usd = await fetchUsd();
  if (usd) {
    const r = Math.round(usd * rate.k * 1e4) / 1e4;
    if (r !== rate.eurPerCny) log(`Taux LoveGoBuy : ${rate.eurPerCny} → ${r} € pour 1 CNY`);
    Object.assign(rate, { eurPerCny: r, usd, at: day });
  } else log(`Cours du jour illisible : taux gardé (${rate.eurPerCny} € pour 1 CNY)`);

  // 2. Produits à relever : articles affichés (et versions moins chères, pour comparer), un appel par produit
  const shown = articles.filter((a) => a.productId && !a.hidden && (!a.dupOf || a.lesser) && (a.shop || 'weidian') === 'weidian');
  const byPid = new Map();
  for (const a of shown) byPid.set(a.productId, [...(byPid.get(a.productId) || []), a]);
  const queue = [...byPid].map(([pid, list]) => {
    const ps = list.map((a) => items[a.id]);
    const missing = ps.some((p) => !p || p.pid !== pid || !p.cny);
    const age = Math.max(...ps.map((p) => (p?.checked && p.pid === pid ? now - Date.parse(p.checked) : Infinity)));
    return { pid, list, missing, age };
  }).sort((x, y) => (y.missing - x.missing) || (y.age - x.age));
  const due = queue.filter((q) => q.missing || q.age > REFRESH_H * 36e5);
  const todo = (due.length >= MIN ? due : queue.slice(0, MIN)).slice(0, MAX);

  const stats = { asked: todo.length, ok: 0, fresh: 0, changed: 0, off: 0, back: 0, errors: 0, unavailable: [] };
  for (const [i, q] of todo.entries()) {
    if (i && wait) await sleep(wait);
    const res = await fetchItem(q.pid);
    if (res.error) { stats.errors++; continue; }
    if (res.missing || res.stock === 0) { stats.unavailable.push(q); continue; }
    stats.ok++;
    for (const a of q.list) {
      const old = items[a.id];
      const known = old && old.pid === q.pid && old.cny;
      if (!known) stats.fresh++;
      else if (old.cny !== res.cny) { stats.changed++; log(`  prix changé : ${a.id} ${a.title} ${old.cny} → ${res.cny} CNY`); }
      if (known && old.off) { stats.back++; log(`  de nouveau disponible : ${a.id} ${a.title}`); }
      items[a.id] = { cny: res.cny, eur: euros(res.cny, rate.eurPerCny), pid: q.pid, at: day, checked: iso };
    }
  }
  // Indisponible : seulement si le relevé a bien fonctionné pour les autres produits (sinon, panne passagère)
  const healthy = stats.ok >= 3 && stats.ok >= stats.unavailable.length;
  for (const q of stats.unavailable) for (const a of q.list) {
    const old = items[a.id] && items[a.id].pid === q.pid ? items[a.id] : { pid: q.pid };
    if (!healthy) continue;
    const p = { ...old, checked: iso };
    if (!p.offSeen) p.offSeen = iso;
    else if (!p.off && now - Date.parse(p.offSeen) >= OFF_H * 36e5) { p.off = true; stats.off++; log(`  indisponible chez le vendeur, retiré du site : ${a.id} ${a.title}`); }
    items[a.id] = p;
  }
  if (!healthy && stats.unavailable.length) log(`  ${stats.unavailable.length} produit(s) sans prix, mais relevé peu fiable cette fois : rien n'est retiré`);

  // 3. Euros recalculés au taux du jour pour tous les prix
  for (const p of Object.values(items)) if (p.cny) p.eur = euros(p.cny, rate.eurPerCny);

  const sorted = Object.fromEntries(Object.entries(items).sort((x, y) => Number(x[0]) - Number(y[0])));
  const next = { checkedAt: stats.ok ? day : prices.checkedAt || day, rate, items: sorted };
  log(`Prix : ${stats.asked} produit(s) vérifié(s) sur Weidian, ${stats.ok} lu(s)${stats.fresh ? `, ${stats.fresh} nouveau(x)` : ''}${stats.changed ? `, ${stats.changed} changé(s)` : ''}${stats.unavailable.length ? `, ${stats.unavailable.length} indisponible(s)` : ''}${stats.errors ? `, ${stats.errors} erreur(s)` : ''} ; taux ${rate.eurPerCny} € pour 1 CNY`);
  return { prices: JSON.stringify(next) === JSON.stringify(prices) ? prices : next, stats };
}

async function main() {
  const articles = JSON.parse(await readFile(ARTICLES, 'utf8')).articles || [];
  const prices = JSON.parse(await readFile(PRICES, 'utf8').catch(() => '{}'));
  const { prices: next } = await updatePrices({ articles, prices });
  if (next !== prices) await writeFile(PRICES, JSON.stringify(next, null, 1) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => { console.error('Relevé des prix impossible :', e.message); process.exit(0); });
}

// Tests hors ligne des corrections automatiques du robot : prix, versions « TOP quality », catégorie devinée.
import assert from 'node:assert/strict';
import { updatePrices, euros } from '../scripts/prices.mjs';
import { markDuplicates, markVersions, hasQuality, baseTitle } from '../scripts/parse.mjs';
import { guessCategory, CAT_LABELS } from '../scripts/pick.mjs';

// --- euros comme LoveGoBuy (relevés du 10 novembre 2026, taux 0,1459, centimes arrondis vers le bas)
assert.equal(euros(750, 0.1459), 109.42);
assert.equal(euros(300, 0.1459), 43.77);
assert.equal(euros(50, 0.1459), 7.29);

// --- taux LoveGoBuy d'après le cours du marché (relevés du 11 novembre 2026 : 0,1465 sur 9 produits)
{
  const { updatePrices: up, K_BY_SOURCE } = await import('../scripts/prices.mjs');
  const { prices: p1 } = await up({ articles: [], prices: { items: {} }, wait: 0, log: () => {}, fetchUsd: async () => ({ usd: 0.149528, source: 'er-api' }), fetchItem: async () => ({ error: 'x' }) });
  assert.equal(p1.rate.eurPerCny, 0.1465, 'cours du marché × k = taux LoveGoBuy');
  const { prices: p2 } = await up({ articles: [], prices: { items: {} }, wait: 0, log: () => {}, fetchUsd: async () => ({ usd: 0.14991, source: 'frankfurter' }), fetchItem: async () => ({ error: 'x' }) });
  assert.equal(p2.rate.eurPerCny, 0.1465, 'cours BCE × k = même taux');
  for (const [cny, eur] of [[900, 131.85], [750, 109.87], [700, 102.55], [510, 74.71], [270, 39.55], [180, 26.36], [21, 3.07], [10, 1.46], [5.2, 0.76]]) assert.equal(euros(cny, 0.1465), eur, `${cny} CNY = ${eur} € sur LoveGoBuy`);
  assert.ok(K_BY_SOURCE['er-api'] && K_BY_SOURCE.frankfurter);
}

// --- relevé des prix
const H = 36e5, T0 = Date.parse('2026-11-10T12:00:00Z');
const art = (id, pid, more = {}) => ({ id, title: `Article ${id}`, productId: pid, shop: 'weidian', ...more });
const silent = () => {};
const shop = (table) => async (pid) => table[pid] ?? { error: 'HTTP 500' };
{
  const articles = [art(1, 'p1'), art(2, 'p2'), art(3, 'p3', { hidden: true }), art(4, 'p4', { dupOf: 1 }), art(5, 'p5', { dupOf: 6, lesser: true }), art(6, 'p6'), art(7, 'p7'), art(8, 'p8')];
  const prices = { checkedAt: '2026-10-31', items: { 2: { cny: 100, eur: 14.62, pid: 'p2', at: '2026-10-30' }, 7: { cny: 80, eur: 11.69, pid: 'ancien-lien', at: '2026-10-30' } } };
  const asked = [];
  const table = { p1: { cny: 750, stock: 10 }, p2: { cny: 120, stock: 4 }, p5: { cny: 300, stock: 1 }, p6: { cny: 450, stock: 2 }, p7: { cny: 90, stock: 3 }, p8: { error: 'HTTP 403' } };
  const { prices: next, stats } = await updatePrices({ articles, prices, now: T0, wait: 0, log: silent, fetchUsd: async () => 0.14992, fetchItem: async (pid) => { asked.push(pid); return shop(table)(pid); } });
  assert.equal(next.rate.eurPerCny, 0.1459, 'taux du jour = cours USD × k');
  assert.ok(!asked.includes('p3') && !asked.includes('p4'), 'article masqué ou doublon : pas relevé');
  assert.ok(asked.includes('p5'), 'version moins chère : relevée (pour comparer)');
  assert.deepEqual({ cny: next.items[1].cny, eur: next.items[1].eur, pid: next.items[1].pid }, { cny: 750, eur: 109.42, pid: 'p1' }, 'nouvel article relevé');
  assert.equal(next.items[2].cny, 120, 'prix changé chez le vendeur');
  assert.equal(next.items[7].pid, 'p7', 'lien changé : prix du nouveau lien');
  assert.ok(!next.items[8], 'erreur de lecture : rien d’inventé');
  assert.equal(stats.errors, 1);
  assert.equal(next.checkedAt, '2026-11-10');
  // passage suivant, 1 h après : rien à relever d'urgence, seuls quelques prix (les plus anciens) sont revérifiés
  const again = [];
  await updatePrices({ articles, prices: next, now: T0 + H, wait: 0, log: silent, fetchUsd: async () => null, fetchItem: async (pid) => { again.push(pid); return shop(table)(pid); } });
  assert.ok(again.length <= 8 && again.includes('p8'), 'produit en erreur retenté en premier');
}
{
  // indisponible : retiré après deux relevés à plus de 20 h d'écart, réaffiché à son retour
  const articles = [art(1, 'p1'), art(2, 'p2'), art(3, 'p3'), art(4, 'p4')];
  let prices = { items: { 1: { cny: 100, eur: 14.59, pid: 'p1', at: '2026-11-09' } } };
  let table = { p1: { missing: true }, p2: { cny: 10, stock: 1 }, p3: { cny: 20, stock: 1 }, p4: { cny: 30, stock: 1 } };
  const run = async (now) => (prices = (await updatePrices({ articles, prices, now, wait: 0, log: silent, fetchUsd: async () => null, fetchItem: shop(table) })).prices);
  await run(T0);
  assert.ok(prices.items[1].offSeen && !prices.items[1].off, '1er relevé indisponible : noté, pas encore retiré');
  assert.equal(prices.items[1].cny, 100, 'ancien prix gardé');
  await run(T0 + 21 * H);
  assert.equal(prices.items[1].off, true, '2e relevé indisponible 21 h plus tard : retiré du site');
  table = { ...table, p1: { cny: 110, stock: 5 } };
  await run(T0 + 42 * H);
  assert.ok(!prices.items[1].off && !prices.items[1].offSeen && prices.items[1].cny === 110, 'de nouveau disponible : réaffiché');
  // épuisé (stock 0) = indisponible
  table = { ...table, p2: { cny: 10, stock: 0 } };
  await run(T0 + 63 * H);
  assert.ok(prices.items[2].offSeen, 'stock à 0 : indisponible');
}
{
  // panne passagère : tout « introuvable » d'un coup → rien n'est retiré
  const articles = [1, 2, 3, 4, 5].map((i) => art(i, 'p' + i));
  const prices = { items: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [i, { cny: 10, eur: 1.45, pid: 'p' + i, at: '2026-11-01' }])) };
  const { prices: next } = await updatePrices({ articles, prices, now: T0, wait: 0, log: silent, fetchUsd: async () => null, fetchItem: async () => ({ missing: true }) });
  assert.ok(Object.values(next.items).every((p) => !p.offSeen && !p.off), 'relevé peu fiable : aucun article marqué');
}

// --- versions « TOP quality » : seule la plus chère reste
assert.ok(hasQuality('Dior B22 TOP quality') && hasQuality('Yeezy 700 TOP') && hasQuality('Pull Moncler haute qualité'));
assert.ok(!hasQuality("Top d'entraînement Nike Brasil") && !hasQuality('Dior B22'), '« Top » en début de titre = un vêtement');
assert.equal(baseTitle('Dior B22 TOP quality'), baseTitle('Dior B22'));
{
  const m = new Map([[3912, { id: 3912, title: 'Dior B22 TOP quality', productId: 'a' }], [3559, { id: 3559, title: 'Dior B22', productId: 'b' }],
    [3581, { id: 3581, title: 'Dior B25', productId: 'c' }], [4555, { id: 4555, title: 'Nike Tech Fleece', productId: 'd' }], [4193, { id: 4193, title: 'Nike Tech Fleece', productId: 'e' }]]);
  const pr = { 3912: { cny: 450, pid: 'a' }, 3559: { cny: 310, pid: 'b' }, 4555: { cny: 180, pid: 'd' }, 4193: { cny: 140, pid: 'e' } };
  markDuplicates(m);
  assert.equal(markVersions(m, pr), 1);
  assert.equal(m.get(3559).dupOf, 3912, 'Dior B22 normale → renvoie vers la version TOP');
  assert.equal(m.get(3559).lesser, true);
  assert.ok(!m.get(4193).dupOf && !m.get(4555).dupOf, 'même titre sans mention de qualité : les deux restent');
  assert.ok(!m.get(3581).dupOf && !m.get(3912).dupOf);
  // passage suivant : même résultat (marques recalculées, rien ne s'accumule)
  markDuplicates(m); markVersions(m, pr);
  assert.equal(m.get(3559).dupOf, 3912);
  // la version TOP devient indisponible chez le vendeur : la version normale revient
  markDuplicates(m); markVersions(m, { ...pr, 3912: { ...pr[3912], off: true } });
  assert.ok(!m.get(3559).dupOf && !m.get(3559).lesser, 'version TOP indisponible : la normale est réaffichée');
  // version normale plus chère que la TOP : cas douteux, rien n'est masqué
  markDuplicates(m); markVersions(m, { ...pr, 3559: { cny: 500, pid: 'b' } });
  assert.ok(!m.get(3559).dupOf);
}

// --- catégorie devinée d'après les photos
const one = (type, v = 0.9) => { const r = Object.fromEntries(CAT_LABELS.map(([l]) => [l, (1 - v) / (CAT_LABELS.length - 1)])); r[CAT_LABELS.find((x) => x[1] === type)[0]] = v; return r; };
assert.equal(guessCategory([one('Chaussures'), one('Chaussures', 0.7)]).type, 'Chaussures');
assert.equal(guessCategory([one('Vestes'), one('Sweats', 0.6)]).type, 'Vestes', 'haut : le type précis le plus probable');
assert.equal(guessCategory([one('Bas')]), null, 'pantalon ou ensemble : le modèle les confond, rien de retenu');
assert.equal(guessCategory([one('Chaussures', 0.4)]), null, 'modèle hésitant : rien de retenu');
assert.equal(guessCategory([]), null);

console.log('robot : prix, versions et catégories OK');

// --- chaussures : vue de côté automatique (shoe-cover.mjs)
{
  const { cutEdges, profileOf, rotateMask, singleShoes } = await import('../scripts/shoe-cover.mjs');
  const { shoeTraits } = await import('../scripts/shoe-side.mjs');
  // silhouette de basket simplifiée (bout arrondi à gauche, talon droit à droite, semelle plate en bas)
  const w = 200, h = 90, mask = (cutTop = false) => {
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const topAt = 12 + 0.004 * (x - 150) ** 2; // pointe basse à gauche, col arrondi plus haut vers le talon
      const inToe = x > 8 || (y - 70) ** 2 / 400 + (x - 8) ** 2 / 64 <= 1;
      if (y >= Math.min(topAt, 80) && y <= 85 && x >= 3 && x <= 190 && inToe && !(cutTop && y < 22)) m[y * w + x] = 1;
    }
    return { m, w, h };
  };
  const whole = cutEdges(mask(), 0.02), cut = cutEdges(mask(true), 0.02);
  assert.ok(whole.top < 0.35 && cut.top > 0.35, `haut coupé net repéré (entière ${whole.top}, coupée ${cut.top})`);
  assert.ok(whole.left < 0.3, `bout arrondi non pris pour une coupe (${whole.left})`);
  const p = profileOf(mask());
  assert.ok(p.ratio > 1.35 && p.upright > 0, 'vue de côté, semelle en bas');
  assert.ok(profileOf(rotateMask(mask(), 180)).upright < p.upright, 'semelle en haut repérée après un demi-tour');
  // repérage : la paire entière et les doublons sont écartés, chaque chaussure gardée seule
  const boxes = [[0, 0, 1000, 600, 0.6], [20, 40, 480, 560, 0.55], [520, 30, 980, 580, 0.5], [22, 42, 478, 556, 0.4]];
  assert.equal(singleShoes(boxes, 1000, 600).length, 2, 'deux chaussures séparées, sans la paire ni le doublon');
  assert.deepEqual(shoeTraits('Claquettes Nike'), { openBack: true, boot: false });
  assert.deepEqual(shoeTraits('Bottes canada goose Toronto Boot'), { openBack: false, boot: true });
  assert.equal(shoeTraits('Crampon nike Mercurial').boot, false);
  console.log('OK chaussures : coupe nette, sens de la semelle, chaussures séparées');
}

// --- contrôle qualité (audit.mjs)
{
  const { audit } = await import('../scripts/audit.mjs');
  const now = Date.parse('2026-11-11T12:00:00Z'), old = '2026-11-01T00:00:00Z', fresh = '2026-11-11T11:00:00Z';
  const base = { link: 'x', category: 'Hauts', photos: ['images/1/1.jpg'], cover: 'images/1/cover.webp', addedAt: old };
  const articles = [
    { ...base, id: 1, title: 'Polo', productId: 'p1' },
    { ...base, id: 2, title: 'Veste （NFC）', productId: 'p2' },
    { ...base, id: 3, title: 'Short', productId: 'p3', cover: null, coverTries: 1 },
    { ...base, id: 4, title: 'Jean', productId: 'p4', cover: null, coverTries: 3 },
    { ...base, id: 5, title: 'Nouveau', productId: 'p5', addedAt: fresh },
    { ...base, id: 6, title: 'Sans prix', productId: 'p6' },
    { ...base, id: 7, title: 'Masqué', productId: 'p7', hidden: true, cover: null },
  ];
  const ok = (pid) => ({ cny: 100, eur: 14.59, pid, checked: '2026-11-11T08:00:00Z' });
  const prices = { items: { 1: ok('p1'), 2: ok('p2'), 3: ok('p3'), 4: ok('p4'), 6: ok('ancien') } };
  const r = await audit({ articles, sweptAt: '2026-11-11T10:00:00Z', prices, exists: async () => true, now });
  const of = (id) => r.issues.filter((i) => i.id === id).map((i) => `${i.type}:${i.level}`).join();
  assert.equal(of(1), '', 'article sain : rien');
  assert.equal(of(2), 'titre:auto');
  assert.equal(of(3), 'photo:auto', 'détourage raté : le robot retente');
  assert.equal(of(4), 'photo:voir', 'trois essais ratés : signalé');
  assert.equal(of(5), '', 'article tout neuf : le prix arrive au passage suivant');
  assert.equal(of(6), 'prix:voir', 'prix d’un ancien lien : pas de prix valable');
  assert.equal(of(7), '', 'article masqué : pas contrôlé');
  assert.equal((await audit({ articles: [articles[0]], sweptAt: '2026-11-10T10:00:00Z', prices, exists: async () => true, now })).issues[0].type, 'robot');
  console.log('OK contrôle qualité');
}

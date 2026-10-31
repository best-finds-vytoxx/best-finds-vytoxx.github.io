import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseMessages, toArticles, parseChannel, minId, PRICE_NOTE, SHIPPING_NOTE, extraFrom, markDuplicates } from '../scripts/parse.mjs';

// 1. Pages réelles capturées : chaque article vu dans le navigateur doit être retrouvé
const pages = readdirSync('test/fixtures').filter((f) => f.endsWith('.html')).map((f) => readFileSync('test/fixtures/' + f, 'utf8'));
const arts = toArticles(pages.flatMap(parseMessages));
const ref = JSON.parse(readFileSync('test/fixtures/browser-articles.json', 'utf8'));
for (const r of ref) {
  const a = arts.find((x) => x.id === r.id);
  assert.ok(a, 'manquant ' + r.id);
  assert.equal(a.link, r.link, 'lien ' + r.id);
  assert.equal(a.photosRemote.length, r.photos.length, 'photos ' + r.id);
  assert.equal(a.photosRemote[0], r.photos[0], 'photo0 ' + r.id);
}
assert.equal(arts.length, ref.length);
assert.ok(!arts.find((a) => a.id === 5460), 'la réponse 5460 ne doit pas être un article');
assert.ok(minId(parseMessages(pages[0])) > 0);
assert.equal(parseChannel(pages[0]).title, 'Best Finds Vytoxx 🔎');

// 2. Historique complet du canal (306 posts) : aucun prix ne doit apparaître nulle part
const hist = JSON.parse(readFileSync('test/fixtures/history-texts.json', 'utf8'));
const fake = Object.entries(hist).map(([id, text]) => ({ id: +id, date: '2026-01-01T00:00:00Z', text, links: [{ href: 'https://www.lovegobuy.com/product?shop_type=weidian&id=1' }], photos: ['x', 'y'] }));
const all = toArticles(fake);
assert.equal(all.length, 306);
const money = /€|\$|prix|\d+[.,]\d+\s*e\b/i;
for (const a of [...all, ...arts]) {
  assert.ok(!('price' in a), 'champ prix présent ' + a.id);
  assert.ok(a.title && !money.test(a.title), 'titre ' + a.id + ' ' + a.title);
  const generic = a.description.replace(PRICE_NOTE, '').replace(SHIPPING_NOTE, '').replace(/le prix de la livraison/g, '');
  assert.ok(!money.test(generic), 'prix dans la description ' + a.id + ' : ' + a.description);
  assert.equal(extraFrom(a.description), a.extra || '', 'texte libre retrouvé ' + a.id);
  assert.ok(a.description.includes(PRICE_NOTE), 'mention du prix sur LoveGoBuy ' + a.id);
}
const withPoids = all.filter((a) => /Poids/i.test(hist[a.id]));
const noWeight = withPoids.filter((a) => !a.weight);
assert.equal(noWeight.length, 0, 'poids non lus : ' + noWeight.map((a) => a.id + ' ' + hist[a.id].match(/Poids[^\n]*/)).join(' | '));

const cats = {};
all.forEach((a) => (cats[a.category] = (cats[a.category] || 0) + 1));
console.log('catégories', cats);
console.log('sans marque', all.filter((a) => !a.brand).length, '/', all.length);
if (process.env.VERBOSE) {
  for (const a of all.filter((x) => x.category === 'Autres' || !x.brand)) console.log('  ', a.id, a.category, a.brand, '|', a.title);
  console.log(all.find((a) => a.weight?.max).description);
  console.log(arts[0].description);
}
console.log('OK', arts.length, 'articles récents,', all.length, 'dans l\'historique');

// 3. Post avec un lien produit sur l'emoji 🔗 avant le vrai « lien LoveGoBuy » : c'est le second qui compte
{
  const [a] = toArticles([{ id: 4105, date: '2026-01-01T00:00:00Z', text: '🔍Corteiz × Nike Air Max 95\n⚖️Poids: ~ 1082g\n🔗lien LoveGoBuy', photos: ['x'], links: [
    { label: '🔗', href: 'https://www.lovegobuy.com/product?shop_type=weidian&id=7730484310&invite_code=V4LTTW' },
    { label: 'lien LoveGoBuy', href: 'https://www.lovegobuy.com/product?shop_type=weidian&id=7828590540&invite_code=V4LTTW' },
  ] }]);
  assert.equal(a.productId, '7828590540', 'lien LoveGoBuy du post 4105');
  console.log('OK lien LoveGoBuy choisi par son intitulé');
}

// Doublons : même lien LoveGoBuy posté deux fois → seul le plus récent reste affiché
{
  const m = new Map([
    [10, { id: 10, shop: 'weidian', productId: '1' }],
    [20, { id: 20, shop: 'weidian', productId: '1' }],
    [30, { id: 30, shop: 'weidian', productId: '2', dupOf: 99 }],
  ]);
  assert.equal(markDuplicates(m), 1);
  assert.equal(m.get(10).dupOf, 20);
  assert.ok(!('dupOf' in m.get(20)));
  assert.ok(!('dupOf' in m.get(30)), 'ancienne marque de doublon retirée');
  console.log('OK doublons (même lien LoveGoBuy)');
}

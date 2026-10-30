// Choix de la photo de couverture : à partir du titre de l'article, on décrit en anglais ce que doit montrer
// la bonne photo (« une gourde, le produit lui-même bien visible »), et ce qu'elle ne doit PAS montrer
// (emballage, étiquette, dos du vêtement, semelle…). Un modèle de reconnaissance d'images (CLIP) note ensuite
// chaque photo : la mieux notée devient la couverture.
// Fonctions pures, partagées par le robot (scripts/rank-worker.mjs et scripts/scrape.mjs).

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// [motif dans le titre, objet en anglais, famille] — le mot trouvé le plus tôt dans le titre l'emporte
// (« Veste … Windrunner » est une veste, « Veste … avec lunettes » aussi)
const RULES = [
  [/gourde|tumbler|quencher|bouteille/, 'a water bottle', 'acc'],
  [/bracelet/, 'a bracelet', 'acc'],
  [/bague|serpenti/, 'a ring', 'acc'],
  [/collier|necklace|alhambra/, 'a necklace', 'acc'],
  [/montre|watch|chrono|rolex/, 'a wristwatch', 'acc'],
  [/bonnet|beanie/, 'a beanie hat', 'acc'],
  [/echarpe|scarf/, 'a scarf', 'acc'],
  [/casquette|\bcaps?\b|\bhat\b/, 'a baseball cap', 'acc'],
  [/lunettes|glasses/, 'sunglasses', 'acc'],
  [/ceinture|belt/, 'a belt', 'acc'],
  [/porte-?cartes|wallet|portefeuille|carte/, 'a card holder wallet', 'acc'],
  [/\bsacs?\b|\bbag|bowling|cisalpin|sprayground/, 'a bag', 'acc'],
  [/chaussettes|socks/, 'socks', 'acc'],
  [/coque/, 'a phone case', 'acc'],
  [/airpods max|casque(?!tte)/, 'over-ear headphones', 'acc'],
  [/airpods|ecouteur/, 'wireless earbuds', 'acc'],
  [/enceinte|jbl|boombox/, 'a bluetooth speaker', 'acc'],
  [/seche-cheveux|dyson|supersonic/, 'a hair dryer', 'acc'],
  [/mocassin/, 'loafers', 'shoe'],
  [/sandale/, 'sandals', 'shoe'],
  [/mules|claquette|slide|sabot|crocs|birkenstock/, 'slides', 'shoe'],
  [/escarpin/, 'high heel shoes', 'shoe'],
  [/boots?\b|botte/, 'boots', 'shoe'],
  [/chaussure|sneaker|basket|shoes?\b|\btn\b|air max|air force|jordan|dunk|9060|1906|shox|p6000|runner|trainer|cloud|gel-|kayano|xt-6|saucony|yeezy|dior b\d|golden goose|mizuno|asics|numeris/, 'a pair of sneakers', 'shoe'],
  [/ensemble|survetement|tracksuit|\bsets?\b|hooded and pant/, 'a tracksuit set with jacket and pants', 'wear'],
  [/short/, 'shorts', 'wear'],
  [/jean/, 'jeans', 'wear'],
  [/pantalon|pants?\b|jogging|jogger|legging|cargo|calecon/, 'pants', 'wear'],
  [/doudoune|pjs|puffer|parka|macmillan/, 'a puffer jacket', 'wear'],
  [/gilet/, 'a vest', 'wear'],
  [/veste|jacket|coupe[\s-]?vent|windrunner|blouson|manteau/, 'a jacket', 'wear'],
  [/hoodie|capuche|\bhood\b|sweat|tech fleece|nike tech/, 'a hoodie', 'wear'],
  [/pull|cardigan|crewneck/, 'a sweater', 'wear'],
  [/maillot/, 'a football jersey', 'wear'],
  [/polo\b/, 'a polo shirt', 'wear'],
  [/t-?shirt|\btee\b/, 'a t-shirt', 'wear'],
  [/chemise|shirt/, 'a shirt', 'wear'],
];
const BY_TYPE = {
  Doudounes: ['a puffer jacket', 'wear'], Vestes: ['a jacket', 'wear'], Sweats: ['a hoodie', 'wear'], Hauts: ['a t-shirt', 'wear'],
  Bas: ['pants', 'wear'], Ensembles: ['a clothing set', 'wear'], Chaussures: ['a pair of sneakers', 'shoe'], Accessoires: ['an accessory', 'acc'],
};

/** Ce que représente l'article : { noun: objet en anglais, kind: 'wear' | 'shoe' | 'acc' } */
export function nounFor(title, type) {
  // « Sweet Pants » est une marque (casquettes), pas un pantalon
  const t = fold(title).replace(/sweet pants/g, ' ');
  // l'article est lui-même une boîte (ex. « Rolex Watch Box ») : la boîte est le produit, on ne la retire pas
  if (/watch box|boite a montre|coffret/.test(t)) return { noun: 'a watch presentation box', kind: 'acc', box: true };
  let best = null;
  for (const [re, noun, kind] of RULES) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { index: m.index, noun, kind };
  }
  if (best) return { noun: best.noun, kind: best.kind };
  const [noun, kind] = BY_TYPE[type] || ['a product', 'acc'];
  return { noun, kind };
}

/** Descriptions proposées au modèle : la première est la bonne photo, les autres sont à éviter. */
export function labelsFor({ noun, kind }) {
  const pos = kind === 'shoe' ? `a photo of ${noun}, the whole pair of shoes clearly visible on a table`
    : kind === 'wear' ? `a photo of ${noun} laid flat, the whole garment seen from the front`
    : `a photo of ${noun}, the product itself clearly visible`;
  const neg = ['a cardboard box or product packaging', 'a close-up of a label, tag or barcode', 'a paper shopping bag', 'a measuring ruler'];
  if (kind === 'wear') neg.push(`the back of ${noun}`, `a folded ${noun}`, 'a close-up of fabric or stitching detail');
  if (kind === 'shoe') neg.push('shoes inside an open shoe box', 'the sole of a shoe seen from below', 'the inside of a shoe');
  if (kind === 'acc') neg.push('a close-up of fabric or stitching detail');
  return [pos, ...neg];
}

/**
 * Ordre d'essai des photos pour la couverture, de la plus pertinente à la moins pertinente.
 * scores[i] = note (0 à 1) de la photo i+1.
 * - Vêtements : sur le canal, la photo 1 est la face, la 2 le dos, les suivantes d'autres vues ou des détails.
 *   On suit cet ordre (1, 3, 4, 5…), jamais la 2, en écartant les photos que le modèle juge hors sujet
 *   (étiquette, gros plan du tissu, emballage).
 * - Chaussures et accessoires : la photo la mieux notée d'abord (le produit lui-même, pas sa boîte),
 *   avec une légère préférence pour la photo 1 à note quasi égale.
 */
// Chaussures : sur le canal, la photo 1 montre presque toujours l'arrière (talons) et la photo 2 l'avant.
// Le modèle compare les deux ; on ne garde la photo 1 que s'il y voit nettement mieux l'avant.
export const SHOE_FRONT = ['shoes viewed from the front with laces and tongue visible', 'shoes viewed from the back with heel tabs visible'];
export const shoeFront = (front1, front2) => (front1 - front2 >= 0.1 ? 1 : 2);

export function candidateOrder(scores, kind, front = null) {
  const max = Math.max(0, ...scores);
  if (kind === 'shoe' && front && scores[front - 1] >= max * 0.45) {
    const other = front === 1 ? 2 : 1;
    const rest = scores.map((s, i) => ({ n: i + 1, s })).filter((c) => c.n !== front && c.n !== other && c.s >= max * 0.5).sort((a, b) => b.s - a.s);
    return [front, other, ...rest.map((c) => c.n)].filter((n) => n <= scores.length);
  }
  if (kind === 'wear') {
    const base = scores.map((s, i) => ({ n: i + 1, s })).filter((c) => c.n !== 2);
    // seules les photos nettement hors sujet sont écartées (étiquette, gros plan : note très basse)
    const ok = base.filter((c) => c.s >= Math.min(0.1, max * 0.3));
    return (ok.length ? ok : base).map((c) => c.n);
  }
  return scores
    .map((s, i) => ({ n: i + 1, s: s + (i === 0 ? 0.04 : 0) }))
    .filter((c) => c.s >= Math.min(0.15, max * 0.5))
    .sort((a, b) => b.s - a.s)
    .map((c) => c.n);
}

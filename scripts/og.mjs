// Aperçus de partage (Telegram, WhatsApp, iMessage, Snapchat…) : générés au déploiement, pas enregistrés dans le dépôt.
// - og/home.jpg : image de la page d'accueil
// - og/<id>.jpg + p/<id>/index.html : pour chaque article, une petite page avec les balises d'aperçu
//   (les applis ne lisent pas le JavaScript) qui renvoie aussitôt vers la fiche du site (?p=<id>).
// Usage : node scripts/og.mjs <dossier du site> <adresse du site>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';

const OUT = process.argv[2] || '_site';
const SITE = (process.argv[3] || 'https://best-finds-vytoxx.github.io').replace(/\/$/, '');
const FONTS = ['Brico-700.ttf', 'Inst-500.ttf', 'Inst-700.ttf'].map((f) => path.join(path.dirname(new URL(import.meta.url).pathname), 'fonts', f));
const W = 1200, H = 630;
const C = { navy: '#1e2a44', terra: '#c4673a', sun: '#f0b45c', linen: '#efe6d6', gold1: '#f6dc9b', gold2: '#d9ad54', gold3: '#a8792b', ink2: '#5d6475' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, ' ') + ' €';
const dataUri = async (buf, type = 'png') => `data:image/${type};base64,${buf.toString('base64')}`;

// coupe un titre en lignes d'au plus `max` caractères (approximation de la largeur), 3 lignes au plus
function wrap(text, max, lines = 3) {
  const words = String(text).normalize('NFKC').replace(/[^\p{L}\p{N}\s&'’.,:()/+×-]/gu, '').replace(/\s+/g, ' ').trim().split(' ');
  const out = [''];
  for (const w of words) {
    const cur = out[out.length - 1];
    if (!cur) out[out.length - 1] = w;
    else if ((cur + ' ' + w).length <= max) out[out.length - 1] = cur + ' ' + w;
    else out.push(w);
  }
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

const render = (svg) => new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Instrument Sans' } }).render().asPng();
const jpeg = (png) => sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();

// fond commun : lin chaud, halo doré derrière le produit
const backdrop = (cx, cy) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f1e7"/><stop offset="1" stop-color="#ead9bf"/></linearGradient>
    <radialGradient id="glow" cx="${cx}" cy="${cy}" r="340" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.sun}" stop-opacity=".55"/><stop offset=".55" stop-color="${C.sun}" stop-opacity=".16"/><stop offset="1" stop-color="${C.sun}" stop-opacity="0"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.gold1}"/><stop offset=".5" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold3}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>`;

const brand = async (x, y) => {
  const logo = await sharp('assets/img/logo.webp').resize(56, 56, { fit: 'cover' }).png().toBuffer();
  return `<clipPath id="lc"><circle cx="${x + 28}" cy="${y + 28}" r="28"/></clipPath>
    <image href="${await dataUri(logo)}" x="${x}" y="${y}" width="56" height="56" clip-path="url(#lc)"/>
    <text x="${x + 72}" y="${y + 37}" font-family="Instrument Sans" font-weight="700" font-size="22" letter-spacing="3.5" fill="${C.navy}">VYTOXX BEST FINDS</text>`;
};

const badge = (x, y, text) => `<g>
    <rect x="${x}" y="${y}" width="${30 + text.length * 13.2}" height="54" rx="27" fill="url(#gold)"/>
    <text x="${x + 24}" y="${y + 35}" font-family="Instrument Sans" font-weight="700" font-size="23" fill="${C.navy}">${esc(text)}</text></g>`;
const pillW = (text) => 30 + text.length * 10.4;
const pills = (x, y, texts) => { let out = ''; for (const t of texts) { out += pill(x, y, t); x += pillW(t) + 12; } return out; };
const pill = (x, y, text) => `<g>
    <rect x="${x}" y="${y}" width="${pillW(text)}" height="40" rx="20" fill="#ffffff" fill-opacity=".72" stroke="${C.navy}" stroke-opacity=".12"/>
    <text x="${x + 14}" y="${y + 26}" font-family="Instrument Sans" font-weight="500" font-size="19" fill="${C.navy}">${esc(text)}</text></g>`;

// produit détouré (ou photo arrondie si pas de détourage), avec une ombre douce posée dessous
async function productLayer(a, box) {
  const coverFile = a.cover && (await readFile(a.cover).catch(() => null));
  if (coverFile) {
    const trimmed = await sharp(coverFile).trim({ threshold: 1 }).png().toBuffer();
    const fit = await sharp(trimmed).resize({ width: box.w, height: box.h, fit: 'inside' }).png().toBuffer();
    const m = await sharp(fit).metadata();
    const x = box.x + (box.w - m.width) / 2, y = box.y + (box.h - m.height) / 2;
    // ombre portée : une ellipse floue posée sous le produit
    return `<defs><radialGradient id="sh${box.x}${box.y}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.navy}" stop-opacity=".32"/><stop offset="1" stop-color="${C.navy}" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${x + m.width / 2}" cy="${y + m.height - 4}" rx="${m.width * 0.46}" ry="${Math.max(14, m.height * 0.05)}" fill="url(#sh${box.x}${box.y})"/>
      <image href="${await dataUri(fit)}" x="${x}" y="${y}" width="${m.width}" height="${m.height}"/>`;
  }
  const photo = a.photos?.[(a.front || 1) - 1] || a.photos?.[0];
  if (!photo) return '';
  const img = await sharp(photo).resize(box.w - 40, box.h - 20, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
  return `<clipPath id="pc"><rect x="${box.x + 20}" y="${box.y + 10}" width="${box.w - 40}" height="${box.h - 20}" rx="28"/></clipPath>
    <image href="${await dataUri(img, 'jpeg')}" x="${box.x + 20}" y="${box.y + 10}" width="${box.w - 40}" height="${box.h - 20}" clip-path="url(#pc)"/>`;
}

async function articleCard(a, price, coupon) {
  const lines = wrap(a.title, 19);
  const fs = lines.length > 2 ? 52 : 60, lh = fs * 1.08;
  const ty = 214;
  const after = ty + lh * (lines.length - 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backdrop(330, 330)}
    ${await productLayer(a, { x: 40, y: 40, w: 580, h: 550 })}
    ${await brand(660, 56)}
    <text x="662" y="${ty - lh - 6}" font-family="Instrument Sans" font-weight="700" font-size="20" letter-spacing="3" fill="${C.terra}">${esc((a.category || '').toUpperCase())}</text>
    ${lines.map((l, i) => `<text x="660" y="${ty + i * lh}" font-family="Bricolage Grotesque" font-weight="700" font-size="${fs}" fill="${C.navy}">${esc(l)}</text>`).join('')}
    ${price ? `<text x="660" y="${after + 74}" font-family="Bricolage Grotesque" font-weight="700" font-size="44" fill="${C.navy}">${esc(eur(price))}</text>
      <text x="662" y="${after + 104}" font-family="Instrument Sans" font-weight="500" font-size="19" fill="${C.ink2}">prix relevé sur LoveGoBuy</text>` : ''}
    ${pills(660, 470, ['Photos réelles', 'Lien LoveGoBuy direct'])}
    ${badge(660, 528, `${coupon} de coupons offerts`)}
  </svg>`;
  return jpeg(render(svg));
}

async function homeCard(articles, coupon) {
  // trois produits phares en éventail derrière le panda, texte à droite
  const panda = await sharp('assets/img/panda-hero.webp').trim({ threshold: 1 }).resize({ height: 560, fit: 'inside' }).png().toBuffer();
  const pm = await sharp(panda).metadata();
  // les plus cliqués du moment : un vêtement derrière le panda, une paire de chaussures à ses pieds
  const top = await readFile('data/clicks.json', 'utf8').then((t) => JSON.parse(t)).catch(() => ({}));
  const score = (a) => Number((top.period || top.total || {})[a.id] || 0);
  const ranked = articles.filter((a) => a.cover).sort((x, y) => score(y) - score(x));
  const picks = [ranked.find((a) => a.category === 'Hauts'), ranked.find((a) => a.category === 'Chaussures')].filter(Boolean);
  const spots = [{ x: 20, y: 40, w: 300, h: 360 }, { x: 330, y: 380, w: 290, h: 200 }];
  let items = '';
  for (let i = 0; i < picks.length; i++) items += await productLayer(picks[i], spots[i]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backdrop(320, 330)}
    <g opacity=".95">${items}</g>
    <image href="${await dataUri(panda)}" x="${300 - pm.width / 2 + 40}" y="${H - pm.height - 10}" width="${pm.width}" height="${pm.height}"/>
    ${await brand(640, 70)}
    <text x="638" y="230" font-family="Bricolage Grotesque" font-weight="700" font-size="76" fill="${C.navy}">Vytoxx</text>
    <text x="638" y="312" font-family="Bricolage Grotesque" font-weight="700" font-size="76" fill="${C.terra}">Best Finds</text>
    <text x="640" y="372" font-family="Instrument Sans" font-weight="500" font-size="24" fill="${C.navy}">Les meilleurs finds LoveGoBuy, photographiés</text>
    <text x="640" y="406" font-family="Instrument Sans" font-weight="500" font-size="24" fill="${C.navy}">par notre équipe. Lien direct pour commander.</text>
    ${pills(640, 452, [`${articles.length} articles`, 'Prix relevés sur LoveGoBuy'])}
    ${badge(640, 522, `${coupon} de coupons offerts`)}
  </svg>`;
  return jpeg(render(svg));
}

const page = (a, desc, img) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(a.title)} · Vytoxx Best Finds</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vytoxx Best Finds">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/p/${a.id}/">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(a.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=${SITE}/?p=${a.id}">
</head><body style="font-family:system-ui,sans-serif;background:#f7f1e7;color:#1e2a44;display:grid;place-items:center;min-height:100vh;margin:0">
<a href="${SITE}/?p=${a.id}" style="color:inherit">Voir ${esc(a.title)} sur Vytoxx Best Finds</a>
</body></html>
`;

const { articles: all } = JSON.parse(await readFile('data/articles.json', 'utf8'));
const prices = (JSON.parse(await readFile('data/prices.json', 'utf8').catch(() => '{}')).items) || {};
const cfg = await readFile('assets/config.js', 'utf8');
const coupon = (cfg.match(/coupon:\s*'([^']+)'/) || [])[1] || '500 €';
const visible = all.filter((a) => !a.hidden && !a.dupOf);
const priceOf = (a) => { const p = prices[a.id]; return p && p.eur && (!p.pid || p.pid === a.productId) ? p.eur : null; };

await mkdir(path.join(OUT, 'og'), { recursive: true });
const v = Date.now().toString(36);
await writeFile(path.join(OUT, 'og', 'home.jpg'), await homeCard(visible, coupon));
let n = 0;
const only = process.env.OG_ONLY ? new Set(process.env.OG_ONLY.split(',').map(Number)) : null;
for (const a of all) {
  if (only && !only.has(a.id)) continue;
  // un doublon renvoie vers l'article gardé ; un article masqué n'a pas d'aperçu produit
  const target = a.dupOf ? all.find((x) => x.id === a.dupOf) : a;
  if (!target || target.hidden) continue;
  try {
    const p = priceOf(target);
    if (!a.dupOf) await writeFile(path.join(OUT, 'og', `${a.id}.jpg`), await articleCard(target, p, coupon));
    const desc = `${p ? `${eur(p)} sur LoveGoBuy · ` : ''}Photos réelles et lien direct pour commander. ${coupon} de coupons offerts à l'inscription.`;
    await mkdir(path.join(OUT, 'p', String(a.id)), { recursive: true });
    await writeFile(path.join(OUT, 'p', String(a.id), 'index.html'), page({ ...target, id: a.id }, desc, `${SITE}/og/${target.id}.jpg?v=${v}`));
    n++;
  } catch (e) { console.warn(`aperçu ${a.id} : ${e.message}`); }
}
console.log(`aperçus de partage : ${n} articles + accueil`);

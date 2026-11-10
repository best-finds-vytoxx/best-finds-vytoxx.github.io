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

// fond ivoire luxe : halo de lumière blanche derrière le produit (comme un projecteur de vitrine), socle ovale,
// grand monogramme V en filigrane, fin cadre doré, texte encre presque noire, bouton noir avec flèche dorée
const INK = '#141414', IVORY = '#f2eee6', MUTED = '#77736b', GOLD = '#b8954f';
const backdrop = (cx = 330, cy = 300) => `
  <defs>
    <radialGradient id="spot" cx="${cx}" cy="${cy}" r="360" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".45"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="vign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".05"/></linearGradient>
    <linearGradient id="gline" x1="0" x2="1"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset=".15" stop-color="${GOLD}"/><stop offset=".85" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
    <radialGradient id="ped" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9d2c4" stop-opacity=".9"/><stop offset=".7" stop-color="#e6e0d4" stop-opacity=".5"/><stop offset="1" stop-color="#e6e0d4" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <text x="${cx}" y="${cy + 250}" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="640" fill="${INK}" fill-opacity=".035">V</text>
  <rect width="${W}" height="${H}" fill="url(#spot)"/>
  <ellipse cx="${cx}" cy="${H - 34}" rx="300" ry="34" fill="url(#ped)"/>
  <rect width="${W}" height="${H}" fill="url(#vign)"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="6" fill="none" stroke="${GOLD}" stroke-opacity=".55" stroke-width="1.2"/>
  <line x1="660" y1="96" x2="1140" y2="96" stroke="url(#gline)" stroke-width="1.5"/>`;
const label = (x, y) => `<text x="${x}" y="${y}" font-family="Instrument Sans" font-weight="700" font-size="17" letter-spacing="6" fill="${INK}">VYTOXX  BEST  FINDS</text>`;
const cta = (x, y, text) => {
  const w = 96 + text.length * 12.6;
  return `<g><rect x="${x}" y="${y + 6}" width="${w}" height="66" rx="33" fill="#000" fill-opacity=".14"/>
    <rect x="${x}" y="${y}" width="${w}" height="66" rx="33" fill="${INK}"/>
    <text x="${x + 32}" y="${y + 42}" font-family="Instrument Sans" font-weight="700" font-size="24" fill="#ffffff">${esc(text)}</text>
    <circle cx="${x + w - 36}" cy="${y + 33}" r="22" fill="${GOLD}"/>
    <path d="M${x + w - 46} ${y + 33} h20 m-8 -8 l8 8 l-8 8" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

// produit détouré (ou photo arrondie si pas de détourage), avec une ombre douce posée dessous
async function productLayer(a, box) {
  const coverFile = a.cover && (await readFile(a.cover).catch(() => null));
  if (coverFile) {
    const trimmed = await sharp(coverFile).trim({ threshold: 1 }).png().toBuffer();
    const fit = await sharp(trimmed).resize({ width: box.w, height: box.h, fit: 'inside' }).png().toBuffer();
    const m = await sharp(fit).metadata();
    const x = box.x + (box.w - m.width) / 2, y = box.y + (box.h - m.height) / 2;
    // ombre portée : une ellipse floue posée sous le produit
    return `<defs><radialGradient id="sh${box.x}${box.y}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${x + m.width / 2}" cy="${y + m.height - 4}" rx="${m.width * 0.46}" ry="${Math.max(14, m.height * 0.05)}" fill="url(#sh${box.x}${box.y})"/>
      <image href="${await dataUri(fit)}" x="${x}" y="${y}" width="${m.width}" height="${m.height}"/>`;
  }
  const photo = a.photos?.[(a.front || 1) - 1] || a.photos?.[0];
  if (!photo) return '';
  const img = await sharp(photo).resize(box.w - 40, box.h - 20, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
  return `<clipPath id="pc"><rect x="${box.x + 20}" y="${box.y + 10}" width="${box.w - 40}" height="${box.h - 20}" rx="28"/></clipPath>
    <image href="${await dataUri(img, 'jpeg')}" x="${box.x + 20}" y="${box.y + 10}" width="${box.w - 40}" height="${box.h - 20}" clip-path="url(#pc)"/>`;
}

async function articleCard(a, price) {
  const lines = wrap(a.title, 17);
  const fs = lines.length > 2 ? 50 : 58, lh = fs * 1.12;
  const ty = 196;
  const after = ty + lh * (lines.length - 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backdrop()}
    ${await productLayer(a, { x: 40, y: 45, w: 580, h: 540 })}
    ${label(660, 72)}
    ${lines.map((l, i) => `<text x="658" y="${ty + i * lh}" font-family="Bricolage Grotesque" font-weight="700" font-size="${fs}" fill="${INK}">${esc(l)}</text>`).join('')}
    ${price ? `<text x="660" y="${after + 66}" font-family="Instrument Sans" font-weight="500" font-size="30" fill="${INK}">${esc(eur(price))}</text>` : ''}
    <text x="660" y="${price ? after + 100 : after + 62}" font-family="Instrument Sans" font-weight="500" font-size="20" fill="${MUTED}">Photos réelles · lien direct pour commander</text>
    ${cta(660, 500, 'Voir l’article')}
  </svg>`;
  return jpeg(render(svg));
}

async function homeCard(articles) {
  const panda = await sharp('assets/img/panda-hero.webp').trim({ threshold: 1 }).resize({ height: 540, fit: 'inside' }).png().toBuffer();
  const pm = await sharp(panda).metadata();
  // les plus cliqués du moment : une veste derrière le panda à gauche, un bas à droite, une paire de chaussures à ses pieds
  const top = await readFile('data/clicks.json', 'utf8').then((t) => JSON.parse(t)).catch(() => ({}));
  const score = (a) => Number((top.period || top.total || {})[a.id] || 0);
  const ranked = articles.filter((a) => a.cover).sort((x, y) => score(y) - score(x));
  const pick = (c) => ranked.find((a) => a.category === c);
  const items = [
    [pick('Hauts'), { x: 40, y: 70, w: 250, h: 320 }],
    [pick('Bas'), { x: 400, y: 120, w: 210, h: 280 }],
    [pick('Chaussures'), { x: 330, y: 420, w: 280, h: 170 }],
  ].filter(([a]) => a);
  let back = '';
  for (const [a, box] of items) back += await productLayer(a, box);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backdrop(320, 310)}
    ${back}
    <image href="${await dataUri(panda)}" x="${300 - pm.width / 2}" y="${H - pm.height - 30}" width="${pm.width}" height="${pm.height}"/>
    ${label(660, 72)}
    <text x="656" y="210" font-family="Bricolage Grotesque" font-weight="700" font-size="84" fill="${INK}">Vytoxx</text>
    <text x="656" y="300" font-family="Bricolage Grotesque" font-weight="700" font-size="84" fill="${INK}">Best Finds</text>
    <text x="660" y="362" font-family="Instrument Sans" font-weight="500" font-size="24" fill="${MUTED}">Les meilleurs finds, sélectionnés et</text>
    <text x="660" y="394" font-family="Instrument Sans" font-weight="500" font-size="24" fill="${MUTED}">photographiés par notre équipe.</text>
    ${cta(660, 470, 'Voir les finds')}
  </svg>`;
  return jpeg(render(svg));
}

const page = (a, desc, img) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(a.title)} · Vytoxx Best Finds</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${SITE}/p/go.js; img-src ${SITE}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
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
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f2eee6;color:#141414;font-family:system-ui,-apple-system,sans-serif;text-align:center">
<main style="padding:24px;max-width:640px">
<img src="${img}" alt="" style="width:100%;border-radius:14px;display:block">
<p><a href="${SITE}/?p=${a.id}" style="display:inline-block;margin-top:18px;padding:14px 26px;border-radius:999px;background:#141414;color:#fff;text-decoration:none;font-weight:700">Voir l’article</a></p>
</main>
<!-- renvoi vers la fiche par JavaScript (et non par « refresh ») : les applis qui fabriquent l'aperçu restent sur cette page -->
<script src="${SITE}/p/go.js" data-to="${SITE}/?p=${a.id}"></script>
</body></html>
`;

const { articles: all } = JSON.parse(await readFile('data/articles.json', 'utf8'));
const prices = (JSON.parse(await readFile('data/prices.json', 'utf8').catch(() => '{}')).items) || {};
const cfg = await readFile('assets/config.js', 'utf8');
const coupon = (cfg.match(/coupon:\s*'([^']+)'/) || [])[1] || '500 €';
// article indisponible chez le vendeur (relevé automatique des prix, « off ») : retiré du site comme un article masqué
const isOff = (a) => { const p = prices[a.id]; return !!(p && p.off && (!p.pid || p.pid === a.productId)); };
const visible = all.filter((a) => !a.hidden && !a.dupOf && !isOff(a));
const priceOf = (a) => { const p = prices[a.id]; return p && p.eur && (!p.pid || p.pid === a.productId) ? p.eur : null; };

await mkdir(path.join(OUT, 'og'), { recursive: true });
await mkdir(path.join(OUT, 'p'), { recursive: true });
// renvoi vers la fiche : seulement vers une adresse du site (jamais ailleurs, même si la page était modifiée)
await writeFile(path.join(OUT, 'p', 'go.js'), `(() => { const s = document.currentScript; const to = s && s.dataset.to; if (to && to.startsWith(${JSON.stringify(SITE + '/')})) location.replace(to); })();\n`);
const v = Date.now().toString(36);
await writeFile(path.join(OUT, 'og', 'home.jpg'), await homeCard(visible));
// page de partage du site : même principe que les articles (aperçu = image d'accueil, puis renvoi vers l'accueil) ;
// une adresse à part évite l'ancien aperçu que les applis gardent en mémoire pour l'adresse du site
{
  const img = `${SITE}/og/home.jpg?v=${v}`;
  const desc = 'Les meilleurs finds LoveGoBuy, sélectionnés et photographiés par notre équipe. Photos réelles et lien direct pour commander.';
  await mkdir(path.join(OUT, 's'), { recursive: true });
  await writeFile(path.join(OUT, 's', 'index.html'), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Vytoxx Best Finds</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${SITE}/p/go.js; img-src ${SITE}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="robots" content="noindex">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Vytoxx Best Finds">
<meta property="og:title" content="Vytoxx Best Finds">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/s/">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f2eee6;color:#141414;font-family:system-ui,-apple-system,sans-serif;text-align:center">
<main style="padding:24px;max-width:640px"><img src="${img}" alt="" style="width:100%;border-radius:14px;display:block">
<p><a href="${SITE}/" style="display:inline-block;margin-top:18px;padding:14px 26px;border-radius:999px;background:#141414;color:#fff;text-decoration:none;font-weight:700">Voir les finds</a></p></main>
<script src="${SITE}/p/go.js" data-to="${SITE}/"></script>
</body></html>
`);
}
let n = 0;
const only = process.env.OG_ONLY ? new Set(process.env.OG_ONLY.split(',').map(Number)) : null;
for (const a of all) {
  if (only && !only.has(a.id)) continue;
  // un doublon renvoie vers l'article gardé ; un article masqué n'a pas d'aperçu produit
  const target = a.dupOf ? all.find((x) => x.id === a.dupOf) : a;
  if (!target || target.hidden || isOff(target)) continue;
  try {
    const p = priceOf(target);
    if (!a.dupOf) await writeFile(path.join(OUT, 'og', `${a.id}.jpg`), await articleCard(target, p));
    const desc = `${p ? `${eur(p)} sur LoveGoBuy · ` : ''}Photos réelles et lien direct pour commander. ${coupon} de coupons offerts à l'inscription.`;
    await mkdir(path.join(OUT, 'p', String(a.id)), { recursive: true });
    await writeFile(path.join(OUT, 'p', String(a.id), 'index.html'), page({ ...target, id: a.id }, desc, `${SITE}/og/${target.id}.jpg?v=${v}`));
    n++;
  } catch (e) { console.warn(`aperçu ${a.id} : ${e.message}`); }
}
console.log(`aperçus de partage : ${n} articles + accueil`);

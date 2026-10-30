// Détourage de la photo principale d'un article : suppression du fond, puis nettoyage
// (règles graduées, étiquettes isolées, petites taches) et recadrage centré au format 3:4.
import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';
import { grabcut } from './grabcut.mjs';
import { watermarkMask } from './watermark.mjs';
import { visionMask } from './vision.mjs';
import { writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ALPHA = 110;
const HAZE_MAX = 0.1; // part maximale de pixels à moitié transparents autour de l'objet // seuil d'opacité pour considérer un pixel comme "objet"

/** Composantes connexes (4-voisinage) d'un masque binaire. */
function components(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    const id = comps.length;
    let sp = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack[sp++] = start;
    label[start] = id;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const n = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of n) if (q >= 0 && mask[q] && label[q] === -1) { label[q] = id; stack[sp++] = q; }
    }
    comps.push({ id, area, x0, y0, x1, y1 });
  }
  return { label, comps };
}

/** Une règle graduée : très allongée, remplit bien sa boîte, et longe un bord de la photo. */
function looksLikeRuler(c, w, h) {
  const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  const elong = Math.max(bw, bh) / Math.min(bw, bh);
  const fill = c.area / (bw * bh);
  const nearEdge = c.x0 < w * 0.12 || c.x1 > w * 0.88 || c.y0 < h * 0.12 || c.y1 > h * 0.88;
  const long = Math.max(bw / w, bh / h) > 0.45;
  return elong > 5 && fill > 0.45 && nearEdge && long;
}

/**
 * @param {Buffer} input image source (jpg/webp/png)
 * @returns {Promise<Buffer>} webp transparent 900x1200, objet centré
 */
/** Méthode principale : produit repéré par son nom puis détouré par BiRefNet (scripts/vision.py). null si indisponible. */
async function visionCut(png, prompt) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vis-'));
  try {
    const src = path.join(dir, 'in.png'), out = path.join(dir, 'mask.png');
    await writeFile(src, png);
    const res = await visionMask(src, out, prompt);
    if (!res) return null;
    if (process.env.DEBUG_CUT) console.log('  repérage', JSON.stringify(res.boxes), 'cadre', JSON.stringify(res.crop));
    const mask = await sharp(await readFile(out)).toColourspace('b-w').raw().toBuffer();
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let p = 0; p < info.width * info.height; p++) {
      rgba[p * 4] = data[p * 3]; rgba[p * 4 + 1] = data[p * 3 + 1]; rgba[p * 4 + 2] = data[p * 3 + 2]; rgba[p * 4 + 3] = mask[p];
    }
    return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function cutout(input, { width = 900, height = 1200, margin = 0.07, dropPackaging = false, rescue = true, prompt = null } = {}) {
  const png = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  let cutPng = prompt ? await visionCut(png, prompt) : null;
  const viaVision = !!cutPng;
  if (!cutPng) {
    const blob = await removeBackground(new Blob([png], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
    cutPng = Buffer.from(await blob.arrayBuffer());
  }
  // vignette du canal (panda + « VYTOXX ») effacée du détourage si elle y est restée
  let wm = null;
  try { wm = await watermarkMask(png); } catch (e) { if (process.env.DEBUG_CUT) console.log('  vignette non cherchée :', e.message); }
  if (wm) {
    const { data, info } = await sharp(cutPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width * info.height === wm.length) {
      for (let p = 0; p < wm.length; p++) if (wm[p]) data[p * 4 + 3] = 0;
      cutPng = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    }
  }
  const first = await cleanCutout(cutPng, { width, height, margin, source: input, dropPackaging });
  if (first) return first;
  // la méthode principale a échoué : on retente avec l'ancienne méthode avant d'abandonner
  if (viaVision) return cutout(input, { width, height, margin, dropPackaging, rescue, prompt: null });
  if (!rescue) return null;
  // Détourage raté (vêtement blanc ou gris sur la table grise, objet à moitié transparent…) :
  // seconde méthode, guidée par la couleur de la table, puis mêmes contrôles de qualité
  try {
    const rescue = await grabcut(png, cutPng, wm);
    if (!rescue) return null;
    if (process.env.DEBUG_CUT) console.log('  seconde méthode (GrabCut)');
    return await cleanCutout(rescue, { width, height, margin, source: input, dropPackaging });
  } catch (e) {
    if (process.env.DEBUG_CUT) console.log('  seconde méthode impossible :', e.message);
    return null;
  }
}

/**
 * Retire un emballage en carton kraft posé contre le produit (ex. la boîte d'une gourde) :
 * on repère la plus grande zone couleur carton, et si elle forme un bloc rectangulaire, on efface ce rectangle.
 * Le produit, à côté, reste seul.
 */
function removeCardboard(data, w, h) {
  const s = Math.max(1, Math.round(Math.max(w, h) / 200));
  const mw = Math.ceil(w / s), mh = Math.ceil(h / s);
  const kraft = new Uint8Array(mw * mh), opaque = new Uint8Array(mw * mh);
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 200) continue;
    const q = ((y / s) | 0) * mw + ((x / s) | 0);
    opaque[q] = 1;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) continue;
    let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60; if (hue < 0) hue += 360;
    const sat = d / mx;
    if (hue >= 22 && hue <= 48 && sat >= 0.22 && sat <= 0.65 && mx >= 0.4 && mx <= 0.9) kraft[q] = 1;
  }
  const { label, comps } = components(kraft, mw, mh);
  if (!comps.length) return;
  const c = comps.reduce((a, b) => (b.area > a.area ? b : a));
  const totalOpaque = opaque.reduce((a, b) => a + b, 0);
  const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  // la zone carton doit être grande, et remplir son rectangle (étiquettes et codes-barres laissent quelques trous)
  if (c.area < totalOpaque * 0.15 || c.area / (bw * bh) < 0.5) return;
  // et il doit rester autre chose à côté (sinon c'est l'article lui-même, ex. un sac en carton)
  let outside = 0;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (opaque[y * mw + x] && (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1)) outside++;
  if (outside < totalOpaque * 0.15) return;
  const pad = Math.round(Math.max(bw, bh) * 0.02);
  const X0 = Math.max(0, (c.x0 - pad) * s), X1 = Math.min(w - 1, (c.x1 + 1 + pad) * s), Y0 = Math.max(0, (c.y0 - pad) * s), Y1 = Math.min(h - 1, (c.y1 + 1 + pad) * s);
  const isKraft = (i) => {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return false;
    let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60; if (hue < 0) hue += 360;
    const sat = d / mx;
    return hue >= 18 && hue <= 52 && sat >= 0.15 && sat <= 0.7 && mx >= 0.3 && mx <= 0.95;
  };
  // 1. effacer le carton lui-même
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) { const i = (y * w + x) * 4; if (data[i + 3] && isKraft(i)) data[i + 3] = 0; }
  // 2. effacer ce qui était imprimé ou collé sur le carton (étiquettes) : les morceaux restés entièrement dans son rectangle
  const rest = new Uint8Array(mw * mh);
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (data[(y * w + x) * 4 + 3] > 128) rest[((y / s) | 0) * mw + ((x / s) | 0)] = 1;
  const parts = components(rest, mw, mh);
  const inside = new Set(parts.comps.filter((p) => p.x0 * s >= X0 && p.x1 * s <= X1 && p.y0 * s >= Y0 && p.y1 * s <= Y1).map((p) => p.id));
  if (!inside.size) return;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const l = parts.label[Math.min(mh - 1, (y / s) | 0) * mw + Math.min(mw - 1, (x / s) | 0)];
    if (inside.has(l)) data[(y * w + x) * 4 + 3] = 0;
  }
  void label;
}

/** Nettoie un PNG déjà détouré (séparé pour pouvoir le tester sans relancer le modèle). */
export async function cleanCutout(cutPng, { width = 900, height = 1200, margin = 0.07, source = null, dropPackaging = false } = {}) {
  const { data, info } = await sharp(cutPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  if (dropPackaging) removeCardboard(data, w, h);

  // Masque réduit (plus rapide) pour analyser les morceaux détourés
  const s = Math.max(1, Math.round(Math.max(w, h) / 256));
  const mw = Math.ceil(w / s), mh = Math.ceil(h / s);
  const mask = new Uint8Array(mw * mh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > ALPHA) mask[((y / s) | 0) * mw + ((x / s) | 0)] = 1;

  // Règle graduée collée à l'objet le long d'un bord : bande fine qui couvre presque toute la largeur
  // de l'objet, alors que les lignes juste avant sont nettement moins remplies.
  const cut = new Uint8Array(mw * mh);
  let bx0 = mw, by0 = mh, bx1 = -1, by1 = -1;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (mask[y * mw + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const stripBands = (lo, hi, jlo, jhi, at) => {
    // lignes i dans [lo, hi], chacune parcourue sur j dans [jlo, jhi] ; at(i, j) = index de cellule
    const n = hi - lo + 1, m = jhi - jlo + 1;
    if (n < 10 || m < 10) return;
    const cov = (i) => { let c = 0; for (let j = jlo; j <= jhi; j++) c += mask[at(i, j)]; return c / m; };
    for (const [edge, dir] of [[hi, -1], [lo, 1]]) {
      for (let st = 0; st < n * 0.08; st++) {
        const i0 = edge + dir * st;
        const c0 = cov(i0);
        if (c0 < 0.8) continue;
        let i1 = i0, sum = c0, cnt = 1;
        while (i1 + dir >= lo && i1 + dir <= hi && cov(i1 + dir) >= 0.8) { i1 += dir; sum += cov(i1); cnt++; }
        if (cnt > n * 0.12) break; // trop épais : c'est l'objet lui-même
        const bandCov = sum / cnt;
        const look = Math.max(3, Math.round(n * 0.1));
        let before = 1;
        for (let t = 1; t <= look; t++) { const r = i1 + dir * t; if (r >= lo && r <= hi) before = Math.min(before, cov(r)); }
        if (before < bandCov * 0.8) {
          for (let i = Math.min(i0, i1, edge); i <= Math.max(i0, i1, edge); i++) for (let j = 0; j < (at === H ? mw : mh); j++) { mask[at(i, j)] = 0; cut[at(i, j)] = 1; }
          // une rangée de plus côté objet pour les reflets de la règle
          const r = i1 + dir; if (r >= 0 && r < (at === H ? mh : mw)) for (let j = jlo; j <= jhi; j++) { mask[at(r, j)] = 0; cut[at(r, j)] = 1; }
        }
        break;
      }
    }
  };
  const H = (i, j) => i * mw + j; // lignes
  const V = (i, j) => j * mw + i; // colonnes
  if (bx1 >= 0) {
    stripBands(by0, by1, bx0, bx1, H); // règles horizontales (haut / bas)
    stripBands(bx0, bx1, by0, by1, V); // règles verticales (gauche / droite)
  }


  // Boîte collée au produit (chaussures, accessoires) : bloc de lignes pleines aux bords bien droits,
  // à une extrémité de l'objet, suivi d'une partie nettement moins pleine (le produit). On coupe le bloc.
  if (dropPackaging) {
    // seuls les morceaux importants comptent (les miettes et bouts de règle faussent le cadre)
    const pre = components(mask, mw, mh);
    const big0 = Math.max(0, ...pre.comps.map((c) => c.area));
    const small = new Set(pre.comps.filter((c) => c.area < big0 * 0.04 || (looksLikeRuler(c, mw, mh) && c.area < big0)).map((c) => c.id));
    for (let q = 0; q < mw * mh; q++) if (mask[q] && small.has(pre.label[q])) mask[q] = 0;
    bx0 = mw; by0 = mh; bx1 = -1; by1 = -1;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (mask[y * mw + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  if (dropPackaging && bx1 >= 0) {
    const stripBox = (lo, hi, jlo, jhi, at, lines) => {
      const n = hi - lo + 1;
      if (n < 20) return;
      const row = (i) => {
        let a = -1, b = -1, c = 0;
        for (let j = jlo; j <= jhi; j++) if (mask[at(i, j)]) { if (a < 0) a = j; b = j; c++; }
        return { a, b, fill: a < 0 ? 0 : c / (b - a + 1), span: a < 0 ? 0 : (b - a + 1) / (jhi - jlo + 1) };
      };
      const rows = []; for (let i = lo; i <= hi; i++) rows.push(row(i));
      const total = rows.reduce((t, r) => t + r.fill * r.span, 0);
      for (const dir of [1]) { // seulement en haut : la boîte est posée derrière le produit, en haut de la photo
        const at0 = dir === 1 ? 0 : n - 1;
        // largeur de la boîte : la plus grande ligne pleine près de ce bord
        let wmax = 0;
        for (let t = 0; t < n * 0.4; t++) { const r = rows[at0 + dir * t]; if (r && r.fill >= 0.93 && r.span > wmax) wmax = r.span; }
        if (wmax < 0.3) continue;
        const full = (r) => r && r.fill >= 0.93 && r.span >= wmax * 0.85;
        // le bloc commence au bord (coins arrondis ou boîte un peu de travers : quelques lignes tolérées)
        let k = at0, skip = 0;
        while (skip < n * 0.1 && rows[k] && !full(rows[k])) { k += dir; skip++; }
        // coin de travers : on attend que les bords se stabilisent
        while (skip < n * 0.12 && full(rows[k + dir]) && (Math.abs(rows[k + dir].a - rows[k].a) > 2 || Math.abs(rows[k + dir].b - rows[k].b) > 2)) { k += dir; skip++; }
        const start = k, r0 = rows[k];
        if (process.env.DEBUG_CUT) console.log('  boîte? dir', dir, 'début', start, 'largeur', wmax.toFixed(2), 'n', n);
        if (!full(r0)) continue;
        // bords droits : peu de variation sur toute la hauteur du bloc
        const drift = Math.max(3, (jhi - jlo + 1) * 0.06);
        while (full(rows[k + dir]) && Math.abs(rows[k + dir].a - r0.a) <= drift && Math.abs(rows[k + dir].b - r0.b) <= drift) k += dir;
        const len = Math.abs(k - start) + 1;
        if (process.env.DEBUG_CUT) console.log('  boîte? longueur', len);
        if (len < n * 0.15 || len > n * 0.8) continue;
        // le reste : assez grand et moins plein (le produit)
        const rest = dir === 1 ? rows.slice(k + 1) : rows.slice(0, k);
        const restArea = rest.reduce((t, r) => t + r.fill * r.span, 0);
        const restFill = rest.length ? rest.reduce((t, r) => t + r.fill, 0) / rest.length : 0;
        const restSpan = rest.length ? rest.reduce((t, r) => t + r.span, 0) / rest.length : 1;
        if (process.env.DEBUG_CUT) console.log('  boîte? reste', (restArea / total).toFixed(2), restFill.toFixed(2), (restSpan / wmax).toFixed(2));
        if (restArea < total * 0.25 || restSpan > wmax * 0.8) continue; // le produit, sous la boîte, est nettement moins large
        // bord de la boîte un peu de travers : on continue tant que la ligne reste plus large que le produit
        const restW = rest.length ? [...rest].sort((p, q) => p.span - q.span)[Math.floor(rest.length / 2)].span : 0;
        let e = k;
        while (Math.abs(e - k) < n * 0.08 && rows[e + dir] && rows[e + dir].span > restW * 1.15) e += dir;
        const end = e + dir * 2; // deux lignes de plus pour le bord de la boîte
        for (let t = Math.min(at0, end); t <= Math.max(at0, end); t++) {
          if (t < 0 || t >= n) continue;
          for (let j = 0; j < lines; j++) { mask[at(lo + t, j)] = 0; cut[at(lo + t, j)] = 1; }
        }
        if (process.env.DEBUG_CUT) console.log(`  boîte collée retirée (${len} lignes)`);
        return;
      }
    };
    stripBox(by0, by1, bx0, bx1, H, mw);
  }

  const { label, comps } = components(mask, mw, mh);
  if (!comps.length) return null; // rien détecté : on garde la photo d'origine
  const biggest = Math.max(...comps.map((c) => c.area));
  const keep = new Set(
    comps
      .filter((c) => c.area >= biggest * 0.04 && c.area >= mw * mh * 0.002)
      .filter((c) => !(looksLikeRuler(c, mw, mh) && c.area < biggest))
      .map((c) => c.id),
  );
  if (!keep.size) return null;

  // Morceaux à moitié transparents à l'écart de l'objet (ex. filigrane du canal, sachet blanc) : écartés
  if (keep.size > 1) {
    const alphaSum = new Float64Array(comps.length), cnt = new Uint32Array(comps.length);
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const l = label[((y / s) | 0) * mw + ((x / s) | 0)];
      if (l >= 0) { alphaSum[l] += data[(y * w + x) * 4 + 3]; cnt[l]++; }
    }
    for (const c of comps) if (keep.has(c.id) && c.area < biggest * 0.3 && cnt[c.id] && alphaSum[c.id] / cnt[c.id] < 170) keep.delete(c.id);
  }

  // Filigrane du canal (vignette « VYTOXX » posée en bas à gauche) : écarté s'il est à part
  if (keep.size > 1) {
    for (const c of comps) {
      if (!keep.has(c.id) || c.area >= biggest * 0.35) continue;
      const fill = c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1)); // la vignette est rectangulaire
      if (fill > 0.8 && c.x1 < mw * 0.45 && c.y0 > mh * 0.55 && c.y1 > mh * 0.75) keep.delete(c.id);
    }
  }

  // Boîte posée à côté du produit (chaussures, accessoires) : un bloc parfaitement rectangulaire,
  // alors que le produit, lui, a une forme irrégulière. On retire la boîte et on garde le produit.
  if (dropPackaging && keep.size > 1) {
    const kept = comps.filter((c) => keep.has(c.id));
    const total = kept.reduce((a, c) => a + c.area, 0);
    const fillOf = (c) => c.area / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1));
    const big = kept.filter((c) => c.area >= total * 0.08);
    const boxes = big.filter((c) => fillOf(c) >= 0.9);
    const products = big.filter((c) => !boxes.includes(c));
    if (process.env.DEBUG_CUT) console.log('  morceaux', big.map((c) => `${c.area}/${fillOf(c).toFixed(2)}`).join(' '));
    const bestBox = boxes.length ? Math.min(...boxes.map(fillOf)) : 0;
    if (boxes.length && products.length && products.some((c) => fillOf(c) <= bestBox - 0.06)) {
      for (const b of boxes) keep.delete(b.id);
      if (process.env.DEBUG_CUT) console.log(`  boîte retirée (${boxes.length})`);
      // ce qui était posé sur la boîte (étiquettes) ou tout petit morceau voisin disparaît aussi
      const rest = comps.filter((c) => keep.has(c.id));
      const restBig = Math.max(...rest.map((c) => c.area));
      for (const c of rest) {
        const onBox = boxes.some((b) => c.x0 >= b.x0 && c.x1 <= b.x1 && c.y0 >= b.y0 && c.y1 <= b.y1);
        if (onBox || c.area < restBig * 0.04) keep.delete(c.id);
      }
      if (!keep.size) return null;
    }
  }

  // Détourage troué : l'objet gardé entoure une grande zone vide (ex. seulement les bretelles d'un haut)
  {
    const outside = new Uint8Array(mw * mh);
    const st = [];
    const isObj = (q) => keep.has(label[q]);
    for (let x = 0; x < mw; x++) { st.push(x, (mh - 1) * mw + x); }
    for (let y = 0; y < mh; y++) { st.push(y * mw, y * mw + mw - 1); }
    while (st.length) {
      const q = st.pop();
      if (outside[q] || isObj(q)) continue;
      outside[q] = 1;
      const x = q % mw, y = (q / mw) | 0;
      if (x > 0) st.push(q - 1); if (x < mw - 1) st.push(q + 1); if (y > 0) st.push(q - mw); if (y < mh - 1) st.push(q + mw);
    }
    let objA = 0, holeA = 0;
    for (let q = 0; q < mw * mh; q++) { if (isObj(q)) objA++; else if (!outside[q]) holeA++; }
    if (holeA > (objA + holeA) * 0.22) { if (process.env.DEBUG_CUT) console.log("  rejet: troué", (holeA / (objA + holeA)).toFixed(2)); return null; }
  }

  // Effacer les morceaux écartés et calculer le cadre de l'objet gardé
  let x0 = w, y0 = h, x1 = 0, y1 = 0, solid = 0, semi = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      const cell = Math.min(mh - 1, (y / s) | 0) * mw + Math.min(mw - 1, (x / s) | 0);
      if (cut[cell]) { data[i + 3] = 0; continue; }
      const l = label[cell];
      if (l === -1) {
        // cellule sans pixel opaque : frange semi-transparente, gardée seulement au bord de l'objet
        const cx = cell % mw, cy = (cell / mw) | 0;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < mw && ny < mh && keep.has(label[ny * mw + nx])) { near = true; break; }
        }
        if (!near) data[i + 3] = 0;
        continue;
      }
      if (!keep.has(l)) { data[i + 3] = 0; continue; }
      if (data[i + 3] > 30) { solid++; if (data[i + 3] < 200) semi++; }
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 <= x0 || y1 <= y0) return null;
  // Détourage "fantôme" (objet à moitié transparent) : mieux vaut essayer une autre photo
  if (solid && semi / solid > 0.22) { if (process.env.DEBUG_CUT) console.log("  rejet: fantôme", (semi / solid).toFixed(2)); return null; }

  // Voile : une partie du fond est restée à moitié transparente autour de l'objet
  {
    let haze = 0, n = 0;
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { n++; const al = data[(y * w + x) * 4 + 3]; if (al > 20 && al < 200) haze++; }
    if (process.env.DEBUG_CUT) console.log('  voile', (haze / n).toFixed(2));
    if (haze / n > HAZE_MAX) { if (process.env.DEBUG_CUT) console.log('  rejet: voile'); return null; }
  }

  // Objet réduit à un contour (ex. seulement les bretelles d'un haut) : il remplit trop peu son cadre
  {
    let inBox = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (data[(y * w + x) * 4 + 3] > 128) inBox++;
    const fill = inBox / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (fill < 0.42) { if (process.env.DEBUG_CUT) console.log('  rejet: incomplet', fill.toFixed(2)); return null; }
  }

  // Objet trop petit dans la photo (ex. détourage raté) : on ne force pas
  if ((x1 - x0) * (y1 - y0) < w * h * 0.04) return null;

  const obj = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .png()
    .toBuffer();
  // Objet mis à l'échelle de la toile 900 × 1200 (filtre Lanczos, net), compression très légère :
  // la netteté dépend surtout de la photo d'origine, gardée sans recompression
  const innerW = Math.round(width * (1 - 2 * margin)), innerH = Math.round(height * (1 - 2 * margin));
  const fitted = await sharp(obj).resize({ width: innerW, height: innerH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }])
    .webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 5 })
    .toBuffer();
}


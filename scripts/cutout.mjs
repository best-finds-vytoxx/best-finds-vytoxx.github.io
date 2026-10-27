// Détourage de la photo principale d'un article : suppression du fond, puis nettoyage
// (règles graduées, étiquettes isolées, petites taches) et recadrage centré au format 3:4.
import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

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
export async function cutout(input, { width = 900, height = 1200, margin = 0.07 } = {}) {
  const png = await sharp(input).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const blob = await removeBackground(new Blob([png], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
  const cutPng = Buffer.from(await blob.arrayBuffer());
  return cleanCutout(cutPng, { width, height, margin, source: input });
}

/** Nettoie un PNG déjà détouré (séparé pour pouvoir le tester sans relancer le modèle). */
export async function cleanCutout(cutPng, { width = 900, height = 1200, margin = 0.07, source = null } = {}) {
  const { data, info } = await sharp(cutPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

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
      if (l === -1) continue; // cellule sans pixel opaque : simple frange semi-transparente
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
  const innerW = Math.round(width * (1 - 2 * margin)), innerH = Math.round(height * (1 - 2 * margin));
  const fitted = await sharp(obj).resize({ width: innerW, height: innerH, fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }])
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();
}


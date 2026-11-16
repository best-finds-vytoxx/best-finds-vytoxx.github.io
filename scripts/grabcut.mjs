// Détourage de secours (méthode GrabCut d'OpenCV), utilisé quand le modèle principal échoue :
// c'est le cas des vêtements blancs ou gris clair posés sur la table grise (le modèle les voit « transparents »).
// Principe : la couleur de la table est mesurée sur le bord de la photo ; ce qui s'en distingue nettement
// (ou ce que le modèle principal a commencé à voir) est probablement l'article ; GrabCut affine ensuite la frontière.
import sharp from 'sharp';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let cvReady = null;
export const loadCv = () => {
  if (!cvReady) {
    cvReady = new Promise((resolve) => {
      const cv = require('@techstark/opencv-js');
      // le module se comporte comme une promesse : on retire « then » avant de le renvoyer, sinon il se résout en boucle
      const done = (m) => { if (typeof m.then === 'function') delete m.then; resolve(m); };
      if (cv.Mat) done(cv);
      else if (typeof cv.then === 'function') cv.then(done);
      else cv.onRuntimeInitialized = () => done(cv);
    });
  }
  return cvReady;
};

const SIZE = 512; // l'analyse se fait en 512 px (rapide), le masque est ensuite agrandi

/**
 * @param {Buffer} png photo (déjà réduite à 1024 px max)
 * @param {Buffer|null} hint résultat du modèle principal (PNG transparent), même taille, ou null
 * @param {Uint8Array|null} wm masque de la vignette du canal (taille de la photo), ou null
 * @returns {Promise<Buffer|null>} PNG transparent, même taille que la photo
 */
export async function grabcut(png, hint = null, wm = null) {
  const cv = await loadCv();
  const meta = await sharp(png).metadata();
  const W = meta.width, H = meta.height;
  const s = SIZE / Math.max(W, H);
  const w = Math.max(16, Math.round(W * s)), h = Math.max(16, Math.round(H * s));
  const rgb = await sharp(png).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
  if (rgb.length !== w * h * 3) return null;
  // vignette du canal ramenée à la taille d'analyse
  const wmSmall = new Uint8Array(w * h);
  if (wm) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) wmSmall[y * w + x] = wm[Math.min(H - 1, Math.round(y / s)) * W + Math.min(W - 1, Math.round(x / s))];
  const hintA = hint
    ? await sharp(hint).ensureAlpha().extractChannel(3).resize(w, h, { fit: 'fill' }).toColourspace('b-w').raw().toBuffer()
    : Buffer.alloc(w * h);

  const img = cv.matFromArray(h, w, cv.CV_8UC3, rgb);
  const lab = new cv.Mat();
  cv.cvtColor(img, lab, cv.COLOR_RGB2Lab);
  const L = lab.data;

  // couleur de la table, mesurée sur la bande du bord (sans la règle, très sombre ou très claire) ;
  // l'éclairage varie sur la photo : on ajuste une surface douce (ordre 2) plutôt qu'une seule couleur
  const b = Math.max(4, Math.round(Math.min(w, h) * 0.08));
  const inBand = (x, y) => x < b || y < b || x >= w - b || y >= h - b;
  const feats = (x, y) => { const X = x / w, Y = y / h; return [1, X, Y, X * X, Y * Y, X * Y]; };
  const samples = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (!inBand(x, y)) continue;
    const i = (y * w + x) * 3;
    if (L[i] > 60 && L[i] < 250) samples.push([x, y, L[i], L[i + 1], L[i + 2]]);
  }
  if (samples.length < 50) { img.delete(); lab.delete(); return null; }
  const coefs = [0, 1, 2].map((c) => {
    let pts = samples;
    let k = fit(pts.map((p) => feats(p[0], p[1])), pts.map((p) => p[2 + c]));
    // seconde passe sans les 20 % de points les plus éloignés (étiquettes, ombres, bout d'article dans la bande)
    const res = pts.map((p) => Math.abs(dot(feats(p[0], p[1]), k) - p[2 + c]));
    const cut = [...res].sort((x, y) => x - y)[Math.floor(res.length * 0.8)];
    pts = pts.filter((_, j) => res[j] <= cut);
    k = fit(pts.map((p) => feats(p[0], p[1])), pts.map((p) => p[2 + c]));
    return k;
  });
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = feats(x, y), i = (y * w + x) * 3;
    const d0 = L[i] - dot(f, coefs[0]), d1 = L[i + 1] - dot(f, coefs[1]), d2 = L[i + 2] - dot(f, coefs[2]);
    dist[y * w + x] = Math.sqrt(d0 * d0 + 2 * d1 * d1 + 2 * d2 * d2);
  }

  // La règle graduée (noire) et la vignette du canal sont repeintes couleur table avant GrabCut :
  // sinon le modèle du fond apprend le noir de la règle et retire les écussons sombres des vêtements
  {
    const tab = [[], [], []];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const p = y * w + x;
      if (inBand(x, y) && dist[p] < 8) { tab[0].push(rgb[p * 3]); tab[1].push(rgb[p * 3 + 1]); tab[2].push(rgb[p * 3 + 2]); }
    }
    if (tab[0].length > 20) {
      const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
      const col = tab.map(med);
      const d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if ((inBand(x, y) && L[p * 3] < 70) || wmSmall[p]) { d[p * 3] = col[0]; d[p * 3 + 1] = col[1]; d[p * 3 + 2] = col[2]; }
      }
    }
  }

  // masque de départ
  const mask = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(cv.GC_PR_BGD));
  const md = mask.data;
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  let seeds = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (x < edge || y < edge || x >= w - edge || y >= h - edge || wmSmall[p]) { md[p] = cv.GC_BGD; continue; }
    const band = inBand(x, y);
    if (band && dist[p] < 8) { md[p] = cv.GC_BGD; continue; } // table bien reconnue au bord : fond certain
    if (hintA[p] > 200) { md[p] = cv.GC_FGD; seeds++; }
    else if (!band && (dist[p] > 18 || hintA[p] > 25)) { md[p] = cv.GC_PR_FGD; seeds++; }
  }
  if (seeds < w * h * 0.03) { img.delete(); lab.delete(); mask.delete(); return null; }

  const bgdModel = new cv.Mat(), fgdModel = new cv.Mat(), rect = new cv.Rect(0, 0, 1, 1);
  try {
    cv.grabCut(img, mask, rect, bgdModel, fgdModel, 6, cv.GC_INIT_WITH_MASK);
  } catch {
    [img, lab, mask, bgdModel, fgdModel].forEach((m) => m.delete());
    return null;
  }
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) fg[p] = md[p] === cv.GC_FGD || md[p] === cv.GC_PR_FGD ? 1 : 0;
  [img, mask, bgdModel, fgdModel].forEach((m) => m.delete());

  // table restée collée à l'article : retirée en partant du bord, sur les pixels de la couleur de la table
  const removed = new Uint8Array(w * h); // pixels reconnus comme fond : jamais rebouchés ensuite
  {
    const seen = new Uint8Array(w * h);
    const st = [];
    const push = (q) => { if (!seen[q] && dist[q] < 10) { seen[q] = 1; st.push(q); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (st.length) {
      const q = st.pop();
      const x = q % w, y = (q / w) | 0;
      if (x > 0) push(q - 1); if (x < w - 1) push(q + 1); if (y > 0) push(q - w); if (y < h - 1) push(q + w);
    }
    // fond lisse relié au bord (ex. zone de table plus claire) : on avance tant que la couleur varie très peu
    // d'un pixel au suivant ; le contour de l'article (changement net) arrête la progression
    const sm = new cv.Mat();
    cv.GaussianBlur(lab, sm, new cv.Size(3, 3), 0);
    const S = sm.data;
    const grown = new Uint8Array(w * h);
    const gq = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (((x < 3 || y < 3 || x >= w - 3 || y >= h - 3) && S[p * 3] > 70) || (inBand(x, y) && dist[p] < 6)) { grown[p] = 1; gq.push(p); }
    }
    while (gq.length) {
      const q = gq.pop();
      const x = q % w, y = (q / w) | 0;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
        if (n < 0 || grown[n]) continue;
        const d0 = S[n * 3] - S[q * 3], d1 = S[n * 3 + 1] - S[q * 3 + 1], d2 = S[n * 3 + 2] - S[q * 3 + 2];
        if (d0 * d0 + d1 * d1 + d2 * d2 < 9) { grown[n] = 1; gq.push(n); }
      }
    }
    sm.delete();
    lab.delete();
    for (let p = 0; p < w * h; p++) if (seen[p] || wmSmall[p] || grown[p]) { fg[p] = 0; removed[p] = 1; }
    // excroissances fines retirées (ouverture 5×5) : détache la vignette du canal collée au bas de l'article
    const R = 2;
    const er = new Uint8Array(w * h);
    for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
      let all = 1;
      for (let dy = -R; dy <= R && all; dy++) for (let dx = -R; dx <= R; dx++) if (!fg[(y + dy) * w + x + dx]) { all = 0; break; }
      er[y * w + x] = all;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let any = 0;
      for (let dy = -R; dy <= R && !any; dy++) for (let dx = -R; dx <= R; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && xx >= 0 && yy < h && xx < w && er[yy * w + xx]) { any = 1; break; }
      }
      fg[y * w + x] = any;
    }
  }

  // trous fermés (zones de fond qui ne touchent pas le bord) rebouchés
  const outside = new Uint8Array(w * h);
  const st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  for (let p = 0; p < w * h; p++) if (removed[p] && !fg[p]) st.push(p);
  while (st.length) {
    const q = st.pop();
    if (outside[q] || fg[q]) continue;
    outside[q] = 1;
    const x = q % w, y = (q / w) | 0;
    if (x > 0) st.push(q - 1); if (x < w - 1) st.push(q + 1); if (y > 0) st.push(q - w); if (y < h - 1) st.push(q + w);
  }
  const alphaSmall = Buffer.alloc(w * h);
  for (let p = 0; p < w * h; p++) alphaSmall[p] = fg[p] || !outside[p] ? 255 : 0;

  // masque agrandi à la taille de la photo, bord adouci
  const alpha = await sharp(alphaSmall, { raw: { width: w, height: h, channels: 1 } })
    .resize(W, H, { fit: 'fill', kernel: 'cubic' }).blur(0.8).toColourspace('b-w').raw().toBuffer();
  if (alpha.length !== W * H) return null;
  const base = await sharp(png).removeAlpha().raw().toBuffer();
  if (base.length !== W * H * 3) return null;
  return sharp(base, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
}

// Moindres carrés (équations normales, pivot de Gauss) : coefficients k tels que X·k ≈ v
function fit(X, v) {
  const n = X[0].length;
  const A = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (let r = 0; r < X.length; r++) {
    const x = X[r];
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += x[i] * x[j]; A[i][n] += x[i] * v[r]; }
  }
  for (let i = 0; i < n; i++) A[i][i] += 1e-6;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j];
    }
  }
  return Array.from({ length: n }, (_, i) => A[i][n] / A[i][i]);
}
const dot = (a, b) => a.reduce((t, x, i) => t + x * b[i], 0);

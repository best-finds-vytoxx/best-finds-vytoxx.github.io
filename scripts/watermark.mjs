// Repère la vignette du canal (panda + « VYTOXX ») posée à côté de l'article sur les photos,
// pour qu'elle ne reste jamais collée au détourage. Recherche par gabarit (OpenCV) à plusieurs échelles.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { loadCv } from './grabcut.mjs';

const TEMPLATE = new URL('./watermark.png', import.meta.url);
let tpl = null;

/**
 * @param {Buffer} png photo
 * @returns {Promise<Uint8Array|null>} masque (1 = pixel de la vignette) à la taille de la photo, ou null si absente
 */
export async function watermarkMask(png) {
  const cv = await loadCv();
  if (!tpl) {
    const { data, info } = await sharp(readFileSync(TEMPLATE)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    tpl = { data, w: info.width, h: info.height };
  }
  const meta = await sharp(png).metadata();
  const W = meta.width, H = meta.height;
  const s = 512 / Math.max(W, H);
  const w = Math.round(W * s), h = Math.round(H * s);
  const rgb = await sharp(png).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
  const img = cv.matFromArray(h, w, cv.CV_8UC3, rgb);
  const t0 = cv.matFromArray(tpl.h, tpl.w, cv.CV_8UC3, tpl.data);
  let best = { score: -1 };
  // hauteur de la vignette : de 6 % à 26 % de la hauteur de la photo
  for (let th = Math.round(h * 0.06); th <= h * 0.26; th = Math.round(th * 1.12) + 1) {
    const tw = Math.round(th * tpl.w / tpl.h);
    if (tw < 8 || tw >= w || th >= h) continue;
    const t = new cv.Mat();
    cv.resize(t0, t, new cv.Size(tw, th), 0, 0, cv.INTER_AREA);
    const res = new cv.Mat();
    cv.matchTemplate(img, t, res, cv.TM_CCOEFF_NORMED);
    const m = cv.minMaxLoc(res);
    if (m.maxVal > best.score) {
      best.t?.delete();
      best = { score: m.maxVal, x: m.maxLoc.x, y: m.maxLoc.y, tw, th, t };
    } else t.delete();
    res.delete();
  }
  img.delete(); t0.delete();
  if (!best.t) return null;
  const { score, x, y, tw, th, t } = best;
  const td = Uint8Array.from(t.data);
  t.delete();
  if (process.env.DEBUG_CUT) console.log(`  vignette : ressemblance ${score.toFixed(2)} à (${x}, ${y}), ${tw}×${th}`);
  if (score < 0.83) return null; // en dessous, ressemblance fortuite
  // seuls les pixels qui ressemblent à la vignette sont marqués (l'article peut la recouvrir en partie)
  const small = new Uint8Array(w * h);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const p = ((y + j) * w + (x + i)) * 3, q = (j * tw + i) * 3;
    const d = (Math.abs(rgb[p] - td[q]) + Math.abs(rgb[p + 1] - td[q + 1]) + Math.abs(rgb[p + 2] - td[q + 2])) / 3;
    if (d < 45) small[(y + j) * w + (x + i)] = 1;
  }
  // un pixel autour en plus (bord flou de la vignette)
  const grown = new Uint8Array(w * h);
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
    if (small[yy * w + xx] || small[yy * w + xx - 1] || small[yy * w + xx + 1] || small[(yy - 1) * w + xx] || small[(yy + 1) * w + xx]) grown[yy * w + xx] = 1;
  }
  const big = await sharp(Buffer.from(grown.map((v) => v * 255)), { raw: { width: w, height: h, channels: 1 } })
    .resize(W, H, { fit: 'fill', kernel: 'nearest' }).toColourspace('b-w').raw().toBuffer();
  const out = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) out[p] = big[p] > 127 ? 1 : 0;
  return out;
}

import sharp from 'sharp';

/** Particularités d'un modèle d'après son titre : ouvert derrière (claquettes, sandales, sabots), botte (tige haute). */
export function shoeTraits(title = '', noun = '') {
  const t = String(title);
  const openBack = (/slides|sandals/.test(noun) || /sabot|clog|claquette|sandale|mule|slide|crocs/i.test(t)) && !/ugg|tasman|toronto/i.test(t);
  const boot = /\bbottes?\b|\bboots?\b|bottines?|chelsea|timberland|toronto|ugg/i.test(t) && !/football|crampon|mule|tasman/i.test(t);
  return { openBack, boot };
}


// Côté du bout de la chaussure, d'après sa silhouette (photo détourée) :
// - le bout est le côté le plus bas (le talon et le col montent plus haut), sauf pour les modèles ouverts derrière
//   (claquettes, mules, sandales, sabots) où c'est l'inverse ;
// - la semelle se relève sous la pointe (le talon reste posé à plat).
// Renvoie > 0 si le bout est à gauche, < 0 s'il est à droite, proche de 0 si on ne sait pas.
export async function toeSide(webp, openBack = false) {
  const { data, info } = await sharp(webp).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const top = [], bot = [];
  for (let x = 0; x < W; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < H; y++) if (data[y * W + x] > 128) { if (t < 0) t = y; b = y; }
    if (t >= 0) { top.push(t); bot.push(b); }
  }
  if (top.length < 20) return 0;
  const y0 = Math.min(...top), y1 = Math.max(...bot), h = Math.max(1, y1 - y0);
  const k = Math.max(3, Math.round(top.length * 0.15));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const heightL = (y1 - mean(top.slice(0, k))) / h, heightR = (y1 - mean(top.slice(-k))) / h;
  const liftL = (y1 - mean(bot.slice(0, k))) / h, liftR = (y1 - mean(bot.slice(-k))) / h;
  return (heightR - heightL) * (openBack ? -1 : 1) + (liftL - liftR);
}

// Remet la chaussure à plat : la ligne sur laquelle elle repose (le bord bas de sa silhouette, du talon à l'avant du pied)
// est rendue horizontale. Ne touche pas aux petites inclinaisons (< 4°) ni aux formes douteuses (> 15°).
// Renvoie { buf, angle } (buf = image recentrée sur la même toile, angle en degrés, 0 = inchangée).
export async function levelShoe(webp, { margin = 0.07 } = {}) {
  const img = sharp(webp).ensureAlpha();
  const { width: W, height: H } = await img.metadata();
  const { data } = await img.clone().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const pts = [];
  for (let x = 0; x < W; x += 2) {
    for (let y = H - 1; y >= 0; y--) if (data[y * W + x] > 128) { pts.push([x, y]); break; }
  }
  if (pts.length < 30) return { buf: webp, angle: 0 };
  // enveloppe convexe du bas (les points les plus bas), de gauche à droite
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hull = [];
  for (const p of pts) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) >= 0) hull.pop();
    hull.push(p);
  }
  const span = pts[pts.length - 1][0] - pts[0][0];
  let best = null;
  for (let i = 1; i < hull.length; i++) {
    const dx = hull[i][0] - hull[i - 1][0], dy = hull[i][1] - hull[i - 1][1];
    if (!best || dx > best.dx) best = { dx, dy };
  }
  if (!best || best.dx < span * 0.4) return { buf: webp, angle: 0 };
  const angle = (Math.atan2(best.dy, best.dx) * 180) / Math.PI;
  if (Math.abs(angle) < 4 || Math.abs(angle) > 15) return { buf: webp, angle: 0 };
  const turned = await sharp(webp).rotate(-angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const trimmed = await sharp(turned).trim({ threshold: 1 }).png().toBuffer();
  const innerW = Math.round(W * (1 - 2 * margin)), innerH = Math.round(H * (1 - 2 * margin));
  const fitted = await sharp(trimmed).resize({ width: innerW, height: innerH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 5 }).toBuffer();
  return { buf, angle };
}

// Tourne la couverture d'un angle donné (degrés, sens des aiguilles d'une montre) et la recentre sur la même toile.
// Sert aux vues de dessus (bout vers le haut ou le bas) que l'on veut voir à l'horizontale, bout à gauche.
export async function turnCover(webp, deg, { margin = 0.07 } = {}) {
  const { width: W, height: H } = await sharp(webp).metadata();
  const turned = await sharp(webp).rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const trimmed = await sharp(turned).trim({ threshold: 1 }).png().toBuffer();
  const innerW = Math.round(W * (1 - 2 * margin)), innerH = Math.round(H * (1 - 2 * margin));
  const fitted = await sharp(trimmed).resize({ width: innerW, height: innerH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 5 }).toBuffer();
}

import sharp from 'sharp';

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

// Couverture automatique d'une chaussure : UNE seule chaussure, vue de côté, bout à gauche, talon à droite, posée à plat.
// Demande de Léonard (novembre 2026), sans réglage à la main :
// 1. la dernière photo du post (convention du canal : la chaussure seule de profil, sur sa boîte et la balance) d'abord ;
// 2. chaque chaussure repérée dans la photo (Grounding DINO, « shoe. ») est découpée seule : l'autre chaussure de la paire
//    est effacée avant le détourage ;
// 3. la silhouette est mise à l'horizontale (une chaussure couchée photographiée d'en haut est tournée d'un quart de tour),
//    semelle en bas, bout à gauche (miroir seulement si aucune autre vue ne convient), puis remise à plat ;
// 4. si la dernière photo ne donne pas une vue de côté propre (paire collée, chaussure coupée, vue de face…), les autres
//    photos du post sont essayées et la meilleure vue de côté est gardée. Sinon : ancienne logique (vue de face).
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { cutout } from './cutout.mjs';
import { visionBoxes } from './vision.mjs';
import { levelShoe, turnCover } from './shoe-side.mjs';
export { shoeTraits } from './shoe-side.mjs';

const area = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const inter = (a, b) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);

/**
 * Chaussures prises une à une dans les cadres du repérage : sans le cadre qui englobe toute la paire, sans les doublons,
 * sans les cadres minuscules ou couvrant toute la photo. Renvoie au plus 3 cadres, du plus sûr au moins sûr.
 */
export function singleShoes(boxes, W, H) {
  if (!boxes?.length) return [];
  const best = Math.max(...boxes.map((b) => b[4]));
  let list = boxes.filter((b) => b[4] >= Math.max(0.28, best * 0.5) && area(b) < W * H * 0.85 && area(b) > W * H * 0.012);
  // doublons (deux cadres presque identiques) : on garde le plus sûr
  const kept = [];
  for (const b of list.sort((x, y) => y[4] - x[4])) {
    if (kept.some((k) => inter(k, b) / Math.min(area(k), area(b)) > 0.8 && Math.max(area(k), area(b)) / Math.min(area(k), area(b)) < 1.5)) continue;
    kept.push(b);
  }
  // cadre qui contient au moins deux autres cadres : c'est la paire entière
  list = kept.filter((b) => kept.filter((o) => o !== b && inter(b, o) / area(o) > 0.75).length < 2);
  return list.slice(0, 3);
}

/** Masque réduit (≈ 320 px) de la partie opaque d'une image détourée. */
export async function maskOf(buf, size = 320) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel(3)
    .resize({ width: size, height: size, fit: 'inside', kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(info.width * info.height);
  for (let i = 0; i < m.length; i++) m[i] = data[i] > 128 ? 1 : 0;
  return { m, w: info.width, h: info.height };
}

/** Masque tourné d'un quart de tour (deg = 90 : sens des aiguilles d'une montre, -90 : sens inverse) ou d'un demi-tour. */
export function rotateMask({ m, w, h }, deg) {
  if (!deg) return { m, w, h };
  if (deg === 180) { const r = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) r[m.length - 1 - i] = m[i]; return { m: r, w, h }; }
  const r = new Uint8Array(w * h), W2 = h, H2 = w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    const nx = deg === 90 ? h - 1 - y : y, ny = deg === 90 ? x : w - 1 - x;
    r[ny * W2 + nx] = 1;
  }
  return { m: r, w: W2, h: H2 };
}

/** Nombre de gros morceaux séparés (plus de 8 % du plus gros) : 2 = la paire est restée. */
export function bigParts({ m, w, h }) {
  const seen = new Uint8Array(w * h), sizes = [], st = [];
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || seen[s]) continue;
    let n = 0; st.push(s); seen[s] = 1;
    while (st.length) {
      const p = st.pop(); n++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, q = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && m[q] && !seen[q]) { seen[q] = 1; st.push(q); }
      }
    }
    sizes.push(n);
  }
  const big = Math.max(0, ...sizes);
  return sizes.filter((n) => n >= big * 0.08).length;
}

const lineRms = (xs, ys) => {
  const n = xs.length; if (n < 5) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const k = sxx ? sxy / sxx : 0;
  let e = 0; for (let i = 0; i < n; i++) e += (ys[i] - my - k * (xs[i] - mx)) ** 2;
  return Math.sqrt(e / n);
};

/**
 * Lecture d'une silhouette posée à l'horizontale :
 * ratio = largeur / hauteur ; upright > 0 si la semelle (bord le plus droit) est en bas ;
 * toe > 0 si le bout est à gauche (le col et le talon montent plus haut que l'avant du pied, la semelle se relève
 * sous la pointe ; inversé pour les modèles ouverts derrière).
 */
export function profileOf({ m, w, h }, openBack = false) {
  const cols = [], top = [], bot = [];
  let y0 = h, y1 = -1;
  for (let x = 0; x < w; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < h; y++) if (m[y * w + x]) { if (t < 0) t = y; b = y; }
    if (t >= 0) { cols.push(x); top.push(t); bot.push(b); if (t < y0) y0 = t; if (b > y1) y1 = b; }
  }
  if (cols.length < 10 || y1 <= y0) return { ratio: 0, upright: 0, toe: 0 };
  const hh = y1 - y0, ww = cols[cols.length - 1] - cols[0];
  const a = Math.floor(cols.length * 0.1), z = Math.ceil(cols.length * 0.9);
  const rb = lineRms(cols.slice(a, z), bot.slice(a, z)) / hh, rt = lineRms(cols.slice(a, z), top.slice(a, z)) / hh;
  const k = Math.max(3, Math.round(cols.length * 0.15));
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const heightL = (y1 - mean(top.slice(0, k))) / hh, heightR = (y1 - mean(top.slice(-k))) / hh;
  const liftL = (y1 - mean(bot.slice(0, k))) / hh, liftR = (y1 - mean(bot.slice(-k))) / hh;
  const toe = (heightR - heightL) * (openBack ? -1 : 1) + (liftL - liftR);
  return { ratio: ww / hh, upright: rt - rb, toe, rt, rb };
}

/**
 * Bord droit et net à l'extrémité de la silhouette (gauche, droite ou haut d'une chaussure posée semelle en bas) :
 * la chaussure a été coupée (bord de la photo, règle, autre chaussure effacée). Un bout ou un talon naturels sont arrondis.
 * Renvoie, pour chaque côté, la longueur du plus long segment droit (à 1,5 px près, pente ≤ 17°) collé à l'extrémité,
 * en part de la hauteur (gauche, droite) ou de la largeur (haut) de la silhouette.
 */
export function cutEdges({ m, w, h }, maxSlope = 0.3) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return { left: 0, right: 0, top: 0 };
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const left = [], right = [], top = [];
  for (let y = y0; y <= y1; y++) {
    let a = -1, b = -1;
    for (let x = x0; x <= x1; x++) if (m[y * w + x]) { if (a < 0) a = x; b = x; }
    left.push(a < 0 ? NaN : a - x0); right.push(b < 0 ? NaN : x1 - b);
  }
  for (let x = x0; x <= x1; x++) {
    let t = -1;
    for (let y = y0; y <= y1; y++) if (m[y * w + x]) { t = y; break; }
    top.push(t < 0 ? NaN : t - y0);
  }
  const run = (p, span) => {
    const near = span * 0.06;
    let best = 0;
    for (let i = 0; i < p.length; i++) {
      if (!(p[i] <= near)) continue;
      let lo = -Infinity, hi = Infinity, j = i + 1;
      for (; j < p.length; j++) {
        if (!(p[j] <= near)) break;
        const d = j - i;
        lo = Math.max(lo, (p[j] - p[i] - 1.5) / d); hi = Math.min(hi, (p[j] - p[i] + 1.5) / d);
        if (lo > hi || lo > maxSlope || hi < -maxSlope) break;
      }
      best = Math.max(best, j - i);
    }
    return best / p.length;
  };
  return { left: +run(left, W).toFixed(3), right: +run(right, W).toFixed(3), top: +run(top, H).toFixed(3) };
}

/**
 * Meilleure orientation d'une chaussure détourée : quart de tour si elle est couchée en hauteur, demi-tour si la semelle
 * est en haut (jamais pour la photo sur la boîte : la chaussure y est debout), miroir si le bout est à droite.
 */
export function orient(mask, { openBack = false, upright = false } = {}) {
  const base = profileOf(mask, openBack);
  const tall = base.ratio && base.ratio < 0.95;
  const turns = upright ? [0] : tall ? [-90, 90] : base.ratio < 1.25 ? [0, 180, -90, 90] : [0, 180];
  let best = null;
  for (const deg of turns) {
    const p = profileOf(rotateMask(mask, deg), openBack);
    // demi-tour seulement si la semelle est nettement en haut
    const s = p.upright - (deg === 180 ? 0.03 : 0) - (Math.abs(deg) === 90 && p.ratio < 1 ? 1 : 0);
    if (!best || s > best.s) best = { s, deg, ...p };
  }
  return { deg: best.deg, ratio: best.ratio, upright: best.upright, toe: best.toe, flip: best.toe < -0.08 };
}

/** Recadrage sur une seule chaussure : marge autour du cadre, l'autre chaussure effacée, bord de fond ajouté. */
export async function cropSingle(photoBuf, box, others = []) {
  const img = sharp(photoBuf).rotate();
  const { data, info } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const [bx0, by0, bx1, by1] = box, bw = bx1 - bx0, bh = by1 - by0;
  // debout (plus large que haute) : peu de marge sous la semelle, la boîte sur laquelle elle est posée reste dehors
  const flat = bw >= bh;
  const mx = bw * (flat ? 0.06 : 0.05), mt = bh * (flat ? 0.08 : 0.05), mb = bh * (flat ? 0.025 : 0.05);
  const x0 = Math.max(0, Math.round(bx0 - mx)), y0 = Math.max(0, Math.round(by0 - mt));
  const x1 = Math.min(W, Math.round(bx1 + mx)), y1 = Math.min(H, Math.round(by1 + mb));
  // couleur du fond : médiane des pixels du bord du recadrage
  const px = [];
  const at = (x, y) => { const i = (y * W + x) * 3; px.push([data[i], data[i + 1], data[i + 2]]); };
  for (let x = x0; x < x1; x += 4) { at(x, y0); at(x, y1 - 1); }
  for (let y = y0; y < y1; y += 4) { at(x0, y); at(x1 - 1, y); }
  const med = (c) => px.map((p) => p[c]).sort((a, b) => a - b)[px.length >> 1] ?? 200;
  const bg = { r: med(0), g: med(1), b: med(2) };
  const out = Buffer.from(data);
  // l'autre chaussure (et tout autre cadre) est peinte de la couleur du fond, sauf là où elle chevauche la nôtre
  for (const o of others) {
    for (let y = Math.max(y0, Math.floor(o[1])); y < Math.min(y1, Math.ceil(o[3])); y++) {
      for (let x = Math.max(x0, Math.floor(o[0])); x < Math.min(x1, Math.ceil(o[2])); x++) {
        if (x >= bx0 && x < bx1 && y >= by0 && y < by1) continue;
        const i = (y * W + x) * 3; out[i] = bg.r; out[i + 1] = bg.g; out[i + 2] = bg.b;
      }
    }
  }
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.08);
  const png = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: bg }).png().toBuffer();
  return { png, touches: bx0 < W * 0.01 || by0 < H * 0.01 || bx1 > W * 0.99 || by1 > H * 0.99, boxRatio: bw / Math.max(1, bh) };
}

const mirror = (buf) => sharp(buf).flop().webp({ quality: 92, alphaQuality: 100 }).toBuffer();

/** Une chaussure candidate : détourée seule, orientée, notée. null si le détourage échoue. */
async function candidate(photo, n, box, others, { last, openBack, minRatio }) {
  const { png, touches, boxRatio } = await cropSingle(photo, box, others);
  const cut = await cutout(png, { dropPackaging: false, rescue: false, prompt: '__full__' });
  if (!cut) return null;
  const mask = await maskOf(cut);
  const parts = bigParts(mask);
  const raw = profileOf(mask);
  // le détourage doit garder toute la chaussure repérée : même allure que son cadre (sinon talon ou bout coupés)
  const fit = raw.ratio && boxRatio ? raw.ratio / boxRatio : 1;
  const o = orient(mask, { openBack, upright: last && boxRatio >= 1 });
  // chaussure debout sur sa boîte (dernière photo, sans rotation) : la meilleure vue ; elle frôle souvent le bord de la photo
  // sans être coupée. Une vraie coupe se voit à un bord parfaitement droit et aligné sur le cadre, au bout du pied ou en haut
  // (lacets, col) ; le talon, lui, est naturellement droit. Les claquettes ont une bride plate en haut : pas de contrôle du haut.
  const standing = last && o.deg === 0;
  const edges = cutEdges(rotateMask(mask, o.deg), 0.02);
  const toeEdge = o.flip ? edges.right : edges.left;
  const cutOff = (!openBack && edges.top > (standing ? 0.35 : 0.17)) || toeEdge > (standing ? 0.45 : 0.3);
  // sans semelle posée à plat (semelle vue de dessous, chaussure vue de face puis couchée) : ce n'est pas une vue de côté
  const noSole = o.upright < 0.02 && !standing;
  let score = 1 + (last ? 0.4 : 0) + 0.6 * Math.min(Math.abs(o.toe), 0.6) + 2 * Math.max(0, Math.min(o.upright, 0.15))
    - (o.flip ? 0.15 : 0) - (Math.abs(o.deg) === 90 ? 0.2 : 0) - (parts > 1 ? 1 : 0) - (touches && !(standing && !cutOff) ? 0.6 : 0)
    - (fit < 0.75 || fit > 1.33 ? 0.5 : 0) - (cutOff ? 0.8 : 0) - (noSole ? 0.5 : 0);
  const okRatio = o.ratio >= minRatio;
  if (!okRatio) score -= 2;
  return { n, box, cut, deg: o.deg, flip: o.flip, ratio: +o.ratio.toFixed(2), upright: +o.upright.toFixed(3), toe: +o.toe.toFixed(2), parts, touches, fit: +fit.toFixed(2), score: +score.toFixed(2), last, standing, cutOff, noSole, edges };
}

/** Image finale d'une candidate : quart ou demi-tour, remise à plat, miroir si le bout est à droite. */
export async function finish(c) {
  let buf = c.deg ? await turnCover(c.cut, c.deg) : c.cut;
  ({ buf } = await levelShoe(buf));
  if (c.flip) buf = await mirror(buf);
  return buf;
}

/**
 * job = { id, inputs: [{ n, path }], openBack, minRatio, exclude? } (chaussure sans réglage à la main).
 * Renvoie { n, out, side: true, ... } ou null (aucune vue de côté propre : l'ancienne logique prend le relais).
 * opts.all = true : toutes les photos sont essayées et toutes les candidates renvoyées (essais au labo).
 */
export async function autoShoe(job, { all = false, log = console.log } = {}) {
  const photos = [...job.inputs].filter((i) => !(job.exclude || []).includes(i.n)).sort((a, b) => a.n - b.n);
  if (!photos.length) return null;
  const lastN = photos[photos.length - 1].n;
  const minRatio = job.minRatio || 1.35;
  const seen = [];
  const tryPhoto = async (p, max) => {
    const det = await visionBoxes(p.path, 'shoe.');
    if (!det) return false;
    const [W, H] = det.size;
    const singles = singleShoes(det.boxes, W, H);
    // photos autres que la dernière : seulement les chaussures allongées (de côté ou couchées), les plus grandes d'abord
    const pool = p.n === lastN ? singles : singles
      .filter((b) => Math.max(b[2] - b[0], b[3] - b[1]) / Math.max(1, Math.min(b[2] - b[0], b[3] - b[1])) >= 1.45);
    const photo = await readFile(p.path);
    for (const b of pool.slice(0, max)) {
      const others = det.boxes.filter((o) => o !== b && o[4] >= 0.25);
      try {
        const c = await candidate(photo, p.n, b, others, { last: p.n === lastN, openBack: job.openBack, minRatio });
        if (c) seen.push(c);
      } catch (e) { log(`  ${job.id} : photo ${p.n}, chaussure non détourée (${e.message})`); }
    }
    return true;
  };
  // 1. dernière photo
  if (!(await tryPhoto(photos[photos.length - 1], 2))) return null; // repérage indisponible : ancienne méthode
  const good = (c) => c.score >= 1.6 && c.parts === 1 && (!c.touches || c.standing) && !c.cutOff && !c.noSole && c.fit >= 0.75 && c.fit <= 1.33;
  // 2. autres photos si la dernière ne suffit pas (photo 1 en dernier : souvent les talons)
  if (all || !seen.some(good)) {
    const rest = photos.slice(0, -1);
    for (const p of [...rest.filter((x) => x.n !== 1), ...rest.filter((x) => x.n === 1)].slice(0, 6)) await tryPhoto(p, 2);
  }
  // choix : une vue debout (sans quart de tour) d'abord ; à défaut la chaussure sur sa boîte même un peu coupée (une vue
  // de dessus tournée peut être une vue de face ou une semelle mal reconnue) ; en dernier recours une vue de dessus tournée
  const best = (l) => [...l].sort((a, b) => b.score - a.score)[0];
  const ok = seen.filter((c) => c.ratio >= minRatio && c.parts === 1 && c.score >= 1.2);
  const pick = best(ok.filter((c) => c.deg === 0 || c.deg === 180))
    || best(seen.filter((c) => c.standing && c.ratio >= minRatio && c.parts === 1 && c.score >= 0.5))
    || best(ok);
  for (const c of seen) log(`  ${job.id} : photo ${c.n} ${c === pick ? '✓' : '·'} note ${c.score} (côté ${c.ratio}, semelle ${c.upright}, bout ${c.toe}${c.deg ? `, tournée ${c.deg}°` : ''}${c.flip ? ', miroir' : ''}${c.parts > 1 ? ', 2 morceaux' : ''}${c.touches ? ', frôle le bord' : ''}${c.cutOff ? ', coupée' : ''}${c.noSole ? ', pas de semelle à plat' : ''}, allure ${c.fit})`);
  if (all) return { pick, seen };
  if (!pick) return null;
  return { n: pick.n, out: await finish(pick), side: true, auto: true };
}

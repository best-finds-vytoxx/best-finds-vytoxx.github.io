// Lien avec scripts/vision.py (repérage du produit + détourage BiRefNet), lancé une seule fois par processus.
// Si Python ou les modèles manquent, visionMask() renvoie null et le détourage d'origine (@imgly) prend le relais.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const MODEL = process.env.BIREFNET || 'models/birefnet-general.onnx';
let proc = null, ready = null, broken = false;
const waiting = [];

function start() {
  if (proc || broken) return ready;
  if (process.env.VISION === '0' || !existsSync(MODEL)) { broken = true; return null; }
  proc = spawn(process.env.PYTHON || 'python3', ['scripts/vision.py'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, BIREFNET: MODEL } });
  ready = new Promise((resolve) => {
    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.ready) return resolve(true);
      waiting.shift()?.(msg);
    });
    // modèles trop longs à charger (téléchargement bloqué…) : on abandonne cette méthode pour ce passage
    const t = setTimeout(() => { console.warn('  repérage/détourage : démarrage trop long, ancienne méthode utilisée'); broken = true; proc?.kill('SIGKILL'); resolve(false); }, 6 * 60e3);
    t.unref?.();
    rl.on('line', () => clearTimeout(t));
    proc.on('exit', (code) => {
      broken = true; proc = null;
      resolve(false);
      while (waiting.length) waiting.shift()({ ok: false, error: `vision arrêté (${code})` });
    });
  });
  return ready;
}

/** Nom anglais du produit → consigne de repérage (« shoe. », « t-shirt. »…). */
export function promptFor(noun = '', kind = '') {
  let n = String(noun).replace(/^(a pair of|an|a)\s+/i, '').trim();
  if (kind === 'shoe' || /sneaker|shoe|boot|slide|sandal|mule|loafer|clog/i.test(n)) n = 'shoe';
  return `${n || 'object'}.`;
}

/** Masque du produit (PNG en niveaux de gris, taille de la photo) ou null si la méthode n'est pas disponible. */
export async function visionMask(inPath, outPath, prompt) {
  const ok = await start();
  if (!ok || !proc) return null;
  const res = await new Promise((resolve) => {
    // une photo qui prend plus de 3 minutes : le processus est arrêté, l'ancienne méthode prend le relais
    const t = setTimeout(() => { broken = true; proc?.kill('SIGKILL'); resolve({ ok: false, error: 'trop long' }); }, 3 * 60e3);
    waiting.push((r) => { clearTimeout(t); resolve(r); });
    proc.stdin.write(JSON.stringify({ in: inPath, out: outPath, prompt }) + '\n');
  });
  if (!res.ok) { console.warn(`  repérage/détourage impossible : ${res.error}`); return null; }
  return res;
}

export function stopVision() { if (proc) proc.stdin.end(); }

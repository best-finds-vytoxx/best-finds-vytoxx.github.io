// Remplace fetch par les pages capturées (test hors ligne)
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const dir = process.env.FIXTURES;
const img = await sharp({ create: { width: 800, height: 1066, channels: 3, background: '#9a9590' } }).jpeg().toBuffer();
globalThis.fetch = async (url) => {
  url = String(url);
  const ok = (body) => ({ ok: true, status: 200, text: async () => body, arrayBuffer: async () => img.buffer.slice(img.byteOffset, img.byteOffset + img.byteLength) });
  if (url.includes('telesco.pe')) return ok('');
  const m = url.match(/before=(\d+)/);
  if (!m) return ok(readFileSync(dir + '/page0.html', 'utf8'));
  for (let i = 1; i < 7; i++) { const h = readFileSync(`${dir}/page${i}.html`, 'utf8'); if (h.includes(`data-before="`) && i === Number(process.env.PAGE_I || 0)) {} }
  // renvoie la page dont les posts sont tous < before
  for (let i = 1; i < 7; i++) {
    const h = readFileSync(`${dir}/page${i}.html`, 'utf8');
    const ids = [...h.matchAll(/data-post="[^/]+\/(\d+)"/g)].map(x => +x[1]);
    if (ids.length && Math.max(...ids) < +m[1] && Math.max(...ids) >= +m[1] - 40) return ok(h);
  }
  return ok('<html></html>');
};

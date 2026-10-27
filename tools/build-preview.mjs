// Construit un aperçu autonome (un seul fichier HTML, données et photos intégrées) à partir des pages capturées.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseMessages, toArticles, describe } from '../scripts/parse.mjs';
const [fixtures, thumbsFile, out, cutDir] = process.argv.slice(2);
import { existsSync } from 'node:fs';
const thumbs = JSON.parse(readFileSync(thumbsFile, 'utf8'));
const msgs = readdirSync(fixtures).filter(f => f.endsWith('.html')).flatMap(f => parseMessages(readFileSync(`${fixtures}/${f}`, 'utf8')));
const cover = (id) => (cutDir && existsSync(`${cutDir}/${id}.webp`) ? 'data:image/webp;base64,' + readFileSync(`${cutDir}/${id}.webp`).toString('base64') : null);
const articles = toArticles(msgs).map(({ photosRemote, ...a }) => ({ ...a, photos: thumbs[a.id] || [], cover: cover(a.id), description: describe({ ...a, photoCount: (thumbs[a.id] || []).length, extra: '' }) })).sort((a, b) => b.id - a.id);
const data = { historyComplete: true, updatedAt: new Date(Date.now() - 6 * 60e3).toISOString(), articles };
const css = readFileSync('assets/style.css', 'utf8');
const cfg = readFileSync('assets/config.js', 'utf8');
let js = readFileSync('assets/app.js', 'utf8');
// Images du site intégrées (l'aperçu ne peut pas charger de fichiers séparés)
const MIME = { png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };
js = js.replace(/'assets\/(img|video)\/([\w.-]+)'/g, (_, d, f) => `'data:${MIME[f.split('.').pop()]};base64,${readFileSync(`assets/${d}/${f}`).toString('base64')}'`);
const html = `<title>Best Finds</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">
<style>${css}</style>
<div id="app"></div>
<script>${cfg}</script>
<script>window.__DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(out, (html.length / 1e6).toFixed(2) + ' Mo', articles.length, 'articles');

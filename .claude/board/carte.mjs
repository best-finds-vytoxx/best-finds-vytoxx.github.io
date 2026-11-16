// Carte des agents : fabrique la page (un seul fichier HTML) à partir des fiches de `.claude/agents/`
// et du skill `board`. Usage : node .claude/board/carte.mjs <fichier-de-sortie.html> [prénom au centre]
// La page est publiée comme Artifact privé (adresse dans CLAUDE.md) ; la refaire après tout changement d'agent.
// Style demandé : celui de la vidéo TikTok de @hippo_vlt (rond central rouge foncé, agents « A », routines « R »).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) { console.error('Indique le fichier de sortie.'); process.exit(1); }

const MOI = process.argv[3] || 'Vytoxx'; // prénom du rond central : en argument, jamais écrit ici (dépôt public)
// Agents : angle en degrés autour du rond central (0 = à droite, 90 = en bas).
const AGENTS = [
  { id: 'cmo', nom: 'CMO', deg: -90 },
  { id: 'avocat-du-diable', nom: 'Avocat du diable', deg: -32 },
  { id: 'cto', nom: 'CTO', deg: 22 },
  { id: 'hocs', nom: 'HOCS', deg: 78 },
  { id: 'stratege', nom: 'Strategic foresight', deg: 134 },
  { id: 'moneymaker', nom: 'Moneymaker', deg: 190 },
];
// Routines du robot du site (toutes les 15 minutes), rattachées au CTO.
const ROUTINES = [
  { id: 'r-canal', nom: 'Lecture du canal', fichier: 'scripts/scrape.mjs, scripts/parse.mjs', resume: 'Lit les posts du canal Telegram, range chaque article dans sa catégorie, nettoie le titre, retrouve le lien LoveGoBuy et retire les posts supprimés.' },
  { id: 'r-photos', nom: 'Photos et détourage', fichier: 'scripts/pick.mjs, scripts/cutout.mjs, scripts/shoe-cover.mjs', resume: 'Télécharge les photos, choisit la meilleure pour la couverture et détoure le produit. Pour les chaussures : une seule, de côté, bout à gauche.' },
  { id: 'r-prix', nom: 'Prix LoveGoBuy', fichier: 'scripts/prices.mjs', resume: 'Relève le prix de chaque article, le revérifie environ toutes les 20 heures et masque les articles qui ne sont plus disponibles.' },
  { id: 'r-clics', nom: 'Top du moment', fichier: 'scripts/clicks.mjs', resume: 'Relève les compteurs de chaque article (fiches ouvertes et clics vers LoveGoBuy) pour classer les plus regardés.' },
  { id: 'r-qualite', nom: 'Contrôle qualité', fichier: 'scripts/audit.mjs', resume: 'Relit tout le site après chaque passage (prix, détourage, fichiers, titres, liens, catégories) et écrit le bilan affiché en haut du tracker.' },
  { id: 'r-partage', nom: 'Aperçus de partage', fichier: 'scripts/og.mjs', resume: 'Fabrique l\'image et la page d\'aperçu de chaque article, celles qui s\'affichent quand on partage un lien.' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<span class="k">$1</span>');

function lire(chemin) {
  const txt = readFileSync(join(root, chemin), 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  for (const l of m[1].split('\n')) {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return { meta, corps: m[2].trim() };
}

// Petit rendu du texte des fiches : titres, paragraphes, listes, tableaux, blocs.
function rendre(md) {
  const L = md.split('\n');
  const h = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) {
      const b = [];
      i++;
      while (i < L.length && !L[i].startsWith('```')) b.push(L[i++]);
      i++;
      h.push('<pre>' + esc(b.join('\n')) + '</pre>');
    } else if (/^#{1,4} /.test(l)) {
      h.push('<h4>' + inline(l.replace(/^#+ /, '')) + '</h4>');
      i++;
    } else if (l.startsWith('|')) {
      const rows = [];
      while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s|:-]+\|$/.test(r));
      h.push('<div class="tw"><table>' + body.map((r, n) => '<tr>' + cells(r).map((c) => (n ? '<td>' : '<th>') + inline(c) + (n ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></div>');
    } else if (/^(- |\d+\. )/.test(l)) {
      const num = /^\d/.test(l);
      const items = [];
      while (i < L.length && (/^(- |\d+\. )/.test(L[i]) || /^ {2,}\S/.test(L[i]))) {
        if (/^(- |\d+\. )/.test(L[i])) items.push(L[i].replace(/^(- |\d+\. )/, ''));
        else items[items.length - 1] += ' ' + L[i].trim();
        i++;
      }
      h.push((num ? '<ol>' : '<ul>') + items.map((t) => '<li>' + inline(t) + '</li>').join('') + (num ? '</ol>' : '</ul>'));
    } else {
      const p = [];
      while (i < L.length && L[i].trim() && !/^(```|#{1,4} |\||- |\d+\. )/.test(L[i])) p.push(L[i++].trim());
      h.push('<p>' + inline(p.join(' ')) + '</p>');
    }
  }
  return h.join('');
}

// ----- Les fiches -----
const data = {};
const ids = AGENTS.map((a) => a.id);
for (const a of AGENTS) {
  const f = lire(`agents/${a.id}.md`);
  data[a.id] = {
    type: 'Agent', nom: a.nom, resume: f.meta.description,
    rows: [
      ['Place', a.id === 'hocs' ? 'Membre du board, contrôle chaque livraison' : a.id === 'avocat-du-diable' ? 'Membre du board, ne sert que là' : 'Membre du board'],
      ['Modèle', 'celui de la session'],
      ['Outils', f.meta.tools],
      ['Skills', 'aucune préchargée'],
    ],
    avec: [...ids.filter((b) => b !== a.id), 'board', ...(a.id === 'cto' ? ROUTINES.map((r) => r.id) : []), ...(a.id === 'hocs' ? ['livraison'] : [])],
    fichier: `.claude/agents/${a.id}.md`,
    html: rendre(f.corps),
  };
}
// Journal des passages (`.claude/board/journal.json`, une ligne ajoutée après chaque convocation d'un agent).
let journal = [];
try { journal = JSON.parse(readFileSync(join(root, 'board/journal.json'), 'utf8')); } catch { journal = []; }
for (const a of AGENTS) data[a.id].passages = journal.filter((j) => j.agent === a.id).slice(-8).reverse();
const skill = lire('skills/board/SKILL.md');
data.board = {
  type: 'Skill', nom: 'Board', resume: skill.meta.description,
  rows: [['Place', 'Commande /board'], ['Se lance', 'Quand tu écris /board, « réunis le board » ou « fous tous les agents dessus »']],
  avec: ids, fichier: '.claude/skills/board/SKILL.md', html: rendre(skill.corps),
};
data.moi = {
  type: 'Toi', nom: MOI,
  resume: 'Tu poses la question et tu décides. Pour une grosse décision, écris /board suivi de ta question : les six agents répondent chacun de leur côté à la même fiche, lisent les avis des autres, débattent, puis Claude te rend une direction. Aucun travail ne démarre sans ton oui.',
  rows: [['Place', 'Au centre : tout part de toi et te revient']],
  avec: [...ids, 'board'], fichier: '', html: '',
};
data.livraison = {
  type: 'Contrôle', nom: 'Livraison',
  resume: 'Avant chaque « c\'est fait », le HOCS ouvre le vrai résultat (le fichier, les tests, le passage du robot, la page en ligne), le compare à ta demande mot à mot et rend GO ou NO-GO. NO-GO : Claude corrige, puis le reconvoque.',
  rows: [['Place', 'Barrière avant chaque réponse « c\'est fait »']],
  avec: ['hocs'], fichier: 'CLAUDE.md (section Règles)', html: '',
};
for (const r of ROUTINES) {
  data[r.id] = {
    type: 'Routine', nom: r.nom, resume: r.resume,
    rows: [['Place', 'Robot du site, toutes les 15 minutes'], ['Se lance', 'Toute seule, sans toi']],
    avec: ['cto'], fichier: r.fichier, html: '',
  };
}

// ----- Le dessin -----
const cx = 450, cy = 400, RA = 168;
const pol = (deg, r, ox = cx, oy = cy) => [Math.round(ox + r * Math.cos(deg * Math.PI / 180)), Math.round(oy + r * Math.sin(deg * Math.PI / 180))];
const pos = { moi: [cx, cy] };
for (const a of AGENTS) pos[a.id] = pol(a.deg, RA);
pos.board = pol(-127, 250);
pos.livraison = pol(104, 300);
const fan = {};
ROUTINES.forEach((r, n) => { fan[r.id] = 35 + n * 12; pos[r.id] = pol(fan[r.id], 165, ...pos.cto); });

const edge = (a, b, cls) => `<line class="e ${cls}" data-a="${a}" data-b="${b}" x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}"/>`;
let svg = '';
for (const a of AGENTS) svg += edge('board', a.id, 'dash');
for (const r of ROUTINES) svg += edge('cto', r.id, 'thin');
svg += edge('hocs', 'livraison', 'dash');
for (const a of AGENTS) svg += edge('moi', a.id, 'ray');

const g = (id, nom, inner) => `<g class="n" data-id="${id}" tabindex="0" role="button" aria-label="${esc(nom)}">${inner}</g>`;
const sous = (x, y, nom) => {
  const mots = nom.split(' ');
  const lignes = mots.length > 1 && nom.length > 11 ? [mots.slice(0, Math.ceil(mots.length / 2)).join(' '), mots.slice(Math.ceil(mots.length / 2)).join(' ')] : [nom];
  return `<text class="lab" x="${x}" y="${y + 30}">` + lignes.map((t) => `<tspan x="${x}" dy="1.15em">${esc(t)}</tspan>`).join('') + '</text>';
};
for (const r of ROUTINES) {
  const [x, y] = pos[r.id];
  const [tx, ty] = pol(fan[r.id], 26, x, y);
  svg += g(r.id, r.nom, `<circle class="hit" cx="${x}" cy="${y}" r="17"/><circle class="c small" cx="${x}" cy="${y}" r="15"/><text class="let small" x="${x}" y="${y + 4.5}">R</text><text class="rot" x="${tx}" y="${ty + 4}" transform="rotate(${fan[r.id]} ${tx} ${ty})">${esc(r.nom)}</text>`);
}
{
  const [x, y] = pos.livraison;
  svg += g('livraison', 'Livraison', `<circle class="c small" cx="${x}" cy="${y}" r="15"/><path class="tick" d="M${x - 6} ${y}l4 4 8-9"/><text class="lab light" x="${x}" y="${y + 36}">Livraison</text>`);
}
{
  const [x, y] = pos.board;
  svg += g('board', 'Board', `<circle class="c ghost" cx="${x}" cy="${y}" r="34"/><text class="gh" x="${x}" y="${y + 5}">Board</text>`);
}
for (const a of AGENTS) {
  const [x, y] = pos[a.id];
  svg += g(a.id, a.nom, `<circle class="c" cx="${x}" cy="${y}" r="25"/><text class="let" x="${x}" y="${y + 6}">A</text>${sous(x, y, a.nom)}`);
}
svg += g('moi', MOI, `<circle class="c hub" cx="${cx}" cy="${cy}" r="62"/><text class="hubt" x="${cx}" y="${cy + 8}">${esc(MOI.toUpperCase())}</text>`);

const page = `<title>Board de Vytoxx</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap">
<style>
/* Mise en page : la carte à gauche (on la déplace et on zoome), la fiche de l'élément choisi à droite ; l'une sous l'autre sur téléphone. */
:root {
  --bg: #f3f0ea; --card: #faf8f4; --ink: #1c1a1a; --soft: #6f6a66; --line: #bdb7b0; --faint: #dcd6ce; --red: #8f1f24; --on-red: #fbf6f0;
  --f: "Montserrat", "Avenir Next", "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #171516; --card: #201d1e; --ink: #f1ece5; --soft: #a8a09a; --line: #5a5352; --faint: #3a3534; --red: #d2545b; --on-red: #1a1011; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #171516; --card: #201d1e; --ink: #f1ece5; --soft: #a8a09a; --line: #5a5352; --faint: #3a3534; --red: #d2545b; --on-red: #1a1011; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--f); font-size: 14.5px; line-height: 1.55; }
.wrap { max-width: 1240px; margin: 0 auto; padding-block: 16px 36px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.cols { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.map { min-width: 0; position: relative; display: flex; flex-direction: column; gap: 8px; }
.stage { position: relative; height: min(76vh, 720px); min-height: 380px; }
@media (max-width: 860px) { .cols { grid-template-columns: minmax(0, 1fr); } .stage { height: auto; min-height: 0; aspect-ratio: 748 / 760; } }
svg { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
svg.drag { cursor: grabbing; }
svg text { font-family: var(--f); text-anchor: middle; fill: var(--ink); pointer-events: none; }
.e { stroke: var(--line); stroke-width: 1.2; }
.e.thin { stroke-width: 1; }
.e.dash { stroke-dasharray: 5 6; }
.e.ray { stroke-width: 1.4; }
.e.on { stroke: var(--red); stroke-width: 2.2; }
.n { cursor: pointer; outline: none; }
.c { fill: var(--bg); stroke: var(--red); stroke-width: 2; }
.c.small { stroke: var(--line); stroke-width: 1.5; }
.c.ghost { stroke: var(--line); stroke-width: 1.5; }
.c.hub { fill: var(--red); stroke: var(--red); }
.let { font-weight: 700; font-size: 17px; }
.let.small { font-weight: 600; font-size: 12px; fill: var(--soft); }
.lab { font-weight: 700; font-size: 14.5px; }
.lab.light { font-weight: 500; font-size: 12.5px; fill: var(--soft); }
.rot { font-size: 13px; font-weight: 500; fill: var(--soft); text-anchor: start; }
svg .n text { pointer-events: auto; }
.hit { fill: transparent; stroke: none; }
.gh { font-weight: 700; font-size: 13.5px; fill: var(--soft); }
.hubt { font-weight: 800; font-size: 22px; fill: var(--on-red); letter-spacing: .02em; }
.tick { fill: none; stroke: var(--soft); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.n:hover .c, .n:focus-visible .c { stroke: var(--red); stroke-width: 3; }
.n.sel .c { fill: var(--red); stroke: var(--red); }
.n.sel .let, .n.sel .gh { fill: var(--on-red); }
.n.sel .tick { stroke: var(--on-red); }
.n.sel .rot, .n.sel .lab.light { fill: var(--ink); font-weight: 700; }
.n.sel .c.hub { stroke: var(--ink); stroke-width: 3; }
.tools { position: absolute; top: 0; right: 0; display: flex; gap: 6px; }
.tools button { font: inherit; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--card); border: 1px solid var(--faint); border-radius: 4px; min-width: 34px; height: 32px; padding: 0 10px; cursor: pointer; }
.tools button:hover, .tools button:focus-visible { border-color: var(--red); outline: none; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 18px; color: var(--soft); font-size: 12.5px; margin: 0; padding: 0; list-style: none; }
.legend li { display: flex; align-items: center; gap: 7px; }
.legend b { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 1.5px solid var(--line); border-radius: 50%; font-size: 10px; font-weight: 700; color: var(--ink); }
.legend b.a { border-color: var(--red); }
.legend i { display: inline-block; width: 24px; height: 0; border-top: 1.5px solid var(--line); font-style: normal; }
.legend .d i { border-top-style: dashed; }
.panel { min-width: 0; background: var(--card); border: 1px solid var(--faint); border-top: 3px solid var(--red); padding: 20px 22px 24px; display: flex; flex-direction: column; gap: 14px; }
.eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--soft); margin: 0; }
h1 { font-weight: 800; font-size: 25px; line-height: 1.1; margin: -8px 0 0; text-transform: uppercase; letter-spacing: .01em; overflow-wrap: anywhere; }
.resume { margin: 0; }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 22px; margin: 0; }
dt { color: var(--soft); }
dd { margin: 0; overflow-wrap: anywhere; }
.links { border-left: 2px dotted var(--red); padding-left: 10px; display: flex; flex-wrap: wrap; gap: 2px 6px; }
.links button { font: inherit; color: var(--red); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; text-align: left; }
.links button:hover, .links button:focus-visible { color: var(--ink); outline: none; }
.sec { font-size: 11.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--red); margin: 6px 0 0; }
.pass { display: grid; grid-template-columns: max-content minmax(0, 1fr) max-content; gap: 8px 16px; font-size: 13.5px; }
.pass .pd, .pass .pm, .none { color: var(--soft); }
.pass .pm { font-variant-numeric: tabular-nums; text-align: right; }
.none { margin: 0; }
.file { display: flex; flex-direction: column; gap: 9px; }
.file h4 { font-size: 15.5px; font-weight: 700; margin: 8px 0 0; }
.file p, .file ul, .file ol { margin: 0; }
.file ul, .file ol { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.file pre { margin: 0; font-family: var(--f); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); border: 1px solid var(--faint); padding: 10px 12px; }
.k { font-weight: 600; overflow-wrap: anywhere; }
.tw { overflow-x: auto; }
table { border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 5px 12px 5px 0; border-bottom: 1px solid var(--faint); vertical-align: top; }
th { color: var(--soft); font-weight: 600; }
/* Téléphone : textes de la carte plus gros (au moins 11 px réels à 390 px de large). À garder en dernier. */
@media (max-width: 860px) { svg .lab { font-size: 24px; } svg .lab.light { font-size: 23px; } svg .rot { font-size: 23px; } svg .gh { font-size: 20px; } svg .let { font-size: 21px; } svg .let.small { font-size: 18px; } svg .hubt { font-size: 26px; } }
</style>
<div class="wrap">
  <div class="cols">
    <div class="map">
      <div class="stage">
        <svg id="g" role="group" aria-label="Carte des agents de ${esc(MOI)}">${svg}</svg>
        <div class="tools"><button type="button" id="zin" aria-label="Zoomer">+</button><button type="button" id="zout" aria-label="Dézoomer">−</button><button type="button" id="zre">Recentrer</button></div>
      </div>
      <ul class="legend">
        <li><b class="a">A</b>agent</li><li><b>R</b>routine du robot</li>
        <li><i></i>il travaille pour</li><li class="d"><i></i>il est convoqué par</li>
      </ul>
    </div>
    <section class="panel" id="panel" aria-live="polite"></section>
  </div>
</div>
<script>
const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const svg = document.getElementById('g'), panel = document.getElementById('panel');
const nodes = [...document.querySelectorAll('.n')], edges = [...document.querySelectorAll('.e')];
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jour = (d) => { const p = String(d).split('-'); return p.length === 3 ? +p[2] + ' ' + MOIS[+p[1] - 1] : e(d); };
function show(id) {
  const d = DATA[id];
  if (!d) return;
  nodes.forEach((n) => { const on = n.dataset.id === id; n.classList.toggle('sel', on); n.setAttribute('aria-pressed', on); });
  edges.forEach((l) => l.classList.toggle('on', l.dataset.a === id || l.dataset.b === id));
  panel.innerHTML = '<p class="eyebrow">' + e(d.type) + '</p><h1>' + e(d.nom) + '</h1><p class="resume">' + e(d.resume) + '</p><dl>'
    + d.rows.map((r) => '<dt>' + e(r[0]) + '</dt><dd>' + e(r[1]) + '</dd>').join('')
    + '<dt>Travaille avec</dt><dd class="links">' + d.avec.map((a, i) => '<button type="button" data-go="' + a + '">' + e(DATA[a].nom) + (i < d.avec.length - 1 ? ',' : '') + '</button>').join('') + '</dd>'
    + (d.fichier ? '<dt>Fichier</dt><dd>' + e(d.fichier) + '</dd>' : '') + '</dl>'
    + (d.passages ? '<p class="sec">Derniers passages</p>' + (d.passages.length ? '<div class="pass">' + d.passages.map((j) => '<span class="pd">' + jour(j.date) + '</span><span>' + e(j.objet) + (j.verdict ? ' · ' + e(j.verdict) : '') + '</span><span class="pm">' + (j.minutes ? e(j.minutes) + ' min' : '') + '</span>').join('') + '</div>' : '<p class="none">Aucun passage enregistré pour le moment.</p>') : '')
    + (d.html ? '<p class="sec">Le fichier, rendu lisible</p><div class="file">' + d.html + '</div>' : '');
}
// Déplacement et zoom de la carte.
const FULL = { x: 208, y: 148, w: 712, h: 722 }, PHONE = { x: 200, y: 148, w: 748, h: 760 };
const petit = window.matchMedia('(max-width: 860px)');
let v;
const apply = () => svg.setAttribute('viewBox', [v.x, v.y, v.w, v.h].join(' '));
const reset = () => { v = { ...(petit.matches ? PHONE : FULL) }; apply(); };
const scale = () => Math.max(v.w / svg.clientWidth, v.h / svg.clientHeight);
function zoom(f, px, py) {
  const w = Math.min(1500, Math.max(220, v.w * f)); f = w / v.w;
  const r = svg.getBoundingClientRect();
  const ux = px == null ? .5 : (px - r.left) / r.width, uy = py == null ? .5 : (py - r.top) / r.height;
  v.x += v.w * (1 - f) * ux; v.y += v.h * (1 - f) * uy; v.w *= f; v.h *= f; apply();
}
const pts = new Map(); let moved = 0, pinch = 0;
svg.addEventListener('pointerdown', (ev) => { pts.set(ev.pointerId, [ev.clientX, ev.clientY]); if (pts.size === 1) moved = 0; });
svg.addEventListener('pointermove', (ev) => {
  const p = pts.get(ev.pointerId); if (!p) return;
  const dx = ev.clientX - p[0], dy = ev.clientY - p[1];
  if (pts.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) { svg.classList.add('drag'); try { svg.setPointerCapture(ev.pointerId); } catch (_) {} const s = scale(); v.x -= dx * s; v.y -= dy * s; apply(); }
  }
  pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pts.size === 2) {
    moved = 99; const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) zoom(pinch / d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d;
  }
});
const up = (ev) => { pts.delete(ev.pointerId); pinch = 0; if (!pts.size) svg.classList.remove('drag'); };
svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
svg.addEventListener('wheel', (ev) => { ev.preventDefault(); zoom(ev.deltaY > 0 ? 1.12 : 1 / 1.12, ev.clientX, ev.clientY); }, { passive: false });
document.getElementById('zin').addEventListener('click', () => zoom(1 / 1.3));
document.getElementById('zout').addEventListener('click', () => zoom(1.3));
document.getElementById('zre').addEventListener('click', reset);
nodes.forEach((n) => {
  n.addEventListener('click', () => { if (moved <= 6) show(n.dataset.id); });
  n.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(n.dataset.id); } });
});
panel.addEventListener('click', (ev) => { const b = ev.target.closest('[data-go]'); if (b) show(b.dataset.go); });
reset(); show('moi');
</script>
`;
writeFileSync(out, page);
console.log('Carte écrite :', out, Math.round(page.length / 1024) + ' Ko');

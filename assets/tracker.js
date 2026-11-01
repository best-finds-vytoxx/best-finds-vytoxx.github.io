// Tracker privé (tracker.html) — script séparé pour que la politique de sécurité interdise tout script en ligne.
(() => {
  // jamais affiché dans le cadre d'un autre site (protection contre le « clickjacking »)
  if (window.top !== window.self) { document.documentElement.innerHTML = ''; try { window.top.location = window.self.location.href; } catch {} return; }
  const $ = (id) => document.getElementById(id);
  let started = false;
  const safe = (fn) => { try { return fn(); } catch { return null; } };
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = () => { const d = new Date(); return iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
  const addDays = (s, k) => iso(new Date(Date.parse(s + 'T00:00:00Z') + k * 864e5));
  const frDay = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // ---------- verrou ----------
  // arrivé ici par erreur : « Retour au site » revient là où on était (ou à l'accueil)
  $('back').addEventListener('click', (e) => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); }
  });
  // seul le compteur privé (Cloudflare) sait vérifier le mot de passe : il renvoie un jeton valable 90 jours sur cet appareil
  const PRIV = ((window.SITE || {}).statsUrl || '').replace(/\/$/, '');
  let token = safe(() => localStorage.getItem('vx-token'));
  const open = () => { $('lock').hidden = true; $('app').hidden = false; start(); };
  $('lock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('lock-form').querySelector('button'); btn.disabled = true; btn.textContent = 'Vérification…';
    const r = PRIV ? await fetch(`${PRIV}/login`, { method: 'POST', body: JSON.stringify({ pw: $('pw').value.trim() }) }).then((x) => x.json()).catch(() => ({ error: 'Serveur injoignable. Réessaie.' }))
      : { error: 'Compteur non configuré.' };
    if (r.ok && typeof r.token === 'string') { token = r.token; safe(() => localStorage.setItem('vx-token', token)); $('pw').value = ''; open(); }
    else { $('lock-err').textContent = r.error || 'Mot de passe incorrect.'; $('pw').select(); }
    btn.disabled = false; btn.textContent = 'Ouvrir le tracker';
  });

  // ---------- données ----------
  let hours = [], hoursRange = '';
  // mesures du graphique « Évolution » : nom clair, couleur
  const M = {
    v: ['Visiteurs', '#1e2a44'], s: ['Visites', '#d9ad54'], n: ['Nouveaux visiteurs', '#6b8fb8'], o: ['Produits regardés', '#c4673a'],
    b: ['Départs vers LoveGoBuy', '#2f8a4c'], po: ['Offre 500 € affichée', '#b98a3a'], p: ['Inscriptions 500 €', '#a27bb0'], sh: ['Partages', '#8a9a5b'], q: ['Questions au chat bot', '#5f6b7a'],
  };
  let evo = ['v', 's'], gran = 'day', rep = 'path';
  try { const e = JSON.parse(localStorage.getItem('vx-evo') || 'null'); if (Array.isArray(e) && e.length) evo = e.filter((k) => M[k]); gran = localStorage.getItem('vx-gran') || 'day'; rep = localStorage.getItem('vx-rep') || 'path'; } catch {}
  const keep = () => { try { localStorage.setItem('vx-evo', JSON.stringify(evo)); localStorage.setItem('vx-gran', gran); localStorage.setItem('vx-rep', rep); } catch {} };
  let dups = new Map();
  let stats = { days: [] }, clicks = { history: [] }, arts = new Map(), loadedAt = null;
  const getJson = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  async function load() {
    const btn = $('refresh'); btn.classList.add('busy'); btn.disabled = true;
    const [r, c, a] = await Promise.all([
      fetch(`${PRIV}/stats?from=${range()[0]}&to=${range()[1]}&t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then((x) => x.json()).catch(() => null),
      getJson(`data/clicks.json?t=${Date.now()}`), getJson(`data/articles.json?t=${Date.now()}`)]);
    if (r && r.error === 'Connexion expirée.') { safe(() => localStorage.removeItem('vx-token')); location.reload(); return; }
    if (r && r.ok) { stats = { since: r.since, days: r.days }; hours = r.hours || []; hoursRange = range().join(' '); }
    if (c) clicks = c;
    if (a) { arts = new Map((a.articles || []).filter((x) => !x.dupOf && !x.hidden).map((x) => [x.id, x])); dups = new Map((a.articles || []).filter((x) => x.dupOf).map((x) => [x.id, x.dupOf])); }
    loadedAt = new Date();
    $('warn').textContent = r && r.ok ? '' : 'Impossible de joindre le compteur pour l’instant. Réessaie dans un moment.';
    $('warn').classList.toggle('on', !(r && r.ok));
    $('updated').textContent = `Actualisé à ${loadedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    btn.classList.remove('busy'); btn.disabled = false;
    render();
  }

  // un tableau de tous les jours (jours sans visite = 0), le jour en cours pris en direct
  function allDays() {
    const by = new Map((stats.days || []).map((d) => [d.date, d]));
    const first = stats.since || [...by.keys()].sort()[0] || today();
    const out = [];
    for (let d = first; d <= today(); d = addDays(d, 1)) out.push({ date: d, ...(by.get(d) || {}) });
    return out;
  }

  // ---------- période ----------
  let period = '7';
  try { period = localStorage.getItem('vx-period') || '7'; } catch {}
  function range() {
    const t = today();
    if (period === 'custom') { const f = $('from').value || addDays(t, -6), to = $('to').value || t; return f <= to ? [f, to] : [to, f]; }
    if (period === 'all') return [stats.since || t, t];
    const n = Number(period) || 7;
    return [addDays(t, -(n - 1)), t];
  }
  document.querySelectorAll('.seg [data-p]').forEach((b) => b.addEventListener('click', () => {
    period = b.dataset.p; try { localStorage.setItem('vx-period', period); } catch {}
    if (period === 'custom' && !$('from').value) { $('to').value = today(); $('from').value = today(); }
    render(); if (range().join(' ') !== hoursRange) load();
  }));
  ['from', 'to'].forEach((id) => $(id).addEventListener('change', () => { render(); if (range().join(' ') !== hoursRange) load(); }));
  $('evo-metrics').innerHTML = Object.entries(M).map(([k, [n, c]]) => `<button type="button" class="chip" data-k="${k}" style="--dot:${c}"><i></i>${n}</button>`).join('');
  $('evo-metrics').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    evo = evo.includes(k) ? (evo.length > 1 ? evo.filter((x) => x !== k) : evo) : [...evo, k];
    keep(); render();
  });
  document.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { gran = b.dataset.g; keep(); render(); }));
  document.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { rep = b.dataset.r; keep(); render(); }));
  $('refresh').addEventListener('click', load);
  $('relock').addEventListener('click', () => { safe(() => localStorage.removeItem('vx-token')); location.reload(); });

  // ---------- graphiques ----------
  const HAS_CHART = typeof window.Chart !== 'undefined'; // si les graphiques ne chargent pas, les chiffres restent visibles
  if (HAS_CHART) {
  Chart.defaults.font.family = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
  Chart.defaults.font.size = 13;
  Chart.defaults.color = '#474e5c';
  }
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const tooltip = { backgroundColor: 'rgba(31,37,51,.92)', padding: 10, cornerRadius: 10, titleFont: { weight: '600' }, bodyFont: { size: 13 }, displayColors: true, boxPadding: 4 };
  const charts = {};
  function chart(id, cfg) { if (!HAS_CHART) return; if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }
  // valeurs écrites au bout des barres (plus besoin de deviner sur l'axe)
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(c, _, opt) {
      if (!opt || !opt.on) return;
      const { ctx } = c; ctx.save(); ctx.font = '600 12.5px "Instrument Sans", Arial'; ctx.fillStyle = '#1f2533';
      c.data.datasets.forEach((ds, i) => {
        if (ds.type === 'line' || c.getDatasetMeta(i).hidden) return;
        c.getDatasetMeta(i).data.forEach((el, j) => {
          const v = ds.data[j]; if (!v) return;
          const txt = opt.fmt ? opt.fmt(v, j, ds) : fmt(v);
          if (c.options.indexAxis === 'y') { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x + 6, el.y); }
          else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - 4); }
        });
      });
      ctx.restore();
    },
  };
  if (HAS_CHART) Chart.register(valueLabels);
  const gridOpts = { color: 'rgba(31,37,51,.07)', drawTicks: false };
  // courbe douce avec un dégradé dessous (au lieu de barres)
  const fade = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const curve = (label, data, color, fill = true, dashed = false) => ({
    type: 'line', label, data, borderColor: color, borderWidth: 3, tension: .38, cubicInterpolationMode: 'monotone',
    pointRadius: data.length > 16 ? 0 : 3.5, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: color, pointBorderWidth: 2,
    borderDash: dashed ? [6, 5] : [], fill: fill ? 'origin' : false,
    backgroundColor: (ctx) => { const a = ctx.chart.chartArea; if (!a) return fade(color, .15); const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, fade(color, .28)); g.addColorStop(1, fade(color, 0)); return g; },
  });
  const lineOpts = (n, extra = {}) => ({
    maintainAspectRatio: false, animation: { duration: 500 }, interaction: { mode: 'index', intersect: false }, layout: { padding: { top: 14 } },
    scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: innerWidth < 520 ? 6 : 12 } },
      y: { beginAtZero: true, grace: '8%', grid: gridOpts, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 5, padding: 8 } } },
    plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16, font: { weight: '600' } } }, tooltip, ...extra },
  });

  function hbar(id, labels, values, colors, fmtFn) {
    chart(id, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 8, barThickness: 22 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false, animation: { duration: 500 },
        layout: { padding: { right: 96 } },
        scales: { x: { display: false, beginAtZero: true, suggestedMax: Math.max(1, ...values) }, y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: innerWidth < 520 ? 12.5 : 13.5, weight: '500' }, color: '#1f2533' } } },
        plugins: { legend: { display: false }, tooltip: { ...tooltip, displayColors: false }, valueLabels: { on: true, fmt: fmtFn } },
      },
    });
  }

  // ---------- affichage ----------
  const sumRows = (rows, k) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  function render() {
    document.querySelectorAll('.seg [data-p]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === period)));
    $('custom').classList.toggle('on', period === 'custom');
    const days = allDays();
    const [from, to] = range();
    const cur = days.filter((d) => d.date >= from && d.date <= to);
    const len = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    const pFrom = addDays(from, -len), pTo = addDays(from, -1);
    const prev = days.filter((d) => d.date >= pFrom && d.date <= pTo);
    const hasPrev = prev.length > 0 && (stats.since || today()) <= pFrom;
    $('range-txt').innerHTML = from === to ? `<b>${frDay(from)}</b>` : `du <b>${frDay(from)}</b> au <b>${frDay(to)}</b>`;

    for (const k of ['v', 's', 'n', 'o', 'b', 'p', 'sh', 'q']) {
      const a = sumRows(cur, k), b = sumRows(prev, k);
      $('k-' + k).textContent = fmt(a);
      const el = $('d-' + k); el.className = 'd';
      if (!hasPrev) { el.textContent = 'comparaison bientôt'; continue; }
      const diff = a - b;
      el.textContent = b ? `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round((diff / b) * 100))} % vs période d'avant` : diff ? `+${fmt(diff)} vs période d'avant` : 'stable';
      el.classList.add(diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');
    }

    // ---------- Évolution : les mesures choisies, par jour ou par heure ----------
    document.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(evo.includes(b.dataset.k))));
    document.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === gran)));
    let labels, series, note;
    if (gran === 'day') {
      labels = cur.map((d) => frDay(d.date));
      series = evo.map((k) => cur.map((d) => Number(d[k]) || 0));
      note = cur.length < 2 ? 'Une seule journée dans la période : passe en « Par heure » pour voir le détail.' : `Chaque jour du ${frDay(from)} au ${frDay(to)}`;
    } else {
      const nowH = new Date().getHours(), isToday = from === to && to === today();
      const n = isToday ? nowH + 1 : 24;
      labels = Array.from({ length: n }, (_, h) => `${h} h`);
      series = evo.map((k) => { const a = Array(24).fill(0); for (const r of hours) if (r.date >= from && r.date <= to) a[r.h] += Number(r[k]) || 0; return a.slice(0, n); });
      const tot = series[0].reduce((t, v) => t + v, 0), pk = series[0].indexOf(Math.max(...series[0]));
      note = (from === to ? `Chaque heure ${isToday ? 'd’aujourd’hui jusqu’à maintenant' : `du ${frDay(from)}`} (heure de Paris).` : 'Chaque heure de la journée, additionnée sur toute la période (heure de Paris).')
        + (tot ? ` ${M[evo[0]][0]} : heure la plus active ${pk} h – ${pk + 1} h.` : ' Pas encore de données heure par heure pour cette période.');
    }
    chart('c-evo', {
      type: 'line',
      data: { labels, datasets: evo.map((k, i) => curve(M[k][0], series[i], M[k][1], evo.length === 1)) },
      options: lineOpts(labels.length, gran === 'hour' ? { tooltip: { ...tooltip, callbacks: { title: (it) => `${it[0].dataIndex} h – ${it[0].dataIndex + 1} h` } } } : {}),
    });
    $('evo-note').textContent = note;

    // ---------- Répartition : parcours, provenance ou appareil ----------
    document.querySelectorAll('[data-r]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === rep)));
    const S2 = (k) => sumRows(cur, k);
    const vis = S2('s');
    if (rep === 'path') {
      const o = S2('o'), bb = S2('b'), po = S2('po'), p = S2('p');
      $('rep-sub').textContent = 'Combien de personnes vont jusqu’au bout, étape par étape, sur la période.';
      $('rates').innerHTML = `<span class="rate">Visites qui finissent sur LoveGoBuy <b>${pct(bb, vis)}</b></span><span class="rate">Produits regardés qui finissent sur LoveGoBuy <b>${pct(bb, o)}</b></span><span class="rate">Offre 500 € vue → inscription <b>${pct(p, po)}</b></span>`;
      hbar('c-rep', ['Visites', 'Produits regardés', 'Départs vers LoveGoBuy', 'Offre 500 € affichée', 'Inscriptions 500 €'], [vis, o, bb, po, p],
        [M.v[1], M.o[1], M.b[1], M.po[1], M.p[1]], (v, j) => (j === 2 ? `${fmt(v)} · ${pct(v, o)}` : j === 4 ? `${fmt(v)} · ${pct(v, po)}` : fmt(v)));
    } else if (rep === 'src') {
      const src = [['Telegram', 'rtg'], ['Instagram', 'rig'], ['Snapchat', 'rsc'], ['TikTok', 'rtt'], ['WhatsApp', 'rwa'], ['Un autre site', 'rweb'], ['Lien direct', 'rdir']]
        .map(([l, k]) => [l, S2(k)]).sort((a, b) => b[1] - a[1]);
      const t = src.reduce((x, y) => x + y[1], 0);
      $('rep-sub').textContent = 'Visites selon l’appli d’où le lien a été ouvert. « Lien direct » : lien collé, favori, ou appli qui ne dit pas d’où on vient (souvent Telegram).';
      $('rates').innerHTML = '';
      hbar('c-rep', src.map((x) => x[0]), src.map((x) => x[1]), src.map((_, i) => (i === 0 ? css('--c3') : css('--c4'))), (v) => `${fmt(v)} · ${pct(v, t)}`);
    } else {
      const mob = S2('mob'), pc = S2('pc'), app = S2('app');
      $('rep-sub').textContent = 'Visites sur téléphone ou sur ordinateur, et visites lancées depuis l’icône Vytoxx Finds ajoutée sur l’écran du téléphone.';
      $('rates').innerHTML = `<span class="rate">Sur téléphone <b>${pct(mob, mob + pc)}</b></span>`;
      hbar('c-rep', ['Téléphone', 'Ordinateur', 'Depuis l’icône sur le téléphone'], [mob, pc, app], [css('--c1'), css('--c4'), css('--c5')], (v, j) => (j < 2 ? `${fmt(v)} · ${pct(v, mob + pc)}` : fmt(v)));
    }

    const hist = [...(clicks.history || [])].sort((a, b) => a.date.localeCompare(b.date));
    // articles les plus cliqués : même source et même calcul que le « Top du moment » du site
    // (fiches ouvertes + clics LoveGoBuy, une fois par personne et par jour ; un doublon compte pour l'article gardé)
    const list = $('top-list'); list.replaceChildren();
    const end = [...hist].reverse().find((h) => h.date <= to);
    const base = [...hist].reverse().find((h) => h.date < from);
    let raw;
    if (period === '30' && clicks.period) raw = clicks.period; // exactement le classement affiché sur le site
    else if (end) raw = Object.fromEntries(Object.entries(end.totals || {}).map(([id, n]) => [id, (Number(n) || 0) - (Number(base?.totals?.[id]) || 0)]));
    if (!raw) { list.innerHTML = '<div class="empty">Pas encore de clics relevés pour cette période.</div>'; return; }
    const merged = new Map();
    for (const [k, n] of Object.entries(raw)) { const id = dups.get(Number(k)) || Number(k); if (n > 0) merged.set(id, (merged.get(id) || 0) + Number(n)); }
    const counts = [...merged.entries()].filter(([id]) => arts.has(id)).sort((x, y) => y[1] - x[1]).slice(0, 15);
    $('note-top').textContent = period === '30' ? 'Exactement le classement « Top du moment » du site (30 derniers jours) : produits regardés + départs vers LoveGoBuy.'
      : base ? 'Même calcul que le « Top du moment » du site, sur la période choisie.' : 'Même calcul que le « Top du moment » du site, depuis le début du relevé (28 octobre).';
    if (!counts.length) { list.innerHTML = '<div class="empty">Aucun clic sur un article pendant cette période.</div>'; return; }
    const max = counts[0][1];
    counts.forEach(([id, n], i) => {
      const a = arts.get(id);
      const row = document.createElement('a'); row.className = 'art'; row.href = `./#article-${id}`; row.target = '_blank'; row.rel = 'noopener';
      const r = document.createElement('span'); r.className = 'r'; r.textContent = i + 1;
      const img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; img.src = a.coverSm || a.cover || (a.photos || [])[0] || '';
      const t = document.createElement('span'); t.className = 't';
      const b = document.createElement('b'); b.textContent = a.title;
      const sm = document.createElement('small'); sm.textContent = [a.brand, a.category].filter(Boolean).join(' · ');
      const bar = document.createElement('div'); bar.className = 'bar-in'; bar.style.width = `${Math.max(6, (n / max) * 100)}%`;
      t.append(b, sm, bar);
      const v = document.createElement('span'); v.className = 'n'; v.textContent = fmt(n);
      const vs = document.createElement('small'); vs.textContent = n > 1 ? 'clics' : 'clic'; v.appendChild(vs);
      row.append(r, img, t, v); list.appendChild(row);
    });
  }

  function start() { if (started) return; started = true; load(); }
  // déjà déverrouillé sur cet appareil : on ouvre directement
  if (PRIV && token) open(); else setTimeout(() => $('pw').focus(), 100);
  try { localStorage.removeItem('vx-tracker'); indexedDB.deleteDatabase('vx-tracker'); } catch {}
})();

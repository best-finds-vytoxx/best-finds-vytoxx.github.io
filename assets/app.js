(() => {
  const S = window.SITE || {};
  const app = document.getElementById('app');
  const state = { articles: [], updatedAt: null, q: '', cat: 'Tous', brand: '', sort: 'recent' };

  // ---------- utilitaires ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g2t = (g) => (g >= 1000 ? (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' kg' : g + ' g');
  const weightText = (w) => (!w ? null : w.max ? `${g2t(w.min)} – ${g2t(w.max)}` : g2t(w.min));
  const views = (v) => { if (!v) return 0; const m = String(v).match(/([\d.,]+)\s*([KM])?/i); if (!m) return 0; const n = parseFloat(m[1].replace(',', '.')); return Math.round(n * ({ K: 1e3, M: 1e6 }[(m[2] || '').toUpperCase()] || 1)); };
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const isNew = (a) => Date.now() - new Date(a.date).getTime() < (S.newForHours || 48) * 3600e3;
  const ago = (iso) => {
    if (!iso) return '';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  };
  // Indication volontairement vague de la dernière mise à jour
  const vagueUpdate = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
    if (days < 1) return 'Mise à jour effectuée aujourd\'hui';
    if (days < 2) return 'Mise à jour effectuée hier';
    if (days < 7) return 'Mise à jour effectuée cette semaine';
    if (days < 14) return 'Mise à jour effectuée la semaine dernière';
    if (days < 31) return 'Mise à jour effectuée ce mois-ci';
    return 'Mise à jour effectuée il y a quelque temps';
  };
  const dateFr = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = {
    get: (k) => safe(() => localStorage.getItem(k)),
    set: (k, v) => safe(() => localStorage.setItem(k, v)),
    sget: (k) => safe(() => sessionStorage.getItem(k)),
    sset: (k, v) => safe(() => sessionStorage.setItem(k, v)),
  };
  const icon = {
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    left: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
    out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    play: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    sound: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    mute: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    link: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
    gift: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg>',
    tg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.3 18.4 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.6 13 2 11.6c-1-.3-1-1 .2-1.5L20.2 3c.8-.3 1.6.2 1.3 1.3Z"/></svg>',
  };
  const coupon = esc(S.coupon || '500 €');
  const IMG = { logo: 'assets/img/logo.webp', banner: 'assets/img/banner.webp', bannerMid: 'assets/img/banner-1200.webp', bannerMobile: 'assets/img/banner-mobile.webp', favicon: 'assets/img/favicon.png', video: 'assets/video/tuto.mp4', poster: 'assets/video/tuto-poster.webp' };
  const logo = (cls = 'logo') => `<img class="${cls}" src="${IMG.logo}" alt="" width="64" height="64">`;
  safe(() => {
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.type = 'image/png';
    l.href = IMG.favicon;
  });

  // ---------- papier crème / blanc ----------
  document.documentElement.dataset.paper = store.get('paper') || 'cream';

  // ---------- squelette ----------
  app.innerHTML = `
    <header class="top"><div class="wrap top-in">
      <nav class="nav-links" aria-label="Navigation">
        <a href="#tuto" id="nav-tuto">${icon.play} Tuto pour commander</a>
      </nav>
      <a class="brand" href="#" aria-label="Retour à l'accueil">${logo()}<span class="brand-label">Accueil</span></a>
      <div class="top-right">
        <button class="gift" type="button" id="open-promo">${icon.gift}<span>${coupon} offerts</span></button>
        <div class="paper" role="group" aria-label="Couleur du fond">
          <button type="button" data-p="cream" title="Fond crème" aria-label="Fond crème"></button>
          <button type="button" data-p="white" title="Fond blanc" aria-label="Fond blanc"></button>
        </div>
        <a class="tg" href="${esc(S.telegram)}" target="_blank" rel="noopener" aria-label="Canal Telegram">${icon.tg} <span class="tg-label">Canal Telegram ${esc(S.by || '')}</span></a>
      </div>
    </div></header>
    <main id="view"></main>
    <div class="bar" id="bar"></div>
    <footer><div class="wrap"><p class="foot-upd" id="foot-upd"></p></div></footer>
    <div class="promo" id="promo" hidden>
      <div class="promo-back" data-close></div>
      <div class="promo-card" role="dialog" aria-modal="true" aria-labelledby="promo-title">
        <button class="promo-x" type="button" data-close aria-label="Fermer">${icon.close}</button>
        <span class="promo-eyebrow">Offre de bienvenue LoveGoBuy</span>
        <h2 id="promo-title"><span class="promo-amount">${coupon}</span> de coupons offerts</h2>
        <p>Inscris-toi avec ce lien et récupère <strong>${coupon} de coupons</strong> à utiliser sur tes <strong>frais de livraison</strong>.</p>
        <ol class="promo-steps">
          <li>Crée ton compte LoveGoBuy avec le bouton ci-dessous</li>
          <li>Les coupons sont ajoutés à ton compte</li>
          <li>Ils se déduisent au moment de payer la livraison</li>
        </ol>
        <a class="promo-cta" id="promo-cta" href="${esc(S.invite)}" target="_blank" rel="noopener">Récupérer mes ${coupon} ${icon.out}</a>
        <button class="promo-later" type="button" data-close>Plus tard</button>
      </div>
    </div>`;
  const view = document.getElementById('view');
  const bar = document.getElementById('bar');

  const syncPaper = () => app.querySelectorAll('.paper button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === document.documentElement.dataset.paper)));
  app.querySelector('.paper').addEventListener('click', (e) => {
    const p = e.target.closest('button')?.dataset.p;
    if (!p) return;
    document.documentElement.dataset.paper = p;
    store.set('paper', p);
    syncPaper();
  });
  syncPaper();

  // ---------- pop-up coupon ----------
  const promo = document.getElementById('promo');
  let lastFocus = null;
  const openPromo = (auto) => {
    lastFocus = document.activeElement;
    // à l'ouverture automatique (arrivée sur le site), « Plus tard » apparaît après 0,5 s, en fondu sur 2 s
    promo.classList.toggle('intro', auto === true);
    promo.hidden = false;
    document.body.classList.add('locked');
    requestAnimationFrame(() => promo.classList.add('on'));
    document.getElementById('promo-cta').focus({ preventScroll: true });
  };
  const closePromo = () => {
    promo.classList.remove('on');
    document.body.classList.remove('locked');
    store.sset('promo-seen', '1');
    setTimeout(() => { promo.hidden = true; }, 200);
    lastFocus?.focus?.({ preventScroll: true });
  };
  promo.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closePromo(); });
  document.getElementById('promo-cta').addEventListener('click', () => {
    store.set('promo-clicked', String(Date.now()));
    closePromo();
  });
  document.getElementById('open-promo').addEventListener('click', () => openPromo());
  document.addEventListener('keydown', (e) => {
    if (promo.hidden) return;
    if (e.key === 'Escape') closePromo();
    if (e.key === 'Tab') { // garder le focus dans la fenêtre
      const f = [...promo.querySelectorAll('a, button')];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  // À l'arrivée sur le site : une fois par visite, sauf si le lien a déjà été ouvert dans les 7 derniers jours
  const clicked = Number(store.get('promo-clicked') || 0);
  if (!store.sget('promo-seen') && Date.now() - clicked > 7 * 864e5) setTimeout(() => openPromo(true), 700);

  // ---------- classement interne : clics sur les produits du site ----------
  // Ouvrir la fiche d'un article et cliquer vers LoveGoBuy incrémentent le compteur de cet article.
  // Le robot GitHub relève les compteurs toutes les 15 minutes et publie data/clicks.json
  // (clics des 30 derniers jours), que le site lit pour établir le classement. Les vues du canal ne comptent pas.
  const C = S.clicks || {};
  const NS = C.namespace || 'bestfinds-vytoxx';
  const top = { ids: [], counts: {} };
  function trackClick(id, kind = 'open') {
    if (!id) return;
    // une ouverture et un clic LoveGoBuy comptés au plus une fois par article, par visiteur et par jour
    const key = `clk-${kind}-${id}-${new Date().toISOString().slice(0, 10)}`;
    if (store.get(key)) return;
    store.set(key, '1');
    safe(() => fetch(`https://abacus.jasoncameron.dev/hit/${NS}/a${id}`, { keepalive: true, mode: 'cors' }).catch(() => {}));
  }
  async function loadTop() {
    let data = window.__CLICKS || null;
    if (!data) data = await fetch('data/clicks.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const counts = (data && data.period) || {};
    top.counts = Object.fromEntries(Object.entries(counts).map(([k, v]) => [Number(k), Number(v)]));
    // Uniquement les articles qui ont reçu des clics, du plus cliqué au moins cliqué (à égalité : le plus récent)
    top.ids = state.articles
      .filter((a) => (top.counts[a.id] || 0) > 0)
      .sort((x, y) => top.counts[y.id] - top.counts[x.id] || y.id - x.id)
      .map((a) => a.id);
  }
  // Tout lien vers LoveGoBuy compte comme un clic pour l'article concerné
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-buy]');
    if (a) trackClick(Number(a.dataset.buy), 'buy');
  });

  // Photo d'origine la plus pertinente (choisie par le robot), utilisée quand il n'y a pas de photo détourée
  const bestPhoto = (a) => (a.photos || [])[(a.front || 1) - 1] || (a.photos || [])[0];

  // ---------- carte ----------
  const card = (a) => {
    const best = bestPhoto(a);
    const main = a.cover || best;
    const real = a.cover ? best : (a.photos || []).find((p) => p !== best);
    const w = weightText(a.weight);
    return `<a class="card" href="#article-${a.id}">
      <div class="ph ${a.cover ? 'is-cut' : ''}">
        ${isNew(a) ? '<span class="badge">Nouveau</span>' : ''}
        ${main ? `<img class="main" src="${esc(main)}" alt="${esc(a.title)}" loading="lazy" decoding="async">` : ''}
        ${real ? `<img class="real" src="${esc(real)}" alt="" loading="lazy" decoding="async">` : ''}
      </div>
      <div class="card-b">
        <span class="br">${esc(a.brand || a.category)}</span>
        <h3>${esc(a.title)}</h3>
        <div class="row"><span class="cat">${esc(a.category)}</span>${w ? `<span class="wt">${esc(w)}</span>` : ''}</div>
      </div>
    </a>`;
  };

  // ---------- catalogue ----------
  function filtered() {
    const q = fold(state.q).split(/\s+/).filter(Boolean);
    const list = state.articles.filter((a) => {
      if (state.cat !== 'Tous' && a.category !== state.cat) return false;
      if (state.brand && a.brand !== state.brand) return false;
      if (!q.length) return true;
      const hay = fold(`${a.title} ${a.brand} ${a.category}`);
      return q.every((w) => hay.includes(w));
    });
    const rank = new Map(top.ids.map((id, k) => [id, k]));
    const sorts = {
      recent: (x, y) => y.id - x.id,
      top: (x, y) => (top.counts[y.id] || 0) - (top.counts[x.id] || 0) || y.id - x.id,
      light: (x, y) => (x.weight?.min ?? 1e9) - (y.weight?.min ?? 1e9),
    };
    return list.sort(sorts[state.sort] || sorts.recent);
  }

  const PAGE = 48;
  // ---------- page d'accueil ----------
  const thumb = (a) => a.cover || bestPhoto(a) || '';
  // Tuiles larges pour que la grille des catégories tombe juste (4 colonnes sur ordinateur, 2 sur téléphone)
  const tileSpan = (k, n) => {
    const r = n % 4, cls = [];
    if ((r === 3 && k === 0) || (r === 2 && k >= n - 2)) cls.push('w4');
    if (r === 1 && k === n - 1) cls.push('w4', 'full4');
    if (n % 2 === 1 && k === 0) cls.push('w2');
    return cls.join(' ');
  };
  function renderWelcome() {
    resetChrome();
    document.title = S.name || 'Finds';
    const arts = [...state.articles].sort((x, y) => y.id - x.id);
    const latest = arts.slice(0, 4);
    const cats = {};
    arts.forEach((a) => { if (!cats[a.category]) cats[a.category] = { n: 0, pics: [] }; cats[a.category].n++; if (a.cover && cats[a.category].pics.length < 3) cats[a.category].pics.push(a.cover); });
    const ORDER = ['Hauts', 'Bas', 'Accessoires', 'Ensembles'];
    const catList = ORDER.filter((c) => cats[c]).map((c) => [c, cats[c]]);
    const byId = new Map(arts.map((a) => [a.id, a]));
    const ranking = top.ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);

    view.innerHTML = `
      <h1 class="sr-only">${esc(S.name || 'Finds')} — ${esc(S.tagline || '')}</h1>
      <section class="banner-wrap">
        <picture class="banner">
          <source media="(max-width: 640px)" srcset="${IMG.bannerMobile}">
          <source media="(max-width: 1100px)" srcset="${IMG.bannerMid}">
          <img src="${IMG.banner}" alt="${esc(S.name || '')} — le panda Vytoxx devant ses colis LoveGoBuy" fetchpriority="high">
        </picture>
      </section>
      <div class="wrap hero-cta">
        <a class="buy" href="#catalogue">Voir tous les articles ${icon.right}</a>
        <button class="sub" type="button" id="hero-promo">${icon.gift} ${coupon} de coupons offerts</button>
        <a class="sub" href="#tuto">${icon.play} Tuto pour commander</a>
      </div>

      ${catList.length ? `<section class="wrap block">
        <div class="block-head"><h2>Catégories</h2></div>
        <div class="cats">${catList.map(([c, v], k) => `<button type="button" class="cat-tile ${tileSpan(k, catList.length)}" data-c="${esc(c)}">
          <span class="cat-pic">${v.pics.map((src, k) => `<img class="p${k}" src="${esc(src)}" alt="" loading="lazy">`).join('')}</span>
          <span class="cat-foot"><span class="cat-name">${esc(c)}</span><span class="cat-go">${icon.right}</span></span>
        </button>`).join('')}</div>
      </section>` : ''}

      <section class="wrap block duo">
        <aside class="panel top-col">
          <div class="block-head"><h2>Top du moment</h2></div>
          <div class="top-panel">
          <p class="top-note">Les articles les plus cliqués sur le site ces ${C.days || 30} derniers jours.</p>
          ${ranking.length ? `<ol class="top-list">${ranking.map((a, k) => `<li><a href="#article-${a.id}">
            <span class="rank">${k + 1}</span>
            <span class="top-pic"><img src="${esc(thumb(a))}" alt="" loading="lazy"></span>
            <span class="top-b"><span class="top-title">${esc(a.title)}</span><span class="top-meta">${top.counts[a.id].toLocaleString('fr-FR')} clic${top.counts[a.id] > 1 ? 's' : ''}</span></span>
          </a></li>`).join('')}</ol>
          <a class="more-link solo" href="#catalogue" id="see-top">Voir le classement complet ${icon.right}</a>` : `<div class="top-empty">
            <span class="top-empty-n">1</span>
            <p>Le classement se remplit avec les clics sur les articles du site. Il est mis à jour toutes les 15 minutes : les premiers articles cliqués apparaîtront ici.</p>
          </div>`}
          </div>
        </aside>
        <div class="panel">
          <div class="block-head"><h2>Dernières arrivées</h2><a class="more-link" href="#catalogue">Tout voir ${icon.right}</a></div>
          ${latest.length ? `<div class="arrivals">${latest.map((a) => `<a class="arrival" href="#article-${a.id}">
            <span class="arr-pic"><img src="${esc(thumb(a))}" alt="" loading="lazy"></span>
            <span class="arr-b">
              <span class="arr-when">${isNew(a) ? '<i>Nouveau</i>' : ''}${esc(ago(a.date))}</span>
              <span class="arr-title">${esc(a.title)}</span>
              <span class="arr-meta">${esc([a.brand, a.category].filter(Boolean).join(' · '))}</span>
            </span>
          </a>`).join('')}</div>` : '<p class="muted">Les articles arrivent à la prochaine lecture du canal.</p>'}
        </div>
      </section>`;

    view.querySelector('#hero-promo').addEventListener('click', () => openPromo());
    view.querySelector('#see-top')?.addEventListener('click', () => { state.sort = 'top'; state.cat = 'Tous'; state.q = ''; state.brand = ''; catScroll = 0; });
    view.querySelectorAll('.cat-tile').forEach((b) => b.addEventListener('click', () => {
      state.cat = b.dataset.c; state.q = ''; state.brand = ''; catScroll = 0;
      location.hash = 'catalogue';
    }));
  }

  // ---------- tuto pour commander ----------
  const CHAPTERS = [
    [0, 'Introduction'],
    [2, 'Créer ton compte avec le lien'],
    [5, 'Récupérer les coupons'],
    [8, 'Choisir un lien sur le canal'],
    [11, 'Coller le lien dans LoveGoBuy'],
    [14, 'Ajouter ton adresse'],
    [20, 'Faire expédier depuis l\'entrepôt'],
    [38, 'Payer moins cher la livraison'],
    [41, 'Quand le colis est prêt'],
    [44, 'Choisir le mode de paiement'],
  ];
  function renderTuto() {
    resetChrome();
    document.title = `Tuto pour commander · ${S.name || 'Finds'}`;
    const t = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    view.innerHTML = `
      <section class="wrap tuto">
        <header class="tuto-head">
          <span class="eyebrow">Tuto vidéo · 48 secondes</span>
          <h1>Commander sur LoveGoBuy, de A à Z</h1>
          <p class="lead">De l'inscription au paiement de la livraison. Touche une étape pour y aller directement.</p>
        </header>
        <div class="tuto-grid">
          <div class="steps-box">
            <div class="steps-title">Les étapes</div>
            <ol class="chapters" id="chapters">${CHAPTERS.map(([sec, label], k) => `<li><button type="button" data-t="${sec}" aria-current="${k === 0}"><span class="ch-n">${k + 1}</span><span class="ch-l">${esc(label)}</span><span class="ch-t">${t(sec)}</span></button></li>`).join('')}</ol>
          </div>
          <div class="player" id="player">
            <video id="tuto-video" src="${IMG.video}" poster="${IMG.poster}" playsinline webkit-playsinline disablepictureinpicture controlslist="nofullscreen nodownload noremoteplayback" preload="metadata"></video>
            <button class="pl-big" type="button" id="pl-big" aria-label="Lire la vidéo">${icon.play}</button>
            <div class="pl-bar">
              <button type="button" class="pl-btn" id="pl-play" aria-label="Lire">${icon.play}</button>
              <input type="range" id="pl-seek" min="0" max="48" step="0.1" value="0" aria-label="Position dans la vidéo">
              <span class="pl-time" id="pl-time">0:00</span>
              <button type="button" class="pl-btn" id="pl-mute" aria-label="Couper le son">${icon.sound}</button>
            </div>
          </div>
        </div>
        <div class="tuto-cta">
          <a class="buy" href="${esc(S.invite)}" target="_blank" rel="noopener">${icon.gift} Créer mon compte · ${coupon} offerts</a>
          <a class="sub" href="#catalogue">Voir les articles ${icon.right}</a>
        </div>
      </section>`;

    // Lecteur sans plein écran : la vidéo se regarde uniquement dans son cadre, sur ordinateur comme sur iPhone
    const v = view.querySelector('#tuto-video');
    const player = view.querySelector('#player');
    const seek = view.querySelector('#pl-seek');
    const time = view.querySelector('#pl-time');
    const playBtn = view.querySelector('#pl-play');
    const muteBtn = view.querySelector('#pl-mute');
    const items = [...view.querySelectorAll('#chapters button')];
    const toggle = () => (v.paused ? v.play().catch(() => {}) : v.pause());
    const sync = () => {
      player.classList.toggle('playing', !v.paused);
      playBtn.innerHTML = v.paused ? icon.play : icon.pause;
      playBtn.setAttribute('aria-label', v.paused ? 'Lire' : 'Mettre en pause');
    };
    v.addEventListener('click', toggle);
    view.querySelector('#pl-big').addEventListener('click', toggle);
    playBtn.addEventListener('click', toggle);
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    v.addEventListener('ended', sync);
    v.addEventListener('loadedmetadata', () => { seek.max = String(v.duration || 48); });
    v.addEventListener('dblclick', (e) => e.preventDefault());
    v.addEventListener('webkitbeginfullscreen', () => safe(() => v.webkitExitFullscreen()));
    document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement === v) safe(() => document.exitFullscreen()); });
    seek.addEventListener('input', () => { v.currentTime = Number(seek.value); });
    muteBtn.addEventListener('click', () => {
      v.muted = !v.muted;
      muteBtn.innerHTML = v.muted ? icon.mute : icon.sound;
      muteBtn.setAttribute('aria-label', v.muted ? 'Remettre le son' : 'Couper le son');
    });
    v.addEventListener('timeupdate', () => {
      seek.value = String(v.currentTime);
      seek.style.setProperty('--p', `${(v.currentTime / (v.duration || 48)) * 100}%`);
      time.textContent = t(v.currentTime);
      let cur = 0;
      CHAPTERS.forEach(([sec], k) => { if (v.currentTime >= sec) cur = k; });
      items.forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
    });
    items.forEach((b) => b.addEventListener('click', () => { v.currentTime = Number(b.dataset.t); v.play().catch(() => {}); }));
  }

  const resetChrome = () => {
    buyObserver?.disconnect();
    bar.classList.remove('on', 'away');
    document.body.classList.remove('has-bar');
  };
  const countLine = (n, total) => `<span class="num">${n.toLocaleString('fr-FR')}</span> <span class="unit">${n > 1 ? 'articles' : 'article'}${total != null && n !== total ? ` sur ${total.toLocaleString('fr-FR')}` : ''}</span>`;

  function renderCatalog() {
    resetChrome();
    document.title = `Articles · ${S.name || 'Finds'}`;
    const arts = state.articles;
    const cats = {};
    arts.forEach((a) => (cats[a.category] = (cats[a.category] || 0) + 1));
    const catList = Object.entries(cats).sort((a, b) => (a[0] === 'Autres') - (b[0] === 'Autres') || b[1] - a[1]);
    const brandCount = {};
    arts.forEach((a) => a.brand && (brandCount[a.brand] = (brandCount[a.brand] || 0) + 1));
    const brands = Object.keys(brandCount).sort((a, b) => a.localeCompare(b, 'fr'));
    const newCount = arts.filter(isNew).length;

    view.innerHTML = `
      <section class="wrap intro">
        <h1 class="cat-title">Tous les articles</h1>
        <div class="tools">
          <label class="search">${icon.search}<input id="q" type="search" placeholder="Rechercher : doudoune, Nike, écharpe…" value="${esc(state.q)}" autocomplete="off" aria-label="Rechercher un article"></label>
          <select id="brand" class="select" aria-label="Marque">
            <option value="">Toutes les marques</option>
            ${brands.map((b) => `<option value="${esc(b)}" ${b === state.brand ? 'selected' : ''}>${esc(b)} (${brandCount[b]})</option>`).join('')}
          </select>
          <select id="sort" class="select" aria-label="Trier">
            <option value="recent">Plus récents</option>
            <option value="top">Les plus demandés</option>
            <option value="light">Plus légers</option>
          </select>
        </div>
        <p class="tally" id="count" aria-live="polite">${countLine(arts.length)}</p>
      </section>
      <div class="wrap">
        <div class="chips" id="chips">
          ${[['Tous', arts.length], ...catList].map(([c, n]) => `<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="${c === state.cat}">${esc(c)} <span>${n}</span></button>`).join('')}
        </div>
        <div class="grid" id="grid"></div>
        <div class="more" id="more"></div>
      </div>`;

    view.querySelector('#sort').value = state.sort;
    const grid = view.querySelector('#grid');
    const more = view.querySelector('#more');
    let shown = PAGE;
    const paint = (keep) => {
      if (!keep) shown = PAGE;
      const list = filtered();
      view.querySelector('#count').innerHTML = countLine(list.length) + (newCount && list.length === arts.length ? ` <span class="new">dont ${newCount} nouveaux</span>` : '');
      grid.innerHTML = list.length
        ? list.slice(0, shown).map(card).join('')
        : arts.length
          ? `<div class="empty" style="grid-column:1/-1"><b>Aucun article trouvé</b><span>Essaie un autre mot ou retire un filtre.</span><button class="btn-ghost" id="reset" type="button">Tout afficher</button></div>`
          : `<div class="empty" style="grid-column:1/-1"><b>Les articles arrivent</b><span>Le site lit le canal toutes les 15 minutes. Les premiers articles apparaîtront ici après la première mise à jour.</span></div>`;
      grid.querySelector('#reset')?.addEventListener('click', () => { state.q = ''; state.cat = 'Tous'; state.brand = ''; renderCatalog(); });
      more.innerHTML = list.length > shown ? `<button class="btn-ghost" type="button" id="load-more">Voir plus d'articles (${list.length - shown})</button>` : '';
      more.querySelector('#load-more')?.addEventListener('click', () => { shown += PAGE; paint(true); });
    };
    paint();

    view.querySelector('#q').addEventListener('input', (e) => { state.q = e.target.value; paint(); });
    view.querySelector('#brand').addEventListener('change', (e) => { state.brand = e.target.value; paint(); });
    view.querySelector('#sort').addEventListener('change', (e) => { state.sort = e.target.value; paint(); });
    view.querySelector('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      state.cat = b.dataset.c;
      view.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      paint();
    });
  }

  // ---------- fiche article ----------
  function renderArticle(id) {
    const a = state.articles.find((x) => x.id === id);
    if (!a) {
      view.innerHTML = `<div class="wrap"><a class="back" href="#catalogue">${icon.left} Tous les articles</a><div class="empty"><b>Article introuvable</b><span>Il a peut-être été retiré du canal.</span></div></div>`;
      return;
    }
    document.title = `${a.title} · ${S.name || 'Finds'}`;
    const best = bestPhoto(a);
    const shots = [...(a.cover ? [{ src: a.cover, cut: true }] : []), ...(a.photos || []).map((src) => ({ src, cut: false }))];
    if (!a.cover && best) { const k = shots.findIndex((x) => x.src === best); if (k > 0) shots.unshift(...shots.splice(k, 1)); }
    const related = state.articles
      .filter((x) => x.id !== a.id && (x.category === a.category || (a.brand && x.brand === a.brand)))
      .sort((x, y) => (y.brand === a.brand) - (x.brand === a.brand) || y.id - x.id)
      .slice(0, 4);
    const buyAttrs = a.link ? `href="${esc(a.link)}" target="_blank" rel="noopener" data-buy="${a.id}"` : 'aria-disabled="true"';
    const w = weightText(a.weight);

    view.innerHTML = `
      <div class="wrap">
        <a class="back" href="#catalogue">${icon.left} Tous les articles</a>
        <article class="item">
          <div class="gallery">
            <div class="stage ${shots[0]?.cut ? 'is-cut' : ''}" id="stage">
              ${shots.length ? `<img id="main" src="${esc(shots[0].src)}" alt="${esc(a.title)}">` : ''}
              ${shots.length > 1 ? `<button class="nav prev" type="button" aria-label="Photo précédente">${icon.left}</button><button class="nav next" type="button" aria-label="Photo suivante">${icon.right}</button>` : ''}
              <span class="pos" id="pos">${shots[0]?.cut ? 'Détouré' : 'Photo réelle'}${shots.length > 1 ? ` · 1 / ${shots.length}` : ''}</span>
            </div>
            ${shots.length > 1 ? `<div class="thumbs" id="thumbs">${shots.map((p, i) => `<button type="button" class="${p.cut ? 'is-cut' : ''}" data-i="${i}" aria-label="${p.cut ? 'Photo détourée' : 'Photo réelle ' + i}" aria-current="${i === 0}"><img src="${esc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
          </div>
          <div class="info">
            <div>
              <span class="br">${esc([a.brand, a.category].filter(Boolean).join(' · '))}</span>
              <h1>${esc(a.title)}</h1>
            </div>
            <p class="desc">${esc(a.description || '')}</p>
            <dl class="label">
              <div><dt>Poids</dt><dd>${esc(w || '—')}</dd></div>
              <div><dt>Photos</dt><dd>${(a.photos || []).length}</dd></div>
              <div><dt>Publié le</dt><dd>${esc(new Date(a.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }))}</dd></div>
            </dl>
            <div class="cta">
              <a class="buy" ${buyAttrs}>Voir l'article sur LoveGoBuy ${icon.out}</a>
              <a class="sub" href="${esc(a.telegram)}" target="_blank" rel="noopener">${icon.tg} Voir le post Telegram</a>
            </div>
            ${S.invite ? `<button class="hint" type="button" id="hint-promo">${icon.gift} Pas encore de compte ? ${coupon} de coupons offerts sur ta livraison</button>` : ''}
            ${a.link ? `<div class="copy">
              <button class="share" type="button" id="share">${icon.link} Copier le lien LoveGoBuy</button>
              <input class="copy-field" id="copy-field" type="text" readonly value="${esc(a.link)}" aria-label="Lien LoveGoBuy de l'article" hidden>
            </div>` : ''}
          </div>
        </article>
      </div>
      ${related.length ? `<section class="related"><div class="wrap"><h2>Dans le même style</h2><div class="grid">${related.map(card).join('')}</div></div></section>` : ''}`;

    bar.innerHTML = `<a class="buy" ${buyAttrs}>Voir sur LoveGoBuy ${icon.out}</a>`;
    bar.classList.add('on');
    document.body.classList.add('has-bar');
    // La barre du bas n'apparaît que quand le bouton principal n'est plus visible
    const mainBuy = view.querySelector('.cta .buy');
    if ('IntersectionObserver' in window && mainBuy) {
      buyObserver?.disconnect();
      buyObserver = new IntersectionObserver(([e]) => bar.classList.toggle('away', e.isIntersecting));
      buyObserver.observe(mainBuy);
    }
    view.querySelector('#hint-promo')?.addEventListener('click', () => openPromo());

    // Galerie : flèches, vignettes, clavier, glisser
    let i = 0;
    const main = view.querySelector('#main');
    const stage = view.querySelector('#stage');
    const show = (n) => {
      if (!shots.length) return;
      i = (n + shots.length) % shots.length;
      main.src = shots[i].src;
      stage.classList.toggle('is-cut', shots[i].cut);
      view.querySelector('#pos').textContent = `${shots[i].cut ? 'Détouré' : 'Photo réelle'} · ${i + 1} / ${shots.length}`;
      view.querySelectorAll('#thumbs button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      view.querySelector(`#thumbs button[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    view.querySelector('.prev')?.addEventListener('click', () => show(i - 1));
    view.querySelector('.next')?.addEventListener('click', () => show(i + 1));
    view.querySelector('#thumbs')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) show(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    keyHandler = (e) => { if (!promo.hidden) return; if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); };

    // Copie le lien LoveGoBuy de l'article (le même que dans le post Telegram)
    view.querySelector('#share')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const field = view.querySelector('#copy-field');
      try {
        await navigator.clipboard.writeText(a.link);
        trackClick(a.id, 'buy');
        btn.innerHTML = `${icon.check} Lien LoveGoBuy copié`;
        btn.classList.add('done');
        setTimeout(() => { btn.innerHTML = `${icon.link} Copier le lien LoveGoBuy`; btn.classList.remove('done'); }, 2200);
      } catch {
        // Copie refusée par le navigateur : on affiche le lien sélectionné, prêt à copier
        field.hidden = false;
        field.focus();
        field.select();
        btn.innerHTML = `${icon.link} Lien sélectionné, copie-le`;
      }
    });
  }

  // ---------- routage ----------
  let keyHandler = null;
  let buyObserver = null;
  document.addEventListener('keydown', (e) => keyHandler && keyHandler(e));
  const header = () => document.querySelector('.top');
  const syncHeader = () => {
    const over = document.body.classList.contains('home');
    const banner = document.querySelector('.banner');
    const limit = banner ? banner.offsetHeight - 80 : 0;
    header().classList.toggle('over', over && window.scrollY < limit);
  };
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('resize', syncHeader);
  function route() {
    keyHandler = null;
    const h = location.hash;
    document.body.classList.toggle('home', !(h === '#tuto' || h === '#catalogue' || /^#article-/.test(h)));
    const m = h.match(/^#article-(\d+)$/);
    document.getElementById('nav-tuto').setAttribute('aria-current', String(h === '#tuto'));
    if (m) {
      trackClick(Number(m[1]), 'open');
      renderArticle(Number(m[1]));
      window.scrollTo(0, 0);
    } else if (h === '#tuto') {
      renderTuto();
      window.scrollTo(0, 0);
    } else if (h === '#catalogue') {
      renderCatalog();
      window.scrollTo(0, catScroll);
    } else {
      renderWelcome();
      window.scrollTo(0, 0);
    }
    syncHeader();
  }
  let catScroll = 0;
  window.addEventListener('hashchange', () => route());
  window.addEventListener('scroll', () => { if (location.hash === '#catalogue') catScroll = window.scrollY; }, { passive: true });

  // ---------- données ----------
  async function load() {
    try {
      const data = window.__DATA || (await (await fetch('data/articles.json', { cache: 'no-cache' })).json());
      // Par sécurité, aucun champ de prix n'est jamais lu
      const MERGE = { Vestes: 'Hauts', Sweats: 'Hauts', 'Vestes & sweats': 'Hauts', Doudounes: 'Hauts', Chaussures: 'Accessoires', Autres: 'Accessoires' };
      state.articles = (data.articles || []).filter((a) => a && a.id).map(({ price, ...a }) => ({ ...a, category: MERGE[a.category] || a.category }));
      state.updatedAt = data.updatedAt;
    } catch {
      state.articles = [];
    }
    if (state.updatedAt) {
      document.getElementById('foot-upd').textContent = vagueUpdate(state.updatedAt);
    }
    await loadTop();
    // Quel que soit le lien d'arrivée, la visite commence sur la page d'accueil
    if (location.hash) safe(() => history.replaceState(null, '', location.pathname + location.search));
    document.body.classList.add('home');
    renderWelcome();
    syncHeader();
    view.querySelector('.banner img')?.addEventListener('load', syncHeader);
  }
  load();
})();

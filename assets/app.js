(() => {
  const S = window.SITE || {};
  const app = document.getElementById('app');
  const state = { articles: [], updatedAt: null, q: '', cat: 'Tous', brand: '', sort: 'recent', prices: {}, pricesAt: null };

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
  const eur = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const cnyTxt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' CNY';
  // Prix relevé sur LoveGoBuy, seulement s'il correspond bien au lien actuel de l'article (jamais le prix Telegram)
  const priceOf = (a) => { const p = (state.prices || {})[a.id]; return p && p.eur && (!p.pid || p.pid === a.productId) ? p : null; };
  const small = (a) => a.coverSm || a.cover;
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
  Object.assign(icon, {
    camera: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    box: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>',
    feather: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 4c-7 0-13 5-13 12v4"/><path d="M7 16c6 0 11-3 13-12"/><path d="M11 12h5"/></svg>',
    tag: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/></svg>',
    cal: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  });
  Object.assign(icon, {
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
    wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.5.4.1.1.1.7-.1 1.3Z"/></svg>',
    snap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c2.9 0 5.1 2.2 5.1 5.3v2.3c.5.2 1.1.1 1.6-.2.5-.2 1 .3.8.8-.3.7-1.4 1-2.1 1.3.2 1.6 1.8 3.4 3.8 4 .5.2.5.8 0 1-.8.3-1.7.4-2.3.6-.2.5-.1 1.1-.6 1.2-.6.1-1.3-.2-2.2 0-1 .2-1.7 1.6-4.1 1.6s-3.1-1.4-4.1-1.6c-.9-.2-1.6.1-2.2 0-.5-.1-.4-.7-.6-1.2-.6-.2-1.5-.3-2.3-.6-.5-.2-.5-.8 0-1 2-.6 3.6-2.4 3.8-4-.7-.3-1.8-.6-2.1-1.3-.2-.5.3-1 .8-.8.5.3 1.1.4 1.6.2V7.5c0-3.1 2.2-5.3 5.1-5.3Z"/></svg>',
    more: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
    plusSq: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.3 10.2 15 12 3.3 13.8z"/></svg>',
    zoom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>',
    spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  });
  const coupon = esc(S.coupon || '500 €');
  const IMG = { logo: 'assets/img/logo.webp', banner: 'assets/img/banner.webp', bannerMid: 'assets/img/banner-1200.webp', bannerMobile: 'assets/img/banner-mobile.webp', favicon: 'assets/img/favicon.png', video: 'assets/video/tuto.mp4', poster: 'assets/video/tuto-poster.webp' };
  const logo = (cls = 'logo') => `<img class="${cls}" src="${IMG.logo}" alt="" width="64" height="64">`;
  safe(() => {
    let l = document.querySelector('link[rel="icon"]');
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
    l.type = 'image/png';
    l.href = IMG.favicon;
  });

  // Images : fondu à l'apparition, une fois chargées (ou en erreur, pour ne jamais laisser un trou)
  const done = (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('ld'); };
  document.addEventListener('load', done, true);
  document.addEventListener('error', done, true);
  const img = (src, alt = '', cls = '', extra = '') => `<img class="fade ${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" ${extra}>`;

  // ---------- fond crème (unique) ----------
  document.documentElement.dataset.paper = 'cream';

  // ---------- squelette ----------
  app.innerHTML = `
    <header class="top"><div class="wrap top-in">
      <nav class="nav-links" aria-label="Navigation">
        <button class="menu-btn" type="button" id="menu-btn" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="drawer">${icon.menu}<span>Menu</span></button>
        <a href="#tuto" id="nav-tuto">${icon.play} Tuto pour commander</a>
      </nav>
      <a class="brand" href="#" aria-label="Retour à l'accueil">${logo()}<span class="brand-label">Accueil</span></a>
      <div class="top-right">
        <button class="share-hdr" type="button" id="share-site">${icon.share}<span>Partager</span></button>
        <button class="gift" type="button" id="open-promo">${icon.gift}<span>${coupon} offerts</span></button>
      </div>
    </div></header>
    <main id="view"></main>
    <footer class="foot">
      <div class="wrap foot-in">
        <div class="foot-brand">${logo()}<b>${esc(S.name || 'Vytoxx Best Finds')}</b><p>Les trouvailles du canal ${esc(S.by || '')}, rangées au même endroit : photos réelles, lien LoveGoBuy direct, prix relevé sur LoveGoBuy.</p></div>
        <nav class="foot-col" aria-label="Le site"><h3>Le site</h3><a href="#catalogue">Tous les articles</a><a href="#tuto">Tuto pour commander</a><a href="#ecran">Ajouter le site sur l'écran d'accueil</a><a href="#aide">Chat bot : pose ta question</a><button type="button" id="foot-promo">${coupon} de coupons offerts</button><button type="button" id="foot-share">Partager le site à un ami</button></nav>
        <nav class="foot-col" aria-label="Ailleurs"><h3>Ailleurs</h3><a href="${esc(S.telegram)}" target="_blank" rel="noopener">Canal Telegram</a><a href="${esc(S.invite)}" target="_blank" rel="noopener">LoveGoBuy</a></nav>
      </div>
      <div class="wrap foot-base"><span>© ${new Date().getFullYear()} ${esc(S.name || 'Vytoxx Best Finds')}</span><span>Prix indicatifs relevés sur LoveGoBuy · ils peuvent évoluer</span></div>
    </footer>
    <div class="bar" id="bar"></div>
    <div class="drawer" id="drawer" hidden>
      <div class="drawer-back" data-dx></div>
      <nav class="drawer-panel" aria-label="Menu">
        <div class="drawer-head">${logo()}<b>${esc(S.name || 'Vytoxx Best Finds')}</b><button class="promo-x" type="button" data-dx aria-label="Fermer le menu">${icon.close}</button></div>
        <a class="dr-link" href="#" data-dx>${icon.home}<span>Accueil</span></a>
        <a class="dr-link" href="#catalogue" data-dx data-cat="Tous">${icon.grid}<span>Tous les articles</span><small id="dr-n"></small></a>
        <button class="dr-link dr-gold" type="button" id="dr-promo">${icon.gift}<span>${coupon} de coupons offerts</span></button>
        <div class="dr-title">Catégories</div>
        <div class="dr-cats" id="dr-cats"></div>
        <div class="dr-title">Aide pour commander</div>
        <a class="dr-link" href="#tuto" data-dx>${icon.play}<span>Tuto pour commander</span></a>
        <a class="dr-link" href="#ecran" data-dx>${icon.phone}<span>Ajouter le site sur l'écran d'accueil</span></a>
        <a class="dr-link" href="#aide" data-dx>${icon.chat}<span>Chat bot : pose ta question</span></a>
        <div class="dr-title">Partager et suivre</div>
        <button class="dr-link" type="button" id="dr-share">${icon.share}<span>Partager le site à un ami</span></button>
        <a class="dr-link" href="${esc(S.telegram)}" target="_blank" rel="noopener">${icon.tg}<span>Canal Telegram ${esc(S.by || '')}</span>${icon.out}</a>
      </nav>
    </div>
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
  document.getElementById('share-site').addEventListener('click', () => shareThis({ title: 'Partage ce site à un ami', text: `Regarde ce site : toutes les trouvailles LoveGoBuy du canal ${S.by || ''}, avec les vraies photos et les prix 👀`, url: siteUrl() }));
  document.getElementById('foot-promo').addEventListener('click', () => openPromo());
  // ---------- menu déroulant (bouton en haut à gauche) ----------
  const drawer = document.getElementById('drawer');
  const menuBtn = document.getElementById('menu-btn');
  const fillDrawer = () => {
    const n = {}; state.articles.forEach((a) => (n[a.category] = (n[a.category] || 0) + 1));
    document.getElementById('dr-n').textContent = state.articles.length || '';
    document.getElementById('dr-cats').innerHTML = ['Hauts', 'Bas', 'Chaussures', 'Ensembles', 'Électronique', 'Accessoires']
      .map((c) => `<a class="dr-cat" href="#catalogue" data-dx data-cat="${esc(c)}"><span>${esc(c)}</span><small>${n[c] || 0}</small></a>`).join('');
  };
  const openMenu = () => {
    fillDrawer();
    drawer.hidden = false; document.body.classList.add('locked'); menuBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => drawer.classList.add('on'));
    drawer.querySelector('.dr-link')?.focus({ preventScroll: true });
  };
  const closeMenu = () => {
    drawer.classList.remove('on'); document.body.classList.remove('locked'); menuBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { drawer.hidden = true; }, 260);
  };
  menuBtn.addEventListener('click', openMenu);
  drawer.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) { state.cat = c.dataset.cat; state.q = ''; state.brand = ''; catScroll = 0; if (location.hash === '#catalogue') route(); }
    if (e.target.closest('[data-dx]')) closeMenu();
  });
  document.getElementById('dr-promo').addEventListener('click', () => { closeMenu(); setTimeout(() => openPromo(), 120); });
  document.getElementById('dr-share').addEventListener('click', () => { closeMenu(); setTimeout(() => shareThis({ title: 'Partage ce site à un ami', text: `Regarde ce site : toutes les trouvailles LoveGoBuy du canal ${S.by || ''}, avec les vraies photos et les prix 👀`, url: siteUrl() }), 120); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeMenu(); });
  // glisser vers la gauche pour fermer (téléphone)
  let dx0 = null;
  drawer.addEventListener('pointerdown', (e) => { dx0 = e.clientX; });
  drawer.addEventListener('pointerup', (e) => { if (dx0 != null && dx0 - e.clientX > 70) closeMenu(); dx0 = null; });
  document.getElementById('foot-share').addEventListener('click', () => shareThis({ title: 'Partage ce site à un ami', text: `Regarde ce site : toutes les trouvailles LoveGoBuy du canal ${S.by || ''}, avec les vraies photos et les prix 👀`, url: siteUrl() }));
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

  // ---------- partage (feuille de partage du téléphone, sinon petite fenêtre : copier, WhatsApp, Telegram, SMS) ----------
  const siteUrl = () => location.origin + location.pathname;
  async function shareThis({ title, text, url }) {
    const msg = `${text} ${url}`;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="sheet-back" data-x></div>
      <div class="sheet-card" role="dialog" aria-modal="true" aria-label="Partager">
        <span class="sheet-grab" aria-hidden="true"></span>
        <button class="promo-x" type="button" data-x aria-label="Fermer">${icon.close}</button>
        <b class="sheet-title">${esc(title)}</b>
        <div class="sheet-row">
          <button type="button" class="sheet-btn" id="sh-copy"><i class="ic-copy">${icon.link}</i><span>Copier le lien</span></button>
          <a class="sheet-btn" data-x href="https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}" target="_blank" rel="noopener"><i class="ic-snap">${icon.snap}</i><span>Snapchat</span></a>
          <a class="sheet-btn" data-x href="sms:?&body=${encodeURIComponent(msg)}"><i class="ic-sms">${icon.out}</i><span>SMS</span></a>
          <a class="sheet-btn" data-x href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><i class="ic-tg">${icon.tg}</i><span>Telegram</span></a>
          <a class="sheet-btn" data-x href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><i class="ic-wa">${icon.wa}</i><span>WhatsApp</span></a>
          ${navigator.share ? `<button type="button" class="sheet-btn" id="sh-more"><i class="ic-more">${icon.more}</i><span>Autres</span></button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(sh);
    document.body.classList.add('locked');
    const close = () => { sh.classList.remove('on'); document.body.classList.remove('locked'); document.removeEventListener('keydown', onKey, true); setTimeout(() => sh.remove(), 200); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    sh.addEventListener('click', (e) => { if (e.target.closest('[data-x]')) setTimeout(close, 50); });
    sh.querySelector('#sh-more')?.addEventListener('click', async () => {
      try { await navigator.share({ title, text, url }); close(); } catch {}
    });
    sh.querySelector('#sh-copy').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch {
        // ancien navigateur : copie par une zone de texte invisible
        const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
        try { ok = document.execCommand('copy'); } catch {} t.remove();
      }
      b.classList.toggle('done', ok);
      b.querySelector('span').textContent = ok ? 'Lien copié' : 'Copie impossible';
      if (ok) setTimeout(close, 900);
    });
    requestAnimationFrame(() => sh.classList.add('on'));
  }

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
    top.counts = {};
    // les clics d'un doublon comptent pour le post gardé
    for (const [k, v] of Object.entries(counts)) { const id = state.dups?.get(Number(k)) || Number(k); top.counts[id] = (top.counts[id] || 0) + Number(v); }
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
    const p = priceOf(a);
    return `<a class="card" href="#article-${a.id}">
      <div class="ph ${a.cover ? 'is-cut' : ''}">
        ${isNew(a) ? '<span class="badge">Nouveau</span>' : ''}
        ${main ? img(a.cover ? small(a) : main, a.title, 'main') : ''}
        ${real ? img(real, '', 'real') : ''}
        ${real ? '<span class="ph-tag">Photo réelle</span>' : ''}
      </div>
      <div class="card-b">
        <span class="br">${esc(a.brand || a.category)}</span>
        <h3>${esc(a.title)}</h3>
        <div class="row">${p ? `<span class="price">${esc(eur(p.eur))}</span>` : `<span class="cat">${esc(a.category)}</span>`}${w ? `<span class="wt">${esc(w)}</span>` : ''}</div>
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
      cheap: (x, y) => (priceOf(x)?.eur ?? 1e9) - (priceOf(y)?.eur ?? 1e9) || y.id - x.id,
      dear: (x, y) => (priceOf(y)?.eur ?? -1) - (priceOf(x)?.eur ?? -1) || y.id - x.id,
    };
    return list.sort(sorts[state.sort] || sorts.recent);
  }

  const PAGE = 48;
  // Texte d'introduction de la fiche : la description sans les phrases d'information générales
  // (elles sont présentées à part, dans l'encadré « En bref »)
  const introOf = (a) => {
    let d = String(a.description || '');
    const generic = [
      /^.*? : ((?:un|une) [^:.]*? sélectionnée? sur le canal)\.\s*/,
      /\d+ photos de contrôle prises par l'équipe montrent l'article réel, étiquettes et détails compris\.\s*/,
      /La photo de contrôle montre l'article réel\.\s*/,
      /Les \d+ photos sont les photos exactes de cet article[^.]*\.\s*/,
      /La photo est la photo exacte de cet article[^.]*\.\s*/,
      /Le rembourrage est en duvet d'oie\.\s*/,
      /Poids indiqué : [^.]*?estimer la livraison( \([^)]*\))?\.\s*/,
      /Poids affiché : [^.]*\. Il permet d'estimer le prix de la livraison\.\s*/,
      /Le poids, sur la page LoveGoBuy, permet d'estimer le prix de la livraison\.\s*/,
      /Ce prix de livraison peut être diminué[^.]*\.\s*/,
      /Tailles, coloris et disponibilité sont à choisir directement sur la page LoveGoBuy\.\s*/,
      /Le prix, les tailles, les coloris et la disponibilité sont affichés directement sur la page LoveGoBuy\.\s*/,
    ];
    // la phrase « un haut sélectionné sur le canal » n'est plus affichée : seul le texte propre au post reste
    for (const re of generic) d = d.replace(re, '');
    return d.trim();
  };
  const isDown = (a) => /duvet d'oie/.test(a.description || '');
  // Les prix ne sont jamais affichés ici : la description renvoie vers LoveGoBuy
  const PRICE_NOTE = 'Le prix, les tailles, les coloris et la disponibilité sont affichés directement sur la page LoveGoBuy.';
  const withPriceNote = (d) => {
    const t = d.replace(/Tailles, coloris et disponibilité sont à choisir directement sur la page LoveGoBuy\./, PRICE_NOTE);
    return t.includes(PRICE_NOTE) ? t : `${t} ${PRICE_NOTE}`.trim();
  };
  // ---------- page d'accueil ----------
  const thumb = (a) => small(a) || bestPhoto(a) || '';
  // Tuiles larges pour que la grille des catégories tombe juste (4 colonnes sur ordinateur, 2 sur téléphone)
  const tileSpan = (k, n) => {
    if (n % 3 === 0) return ''; // 6 catégories : grille de 3 × 2
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
    arts.forEach((a) => { if (!cats[a.category]) cats[a.category] = { n: 0, pics: [] }; cats[a.category].n++; if (a.cover && cats[a.category].pics.length < 3) cats[a.category].pics.push(small(a)); });
    const ORDER = ['Hauts', 'Bas', 'Chaussures', 'Ensembles', 'Électronique', 'Accessoires'];
    // les 6 catégories sont toujours affichées, dans cet ordre (même si l'une est momentanément vide)
    const catList = ORDER.map((c) => [c, cats[c] || { n: 0, pics: [] }]);
    const byId = new Map(arts.map((a) => [a.id, a]));
    const ranking = top.ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);

    view.innerHTML = `
      <section class="hero">
        <div class="hero-glow" aria-hidden="true"></div>
        <div class="wrap hero-in">
          <div class="hero-card lg">
            <div class="hero-txt">
              <span class="hero-kicker">Le canal ${esc(S.by || 'Vytoxx')}</span>
              <h1 class="hero-title">Vytoxx <em>Best Finds</em></h1>
              <p class="hero-lead">Les meilleures trouvailles LoveGoBuy, en photos réelles et au prix vérifié.</p>
              <p class="hero-meta"><b>${arts.length.toLocaleString('fr-FR')}</b> articles<i></i>mis à jour toutes les 15&nbsp;min</p>
            </div>
            <div class="hero-pic" aria-hidden="true">
              <span class="hero-sun"></span>
              <img src="assets/img/panda-hero.webp" alt="" fetchpriority="high">
            </div>
          </div>
          <div class="help">
            <span class="help-title">Aide pour commander</span>
            <div class="help-row">
              <a class="help-tile lg" href="#tuto"><span class="help-ic ic-gold">${icon.play}</span><b>Tuto pour commander</b><small>10 étapes illustrées</small><span class="help-go">${icon.right}</span></a>
              <a class="help-tile lg" href="#ecran"><span class="help-ic ic-navy">${icon.phone}</span><b>Le site sur ton écran</b><small>iPhone et Android</small><span class="help-go">${icon.right}</span></a>
              <a class="help-tile lg" href="#aide"><span class="help-ic ic-terra">${icon.chat}</span><b>Chat bot</b><small>Pose ta question</small><span class="help-go">${icon.right}</span></a>
            </div>
          </div>
        </div>
      </section>

      ${catList.length ? `<section class="wrap block reveal">
        <div class="block-head"><h2>Catégories</h2><a class="more-link" href="#catalogue">Voir tous les articles ${icon.right}</a></div>
        <div class="cats">${catList.map(([c, v], k) => `<button type="button" class="cat-tile ${tileSpan(k, catList.length)}" data-c="${esc(c)}">
          <span class="cat-pic">${v.pics.map((src, k) => img(src, '', `p${k}`)).join('')}</span>
          <span class="cat-foot"><span class="cat-name">${esc(c)}<small>${v.n} article${v.n > 1 ? 's' : ''}</small></span><span class="cat-go">${icon.right}</span></span>
        </button>`).join('')}</div>
      </section>` : ''}

      <section class="wrap block duo reveal">
        <aside class="panel top-col">
          <div class="block-head"><h2>Top du moment</h2></div>
          <div class="top-panel">
          <p class="top-note">Les articles les plus cliqués sur le site ces ${C.days || 30} derniers jours.</p>
          ${ranking.length ? `<ol class="top-list">${ranking.map((a, k) => `<li><a href="#article-${a.id}">
            <span class="rank">${k + 1}</span>
            <span class="top-pic">${img(thumb(a))}</span>
            <span class="top-b"><span class="top-title">${esc(a.title)}</span><span class="top-meta">${top.counts[a.id].toLocaleString('fr-FR')} clic${top.counts[a.id] > 1 ? 's' : ''}</span></span>
            ${priceOf(a) ? `<span class="top-price">${esc(eur(priceOf(a).eur))}</span>` : ''}
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
            <span class="arr-pic">${img(thumb(a))}</span>
            <span class="arr-b">
              <span class="arr-when">${isNew(a) ? '<i>Nouveau</i>' : ''}${esc(ago(a.date))}</span>
              <span class="arr-title">${esc(a.title)}</span>
              <span class="arr-meta">${esc([priceOf(a) ? eur(priceOf(a).eur) : null, a.brand, a.category].filter(Boolean).join(' · '))}</span>
            </span>
          </a>`).join('')}</div>` : '<p class="muted">Les articles arrivent à la prochaine lecture du canal.</p>'}
        </div>
      </section>`;

    reveal();
    view.querySelector('#see-top')?.addEventListener('click', () => { state.sort = 'top'; state.cat = 'Tous'; state.q = ''; state.brand = ''; catScroll = 0; });
    view.querySelectorAll('.cat-tile').forEach((b) => b.addEventListener('click', () => {
      state.cat = b.dataset.c; state.q = ''; state.brand = ''; catScroll = 0;
      location.hash = 'catalogue';
    }));
  }

  // Blocs qui apparaissent en douceur quand ils entrent à l'écran
  let revealObs = null;
  function reveal() {
    const els = view.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    revealObs?.disconnect();
    revealObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => revealObs.observe(e));
  }

  // ---------- tuto pour commander ----------
  // Tuto illustré pour commander : mêmes iPhones dessinés que le tuto « écran d'accueil »
  const lgbTop = (title) => `<div class="mk-lgb-top"><b>LoveGoBuy</b><span>${title}</span></div>`;
  const orderSteps = () => [
    ['Crée ton compte avec le lien', `Touche <b>Créer mon compte</b> (le bouton doré du site) : tu arrives sur LoveGoBuy. Inscris-toi avec ton e-mail. C'est ce lien qui te donne droit aux <b>${coupon} de coupons</b>.`,
      phone(`${lgbTop('Inscription')}<div class="mk-form"><div class="mk-gold">${coupon} de coupons offerts</div><span class="mk-field">E-mail</span><span class="mk-field">Mot de passe</span><span class="mk-btn hl">S'inscrire</span></div>`)],
    ['Récupère tes coupons', `Dans ton compte, ouvre les coupons et touche <b>Recevoir</b>. Ils servent plus tard à payer <b>moins cher la livraison</b>.`,
      phone(`${lgbTop('Mes coupons')}<div class="mk-coupons">${['1,43', '1,43', '2,85', '4,28'].map((v, i) => `<div class="mk-cpn"><b>€${v}</b><small>Réduction livraison</small><span class="${i === 0 ? 'hl' : ''}">Recevoir</span></div>`).join('')}</div>`)],
    ["Choisis ton article sur Vytoxx Best Finds", `Sur la fiche de l'article qui te plaît, touche <b>Copier le lien LoveGoBuy</b> (ou <b>Voir sur LoveGoBuy</b> pour l'ouvrir directement).`,
      phone(`<div class="mk-site"><img src="${IMG.bannerMobile}" alt=""></div><div class="mk-fiche"><b>Nike Tech</b><span class="mk-price">20,46 €</span><span class="mk-btn">Voir sur LoveGoBuy</span><span class="mk-btn ghost hl">Copier le lien LoveGoBuy</span></div>`)],
    ['Colle le lien dans LoveGoBuy', `Dans l'appli ou le site LoveGoBuy, colle le lien dans la <b>barre de recherche</b> en haut, puis touche <b>Rechercher</b>.`,
      phone(`${lgbTop('Accueil')}<div class="mk-search"><span>lovegobuy.com/product?…</span><b class="hl">Rechercher</b></div><div class="mk-grid mk-grid-lgb"><i></i><i></i><i></i><i></i></div>`)],
    ['Choisis ta taille et achète', `Sur la page de l'article, choisis la <b>taille</b> et la <b>couleur</b>, puis touche <b>Acheter</b> (ou <b>Ajouter au panier</b> pour grouper plusieurs articles).`,
      phone(`${lgbTop('Article')}<div class="mk-prod"><div class="mk-prod-img"></div><b>CNY 140 ≈ €20,46</b><div class="mk-sizes"><span>S</span><span class="on">M</span><span>L</span><span>XL</span></div><div class="mk-two"><span class="mk-btn ghost">Ajouter au panier</span><span class="mk-btn hl">Acheter</span></div></div>`)],
    ['Ajoute ton adresse et paie l\'article', `Ajoute ton <b>adresse de livraison</b>, puis touche <b>Vérifier</b> pour payer l'article. LoveGoBuy l'achète au vendeur et le fait venir dans son entrepôt.`,
      phone(`${lgbTop('Commande')}<div class="mk-form"><span class="mk-field">📍 Ton adresse</span><span class="mk-field">Article : 1</span><div class="mk-total"><span>Total article</span><b>€20,46</b></div><span class="mk-btn hl">Vérifier</span></div>`)],
    ['Choisis ce que tu expédies', `Après <b>2 à 5 jours</b>, ton article arrive dans <b>Mon entrepôt</b>, avec des photos de contrôle. Coche les articles à envoyer ensemble, puis touche <b>Soumettre l'expédition</b>.`,
      phone(`${lgbTop('Mon entrepôt')}<div class="mk-wh">${[1, 1, 0].map((c) => `<div class="mk-wh-row"><i class="${c ? 'on' : ''}"></i><span></span><b></b></div>`).join('')}<span class="mk-btn hl">Soumettre l'expédition</span></div>`)],
    ['Conseil : sépare les catégories', `Mets l'<b>électronique</b>, les <b>liquides</b> et les <b>bijoux</b> chacun dans un colis à part. Chaque colis part sur la bonne ligne et la livraison coûte moins cher.`,
      `<div class="od-tip-pic" aria-hidden="true"><span>⚡<b>Électronique</b><small>1 colis</small></span><span>💧<b>Liquides</b><small>1 colis</small></span><span>💎<b>Bijoux</b><small>1 colis</small></span></div>`],
    ['Paie moins cher la livraison', `Au moment d'emballer, choisis l'option <b>Colis d'essai</b> et retire l'emballage d'origine : le colis est plus léger, donc moins cher.`,
      phone(`${lgbTop('Emballage')}<div class="mk-form">${['Itinéraire logistique', 'Coupon'].map((x) => `<div class="mk-total"><span>${x}</span><b>›</b></div>`).join('')}<div class="mk-total hl"><span>Colis d'essai</span><i class="mk-check"></i></div><div class="mk-total"><span>Retirer l'emballage d'origine</span><i class="mk-check"></i></div></div>`)],
    ['Choisis la livraison', `Ton colis est prêt en <b>2 à 3 jours</b>. Choisis une ligne de livraison (prix et délai affichés) et touche <b>Sélectionner</b>.`,
      phone(`${lgbTop('Logistique')}<div class="mk-form">${['Ligne économique', 'Ligne express'].map((x, i) => `<div class="mk-line"><span><b>${x}</b><small>${i ? '7 à 12 jours' : '12 à 20 jours'}</small></span><span class="mk-sel ${i ? '' : 'hl'}">Sélectionner</span></div>`).join('')}</div>`)],
    ['Paie la livraison avec tes coupons', `Tes <b>coupons</b> se déduisent du prix de la livraison. Choisis ton moyen de paiement (carte, Apple Pay…) et touche <b>Confirmer</b>.`,
      phone(`${lgbTop('Paiement')}<div class="mk-form"><div class="mk-total"><span>Livraison</span><b>€18,90</b></div><div class="mk-total good"><span>Coupons</span><b>−€8,55</b></div><span class="mk-field">💳 Carte bancaire</span><span class="mk-field"> Apple Pay</span><span class="mk-btn hl">Confirmer</span></div>`)],
    ["C'est tout !", `Il ne reste plus qu'à attendre ton colis, environ <b>2 semaines</b>. Tu peux suivre son trajet dans ton compte LoveGoBuy.`,
      `<div class="od-done" aria-hidden="true">${icon.check}<b>Colis en route</b><small>≈ 2 semaines</small></div>`],
  ];

  function renderTuto() {
    resetChrome();
    document.title = `Tuto pour commander · ${S.name || 'Finds'}`;
    const t = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    view.innerHTML = `
      <section class="wrap tuto">
        <header class="tuto-head">
          <span class="eyebrow">Tuto · 10 étapes + 1 conseil</span>
          <h1>Commander sur LoveGoBuy, de A à Z</h1>
          <p class="lead">De l'inscription au paiement de la livraison, étape par étape. Le bouton à toucher est entouré en rouge sur chaque écran.</p>
        </header>
        <ol class="hs-steps od-steps">${orderSteps().map(([title, txt, pic], k) => `<li class="hs-step reveal ${title.startsWith('Conseil') ? 'od-tip' : ''}">
          <div class="hs-pic">${pic}</div>
          <div class="hs-txt"><span class="hs-n">${title.startsWith('Conseil') ? '★' : title.startsWith("C'est tout") ? '✓' : k + 1 - (k > 7 ? 1 : 0)}</span><h2>${title}</h2><p>${txt}</p></div>
        </li>`).join('')}</ol>
        <div class="tuto-cta">
          <a class="buy" href="${esc(S.invite)}" target="_blank" rel="noopener">${icon.gift} Créer mon compte · ${coupon} offerts</a>
          <a class="sub" href="#aide">${icon.chat} Une question ? Le chat bot</a>
        </div>
        <header class="tuto-head od-video-head">
          <span class="eyebrow">En vidéo · 1 min 30</span>
          <h2>La même chose en vidéo</h2>
        </header>
        <div class="tuto-grid solo">
          <div class="player" id="player">
            <video id="tuto-video" src="${IMG.video}" poster="${IMG.poster}" playsinline webkit-playsinline disablepictureinpicture controlslist="nofullscreen nodownload noremoteplayback" preload="metadata"></video>
            <button class="pl-big" type="button" id="pl-big" aria-label="Lire la vidéo">${icon.play}</button>
            <div class="pl-bar">
              <button type="button" class="pl-btn" id="pl-play" aria-label="Lire">${icon.play}</button>
              <input type="range" id="pl-seek" min="0" max="89" step="0.1" value="0" aria-label="Position dans la vidéo">
              <span class="pl-time" id="pl-time">0:00</span>
              <button type="button" class="pl-btn" id="pl-mute" aria-label="Couper le son">${icon.sound}</button>
            </div>
          </div>
        </div>
        <div class="tuto-cta">
          <a class="sub" href="#catalogue">Voir les articles ${icon.right}</a>
        </div>
      </section>`;
    reveal();

    // Lecteur sans plein écran : la vidéo se regarde uniquement dans son cadre, sur ordinateur comme sur iPhone
    const v = view.querySelector('#tuto-video');
    const player = view.querySelector('#player');
    const seek = view.querySelector('#pl-seek');
    const time = view.querySelector('#pl-time');
    const playBtn = view.querySelector('#pl-play');
    const muteBtn = view.querySelector('#pl-mute');
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
    v.addEventListener('loadedmetadata', () => { seek.max = String(v.duration || 89); });
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
      seek.style.setProperty('--p', `${(v.currentTime / (v.duration || 89)) * 100}%`);
      time.textContent = t(v.currentTime);
    });
  }

  // ---------- chat bot : réponses aux questions de ceux qui n'ont jamais commandé ----------
  // Tout se passe dans le navigateur (pas de serveur ni d'abonnement) : la question est comparée aux mots-clés
  // de chaque réponse, la plus proche est affichée. Les réponses se modifient ici, dans BOT.
  // Réponses validées avec Léonard (questions les plus posées sur le groupe LoveGoBuy_fr, dans cet ordre).
  // hide: true → la question n'est jamais proposée, le bot répond seulement si on la pose.
  const BOT = [
    { q: 'Je cherche un article précis, comment je fais ?', k: 'cherche chercher trouve trouver lien liens article produit dispo disponible find recherche recherch existe modele',
      a: "1. Tape le <b>nom de l'article</b> dans la barre de recherche du site.<br>2. Rien ne sort ? Tape la <b>marque et le type de produit</b> (par exemple « Nike jogging »).<br>3. Il n'est pas sur le site ? Va sur le <b>groupe de discussion</b> et envoie une capture d'écran du produit en demandant gentiment le lien.", act: ['search', 'group'] },
    { q: 'Dans combien de temps je reçois ma commande ?', k: 'temps delai delais combien jours semaines recevoir recois reception arrive arriver quand long attente livre livraison',
      a: "Compte environ <b>3 semaines</b> en tout :<br>• <b>3 à 7 jours</b> pour que le vendeur envoie ton article à l'entrepôt LoveGoBuy ;<br>• puis <b>6 à 18 jours</b> de livraison jusqu'à chez toi, selon la ligne choisie." },
    { q: 'Comment suivre mon colis ?', k: 'suivre suivi tracking numero colis trouve ou est aftership track localiser',
      a: "1. Dans l'appli LoveGoBuy, va dans <b>Colis</b> puis touche <b>Détails</b>.<br>2. Descends tout en bas et touche le <b>numéro de suivi</b> : il s'actualise au fur et à mesure, même tant que le colis est hors d'Europe.<br>3. Pour un suivi plus précis une fois le colis <b>arrivé en Europe</b>, copie ce numéro et colle-le sur <b>AfterShip</b> (site ou appli).", act: 'aftership' },
    { q: "Mon colis ne bouge plus, c'est normal ?", k: 'bouge bouger suivi tracking bloque rien nouvelle avance statut normal toujours depuis',
      a: "Oui, c'est fréquent : le suivi peut rester <b>plusieurs jours sans nouvelle info</b>, surtout pendant le vol et le passage en douane. Regarde le suivi dans l'appli (Colis, puis Détails, puis le numéro de suivi tout en bas). Tant que tu es dans les délais (6 à 18 jours de livraison), pas d'inquiétude. Au-delà, ouvre un <b>ticket</b> sur le site LoveGoBuy ou demande sur le groupe de discussion.", act: 'group' },
    { q: 'Combien coûte la livraison ?', k: 'combien cout coute prix livraison frais tarif poids estimer estimation kilo volume calcul cher',
      a: "Le prix dépend du <b>poids</b>, du <b>volume</b> du colis et de la ligne choisie.<br>• Les prix sont les plus avantageux entre <b>500 g et 5 kg</b> par colis.<br>• Le volume compte : un coussin d'1 kg coûte bien plus cher à envoyer qu'un pull épais d'1 kg.<br>• Pour estimer avant de payer, utilise l'onglet <b>Estimation</b> sur l'accueil LoveGoBuy.<br>• Poids indicatifs : t-shirt 250 g, short 350 g, pull 500 à 800 g, pantalon 600 g, chaussures 1 à 1,2 kg. Le poids est aussi indiqué sur la fiche de chaque article." },
    { q: "C'est quoi le colis d'essai ?", k: 'colis essai test calcul precis exact vacuum vide sous volumineux emballage',
      a: "Pour <b>2 € par colis</b>, LoveGoBuy prépare ton colis et te donne son <b>poids et son prix de livraison exacts</b> en 24 h environ, avant que tu paies.<br>• Fais-le quand <b>tous tes articles sont arrivés</b> à l'entrepôt.<br>• Pour les articles volumineux (doudoune, pull épais…), choisis aussi le <b>Vacuum pack</b> (mise sous vide) : le colis prend moins de place et coûte moins cher.", act: 'tuto' },
    { q: `Comment obtenir les ${S.coupon || '500 €'} de coupons ?`, k: '500 485 coupon coupons reduction code promo offert offerts bon inscription parrainage cadeau',
      a: "Inscris-toi sur LoveGoBuy avec le lien du site : tu reçois <b>485 € de coupons</b> (environ 500 €).<br>• Ils servent uniquement à réduire la <b>livraison</b>.<br>• Tu peux utiliser <b>un seul coupon par colis</b>.<br>• Pense à les récupérer dans ton compte (bouton « Recevoir »).", act: 'promo' },
    { q: 'Comment me faire rembourser ?', k: 'rembourse remboursement rembourser annuler annulation cancel argent retour retourner',
      a: "• Si le vendeur n'a pas envoyé l'article au bout de <b>8 jours</b>, tu peux demander le remboursement.<br>• Une fois l'article arrivé à l'entrepôt, tu as <b>5 jours</b> pour le demander.<br>• L'argent revient sur ton <b>solde LoveGoBuy</b> (pas sur ton compte bancaire) en <b>3 à 8 jours</b>." },
    { q: 'Je ne vois pas les photos de contrôle (QC)', k: 'qc photo photos controle verification entrepot voir vois pas apparait',
      a: "Les photos de contrôle arrivent en général <b>1 à 2 jours</b> après l'arrivée de l'article à l'entrepôt. Toujours rien au bout de <b>72 h</b> ? Ouvre un <b>ticket</b> sur le site LoveGoBuy pour les demander." },
    { q: "Que veut dire ce message de l'appli ?", k: 'message veut dire signifie recharge need closed ferme apply cancel statut appli application',
      a: "• « <b>Need to recharge</b> » : le prix de l'article a changé, tu dois payer la différence.<br>• « <b>Apply cancel</b> » : ta demande d'annulation est en cours.<br>• « <b>Colis fermé</b> » : l'article est resté plus de 60 jours à l'entrepôt et il est reparti chez le vendeur.<br>Un autre message ? Envoie une capture sur le groupe de discussion.", act: 'group' },
    { q: "LoveGoBuy, c'est fiable ?", k: 'fiable confiance arnaque scam serieux sur securise lovegobuy marche vraiment legit',
      a: "LoveGoBuy est un <b>agent d'achat</b> : il achète l'article au vendeur en Chine, le reçoit dans son entrepôt, te montre des <b>photos de contrôle</b>, puis te l'envoie. Si le vendeur n'envoie pas l'article, tu es <b>remboursé</b> sur ton solde LoveGoBuy. Le groupe de discussion est là si tu as un doute." },
    { q: 'Quelle ligne de livraison choisir ?', k: 'ligne dhl dpd europe eu transporteur choisir choix meilleure moins chere',
      a: "LoveGoBuy EU, DHL ou DPD : les délais sont <b>à peu près les mêmes</b>. Prends simplement la <b>moins chère</b> des lignes proposées pour ton colis." },
    { q: 'Quelle taille prendre ?', k: 'taille tailles size guide mesure grand petit fit correspondance prendre',
      a: "Choisis la taille sur la page LoveGoBuy de l'article, avec le guide des tailles du vendeur. Les photos des fiches montrent l'étiquette, et la règle posée à côté donne les dimensions réelles. Un doute ? Demande sur le groupe de discussion.", act: 'group' },
    { q: 'Combien de temps mes articles restent à l\'entrepôt ?', k: 'stockage stocker garder entrepot jours gratuit reste rester 60 attendre',
      a: "Le stockage est <b>gratuit pendant 60 jours</b>. Passé ce délai, l'article repart chez le vendeur : pense à expédier ton colis avant." },
    { q: 'Comment contacter le service client ?', k: 'service client contacter contact aide support ticket probleme parler joindre',
      a: "Ouvre un <b>ticket</b> sur le site LoveGoBuy, depuis ton compte. Tu peux aussi poser ta question sur le <b>groupe de discussion</b>.", act: 'group' },
    { q: 'Comment commander un article du site ?', k: 'commander acheter achat commande etapes faire comment panier',
      a: "1. Ouvre la fiche de l'article et touche <b>Voir sur LoveGoBuy</b>.<br>2. Choisis ta taille et ta couleur, puis achète.<br>3. Quand l'article est à l'entrepôt, vérifie les photos de contrôle et demande l'expédition.<br>4. Paie la livraison avec tes coupons. Tout est montré pas à pas dans le tuto.", act: 'tuto' },
    { q: 'Est-ce que je vais recevoir la même chose que sur les photos ?', k: 'meme photo photos reel reelle vrai qualite identique pareil',
      a: "Les photos des fiches sont les <b>photos exactes de l'article</b>, étiquettes et détails compris. Et quand ton article arrive à l'entrepôt, LoveGoBuy te montre des <b>photos de contrôle</b> avant l'envoi : tu vérifies que c'est bien ce que tu as commandé." },
    { q: 'Comment payer ?', k: 'payer paiement carte bancaire apple pay google paypal moyen usd dollar euro',
      a: "LoveGoBuy propose plusieurs moyens : <b>carte bancaire</b>, <b>Apple Pay</b>, <b>Google Pay</b> et d'autres. Tu paies deux fois : l'article d'abord, la livraison ensuite." },
    { q: 'Le prix affiché sur le site est-il le bon ?', k: 'prix affiche bon exact change yuan cny different',
      a: "Le prix affiché est celui de la page LoveGoBuy, relevé à la date indiquée sous le prix. Il peut changer : le prix qui compte est celui affiché sur LoveGoBuy au moment de commander." },
    { q: 'Pourquoi séparer les catégories dans mes colis ?', k: 'separer categories pourquoi electronique liquide bijou bijoux melanger',
      a: "L'électronique, les liquides et les bijoux partent sur des lignes de livraison spéciales. En les gardant chacun de leur côté, chaque colis part sur la bonne ligne et coûte moins cher." },
    { q: "Comment ajouter le site sur mon écran d'accueil ?", k: 'iphone android ecran accueil installer raccourci icone appli application telephone',
      a: "<b>iPhone</b> : dans Safari, touche « ••• », puis Partager, puis « Sur l'écran d'accueil ».<br><b>Android</b> : dans Chrome, touche « ⋮ » en haut à droite, puis « Ajouter à l'écran d'accueil ».<br>Toutes les étapes sont illustrées dans le petit tuto.", act: 'ecran' },
    { q: 'Mon colis peut-il être saisi à la douane ?', hide: true, k: 'saisi saisie douane attrape attraper bloque confisque perdu risque',
      a: "C'est <b>extrêmement rare</b> : moins d'un colis sur 500. En général, le colis est simplement saisi et n'arrive pas chez toi. LoveGoBuy prend cela en charge : <b>si le colis est assuré, il est remboursé</b>. Les règles peuvent changer : pour ce genre de question, ouvre un <b>ticket</b> sur le site LoveGoBuy." },
  ];
  const ACTS = {
    promo: [`${icon.gift} Récupérer mes ${coupon}`, () => openPromo()],
    tuto: [`${icon.play} Voir le tuto pour commander`, () => { location.hash = 'tuto'; }],
    ecran: [`${icon.phone} Voir le tuto`, () => { location.hash = 'ecran'; }],
    search: [`${icon.search} Chercher sur le site`, () => { location.hash = 'catalogue'; setTimeout(() => document.getElementById('q')?.focus(), 350); }],
    aftership: [`${icon.out} Ouvrir AfterShip`, () => window.open('https://www.aftership.com/', '_blank', 'noopener')],
    group: [`${icon.tg} Ouvrir le groupe`, () => window.open(S.chat || S.telegram, '_blank', 'noopener')],
  };
  // mots trop courants pour départager deux questions
  const BOT_STOP = new Set('comment fais faire est pour les des une mon mes ton tes que qui quoi quel quelle avec dans sur pas vous tu je suis peut ca cest'.split(' '));
  const botAnswer = (text) => {
    const words = fold(text).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => (w.length > 2 || w === 'qc') && !BOT_STOP.has(w));
    let best = null, bestScore = 0;
    for (const e of BOT) {
      const keys = fold(`${e.k} ${e.q}`).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((k) => (k.length > 2 || k === 'qc') && !BOT_STOP.has(k));
      let sc = 0;
      for (const w of words) if (keys.some((k) => k === w || (w.length > 4 && k.length > 4 && (k.startsWith(w.slice(0, 5)) || w.startsWith(k.slice(0, 5)))))) sc++;
      if (sc > bestScore) { bestScore = sc; best = e; }
    }
    return bestScore ? best : null;
  };
  const botLog = [];
  function renderBot() {
    resetChrome();
    document.title = `Chat bot · ${S.name || 'Finds'}`;
    view.innerHTML = `
      <section class="wrap bot">
        <header class="bot-head">${logo()}<div><b>Assistant ${esc(S.name || 'Vytoxx Best Finds')}</b><span class="bot-on">Répond tout de suite</span></div></header>
        <div class="bot-feed" id="bot-feed" aria-live="polite"></div>
        <div class="bot-sugg" id="bot-sugg"></div>
        <form class="bot-form" id="bot-form" autocomplete="off">
          <input id="bot-in" type="text" placeholder="Pose ta question…" aria-label="Ta question" enterkeyhint="send">
          <button type="submit" aria-label="Envoyer">${icon.send}</button>
        </form>
      </section>`;
    const feed = view.querySelector('#bot-feed'), sugg = view.querySelector('#bot-sugg'), form = view.querySelector('#bot-form'), input = view.querySelector('#bot-in');
    const bubble = (who, html, act) => {
      const d = document.createElement('div');
      d.className = `bm bm-${who}`;
      d.innerHTML = `${who === 'bot' ? `<img class="bm-av" src="${IMG.logo}" alt="">` : ''}<div class="bm-b"><div>${html}</div>${act ? `<div class="bm-acts">${[].concat(act).map((x) => `<button type="button" class="bm-act" data-act="${x}">${ACTS[x][0]}</button>`).join('')}</div>` : ''}</div>`;
      feed.appendChild(d);
      d.scrollIntoView({ block: 'end', behavior: 'smooth' });
      return d;
    };
    const showSugg = (exclude = []) => {
      sugg.innerHTML = BOT.filter((e) => !e.hide && !exclude.includes(e)).slice(0, 6).map((e) => `<button type="button" class="chip" data-q="${esc(e.q)}">${esc(e.q)}</button>`).join('');
    };
    const asked = new Set();
    const ask = (text) => {
      text = String(text || '').trim();
      if (!text) return;
      bubble('me', esc(text));
      botLog.push(['me', text]);
      const typing = bubble('bot', '<span class="bm-typing"><i></i><i></i><i></i></span>');
      const e = BOT.find((x) => x.q === text) || botAnswer(text);
      setTimeout(() => {
        typing.remove();
        if (e) { asked.add(e); bubble('bot', e.a, e.act); botLog.push(['bot', e]); }
        else { bubble('bot', "Je n'ai pas encore la réponse à cette question. Pose-la sur le groupe de discussion, on te répondra. Sinon, choisis une des questions ci-dessous.", 'group'); botLog.push(['bot', null]); }
        showSugg([...asked]);
      }, 550 + Math.random() * 350);
    };
    // la conversation est gardée tant que la page n'est pas rechargée
    if (botLog.length) botLog.forEach(([who, x]) => (who === 'me' ? bubble('me', esc(x)) : x ? bubble('bot', x.a, x.act) : bubble('bot', "Je n'ai pas encore la réponse à cette question. Pose-la sur le groupe de discussion.", 'group')));
    else bubble('bot', `Salut 👋 Je réponds aux questions sur la commande LoveGoBuy : trouver un article, délais, livraison, coupons, remboursement… Touche une question ci-dessous ou écris la tienne.`);
    showSugg();
    sugg.addEventListener('click', (ev) => { const b = ev.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
    feed.addEventListener('click', (ev) => { const b = ev.target.closest('[data-act]'); if (b) ACTS[b.dataset.act][1](); });
    form.addEventListener('submit', (ev) => { ev.preventDefault(); ask(input.value); input.value = ''; });
  }

  // ---------- tuto : ajouter le site sur l'écran d'accueil (iPhone ou Android) ----------
  // Illustrations dessinées en HTML (aucune capture d'écran) : un téléphone simplifié, le bouton à toucher entouré
  const phone = (screen, cls = '') => `<div class="mock ${cls}" aria-hidden="true"><div class="mock-notch"></div><div class="mock-screen">${screen}</div></div>`;
  const safariBar = (hl) => `<div class="mk-bar"><span class="mk-url">🔒 best-finds-vytoxx.github.io</span><span class="mk-dots ${hl ? 'hl' : ''}">•••</span></div>`;
  const sitePage = `<div class="mk-site"><img src="${IMG.bannerMobile}" alt=""><div class="mk-site-btn"></div><div class="mk-grid"><i></i><i></i><i></i><i></i></div></div>`;
  const chromeBar = (hl) => `<div class="mk-cbar"><span class="mk-url">🔒 best-finds-vytoxx.github.io</span><span class="mk-kebab ${hl ? 'hl' : ''}">⋮</span></div>`;
  const sitePageTop = sitePage.replace('mk-site', 'mk-site mk-site-top');
  const andPhone = (screen, cls = '') => phone(screen, `mock-and ${cls}`);
  const homeIcons = (n) => Array.from({ length: n }, () => '<i></i>').join('');
  const HS_STEPS = {
    ios: () => [
      ['Ouvre le site dans Safari', `Le site doit être ouvert dans <b>Safari</b>, le navigateur de l'iPhone. Si tu l'as ouvert depuis Telegram, Instagram ou Snapchat, choisis « Ouvrir dans Safari » dans le menu de l'appli (ou copie le lien et colle-le dans Safari).`,
        phone(`${sitePage}${safariBar(false)}`)],
      ['Touche les trois points « ••• »', `En bas de l'écran, à droite de l'adresse du site, touche <b>•••</b>, puis <b>Partager</b>.<br><span class="hs-note">Sur un iPhone qui n'est pas à jour, touche directement le bouton Partager (le carré avec une flèche vers le haut), en bas au milieu.</span>`,
        phone(`${sitePage}<div class="mk-pop"><span>Ajouter aux favoris</span><span>Nouvel onglet</span><span class="hl">${icon.share} Partager</span></div>${safariBar(true)}`)],
      ["Touche « Sur l'écran d'accueil »", `Dans le menu qui s'ouvre, fais défiler vers le bas et touche <b>Sur l'écran d'accueil</b>.<br><span class="hs-note">Tu ne le vois pas ? Touche « Plus » ou « Modifier les actions » tout en bas pour l'afficher.</span>`,
        phone(`<div class="mk-sheet"><div class="mk-share-head"><span class="mk-ic"></span><span><b>Vytoxx Best Finds</b><small>best-finds-vytoxx.github.io</small></span></div><div class="mk-apps"><i></i><i></i><i></i><i></i></div><div class="mk-list"><span>Copier ${icon.link}</span><span>Ajouter aux favoris</span><span class="hl">Sur l'écran d'accueil ${icon.plusSq}</span><span>Imprimer</span></div></div>`)],
      ['Touche « Ajouter »', `Laisse le nom <b>Vytoxx Finds</b> et l'option <b>Ouvrir en tant qu'app web</b> activée, puis touche <b>Ajouter</b> en haut à droite.`,
        phone(`<div class="mk-add"><div class="mk-add-top"><span>Annuler</span><b>Ajouter à l'écran</b><span class="hl">Ajouter</span></div><div class="mk-add-row"><img src="assets/img/app-icon-180.png" alt=""><span><b>Vytoxx Finds</b><small>best-finds-vytoxx.github.io</small></span></div><div class="mk-toggle"><span>Ouvrir en tant qu'app web</span><i></i></div></div>`)],
      ["C'est fait !", `Le panda <b>Vytoxx Best Finds</b> est sur ton écran d'accueil. Touche-le : le site s'ouvre en plein écran, comme une vraie appli, toujours à jour avec les derniers articles du canal.`,
        phone(`<div class="mk-home">${homeIcons(11)}<span class="mk-app hl"><img src="assets/img/app-icon-180.png" alt=""><small>Vytoxx Finds</small></span>${homeIcons(4)}</div>`, 'mock-home')],
    ],
    android: () => [
      ['Ouvre le site dans Chrome', `Le site doit être ouvert dans <b>Chrome</b>. Si tu l'as ouvert depuis Telegram, Instagram ou Snapchat, touche les trois points de l'appli puis « Ouvrir dans Chrome » (ou « Ouvrir dans le navigateur »).`,
        andPhone(`${chromeBar(false)}${sitePageTop}`)],
      ['Touche les trois points « ⋮ »', `En haut à droite de l'écran, à côté de l'adresse du site, touche <b>⋮</b>.<br><span class="hs-note">Sur Samsung Internet, touche plutôt le menu ☰ en bas à droite, puis « Ajouter la page à », puis « Écran d'accueil ».</span>`,
        andPhone(`${chromeBar(true)}${sitePageTop}`)],
      ["Touche « Ajouter à l'écran d'accueil »", `Dans le menu qui s'ouvre, touche <b>Ajouter à l'écran d'accueil</b>.<br><span class="hs-note">Selon ton téléphone, l'option s'appelle aussi « Installer l'application ».</span>`,
        andPhone(`${chromeBar(false)}${sitePageTop}<div class="mk-amenu"><span>Nouvel onglet</span><span>Historique</span><span>Favoris</span><span>Partager…</span><span class="hl">${icon.plusSq} Ajouter à l'écran d'accueil</span><span>Paramètres</span></div>`)],
      ['Touche « Installer »', `Laisse le nom <b>Vytoxx Finds</b> et touche <b>Installer</b> (ou <b>Ajouter</b>). Si le téléphone te le redemande, confirme avec <b>Ajouter</b>.`,
        andPhone(`${sitePageTop}<div class="mk-adlg"><b>Ajouter à l'écran d'accueil</b><div class="mk-add-row"><img src="assets/img/app-icon-180.png" alt=""><span><b>Vytoxx Finds</b><small>best-finds-vytoxx.github.io</small></span></div><div class="mk-adlg-btns"><span>Annuler</span><span class="hl">Installer</span></div></div>`)],
      ["C'est fait !", `Le panda <b>Vytoxx Best Finds</b> est sur ton écran d'accueil. Touche-le : le site s'ouvre en plein écran, comme une vraie appli, toujours à jour avec les derniers articles du canal.`,
        andPhone(`<div class="mk-home">${homeIcons(11)}<span class="mk-app hl"><img src="assets/img/app-icon-180.png" alt=""><small>Vytoxx Finds</small></span>${homeIcons(4)}</div>`, 'mock-home')],
    ],
  };
  let hsOS = null;
  function renderHomeScreen() {
    resetChrome();
    document.title = `Ajouter le site sur l'écran d'accueil · ${S.name || 'Finds'}`;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ua = navigator.userAgent;
    const inApp = /Instagram|FBAN|FBAV|Telegram|Snapchat|TikTok|Line\/|GSA\//i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    if (!hsOS) { try { hsOS = localStorage.getItem('bf_hs_os'); } catch {} }
    if (hsOS !== 'ios' && hsOS !== 'android') hsOS = android ? 'android' : 'ios';
    const notSafari = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    const draw = () => {
      const isIOS = hsOS === 'ios';
      const browser = isIOS ? 'Safari' : 'Chrome';
      const wrongBrowser = !standalone && (inApp || (isIOS && notSafari)) && (isIOS ? ios : android);
      view.innerHTML = `
      <section class="wrap tuto hs">
        <header class="tuto-head">
          <span class="eyebrow">Tuto ${isIOS ? 'iPhone' : 'Android'} · 30 secondes</span>
          <h1>Le site sur ton écran d'accueil, comme une appli</h1>
          <p class="lead">Une icône Vytoxx Best Finds à côté de tes applis : un appui et tu retrouves toutes les trouvailles, sans chercher le lien.</p>
          <div class="hs-os" role="radiogroup" aria-label="Ton téléphone">
            <button type="button" role="radio" aria-checked="${isIOS}" data-os="ios"><i></i>iPhone</button>
            <button type="button" role="radio" aria-checked="${!isIOS}" data-os="android"><i></i>Android</button>
          </div>
          ${standalone ? `<p class="hs-ok">${icon.check} C'est déjà fait : tu utilises le site depuis ton écran d'accueil.</p>` : ''}
          ${wrongBrowser ? `<div class="hs-warn"><b>Tu n'es pas dans ${browser}</b><span>Copie le lien, ouvre ${browser} et colle-le dans la barre d'adresse, puis suis les étapes.</span><button class="sub" type="button" id="hs-copy">${icon.link} Copier le lien du site</button></div>` : ''}
        </header>
        <ol class="hs-steps">${HS_STEPS[hsOS]().map(([t, txt, pic], k) => `<li class="hs-step reveal">
          <div class="hs-pic">${pic}</div>
          <div class="hs-txt"><span class="hs-n">${k + 1}</span><h2>${t}</h2><p>${txt}</p></div>
        </li>`).join('')}</ol>
        <div class="tuto-cta">
          <a class="buy" href="#catalogue">Voir les articles ${icon.right}</a>
          <a class="sub" href="#tuto">${icon.play} Tuto pour commander</a>
        </div>
      </section>`;
      reveal();
      view.querySelectorAll('.hs-os [data-os]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.os === hsOS) return;
        hsOS = b.dataset.os;
        try { localStorage.setItem('bf_hs_os', hsOS); } catch {}
        draw();
        view.querySelector(`.hs-os [data-os="${hsOS}"]`)?.focus();
      }));
      view.querySelector('#hs-copy')?.addEventListener('click', async (e) => {
        const b = e.currentTarget, url = siteUrl();
        try { await navigator.clipboard.writeText(url); b.innerHTML = `${icon.check} Lien copié`; } catch { b.textContent = url; }
      });
    };
    draw();
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
    const CAT_ORDER = ['Hauts', 'Bas', 'Chaussures', 'Ensembles', 'Électronique', 'Accessoires'];
    const rank = (c) => (CAT_ORDER.includes(c) ? CAT_ORDER.indexOf(c) : 99);
    const catList = Object.entries(cats).sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1]);
    const brandCount = {};
    arts.forEach((a) => a.brand && (brandCount[a.brand] = (brandCount[a.brand] || 0) + 1));
    const brands = Object.keys(brandCount).sort((a, b) => a.localeCompare(b, 'fr'));
    const newCount = arts.filter(isNew).length;

    view.innerHTML = `
      <section class="wrap intro">
        <h1>Tous les articles</h1>
        <p class="tally" id="count" aria-live="polite">${countLine(arts.length)}</p>
      </section>
      <div class="filters" id="filters"><div class="wrap">
        <div class="tools">
          <label class="search">${icon.search}<input id="q" type="search" placeholder="Rechercher : doudoune, Nike, écharpe…" value="${esc(state.q)}" autocomplete="off" aria-label="Rechercher un article"><kbd>/</kbd></label>
          <select id="brand" class="select" aria-label="Marque">
            <option value="">Toutes les marques</option>
            ${brands.map((b) => `<option value="${esc(b)}" ${b === state.brand ? 'selected' : ''}>${esc(b)} (${brandCount[b]})</option>`).join('')}
          </select>
          <select id="sort" class="select" aria-label="Trier">
            <option value="recent">Plus récents</option>
            <option value="top">Les plus demandés</option>
            <option value="cheap">Prix croissant</option>
            <option value="dear">Prix décroissant</option>
            <option value="light">Plus légers</option>
          </select>
        </div>
        <div class="chips" id="chips">
          ${[['Tous', arts.length], ...catList].map(([c, n]) => `<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="${c === state.cat}">${esc(c)} <span>${n}</span></button>`).join('')}
        </div>
      </div></div>
      <div class="wrap">
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
    // Ombre sous la barre de filtres quand elle est collée en haut
    const filters = view.querySelector('#filters');
    stickObs?.disconnect();
    if ('IntersectionObserver' in window) {
      const probe = document.createElement('div');
      filters.before(probe);
      stickObs = new IntersectionObserver(([e]) => filters.classList.toggle('stuck', !e.isIntersecting), { rootMargin: '-65px 0px 0px 0px' });
      stickObs.observe(probe);
    }
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
    // prix relevé sur LoveGoBuy, seulement s'il correspond bien au lien actuel de l'article
    const lgb = priceOf(a);
    const checked = lgb?.at || state.pricesAt;

    view.innerHTML = `
      <div class="wrap">
        <nav class="crumbs" aria-label="Fil d'Ariane"><a href="#catalogue">${icon.left} Tous les articles</a><i>/</i><span>${esc(a.category)}</span>${a.brand ? `<i>/</i><span>${esc(a.brand)}</span>` : ''}</nav>
        <article class="item">
          <div class="gallery">
            <div class="stage" id="stage">
              <div class="slides" id="slides">${shots.map((p, k) => `<figure class="slide ${p.cut ? 'is-cut' : ''}" data-k="${k}"><img class="fade" src="${esc(p.src)}" alt="${k === 0 ? esc(a.title) : ''}" ${k ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" draggable="false"></figure>`).join('')}</div>
              ${shots.length ? `<span class="zoom-hint" aria-hidden="true">${icon.zoom}</span>` : ''}
              ${shots.length > 1 ? `<button class="nav prev" type="button" aria-label="Photo précédente">${icon.left}</button><button class="nav next" type="button" aria-label="Photo suivante">${icon.right}</button>` : ''}
              <span class="pos" id="pos">${shots[0]?.cut ? 'Détouré' : 'Photo réelle'}${shots.length > 1 ? ` · 1 / ${shots.length}` : ''}</span>
              ${shots.length > 1 ? `<span class="dots" aria-hidden="true">${shots.map((_, k) => `<i${k ? '' : ' class="on"'}></i>`).join('')}</span>` : ''}
            </div>
            ${shots.length > 1 ? `<div class="thumbs" id="thumbs">${shots.map((p, i) => `<button type="button" class="${p.cut ? 'is-cut' : ''}" data-i="${i}" aria-label="${p.cut ? 'Photo détourée' : 'Photo réelle ' + i}" aria-current="${i === 0}">${img(p.cut ? small(a) : p.src)}</button>`).join('')}</div>` : ''}
          </div>
          <div class="info">
            <div class="info-head">
              <span class="br">${esc([a.brand, a.category].filter(Boolean).join(' · '))}</span>
              <h1>${esc(a.title)}</h1>
              ${introOf(a) ? `<p class="desc">${esc(introOf(a))}</p>` : ''}
              <button class="share-pill" type="button" id="share-item">${icon.share} Partage ce produit à un pote</button>
            </div>

            <div class="card-box price-box">
              <span class="price-label">Prix affiché sur le site</span>
              ${lgb ? `<span class="price-val">${esc(eur(lgb.eur))}</span><span class="price-sub"><span class="dot"></span>${esc(cnyTxt(lgb.cny))} sur LoveGoBuy${checked ? ` · relevé le ${esc(new Date(checked).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))}` : ''}</span>`
                : `<span class="price-val price-none">Voir la page LoveGoBuy</span><span class="price-sub">Le prix de cet article n'a pas encore été relevé.</span>`}
            </div>

            <section class="card-box" aria-label="Informations sur l'article">
              <ul class="facts">
                <li>${icon.camera}<span><b>${(a.photos || []).length} photo${(a.photos || []).length > 1 ? 's' : ''} exacte${(a.photos || []).length > 1 ? 's' : ''} de l'article</b>Prises par l'équipe Vytoxx, étiquettes et détails compris.</span></li>
                <li>${icon.box}<span><b>Poids : ${esc(w || 'sur la page LoveGoBuy')}</b>Sert à estimer le prix de la livraison, que les ${coupon} de coupons permettent de réduire.</span></li>
                ${isDown(a) ? `<li>${icon.feather}<span><b>Rembourrage en duvet d'oie</b>Garnissage de la doudoune.</span></li>` : ''}
                <li>${icon.tag}<span><b>Tailles et coloris</b>À choisir directement sur la page LoveGoBuy.</span></li>
              </ul>
            </section>

            <section class="card-box" aria-labelledby="order-t">
              <h2 class="box-title" id="order-t">Commander</h2>
              <div class="cta">
                <a class="buy" ${buyAttrs}>Voir l'article sur LoveGoBuy ${icon.out}</a>
                ${a.link ? `<div class="copy">
                  <span class="copy-title">Pour copier-coller directement dans l'application LoveGoBuy</span>
                  <button class="sub share" type="button" id="share">${icon.link} Copier le lien LoveGoBuy</button>
                  <input class="copy-field" id="copy-field" type="text" readonly value="${esc(a.link)}" aria-label="Lien LoveGoBuy de l'article" hidden>
                </div>` : ''}
                <div class="copy">
                  <span class="copy-title">Pour le retrouver sur le canal</span>
                  <a class="sub" href="${esc(a.telegram)}" target="_blank" rel="noopener">${icon.tg} Voir le post Telegram</a>
                </div>
              </div>
            </section>

            ${S.invite ? `<button class="coupon-card" type="button" id="hint-promo">
              <span class="coupon-ic">${icon.gift}</span>
              <span class="coupon-txt"><b>${coupon} de coupons offerts</b>Pas encore de compte LoveGoBuy ? Ils réduisent tes frais de livraison.</span>
              <span class="coupon-go">${icon.right}</span>
            </button>` : ''}
          </div>
        </article>
      </div>
      ${related.length ? `<section class="related"><div class="wrap"><h2>Dans le même style</h2><div class="grid">${related.map(card).join('')}</div></div></section>` : ''}`;

    bar.innerHTML = `${lgb ? `<span class="bar-price"><b>${esc(eur(lgb.eur))}</b><span>sur LoveGoBuy</span></span>` : ''}<a class="buy" ${buyAttrs}>Voir sur LoveGoBuy ${icon.out}</a><button class="bar-share" type="button" id="bar-share" aria-label="Partager ce produit">${icon.share}</button>`;
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
    const shareItem = () => shareThis({
      title: 'Partage ce produit à un pote',
      text: `Regarde ça : ${a.title}${lgb ? ` à ${eur(lgb.eur)}` : ''} sur ${S.name || 'Vytoxx Best Finds'}`,
      url: `${siteUrl()}?p=${a.id}`,
    });
    view.querySelector('#share-item').addEventListener('click', shareItem);
    bar.querySelector('#bar-share').addEventListener('click', shareItem);

    // Galerie : carrousel qui défile au doigt (défilement natif aimanté), flèches, vignettes, clavier
    let i = 0;
    const slides = view.querySelector('#slides');
    const stage = view.querySelector('#stage');
    const mark = (n) => {
      if (n === i && view.querySelector('#pos').dataset.k === String(n)) return;
      i = n;
      view.querySelector('#pos').dataset.k = String(n);
      view.querySelector('#pos').textContent = `${shots[i].cut ? 'Détouré' : 'Photo réelle'}${shots.length > 1 ? ` · ${i + 1} / ${shots.length}` : ''}`;
      view.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
      view.querySelectorAll('#thumbs button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      const t = view.querySelector(`#thumbs button[data-i="${i}"]`);
      const th = view.querySelector('#thumbs');
      if (t && th) th.scrollTo({ left: t.offsetLeft - th.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
    };
    const show = (n, smooth = true) => {
      if (!shots.length) return;
      const k = (n + shots.length) % shots.length;
      slides.scrollTo({ left: k * slides.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      mark(k);
    };
    let raf = 0;
    slides.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mark(Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth))));
    }, { passive: true });
    view.querySelector('.prev')?.addEventListener('click', () => show(i - 1));
    view.querySelector('.next')?.addEventListener('click', () => show(i + 1));
    view.querySelector('#thumbs')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
    // un appui (sans glisser) ouvre la visionneuse plein écran
    let p0 = null;
    slides.addEventListener('pointerdown', (e) => { p0 = [e.clientX, e.clientY]; });
    slides.addEventListener('click', (e) => {
      if (p0 && Math.hypot(e.clientX - p0[0], e.clientY - p0[1]) > 10) return;
      openLightbox(shots, i, (k) => show(k, false));
    });
    void stage;
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

  // ---------- visionneuse plein écran (zoom au clic, glisser pour changer de photo) ----------
  function openLightbox(shots, start, onClose) {
    let i = start, zoom = false;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photos en grand');
    lb.innerHTML = `
      <div class="lb-top"><span id="lb-pos"></span><button class="lb-x" type="button" aria-label="Fermer">${icon.close}</button></div>
      <div class="lb-stage"><img id="lb-img" alt="">
        ${shots.length > 1 ? `<button class="lb-nav prev" type="button" aria-label="Photo précédente">${icon.left}</button><button class="lb-nav next" type="button" aria-label="Photo suivante">${icon.right}</button>` : ''}
      </div>
      ${shots.length > 1 ? `<div class="lb-thumbs">${shots.map((p, k) => `<button type="button" data-k="${k}" aria-label="Photo ${k + 1}"><img src="${esc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : '<div></div>'}`;
    document.body.appendChild(lb);
    document.body.classList.add('locked');
    const im = lb.querySelector('#lb-img');
    const paintLb = () => {
      zoom = false; im.classList.remove('zoomed'); im.style.transform = '';
      im.src = shots[i].src; im.classList.toggle('cut', shots[i].cut);
      lb.querySelector('#lb-pos').textContent = `${i + 1} / ${shots.length} · ${shots[i].cut ? 'détouré' : 'photo réelle'}`;
      lb.querySelectorAll('.lb-thumbs button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      lb.querySelector(`.lb-thumbs button[data-k="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    const go = (d) => { i = (i + d + shots.length) % shots.length; paintLb(); };
    const close = () => {
      lb.classList.remove('on'); document.body.classList.remove('locked');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => lb.remove(), 220); onClose?.(i);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'ArrowLeft') { e.stopPropagation(); go(-1); }
      if (e.key === 'ArrowRight') { e.stopPropagation(); go(1); }
    };
    document.addEventListener('keydown', onKey, true);
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.prev')?.addEventListener('click', () => go(-1));
    lb.querySelector('.next')?.addEventListener('click', () => go(1));
    lb.querySelector('.lb-thumbs')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { i = +b.dataset.k; paintLb(); } });
    // Zoom : clic sur la photo, puis la photo suit le pointeur
    im.addEventListener('click', (e) => {
      if (moved > 10) return; // c'était un glissement, pas un appui
      zoom = !zoom; im.classList.toggle('zoomed', zoom);
      if (!zoom) { im.style.transform = ''; return; }
      const r = im.getBoundingClientRect();
      im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      im.style.transform = 'scale(2.2)';
    });
    im.addEventListener('pointermove', (e) => {
      if (!zoom) return;
      const r = im.getBoundingClientRect();
      im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
    let sx = null;
    const st = lb.querySelector('.lb-stage');
    let sy = null, moved = 0;
    st.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    st.addEventListener('pointerup', (e) => {
      moved = sx == null ? 0 : Math.hypot(e.clientX - sx, e.clientY - sy);
      if (!zoom && sx != null) {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dx) < 70) close(); // glisser vers le bas : fermer
      }
      sx = sy = null;
    });
    st.addEventListener('click', (e) => { if (e.target === st) close(); });
    paintLb();
    requestAnimationFrame(() => lb.classList.add('on'));
    lb.querySelector('.lb-x').focus({ preventScroll: true });
  }

  // ---------- routage ----------
  let keyHandler = null;
  let stickObs = null;
  // « / » place le curseur dans la recherche du catalogue
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || /input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
    const q = document.getElementById('q');
    if (q) { e.preventDefault(); q.focus(); }
  });
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
  // Sur téléphone, le bandeau se cache quand on descend et revient dès qu'on remonte (plus de place pour les articles)
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    if (!mobile || document.body.classList.contains('home') || y < 120) document.body.classList.remove('hdr-hide');
    else if (y > lastY + 8) document.body.classList.add('hdr-hide');
    else if (y < lastY - 8) document.body.classList.remove('hdr-hide');
    if (Math.abs(y - lastY) > 8) lastY = y;
  }, { passive: true });
  window.addEventListener('resize', syncHeader);
  function route() {
    keyHandler = null;
    const h = location.hash;
    document.body.classList.toggle('home', !(h === '#tuto' || h === '#ecran' || h === '#aide' || h === '#catalogue' || /^#article-/.test(h)));
    const m = h.match(/^#article-(\d+)$/);
    document.getElementById('nav-tuto').setAttribute('aria-current', String(h === '#tuto'));
    if (m) {
      trackClick(Number(m[1]), 'open');
      renderArticle(Number(m[1]));
      window.scrollTo(0, 0);
    } else if (h === '#tuto') {
      renderTuto();
      window.scrollTo(0, 0);
    } else if (h === '#ecran') {
      renderHomeScreen();
      window.scrollTo(0, 0);
    } else if (h === '#aide') {
      renderBot();
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
  window.addEventListener('hashchange', () => (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? safe(() => { const t = document.startViewTransition(route); t.ready.catch(() => {}); t.finished.catch(() => {}); }) : route()));
  window.addEventListener('scroll', () => { if (location.hash === '#catalogue') catScroll = window.scrollY; }, { passive: true });

  // ---------- données ----------
  async function load() {
    try {
      const data = window.__DATA || (await (await fetch('data/articles.json', { cache: 'no-cache' })).json());
      // Par sécurité, aucun champ de prix n'est jamais lu
      const MERGE = { Vestes: 'Hauts', Sweats: 'Hauts', 'Vestes & sweats': 'Hauts', Doudounes: 'Hauts', Autres: 'Accessoires' };
      const all = (data.articles || []).filter((a) => a && a.id);
      // doublons (même lien LoveGoBuy reposté) : seul le post le plus récent est affiché
      state.dups = new Map(all.filter((a) => a.dupOf).map((a) => [a.id, a.dupOf]));
      state.articles = all.filter((a) => !a.dupOf && !a.hidden).map(({ price, ...a }) => ({ ...a, category: MERGE[a.category] || a.category }));
      state.updatedAt = data.updatedAt;
    } catch {
      state.articles = [];
    }
    // Prix relevés sur LoveGoBuy (data/prices.json) : seul prix affiché, jamais celui des posts Telegram
    try {
      const pr = window.__PRICES || (await (await fetch('data/prices.json', { cache: 'no-cache' })).json());
      state.prices = pr.items || {};
      state.pricesAt = pr.checkedAt || null;
    } catch {
      state.prices = {};
    }
    await loadTop();
    // Quel que soit le lien d'arrivée, la visite commence sur la page d'accueil,
    // sauf un lien partagé depuis une fiche (?p=ID) : il ouvre directement le produit
    const shared = Number(new URLSearchParams(location.search).get('p')) || 0;
    safe(() => history.replaceState(null, '', location.pathname));
    document.body.classList.add('home');
    renderWelcome();
    syncHeader();
    const target = state.dups?.get(shared) || shared;
    if (target && state.articles.some((a) => a.id === target)) location.hash = `article-${target}`;
  }
  load();
})();

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
        <button class="gift" type="button" id="open-promo">${icon.gift}<span>${coupon} offerts</span></button>
        <a class="tg" href="${esc(S.telegram)}" target="_blank" rel="noopener" aria-label="Canal Telegram">${icon.tg} <span class="tg-label">Canal Telegram ${esc(S.by || '')}</span></a>
      </div>
    </div></header>
    <main id="view"></main>
    <footer class="foot">
      <div class="wrap foot-in">
        <div class="foot-brand">${logo()}<b>${esc(S.name || 'Best Finds')}</b><p>Les trouvailles du canal ${esc(S.by || '')}, rangées au même endroit : photos réelles, lien LoveGoBuy direct, prix relevé sur LoveGoBuy.</p></div>
        <nav class="foot-col" aria-label="Le site"><h3>Le site</h3><a href="#catalogue">Tous les articles</a><a href="#tuto">Tuto pour commander</a><a href="#ecran">Ajouter le site sur iPhone</a><button type="button" id="foot-promo">${coupon} de coupons offerts</button><button type="button" id="foot-share">Partager le site à un ami</button></nav>
        <nav class="foot-col" aria-label="Ailleurs"><h3>Ailleurs</h3><a href="${esc(S.telegram)}" target="_blank" rel="noopener">Canal Telegram</a><a href="${esc(S.invite)}" target="_blank" rel="noopener">LoveGoBuy</a></nav>
      </div>
      <div class="wrap foot-base"><span>© ${new Date().getFullYear()} ${esc(S.name || 'Best Finds')} · ${esc(S.by || '')}</span><span>Prix indicatifs relevés sur LoveGoBuy · ils peuvent évoluer</span></div>
    </footer>
    <div class="bar" id="bar"></div>
    <div class="drawer" id="drawer" hidden>
      <div class="drawer-back" data-dx></div>
      <nav class="drawer-panel" aria-label="Menu">
        <div class="drawer-head">${logo()}<b>${esc(S.name || 'Best Finds')}</b><button class="promo-x" type="button" data-dx aria-label="Fermer le menu">${icon.close}</button></div>
        <a class="dr-link" href="#" data-dx>${icon.home}<span>Accueil</span></a>
        <a class="dr-link" href="#catalogue" data-dx data-cat="Tous">${icon.grid}<span>Tous les articles</span><small id="dr-n"></small></a>
        <div class="dr-title">Catégories</div>
        <div class="dr-cats" id="dr-cats"></div>
        <div class="dr-title">Commander</div>
        <a class="dr-link" href="#tuto" data-dx>${icon.play}<span>Tuto pour commander</span></a>
        <a class="dr-link" href="#ecran" data-dx>${icon.phone}<span>Ajouter le site sur iPhone</span></a>
        <button class="dr-link dr-gold" type="button" id="dr-promo">${icon.gift}<span>${coupon} de coupons offerts</span></button>
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
          <a class="sheet-btn" data-x href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><i class="ic-wa">${icon.wa}</i><span>WhatsApp</span></a>
          <a class="sheet-btn" data-x href="https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}" target="_blank" rel="noopener"><i class="ic-snap">${icon.snap}</i><span>Snapchat</span></a>
          <a class="sheet-btn" data-x href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><i class="ic-tg">${icon.tg}</i><span>Telegram</span></a>
          <a class="sheet-btn" data-x href="sms:?&body=${encodeURIComponent(msg)}"><i class="ic-sms">${icon.out}</i><span>SMS</span></a>
          <button type="button" class="sheet-btn" id="sh-copy"><i class="ic-copy">${icon.link}</i><span>Copier le lien</span></button>
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
        <a class="sub" href="#tuto">${icon.play} Tuto pour commander</a>
        <button class="sub" type="button" id="share-site">${icon.share} Partager le site</button>
      </div>

      ${catList.length ? `<section class="wrap block reveal">
        <div class="block-head"><h2>Catégories</h2></div>
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
    view.querySelector('#share-site').addEventListener('click', () => shareThis({
      title: 'Partage ce site à un ami',
      text: `Regarde ce site : toutes les trouvailles LoveGoBuy du canal ${S.by || ''}, avec les vraies photos et les prix 👀`,
      url: siteUrl(),
    }));
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
  // Étapes de la vidéo (secondes de début), lues sur la vidéo tuto_lovegobuy
  const CHAPTERS = [
    [0, 'Introduction'],
    [6, 'Créer ton compte avec le lien'],
    [12, 'Récupérer tes coupons'],
    [18, 'Choisir ton article dans le canal'],
    [24, 'Coller le lien dans LoveGoBuy'],
    [30, 'Acheter ou ajouter au panier'],
    [34, 'Ajouter ton adresse'],
    [40, 'Choisir ce que tu expédies'],
    [49, 'Le conseil : séparer les catégories'],
    [62, 'Payer moins cher la livraison'],
    [70, 'Choisir la livraison'],
    [74, 'Choisir le mode de paiement'],
    [80, "C'est tout !"],
  ];
  function renderTuto() {
    resetChrome();
    document.title = `Tuto pour commander · ${S.name || 'Finds'}`;
    const t = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    view.innerHTML = `
      <section class="wrap tuto">
        <header class="tuto-head">
          <span class="eyebrow">Tuto vidéo · 1 min 30</span>
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
            <div class="pl-step" aria-hidden="true"><span id="pl-step"></span></div>
            <div class="pl-bar">
              <button type="button" class="pl-btn" id="pl-play" aria-label="Lire">${icon.play}</button>
              <input type="range" id="pl-seek" min="0" max="89" step="0.1" value="0" aria-label="Position dans la vidéo">
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
    const stepLabel = view.querySelector('#pl-step');
    stepLabel.textContent = `1/${CHAPTERS.length} · ${CHAPTERS[0][1]}`;
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
      let cur = 0;
      CHAPTERS.forEach(([sec], k) => { if (v.currentTime >= sec) cur = k; });
      if (items[cur]?.getAttribute('aria-current') !== 'true') {
        items.forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
        stepLabel.textContent = `${cur + 1}/${CHAPTERS.length} · ${CHAPTERS[cur][1]}`;
        // sur téléphone, la liste suit l'étape en cours sans faire défiler la page
        const list = items[cur].closest('.chapters');
        if (list && list.scrollHeight > list.clientHeight) list.scrollTo({ top: items[cur].offsetTop - list.clientHeight / 2, behavior: 'smooth' });
      }
    });
    items.forEach((b) => b.addEventListener('click', () => {
      v.currentTime = Number(b.dataset.t); v.play().catch(() => {});
      // sur téléphone la vidéo est au-dessus de la liste : on remonte jusqu'à elle
      if (matchMedia('(max-width: 760px)').matches) player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  // ---------- tuto : ajouter le site sur l'écran d'accueil de l'iPhone ----------
  // Illustrations dessinées en HTML (aucune capture d'écran) : un iPhone simplifié, le bouton à toucher entouré
  const phone = (screen, cls = '') => `<div class="mock ${cls}" aria-hidden="true"><div class="mock-notch"></div><div class="mock-screen">${screen}</div></div>`;
  const safariBar = (hl) => `<div class="mk-bar"><span class="mk-url">🔒 best-finds-vytoxx.github.io</span><span class="mk-dots ${hl ? 'hl' : ''}">•••</span></div>`;
  const sitePage = `<div class="mk-site"><img src="${IMG.bannerMobile}" alt=""><div class="mk-site-btn"></div><div class="mk-grid"><i></i><i></i><i></i><i></i></div></div>`;
  function renderHomeScreen() {
    resetChrome();
    document.title = `Ajouter le site sur iPhone · ${S.name || 'Finds'}`;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ua = navigator.userAgent;
    const inApp = /Instagram|FBAN|FBAV|Telegram|Snapchat|TikTok|Line\/|GSA\//i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const notSafari = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    const steps = [
      ['Ouvre le site dans Safari', `Le site doit être ouvert dans <b>Safari</b>, le navigateur de l'iPhone. Si tu l'as ouvert depuis Telegram, Instagram ou Snapchat, choisis « Ouvrir dans Safari » dans le menu de l'appli (ou copie le lien et colle-le dans Safari).`,
        phone(`${sitePage}${safariBar(false)}`)],
      ['Touche les trois points « ••• »', `En bas de l'écran, à droite de l'adresse du site, touche <b>•••</b>, puis <b>Partager</b>.<br><span class="hs-note">Sur un iPhone qui n'est pas à jour, touche directement le bouton Partager (le carré avec une flèche vers le haut), en bas au milieu.</span>`,
        phone(`${sitePage}<div class="mk-pop"><span>Ajouter aux favoris</span><span>Nouvel onglet</span><span class="hl">${icon.share} Partager</span></div>${safariBar(true)}`)],
      ["Touche « Sur l'écran d'accueil »", `Dans le menu qui s'ouvre, fais défiler vers le bas et touche <b>Sur l'écran d'accueil</b>.<br><span class="hs-note">Tu ne le vois pas ? Touche « Plus » ou « Modifier les actions » tout en bas pour l'afficher.</span>`,
        phone(`<div class="mk-sheet"><div class="mk-share-head"><span class="mk-ic"></span><span><b>Best Finds</b><small>best-finds-vytoxx.github.io</small></span></div><div class="mk-apps"><i></i><i></i><i></i><i></i></div><div class="mk-list"><span>Copier ${icon.link}</span><span>Ajouter aux favoris</span><span class="hl">Sur l'écran d'accueil ${icon.plusSq}</span><span>Imprimer</span></div></div>`)],
      ['Touche « Ajouter »', `Laisse le nom <b>Best Finds</b> et l'option <b>Ouvrir en tant qu'app web</b> activée, puis touche <b>Ajouter</b> en haut à droite.`,
        phone(`<div class="mk-add"><div class="mk-add-top"><span>Annuler</span><b>Ajouter à l'écran</b><span class="hl">Ajouter</span></div><div class="mk-add-row"><img src="${IMG.logo}" alt=""><span><b>Best Finds</b><small>best-finds-vytoxx.github.io</small></span></div><div class="mk-toggle"><span>Ouvrir en tant qu'app web</span><i></i></div></div>`)],
      ["C'est fait !", `Le panda <b>Best Finds</b> est sur ton écran d'accueil. Touche-le : le site s'ouvre en plein écran, comme une vraie appli, toujours à jour avec les derniers articles du canal.`,
        phone(`<div class="mk-home">${Array.from({ length: 11 }, () => '<i></i>').join('')}<span class="mk-app hl"><img src="${IMG.logo}" alt=""><small>Best Finds</small></span>${Array.from({ length: 4 }, () => '<i></i>').join('')}</div>`, 'mock-home')],
    ];
    view.innerHTML = `
      <section class="wrap tuto hs">
        <header class="tuto-head">
          <span class="eyebrow">Tuto iPhone · 30 secondes</span>
          <h1>Le site sur ton écran d'accueil, comme une appli</h1>
          <p class="lead">Une icône Best Finds à côté de tes applis : un appui et tu retrouves toutes les trouvailles, sans chercher le lien.</p>
          ${standalone ? `<p class="hs-ok">${icon.check} C'est déjà fait : tu utilises le site depuis ton écran d'accueil.</p>` : ''}
          ${!standalone && (inApp || notSafari) ? `<div class="hs-warn"><b>Tu n'es pas dans Safari</b><span>Copie le lien, ouvre Safari et colle-le dans la barre d'adresse, puis suis les étapes.</span><button class="sub" type="button" id="hs-copy">${icon.link} Copier le lien du site</button></div>` : ''}
        </header>
        <ol class="hs-steps">${steps.map(([t, txt, pic], k) => `<li class="hs-step reveal">
          <div class="hs-pic">${pic}</div>
          <div class="hs-txt"><span class="hs-n">${k + 1}</span><h2>${t}</h2><p>${txt}</p></div>
        </li>`).join('')}</ol>
        <p class="hs-android"><b>Sur Android ?</b> Dans Chrome, touche les trois points en haut à droite, puis « Ajouter à l'écran d'accueil » (ou « Installer l'application »).</p>
        <div class="tuto-cta">
          <a class="buy" href="#catalogue">Voir les articles ${icon.right}</a>
          <a class="sub" href="#tuto">${icon.play} Tuto pour commander</a>
        </div>
      </section>`;
    reveal();
    view.querySelector('#hs-copy')?.addEventListener('click', async (e) => {
      const b = e.currentTarget, url = siteUrl();
      try { await navigator.clipboard.writeText(url); b.innerHTML = `${icon.check} Lien copié`; } catch { b.textContent = url; }
    });
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
      text: `Regarde ça : ${a.title}${lgb ? ` à ${eur(lgb.eur)}` : ''} sur ${S.name || 'Best Finds'}`,
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
    document.body.classList.toggle('home', !(h === '#tuto' || h === '#ecran' || h === '#catalogue' || /^#article-/.test(h)));
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
      state.articles = all.filter((a) => !a.dupOf).map(({ price, ...a }) => ({ ...a, category: MERGE[a.category] || a.category }));
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
    view.querySelector('.banner img')?.addEventListener('load', syncHeader);
  }
  load();
})();

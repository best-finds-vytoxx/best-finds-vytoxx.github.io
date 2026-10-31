// Lecture d'une page publique t.me/s/<canal> et extraction des articles.
// Fonctions pures : aucun accès réseau ici, pour pouvoir tester sur des fixtures.
import * as cheerio from 'cheerio';

const decode = (s) => {
  // Les href Telegram sont parfois doublement encodés (&amp;amp;)
  let t = s || '';
  for (let i = 0; i < 3; i++) t = t.replace(/&amp;/g, '&');
  return t
    .replace(/&#0*36;/g, '$')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
};

/** Extrait les messages bruts d'une page HTML t.me/s/... */
export function parseMessages(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('.tgme_widget_message[data-post]').each((_, el) => {
    const m = $(el);
    const id = Number(String(m.attr('data-post')).split('/')[1]);
    if (!id) return;

    // Le texte propre du message : pas celui de la citation (réponse), pas un div imbriqué
    const textEl = m
      .find('.js-message_text')
      .filter((_, e) => $(e).closest('.tgme_widget_message_reply').length === 0)
      .filter((_, e) => $(e).parent().closest('.js-message_text').length === 0)
      .first();

    let text = '';
    const links = [];
    if (textEl.length) {
      textEl.find('i.emoji').each((_, e) => { $(e).replaceWith($(e).text()); });
      const inner = textEl.html() || '';
      text = decode(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/ /g, ' ').trim();
      textEl.find('a[href]').each((_, a) => links.push({ label: $(a).text().trim(), href: decode($(a).attr('href')) }));
    }

    const photos = [];
    m.find('.tgme_widget_message_photo_wrap').each((_, a) => {
      const style = $(a).attr('style') || '';
      const u = style.match(/background-image:\s*url\(\s*['"]?(.*?)['"]?\s*\)/);
      if (u) photos.push(u[1].startsWith('//') ? 'https:' + u[1] : u[1]);
    });

    const views = m.find('.tgme_widget_message_views').first().text().trim();
    out.push({
      id,
      date: m.find('.tgme_widget_message_date time').attr('datetime') || null,
      text,
      links,
      photos,
      views,
    });
  });
  return out;
}

/** Plus petit id présent sur la page (pour paginer avec ?before=) */
export const minId = (msgs) => (msgs.length ? Math.min(...msgs.map((m) => m.id)) : null);

/** Infos du canal (nom, avatar, description) */
export function parseChannel(html) {
  const $ = cheerio.load(html);
  return {
    title: $('.tgme_channel_info_header_title').first().text().trim() || null,
    avatar: $('.tgme_page_photo_image img').first().attr('src') || null,
    subscribers: $('.tgme_channel_info_counter .counter_value').first().text().trim() || null,
  };
}

const BRANDS = [
  'Canada Goose', 'Moncler', 'Parajumpers', 'Stone Island', 'C.P. Company', 'C.P Company', 'CP Company', 'The North Face', "Arc'teryx", 'Arcteryx',
  'Louis Vuitton', 'Ralph Lauren', 'Under Armour', 'New Balance', 'Fear of God', 'Essentials', 'Nocta', 'Travis Scott', 'Nike', 'Jordan', 'Adidas',
  'Dior', 'Celine', 'Céline', 'Burberry', 'Prada', 'Gucci', 'Balenciaga', 'Courreges', 'Courrèges', 'Blauer', 'Stanley', 'Boss',
  'Lacoste', 'Carhartt', 'Stüssy', 'Stussy', 'Corteiz', 'Trapstar', 'Supreme', 'Alo', 'Lululemon', 'Chrome Hearts', 'Off-White',
  'Amiri', 'Represent', 'Hellstar', 'Sp5der', 'Denim Tears', 'Salomon', 'Asics', 'Mizuno', 'Yeezy', 'Vivienne Westwood', 'Loewe', 'Miu Miu',
  'Bottega Veneta', 'Hermès', 'Hermes', 'Chanel', 'Saint Laurent', 'Givenchy', 'Valentino', 'Versace', 'Fendi', 'Rolex', 'Cartier',
  'Audemars Piguet', 'Audemar', 'Swatch', 'Crocs', 'Birkenstock', 'Casablanca', 'Gallery Dept', 'Syna World', 'Syna', 'Cole Buxton',
  'Palm Angels', 'Maison Margiela', 'Margiela', 'Sprayground', 'SprayGround', 'Calvin Klein', 'Godspeed', 'Purple Brand', 'Purple', 'Acne Studios', 'Acne Studio',
  'Bape', 'Rhude', 'Numeris', 'Ray-Ban', 'Golden Goose', 'Goyard', 'Comme des Garçons', 'Saucony', 'Ermenegildo Zegna', 'Zegna', 'Loro Piana',
  'Van Cleef', 'Alhambra', 'Bvlgari', 'Bulgari', 'LV', 'UA', 'The North', 'AirPods', 'Swarovski',
  'Apple', 'Dyson', 'JBL', 'Sweet Pants', 'Goodbrand', 'Amir', 'Ugg', 'UGG', 'Timberland', 'Ami', 'Polo', 'Oakley', 'Moose Knuckles', 'Ralph',
];
const CANON = {
  'C.P Company': 'C.P. Company', 'CP Company': 'C.P. Company', Arcteryx: "Arc'teryx", Céline: 'Celine', Courrèges: 'Courreges',
  Stussy: 'Stüssy', Hermes: 'Hermès', UGG: 'Ugg', Polo: 'Ralph Lauren', Ralph: 'Ralph Lauren', Audemar: 'Audemars Piguet', Syna: 'Syna World', Ami: 'AMI',
  Margiela: 'Maison Margiela', SprayGround: 'Sprayground', Purple: 'Purple Brand', 'Acne Studio': 'Acne Studios', Zegna: 'Ermenegildo Zegna',
  'Ermenegildo Zegna': 'Ermenegildo Zegna', Alhambra: 'Van Cleef & Arpels', 'Van Cleef': 'Van Cleef & Arpels', Bulgari: 'Bvlgari', LV: 'Louis Vuitton',
  UA: 'Under Armour', 'The North': 'The North Face', AirPods: 'Apple', Amir: 'Amiri', Goodbrand: 'Goodbrand',
};

export function detectBrand(title) {
  if (/\bOn\b/.test(title) && /\b(On Running|On Core|On Weather|sport On|Gilet On|Veste On|Pantalon On|Short On|Chaussures On|T-shirt On)\b/i.test(title)) return 'On';
  for (const b of BRANDS) {
    const re = new RegExp(`(^|[^\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu');
    if (re.test(title)) return CANON[b] || b;
  }
  if (/\bOn\b/.test(title)) return 'On';
  return null;
}

const CATEGORIES = [
  ['Doudounes', /doudoune|parka|puffer|down jacket|pjs|macmillan|mac millan/i],
  ['Vestes', /veste|blouson|coupe[\s-]?vent|jacket|windbreaker|windrunner|storm-fit|gilet|manteau|coat|polaire|fleece jacket/i],
  ['Sweats', /sweat(?!\s*pants)|hoodie|\bhood\b|capuche|hooded|pull|crewneck|tech fleece|nike tech|cardigan|demi-zip|half-zip/i],
  ['Hauts', /t-?shirt|\btee\b|polo\b|chemise|shirt|maillot|débardeur|\btop\b|\bhaut\b|dri-fit/i],
  ['Bas', /pantalon|jogging|jogger|short|jeans?\b|pants?\b|legging|cargo|caleçons?|boxers?/i],
  ['Ensembles', /ensemble|survêtement|tracksuit|\bsets?\b|sportswear|running|run division/i],
  ['Chaussures', /chaussure|sneakers?|baskets?|shoes?\b|boots?\b|botte|\btn\b|air max|air force|shox|p6000|jordan|dunk|samba|claquette|slide|sabot|crocs|9060|1906|jumpman|escarpins?|sandales?|mules?|mocassins?|runner|trainer|tennis walk|golden goose|yeezy \d|dior b\d|cloud\w*|gel-|kayano|xt-6|saucony|asics|numeris/i],
  ['Électronique', /casque(?!tte)|airpods|écouteurs?|ecouteurs?|enceinte|bluetooth|\bjbl\b|\bbeats\b|chargeur|power ?bank|batterie externe|console|manette|apple watch|montre connectée|iphone|ipad|sèche-cheveux|seche-cheveux|dyson|lisseur|boucleur|rasoir|tondeuse/i],
  ['Accessoires', /bonnet|écharpe|echarpe|scarf|casquette|\bcaps?\b|\bhat\b|beanie|gants?|ceinture|lunettes|glasses|sacs?\b|\bbags?\b|bowling|cisalpin|sprayground|portefeuille|porte-cartes|wallet|bracelet|collier|bague|montres?\b|watch|chrono|gourde|tumbler|quencher|chaussettes|socks|coque|goyard/i],
];

export function detectCategory(title) {
  // Le mot-clé le plus proche du début du titre désigne le type d'article
  // ("Short Nocta Tech Fleece" = un short, "Écharpe Polo Ralph Lauren" = une écharpe)
  const t = title.toLowerCase().replace(/[\u2010-\u2013]/g, '-').replace(/sweet pants/g, ' '); // « Sweet Pants » : une marque
  if (/hooded and pant|hoodie and pant|\bset\b/i.test(t)) return 'Ensembles';
  // haut ET bas proposés ensemble (« Veste / Pantalon », « T-shirt / Shorts », « t-shirt shorts suit ») : un ensemble
  const top = CATEGORIES.slice(0, 4).some(([, re]) => re.test(t)), bottom = CATEGORIES[4][1].test(t);
  if (top && bottom && /\/|\+|\band\b|\bet\b|\bsuit\b/.test(t)) return 'Ensembles';
  let best = null;
  for (const [name, re] of CATEGORIES) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { name, index: m.index };
  }
  return best ? best.name : 'Autres';
}

// Catégories regroupées sur le site : Hauts, Bas, Chaussures, Ensembles, Électronique, Accessoires
export const MERGE = { Vestes: 'Hauts', Sweats: 'Hauts', Doudounes: 'Hauts', Autres: 'Accessoires' };

const num = (s) => Number(String(s).replace(',', '.'));

/** Poids : "330g", "~ 514-660g", "156~228 g", "1,2 kg" → { min, max } en grammes */
export function parseWeight(text) {
  const m = text.match(/Poids\s*[:：]\s*~?\s*([\d.,]+)\s*(?:[-–~à]\s*([\d.,]+))?\s*(kg|g)\b/i);
  if (!m) return null;
  const k = m[3].toLowerCase() === 'kg' ? 1000 : 1;
  const min = Math.round(num(m[1]) * k), max = m[2] ? Math.round(num(m[2]) * k) : null;
  return { min, max: max && max !== min ? max : null };
}

/** Titre propre : espaces, &nbsp;, majuscule initiale */
export function cleanTitle(raw) {
  const t = raw.replace(/^🔍\s*/, '').replace(/[\u2010-\u2013]/g, '-').replace(/❗️|‼️|❗/g, '').replace(/[ \s]+/g, ' ').replace(/\s*([/])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Toute ligne qui parle d'argent est écartée : aucun prix ne doit sortir du post
const MONEY = /prix|€|\$|eur\b|euros?|usd|cny|¥|tarif|promo|coupon|réduc/i;
const PROMO = /best spreadsheet|lien lovegobuy|inscri|canal de chat|groupe|poids\s*[:：]|https?:\/\//i;

const TYPE_WORD = {
  Doudounes: 'une doudoune', Vestes: 'une veste', Sweats: 'un sweat', Hauts: 'un haut', Bas: 'un bas',
  Ensembles: 'un ensemble', Chaussures: 'une paire de chaussures', Électronique: 'un appareil électronique', Accessoires: 'un accessoire', Autres: 'un article',
};

function fmtWeight(w) {
  if (!w) return null;
  const f = (g) => (g >= 1000 ? `${(g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg` : `${g} g`);
  return w.max ? `entre ${f(w.min)} et ${f(w.max)}` : f(w.min);
}

// Aucun prix n'est écrit sur le site : il est affiché sur LoveGoBuy
export const PRICE_NOTE = 'Le prix, les tailles, les coloris et la disponibilité sont affichés directement sur la page LoveGoBuy.';
export const TYPE_WORDS = TYPE_WORD;

// Montant des coupons offerts à l'inscription (même valeur que « coupon » dans assets/config.js)
export const COUPON = '500 €';
export const SHIPPING_NOTE = `Ce prix de livraison peut être diminué grâce aux ${COUPON} de coupons offerts à l'inscription sur LoveGoBuy.`;
export const DOWN_NOTE = "Le rembourrage est en duvet d'oie.";
// Doudounes uniquement (pas les gilets ni les vestes) : titre ou type précis
const isDoudoune = (title, category) => category === 'Doudounes' || /doudoune|puffer|down jacket|veste down|blouson de duvet|\bpjs\b|macmillan|mac millan/i.test(title || '');

/** Description lisible, construite uniquement avec ce que dit le post (jamais de prix d'article). */
export function describe({ title, brand, category, weight, photoCount, extra }) {
  const parts = [];
  const word = TYPE_WORD[category] || 'un article';
  parts.push(`${title}${brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `, de la marque ${brand}` : ''} : ${word} ${word.startsWith('une ') ? 'sélectionnée' : 'sélectionné'} sur le canal.`);
  if (photoCount > 1) parts.push(`Les ${photoCount} photos sont les photos exactes de cet article, prises par l'équipe Vytoxx : étiquettes et détails compris.`);
  else if (photoCount === 1) parts.push(`La photo est la photo exacte de cet article, prise par l'équipe Vytoxx.`);
  if (isDoudoune(title, category)) parts.push(DOWN_NOTE);
  if (weight) parts.push(`Poids affiché : ${fmtWeight(weight)}${weight.max ? ' (selon la taille ou le modèle)' : ''}. Il permet d'estimer le prix de la livraison.`);
  else parts.push(`Le poids, sur la page LoveGoBuy, permet d'estimer le prix de la livraison.`);
  parts.push(SHIPPING_NOTE);
  if (extra) parts.push(extra);
  parts.push(PRICE_NOTE);
  return parts.join(' ');
}

/**
 * Texte libre du post (ce qui n'est pas généré) retrouvé dans une ancienne description,
 * pour reconstruire la description d'un article déjà sur le site avec les nouvelles phrases.
 */
export function extraFrom(description) {
  return String(description || '')
    .replace(/^.*? sélectionnée? sur le canal\.\s*/, '')
    .replace(/\d+ photos de contrôle prises par l'équipe montrent l'article réel, étiquettes et détails compris\.\s*/, '')
    .replace(/La photo de contrôle montre l'article réel\.\s*/, '')
    .replace(/Les \d+ photos sont les photos exactes de cet article[^.]*\.\s*/, '')
    .replace(/La photo est la photo exacte de cet article[^.]*\.\s*/, '')
    .replace(DOWN_NOTE, '')
    .replace(/Poids indiqué : [^.]*?estimer la livraison( \([^)]*\))?\.\s*/, '')
    .replace(/Poids affiché : [^.]*\. Il permet d'estimer le prix de la livraison\.\s*/, '')
    .replace(/Le poids, sur la page LoveGoBuy, permet d'estimer le prix de la livraison\.\s*/, '')
    .replace(SHIPPING_NOTE, '')
    .replace(/Tailles, coloris et disponibilité sont à choisir directement sur la page LoveGoBuy\.\s*/, '')
    .replace(PRICE_NOTE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Transforme les messages en articles (posts qui commencent par 🔍) */
export function toArticles(messages, channel = 'lovegobuy_france') {
  // Un même message peut apparaître sur deux pages (album coupé en bord de page) : on garde la version la plus complète
  const byId = new Map();
  for (const m of messages) {
    const prev = byId.get(m.id);
    if (!prev || m.photos.length + m.text.length > prev.photos.length + prev.text.length) byId.set(m.id, m);
  }
  const list = [...byId.values()].sort((a, b) => a.id - b.id);
  const articles = [];
  list.forEach((m, i) => {
    if (!m.text.replace(/^\s+/, '').startsWith('🔍')) return;

    // Photos : dans le message lui-même, sinon dans l'album posté juste avant (sans texte, < 10 min)
    let photos = m.photos;
    if (!photos.length) {
      const prev = list[i - 1];
      if (prev && !prev.text && prev.photos.length && Math.abs(new Date(m.date) - new Date(prev.date)) < 10 * 60e3) photos = prev.photos;
    }

    const lines = m.text.split('\n').map((l) => l.trim());
    const title = cleanTitle(lines[0]);
    const brand = detectBrand(title);
    const kind = detectCategory(title); // type précis (pour la description)
    const category = MERGE[kind] || kind; // catégorie affichée sur le site
    const weight = parseWeight(m.text);
    // Lien de l'article : celui intitulé « lien LoveGoBuy » (certains posts ont un autre lien produit avant, sur l'emoji 🔗)
    const products = m.links.filter((l) => /lovegobuy\.com\/product/i.test(l.href));
    const lgb = products.find((l) => /lien/i.test(l.label || '')) || products[products.length - 1];
    let shop = null, productId = null;
    if (lgb) {
      try {
        const u = new URL(lgb.href);
        shop = u.searchParams.get('shop_type');
        productId = u.searchParams.get('id');
      } catch {}
    }

    // Lignes libres du post (hors titre, poids, liens et tout ce qui parle d'argent)
    const extra = lines.slice(1).filter((l) => l && !PROMO.test(l) && !MONEY.test(l)).join(' ').replace(/\s+/g, ' ').trim();

    articles.push({
      id: m.id,
      title,
      brand,
      category,
      type: kind, // type précis (Vestes, Doudounes, Sweats…) : sert au choix de la photo de face
      weight,
      extra: extra || null, // texte libre du post, gardé pour reconstruire la description
      description: describe({ title, brand, category: kind, weight, photoCount: photos.length, extra }),
      link: lgb ? lgb.href : null,
      shop,
      productId,
      date: m.date,
      views: m.views || null,
      telegram: `https://t.me/${channel}/${m.id}`,
      photosRemote: photos,
    });
  });
  return articles;
}

/**
 * Doublons : articles qui pointent vers le même produit LoveGoBuy (même lien, post repartagé).
 * Le plus récent est gardé ; les autres reçoivent dupOf = id du post gardé (le site ne les affiche pas).
 * known : Map id → article (modifiée sur place). Renvoie le nombre d'articles masqués.
 */
export function markDuplicates(known) {
  const keep = new Map();
  for (const a of known.values()) {
    if (!a.productId) continue;
    const k = `${a.shop || ''}:${a.productId}`;
    if (!keep.has(k) || keep.get(k) < a.id) keep.set(k, a.id);
  }
  let n = 0;
  for (const [id, a] of known) {
    const k = a.productId ? `${a.shop || ''}:${a.productId}` : null;
    const winner = k ? keep.get(k) : null;
    const dupOf = winner && winner !== a.id ? winner : null;
    if (dupOf) n++;
    if ((a.dupOf || null) !== dupOf) {
      const { dupOf: _, ...rest } = a;
      known.set(id, dupOf ? { ...rest, dupOf } : rest);
    }
  }
  return n;
}

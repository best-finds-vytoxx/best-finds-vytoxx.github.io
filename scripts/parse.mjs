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
  'Apple', 'Dyson', 'Ugg', 'UGG', 'Timberland', 'Ami', 'Polo', 'Oakley', 'Moose Knuckles', 'Ralph',
];
const CANON = {
  'C.P Company': 'C.P. Company', 'CP Company': 'C.P. Company', Arcteryx: "Arc'teryx", Céline: 'Celine', Courrèges: 'Courreges',
  Stussy: 'Stüssy', Hermes: 'Hermès', UGG: 'Ugg', Polo: 'Ralph Lauren', Ralph: 'Ralph Lauren', Audemar: 'Audemars Piguet', Syna: 'Syna World', Ami: 'AMI',
  Margiela: 'Maison Margiela', SprayGround: 'Sprayground', Purple: 'Purple Brand', 'Acne Studio': 'Acne Studios', Zegna: 'Ermenegildo Zegna',
  'Ermenegildo Zegna': 'Ermenegildo Zegna', Alhambra: 'Van Cleef & Arpels', 'Van Cleef': 'Van Cleef & Arpels', Bulgari: 'Bvlgari', LV: 'Louis Vuitton',
  UA: 'Under Armour', 'The North': 'The North Face', AirPods: 'Apple',
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
  ['Accessoires', /bonnet|écharpe|echarpe|scarf|casquette|\bcaps?\b|\bhat\b|beanie|gants?|ceinture|lunettes|glasses|sacs?\b|\bbags?\b|bowling|cisalpin|sprayground|portefeuille|porte-cartes|wallet|bracelet|collier|bague|montres?\b|watch|chrono|gourde|tumbler|quencher|chaussettes|socks|coque|airpods|goyard/i],
];

export function detectCategory(title) {
  // Le mot-clé le plus proche du début du titre désigne le type d'article
  // ("Short Nocta Tech Fleece" = un short, "Écharpe Polo Ralph Lauren" = une écharpe)
  const t = title.toLowerCase().replace(/[\u2010-\u2013]/g, '-').replace(/sweet pants/g, ' '); // « Sweet Pants » : une marque
  if (/hooded and pant|hoodie and pant|\bset\b/i.test(t)) return 'Ensembles';
  let best = null;
  for (const [name, re] of CATEGORIES) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.index)) best = { name, index: m.index };
  }
  return best ? best.name : 'Autres';
}

// Catégories regroupées sur le site : Hauts, Bas, Accessoires, Ensembles
export const MERGE = { Vestes: 'Hauts', Sweats: 'Hauts', Doudounes: 'Hauts', Chaussures: 'Accessoires', Autres: 'Accessoires' };

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
  Ensembles: 'un ensemble', Chaussures: 'une paire de chaussures', Accessoires: 'un accessoire', Autres: 'un article',
};

function fmtWeight(w) {
  if (!w) return null;
  const f = (g) => (g >= 1000 ? `${(g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg` : `${g} g`);
  return w.max ? `entre ${f(w.min)} et ${f(w.max)}` : f(w.min);
}

/** Description lisible, construite uniquement avec ce que dit le post (jamais de prix). */
export function describe({ title, brand, category, weight, photoCount, extra }) {
  const parts = [];
  parts.push(`${title}${brand && !title.toLowerCase().includes(brand.toLowerCase()) ? `, de la marque ${brand}` : ''} : ${TYPE_WORD[category] || 'un article'} sélectionné sur le canal.`);
  if (photoCount > 1) parts.push(`${photoCount} photos de contrôle prises par l'équipe montrent l'article réel, étiquettes et détails compris.`);
  else if (photoCount === 1) parts.push(`La photo de contrôle montre l'article réel.`);
  if (weight) parts.push(`Poids indiqué : ${fmtWeight(weight)}, à prendre en compte pour estimer la livraison${weight.max ? ' (le poids varie selon la taille ou le modèle)' : ''}.`);
  if (extra) parts.push(extra);
  parts.push(`Tailles, coloris et disponibilité sont à choisir directement sur la page LoveGoBuy.`);
  return parts.join(' ');
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
    const lgb = m.links.find((l) => /lovegobuy\.com\/product/i.test(l.href));
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

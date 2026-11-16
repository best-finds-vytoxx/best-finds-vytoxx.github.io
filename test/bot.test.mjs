// Tests du chat bot : des questions telles que les gens les écrivent (fautes, SMS, tournures variées)
// et la réponse attendue. « ? id » = le bot doit demander en proposant au moins cette réponse.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = { SITE: { coupon: '500 €' } };
vm.runInNewContext(readFileSync(new URL('../assets/bot.js', import.meta.url), 'utf8'), { window });
const { answer } = window.VXBOT;

const CASES = [
  // trouver un article
  ['je trouve pas un article', 'search'], ['ou je peux trouver des jordan 4 ?', 'search'], ['vous avez le lien des air force ?', 'search'],
  ["l'article est plus dispo", 'search'], ['comment je fais pour trouver un produit qui est pas sur le site', 'search'], ['tu as le lien de la veste stone island', 'search'],
  // délais
  ['combien de temps pour recevoir ma commande', 'delai'], ['cb de tps la livraison', 'delai'], ['quand est-ce que je vais recevoir mon colis ?', 'delai'],
  ['ça met combien de jours à arriver ?', 'delai'], ['les délais de livraison ?', 'delai'], ['en combien de temps ça arrive en France', 'delai'], ['c long a arriver ?', 'delai'],
  // suivi
  ['comment suivre mon colis', 'suivi'], ['ou est mon colis ?', 'suivi'], ['je trouve pas le numéro de suivi', 'suivi'], ['ou je vois le tracking', 'suivi'], ["c'est quoi aftership", 'suivi'],
  // colis bloqué
  ['mon colis bouge plus depuis 5 jours', 'bloque'], ["le suivi n'avance pas c'est normal ?", 'bloque'], ['mon colis est bloqué', 'bloque'], ['toujours le même statut depuis une semaine', 'bloque'],
  // prix de la livraison
  ['combien coûte la livraison ?', 'prixlivr'], ['c cher la livraison ?', 'prixlivr'], ['prix pour envoyer 2 kg', 'prixlivr'], ['les frais de port sont de combien', 'prixlivr'],
  ['combien je vais payer pour 3 pulls', 'prixlivr'], ['comment estimer le prix de mon colis', 'prixlivr'], ['combien pèse une paire de chaussures', 'prixlivr'],
  // colis d'essai
  ["c'est quoi le colis d'essai", 'essai'], ['le vacuum pack ça sert à quoi', 'essai'], ['mise sous vide ?', 'essai'],
  // coupons
  ['comment avoir les 500€', 'coupons'], ['comment récupérer mes coupons', 'coupons'], ["j'ai pas reçu les 485 euros", 'coupons'], ['vous avez un code promo ?', 'coupons'],
  ['comment créer un compte', 'coupons'], ['je peux utiliser 2 coupons sur un colis ?', 'coupons'],
  // remboursement
  ['comment me faire rembourser', 'rembours'], ['je veux annuler ma commande', 'rembours'], ['le vendeur a pas envoyé mon article je peux être remboursé', 'rembours'], ['remboursser', 'rembours'],
  // QC
  ['je vois pas mes QC', 'qc'], ['les photos de contrôle arrivent quand', 'qc'], ["je n'ai pas les photos de l'entrepôt", 'qc'],
  // messages de l'appli
  ['need to recharge ça veut dire quoi', 'message'], ["c'est quoi apply cancel", 'message'], ['mon colis est fermé', 'message'],
  // confiance
  ['lovegobuy c fiable ?', 'fiable'], ["c'est une arnaque ?", 'fiable'], ["c'est sérieux comme site ?", 'fiable'], ['on peut avoir confiance', 'fiable'],
  // ligne
  ['quelle ligne choisir', 'ligne'], ['dhl ou dpd ?', 'ligne'], ['quel transporteur prendre', 'ligne'],
  // taille
  ['quelle taille je prends', 'taille'], ['ça taille petit ?', 'taille'], ['je fais du 42 quelle pointure', 'taille'],
  // stockage
  ["combien de temps mes articles restent à l'entrepôt", 'stockage'], ['le stockage est gratuit ?', 'stockage'], ["je peux attendre avant d'envoyer mon colis ?", 'stockage'],
  // service client
  ['comment contacter le service client', 'contact'], ['je veux parler à quelqu’un', 'contact'], ['comment ouvrir un ticket', 'contact'],
  // commander
  ['comment commander', 'commander'], ["comment ça marche pour acheter", 'commander'], ["c'est ma première commande", 'commander'], ['comment passer commande sur lovegobuy', 'commander'],
  // même article que les photos
  ['je vais recevoir la même chose que sur la photo ?', 'memephoto'], ['les photos sont réelles ?', 'memephoto'],
  // paiement
  ['comment payer', 'payer'], ['on peut payer avec paypal ?', 'payer'], ['je peux payer par carte', 'payer'],
  // prix du site
  ['le prix affiché est le bon ?', 'prixsite'], ["le prix a changé sur lovegobuy", 'prixsite'],
  // séparer
  ["pourquoi séparer l'électronique", 'separer'], ['je peux mettre un parfum avec mes vêtements', 'separer'],
  // écran d'accueil
  ["comment mettre le site sur mon écran d'accueil", 'ecran'], ["il y a une appli du site ?", 'ecran'],
  // douane (saisie)
  ['mon colis peut être saisi ?', 'douane'], ['risque que la douane bloque mon colis', 'douane'],
  // politesse
  ['salut', 'talk'], ['bonjour', 'talk'], ['merci beaucoup', 'talk'], ['ok merci', 'talk'], ['t es un robot ?', 'talk'],
  // sujets écartés : renvoi au groupe
  ["c'est des reps ?", 'aside'], ['je vais payer des taxes ?', 'aside'], ['mieux que vinted ?', 'aside'], ['et hacoo ?', 'aside'],
  // trop vague : le bot demande
  ['livraison', '? delai'], ['colis', '?'],
  // tournures moins évidentes
  ['tu peux m aider', 'talk'], ['merci pour ton aide', 'talk'], ['merci mais combien coute la livraison ?', 'prixlivr'], ['comment je récupère mon argent', 'rembours'],
  ["c'est quoi lovegobuy", 'fiable'], ['combien de temps je peux laisser mes articles', 'stockage'], ['pourquoi je dois repayer', 'message'],
  ['je veux commander les nike du site', 'commander'], ["l'article est arrivé à l'entrepôt et après ?", 'commander'], ['ça marche comment', 'commander'],
  ['ma commande est arrivée cassée', 'contact'], ['il manque un article dans mon colis', 'contact'], ["j'ai un problème avec ma commande", 'contact'],
  ["jai commandé il y a 2 semaines toujours rien", 'bloque'], ['g pas recu mes photos qc', 'qc'], ['ou je met mon code parrainage', 'coupons'],
  ['bonjour, combien de temps pour la livraison ?', 'delai'], ['est ce que les articles sont de bonne qualité', 'memephoto'],
  // hors sujet : pas de réponse au hasard
  ['quel temps fait-il à Paris', 'none'], ['tu aimes le foot', 'none'], ['asdfgh', 'none'], ['ma mère veut un cadeau pour noël', 'none'],
];

let ok = 0;
const fails = [];
for (const [q, want] of CASES) {
  const r = answer(q);
  let got;
  if (!r || r.none) got = 'none';
  else if (r.talk) got = /groupe de discussion<\/b> : on te/.test(r.talk) ? 'aside' : 'talk';
  else if (r.pick) got = '? ' + r.pick.map((e) => e.id).join(',');
  else got = r.e.id;
  const pass = want === '?' ? got.startsWith('?') : want.startsWith('? ') ? got.startsWith('?') && got.includes(want.slice(2)) : got === want;
  if (pass) ok++; else fails.push(`  « ${q} » → ${got} (attendu ${want})`);
}
console.log(`chat bot : ${ok}/${CASES.length} questions bien comprises`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }

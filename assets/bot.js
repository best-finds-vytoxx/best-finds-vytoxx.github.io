// Chat bot du site (#aide) : les réponses validées par Léonard et la compréhension des questions.
// Les réponses se modifient dans BOT ; les tournures qui les désignent dans P (même identifiant).
// hide: true → la question n'est jamais proposée, le bot répond seulement si on la pose.
(() => {
  const S = window.SITE || {};
  const BOT = [
    { id: 'search', q: 'Je cherche un article précis, comment je fais ?', k: 'cherche chercher trouve trouver lien liens article produit dispo disponible find recherche recherch existe modele',
      a: "1. Tape le <b>nom de l'article</b> dans la barre de recherche du site.<br>2. Rien ne sort ? Tape la <b>marque et le type de produit</b> (par exemple « Nike jogging »).<br>3. Il n'est pas sur le site ? Va sur le <b>groupe de discussion</b> et envoie une capture d'écran du produit en demandant gentiment le lien.", act: ['search', 'group'] },
    { id: 'delai', q: 'Dans combien de temps je reçois ma commande ?', k: 'temps delai delais combien jours semaines recevoir recois reception arrive arriver quand long attente livre livraison',
      a: "Compte environ <b>3 semaines</b> en tout :<br>• <b>3 à 7 jours</b> pour que le vendeur envoie ton article à l'entrepôt LoveGoBuy ;<br>• puis <b>6 à 18 jours</b> de livraison jusqu'à chez toi, selon la ligne choisie." },
    { id: 'suivi', q: 'Comment suivre mon colis ?', k: 'suivre suivi tracking numero colis trouve ou est aftership track localiser',
      a: "1. Dans l'appli LoveGoBuy, va dans <b>Colis</b> puis touche <b>Détails</b>.<br>2. Descends tout en bas et touche le <b>numéro de suivi</b> : il s'actualise au fur et à mesure, même tant que le colis est hors d'Europe.<br>3. Pour un suivi plus précis une fois le colis <b>arrivé en Europe</b>, copie ce numéro et colle-le sur <b>AfterShip</b> (site ou appli).", act: 'aftership' },
    { id: 'bloque', q: "Mon colis ne bouge plus, c'est normal ?", k: 'bouge bouger suivi tracking bloque rien nouvelle avance statut normal toujours depuis',
      a: "Oui, c'est fréquent : le suivi peut rester <b>plusieurs jours sans nouvelle info</b>, surtout pendant le vol et le passage en douane. Regarde le suivi dans l'appli (Colis, puis Détails, puis le numéro de suivi tout en bas). Tant que tu es dans les délais (6 à 18 jours de livraison), pas d'inquiétude. Au-delà, ouvre un <b>ticket</b> sur le site LoveGoBuy ou demande sur le groupe de discussion.", act: 'group' },
    { id: 'prixlivr', q: 'Combien coûte la livraison ?', k: 'combien cout coute prix livraison frais tarif poids estimer estimation kilo volume calcul cher',
      a: "Le prix dépend du <b>poids</b>, du <b>volume</b> du colis et de la ligne choisie.<br>• Les prix sont les plus avantageux entre <b>500 g et 5 kg</b> par colis.<br>• Le volume compte : un coussin d'1 kg coûte bien plus cher à envoyer qu'un pull épais d'1 kg.<br>• Pour estimer avant de payer, utilise l'onglet <b>Estimation</b> sur l'accueil LoveGoBuy.<br>• Poids indicatifs : t-shirt 250 g, short 350 g, pull 500 à 800 g, pantalon 600 g, chaussures 1 à 1,2 kg. Le poids est aussi indiqué sur la fiche de chaque article." },
    { id: 'essai', q: "C'est quoi le colis d'essai ?", k: 'colis essai test calcul precis exact vacuum vide sous volumineux emballage',
      a: "Pour <b>2 € par colis</b>, LoveGoBuy prépare ton colis et te donne son <b>poids et son prix de livraison exacts</b> en 24 h environ, avant que tu paies.<br>• Fais-le quand <b>tous tes articles sont arrivés</b> à l'entrepôt.<br>• Pour les articles volumineux (doudoune, pull épais…), choisis aussi le <b>Vacuum pack</b> (mise sous vide) : le colis prend moins de place et coûte moins cher.", act: 'tuto' },
    { id: 'coupons', q: `Comment obtenir les ${S.coupon || '500 €'} de coupons ?`, k: '500 485 coupon coupons reduction code promo offert offerts bon inscription parrainage cadeau',
      a: "Inscris-toi sur LoveGoBuy avec le lien du site : tu reçois <b>485 € de coupons</b> (environ 500 €).<br>• Ils servent uniquement à réduire la <b>livraison</b>.<br>• Tu peux utiliser <b>un seul coupon par colis</b>.<br>• Pense à les récupérer dans ton compte (bouton « Recevoir »).", act: 'promo' },
    { id: 'rembours', q: 'Comment me faire rembourser ?', k: 'rembourse remboursement rembourser annuler annulation cancel argent retour retourner',
      a: "• Si le vendeur n'a pas envoyé l'article au bout de <b>8 jours</b>, tu peux demander le remboursement.<br>• Une fois l'article arrivé à l'entrepôt, tu as <b>5 jours</b> pour le demander.<br>• L'argent revient sur ton <b>solde LoveGoBuy</b> (pas sur ton compte bancaire) en <b>3 à 8 jours</b>." },
    { id: 'qc', q: 'Je ne vois pas les photos de contrôle (QC)', k: 'qc photo photos controle verification entrepot voir vois pas apparait',
      a: "Les photos de contrôle arrivent en général <b>1 à 2 jours</b> après l'arrivée de l'article à l'entrepôt. Toujours rien au bout de <b>72 h</b> ? Ouvre un <b>ticket</b> sur le site LoveGoBuy pour les demander." },
    { id: 'message', q: "Que veut dire ce message de l'appli ?", k: 'message veut dire signifie recharge need closed ferme apply cancel statut appli application',
      a: "• « <b>Need to recharge</b> » : le prix de l'article a changé, tu dois payer la différence.<br>• « <b>Apply cancel</b> » : ta demande d'annulation est en cours.<br>• « <b>Colis fermé</b> » : l'article est resté plus de 60 jours à l'entrepôt et il est reparti chez le vendeur.<br>Un autre message ? Envoie une capture sur le groupe de discussion.", act: 'group' },
    { id: 'fiable', q: "LoveGoBuy, c'est fiable ?", k: 'fiable confiance arnaque scam serieux sur securise lovegobuy marche vraiment legit',
      a: "LoveGoBuy est un <b>agent d'achat</b> : il achète l'article au vendeur en Chine, le reçoit dans son entrepôt, te montre des <b>photos de contrôle</b>, puis te l'envoie. Si le vendeur n'envoie pas l'article, tu es <b>remboursé</b> sur ton solde LoveGoBuy. Le groupe de discussion est là si tu as un doute." },
    { id: 'ligne', q: 'Quelle ligne de livraison choisir ?', k: 'ligne dhl dpd europe eu transporteur choisir choix meilleure moins chere',
      a: "LoveGoBuy EU, DHL ou DPD : les délais sont <b>à peu près les mêmes</b>. Prends simplement la <b>moins chère</b> des lignes proposées pour ton colis." },
    { id: 'taille', q: 'Quelle taille prendre ?', k: 'taille tailles size guide mesure grand petit fit correspondance prendre',
      a: "Choisis la taille sur la page LoveGoBuy de l'article, avec le guide des tailles du vendeur. Les photos des fiches montrent l'étiquette, et la règle posée à côté donne les dimensions réelles. Un doute ? Demande sur le groupe de discussion.", act: 'group' },
    { id: 'stockage', q: 'Combien de temps mes articles restent à l\'entrepôt ?', k: 'stockage stocker garder entrepot jours gratuit reste rester 60 attendre',
      a: "Le stockage est <b>gratuit pendant 60 jours</b>. Passé ce délai, l'article repart chez le vendeur : pense à expédier ton colis avant." },
    { id: 'contact', q: 'Comment contacter le service client ?', k: 'service client contacter contact aide support ticket probleme parler joindre',
      a: "Ouvre un <b>ticket</b> sur le site LoveGoBuy, depuis ton compte. Tu peux aussi poser ta question sur le <b>groupe de discussion</b>.", act: 'group' },
    { id: 'commander', q: 'Comment commander un article du site ?', k: 'commander acheter achat commande etapes faire comment panier',
      a: "1. Ouvre la fiche de l'article et touche <b>Voir sur LoveGoBuy</b>.<br>2. Choisis ta taille et ta couleur, puis achète.<br>3. Quand l'article est à l'entrepôt, vérifie les photos de contrôle et demande l'expédition.<br>4. Paie la livraison avec tes coupons. Tout est montré pas à pas dans le tuto.", act: 'tuto' },
    { id: 'memephoto', q: 'Est-ce que je vais recevoir la même chose que sur les photos ?', k: 'meme photo photos reel reelle vrai qualite identique pareil',
      a: "Les photos des fiches sont les <b>photos exactes de l'article</b>, étiquettes et détails compris. Et quand ton article arrive à l'entrepôt, LoveGoBuy te montre des <b>photos de contrôle</b> avant l'envoi : tu vérifies que c'est bien ce que tu as commandé." },
    { id: 'payer', q: 'Comment payer ?', k: 'payer paiement carte bancaire apple pay google paypal moyen usd dollar euro',
      a: "LoveGoBuy propose plusieurs moyens : <b>carte bancaire</b>, <b>Apple Pay</b>, <b>Google Pay</b> et d'autres. Tu paies deux fois : l'article d'abord, la livraison ensuite." },
    { id: 'prixsite', q: 'Le prix affiché sur le site est-il le bon ?', k: 'prix affiche bon exact change yuan cny different',
      a: "Le prix affiché est celui de la page LoveGoBuy, relevé à la date indiquée sous le prix. Il peut changer : le prix qui compte est celui affiché sur LoveGoBuy au moment de commander." },
    { id: 'separer', q: 'Pourquoi séparer les catégories dans mes colis ?', k: 'separer categories pourquoi electronique liquide bijou bijoux melanger',
      a: "L'électronique, les liquides et les bijoux partent sur des lignes de livraison spéciales. En les gardant chacun de leur côté, chaque colis part sur la bonne ligne et coûte moins cher." },
    { id: 'ecran', q: "Comment ajouter le site sur mon écran d'accueil ?", k: 'iphone android ecran accueil installer raccourci icone appli application telephone',
      a: "<b>iPhone</b> : dans Safari, touche « ••• », puis Partager, puis « Sur l'écran d'accueil ».<br><b>Android</b> : dans Chrome, touche « ⋮ » en haut à droite, puis « Ajouter à l'écran d'accueil ».<br>Toutes les étapes sont illustrées dans le petit tuto.", act: 'ecran' },
    { id: 'douane', q: 'Mon colis peut-il être saisi à la douane ?', hide: true, k: 'saisi saisie douane attrape attraper bloque confisque perdu risque',
      a: "C'est <b>extrêmement rare</b> : moins d'un colis sur 500. En général, le colis est simplement saisi et n'arrive pas chez toi. LoveGoBuy prend cela en charge : <b>si le colis est assuré, il est remboursé</b>. Les règles peuvent changer : pour ce genre de question, ouvre un <b>ticket</b> sur le site LoveGoBuy." },
  ];

  // ---------- compréhension des questions ----------
  // 1. la question est nettoyée (accents, majuscules, apostrophes, langage SMS, fautes de frappe courantes) ;
  // 2. chaque réponse a des « tournures » (P) qui la désignent presque à coup sûr, et des mots-clés (k) ;
  //    (« ! » devant une tournure = très forte, ex. un article cassé) ;
  //    un mot-clé présent dans beaucoup de réponses (« colis », « livraison ») compte peu, un mot rare compte beaucoup ;
  // 3. si deux réponses sont trop proches, le bot demande laquelle on veut au lieu de deviner ;
  // 4. si rien ne correspond vraiment, il le dit et propose le groupe de discussion.
  const P = {
    search: ['(trouv|cherch|recherch)', '\\blien\\b', '\\bdispo', 'pas sur le site', 'existe (en|pas|sur)', 'ou (je peux )?(trouv|achet)', 'il est ou', 'vous avez (le|la|les|des|un|une)'],
    delai: ['combien de (temps|jours|jour|semaines|semaine)', '\\bquand\\b.*\\b(recoi|recev|arriv|livr|reçoi)', '\\bdelai', '(temps|duree) de (livraison|reception|transport|envoi)', '(met|prend|faut)\\w* combien de', '(ca|sa|il) (met|prend) (combien|longtemps)', 'en combien de', 'long (a|pour) (arriver|recevoir|venir)', 'arrive (quand|dans combien)', 'rapide'],
    suivi: ['\\bsuivi\\b', '\\bsuivre\\b', 'tracking', '\\btrack', 'numero de suivi', 'aftership', 'ou (est|en est) (mon|ma|le|la) (colis|commande|paquet)', 'ou en est', 'localiser'],
    bloque: ['(ne |n )?bouge (plus|pas)', 'n avance (plus|pas)', '\\bbloque', 'pas (de|d) (nouvelle|info|mise a jour|maj)', 'toujours (le meme|rien|pas|au meme)', 'rien ne (bouge|change|avance)', 'meme statut', 'depuis .* (jours|semaines) .*(rien|pareil|meme|bouge)'],
    prixlivr: ['(combien|prix|cout|tarif|frais|cher).{0,30}(livraison|envoi|expedi|port\\b|shipping|colis|expedier|envoyer)', '(livraison|envoi|shipping|expedition|port\\b).{0,25}(combien|prix|cout|cher|tarif)', '\\bpoids\\b', '\\b(kg|kilo|kilos|grammes)\\b', 'estim', 'frais de port', 'combien je vais payer', '\\bpes(e|ent)\\b', 'combien (pese|coute l envoi)'],
    essai: ['colis (d )?essai', '\\bessai\\b', 'colis test', 'vacuum', 'sous vide', 'rehearsal', 'mise sous vide'],
    coupons: ['livraison gratuite', '\\b(500|485)\\b', 'coupon', 'code promo', '\\bpromo\\b', 'reduc', 'parrain', 'inscri', 'creer (un |mon )?compte', 'ouvrir un compte', 'bon de reduction', '(500|485) euros? offert'],
    rembours: ['recuper\\w* (mon|l|de l|mes) argent', '\\bargent\\b', 'rembours', 'annul', '\\bcancel', 'retour', 'recuperer (mon|l) argent', 'me faire rendre'],
    qc: ['\\bqc\\b', 'photos? (de )?control', 'photos? (de l |a l |dans l )?entrepot', 'voir (mon|l) article avant', 'verifier (mon|l) article'],
    message: ['repayer', 'payer (la|une) difference', 'payer (encore|a nouveau|de nouveau)', 'supplement', 'need to recharge', '\\brecharge', 'apply cancel', 'colis (est )?ferme', 'veut dire', 'signifie', 'message (de|dans|sur) (l )?(appli|application|site)', 'ca veut dire quoi', 'c est quoi ce message'],
    fiable: ['c est quoi lovegobuy', 'lovegobuy c (est )?quoi', 'qu est ce que lovegobuy', 'comment (fonctionne|marche) lovegobuy', 'le site c (est )?quoi', 'agent d achat', 'fiable', 'arnaque', '\\bscam', 'serieux', 'confiance', '\\blegit', '\\bsafe\\b', 'securis', 'c est sur\\b', 'sans risque', 'vraiment (fiable|sur|serieux)', 'se faire avoir'],
    ligne: ['\\bligne', '\\bdhl\\b', '\\bdpd\\b', 'transporteur', 'quel(le)? (livraison|mode de livraison|envoi) (choisir|prendre)', 'meilleure livraison', 'livraison la moins chere'],
    taille: ['\\btaille', '\\bsize', 'pointure', 'mesure', 'guide des tailles', 'taille (petit|grand)', 'quelle taille'],
    stockage: ['combien de temps .*(laisser|garder|rester|stock)', 'laisser (mes|les|mon|l) (article|colis)', '\\bgarder\\b', 'stock', 'reste(nt)? (a|dans) l entrepot', 'garder? (a|dans) l entrepot', '\\b60 jours', 'combien de temps .*entrepot', 'entrepot .*combien de temps', 'attendre (pour|avant d) (envoyer|expedier)'],
    contact: ['!cass', '!abim', '!endommag', '!defectu', '!trompe', 'mauvais(e)? (article|taille|couleur|produit)', 'pas (le bon|la bonne|les bons) ', '!il manque', '\\bprobleme', '\\bsouci', 'service client', 'contacter', '\\bjoindre', '\\bsupport\\b', '\\bticket', 'parler (a|avec) (quelqu|une personne|un humain|le service)', 'qui (je )?contacte'],
    commander: ['entrepot .*(apres|ensuite|maintenant|quoi faire)', 'et apres', 'je fais quoi', '(prochaine|derniere) etape', '(expedi\\w*|envoyer) (mon|mes|le|les) (colis|articles?)', 'commander (les|le|la|des|un|une|cet|ce|cette)', 'veux commander', 'marche comment', 'fonctionne comment', 'comment (ca|sa) fonctionne', 'comment (je )?(commande|achet|passe)', 'passer (une |ma )?commande', 'acheter (un|cet|ce|l)', 'comment (ca|sa) marche', 'premiere commande', 'comment (on )?fait (pour )?(acheter|commander)', 'etapes pour commander', 'jamais commande'],
    memephoto: ['qualite', '(meme|pareil|identique).{0,25}photo', 'photo.{0,25}(reel|vrai|contractuel|identique|pareil)', 'recevoir la meme chose', 'conforme'],
    payer: ['comment (je )?(pay|regl)', 'payer (avec|par|en)', 'par (carte|paypal)', 'paiement', '\\bcarte\\b', 'paypal', 'apple ?pay', 'google ?pay', 'moyens? de paiement', 'regler'],
    prixsite: ['en (euros?|dollars?|yuan)', 'prix (affiche|du site|sur le site|indique)', 'bon prix', 'prix (a|est) (change|different)', '\\byuan', '\\bcny\\b', 'pas le meme prix', 'prix (pas )?(a jour|exact)'],
    separer: ['separ', 'electroniq', 'liquide', 'parfum', 'bijou', 'melanger', 'plusieurs categories'],
    ecran: ['ecran d accueil', 'installer', 'raccourci', 'appli du site', 'application du site', 'telecharger (le site|l appli)', 'ajouter le site', 'icone'],
    douane: ['\\bdouane\\b', 'saisi', 'confisqu', 'douane .*(bloque|pris|garde|attrap|saisi)', '(bloque|pris|attrap) .*douane', 'perdu'],
  };
  // mots de langage SMS et fautes fréquentes → mot correct
  const SMS = {
    cb: 'combien', cmb: 'combien', cbn: 'combien', combiens: 'combien', tps: 'temps', qd: 'quand', kan: 'quand', qand: 'quand', kand: 'quand',
    pk: 'pourquoi', pq: 'pourquoi', pourkoi: 'pourquoi', koi: 'quoi', kwa: 'quoi', cmt: 'comment', cmnt: 'comment', comen: 'comment', komen: 'comment',
    jsp: '', stp: '', svp: '', slt: 'salut', bjr: 'bonjour', bsr: 'bonsoir', cc: 'coucou', mrc: 'merci', mci: 'merci', thx: 'merci', ty: 'merci',
    coli: 'colis', collis: 'colis', livraisson: 'livraison', livrason: 'livraison', livrer: 'livraison', livre: 'livraison', livree: 'livraison', livres: 'livraison',
    remboursser: 'rembourser', rembourcement: 'remboursement', ranbourser: 'rembourser', dispo: 'disponible', lgb: 'lovegobuy', lovegobuy: 'lovegobuy', site: 'site',
    cmd: 'commande', cde: 'commande', commende: 'commande', comande: 'commande', comander: 'commander', achte: 'achete', recu: 'recu', resu: 'recu',
    sa: 'ca', ca: 'ca', ke: 'que', ki: 'qui', g: 'j ai', jai: 'j ai', c: 'c est', cest: 'c est', ya: 'il y a', yaura: 'il y aura', tkt: '', mtn: 'maintenant',
    tracking: 'tracking', trk: 'tracking', suivit: 'suivi', suivie: 'suivi', semaine: 'semaines', jour: 'jours', ptn: '', wesh: 'salut', yo: 'salut',
  };
  const norm = (text) => {
    let t = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/€/g, ' euros ').replace(/['’`´]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    t = t.split(' ').map((w) => (w in SMS ? SMS[w] : w)).filter(Boolean).join(' ');
    return ` ${t} `.replace(/\s+/g, ' ').replace(/ c est est /g, ' c est ');
  };
  // mots trop courants pour départager deux réponses
  const STOP = new Set(('a au aux avec dans chez sans entre ca ce ces cet cette c d de des du elle en est et etre il ils j je l la le les leur lui m ma me mes moi mon n ne nous on ou par pas pour qu que qui quoi quel quelle quels quelles s sa se ses si son sur t ta te tes toi ton tu un une vos votre vous y '
    + 'comment fais faire fait est sont suis peux peut puis veux voudrais aimerais savoir dire bien bon bonne alors donc mais aussi tout tous toute toutes tres trop plus moins deja encore '
    + 'vais va vas vont aller allez ete etait sera faut veut voulais avez avons chose truc ' 
    + 'svp merci salut bonjour question aide besoin j ai avoir as ont c est il y quand combien pourquoi article articles produit site lovegobuy').split(' '));
  const stem = (w) => { w = w.replace(/(s|x)$/, ''); return w.length > 5 ? w.slice(0, 5) : w; };
  const words = (t) => t.trim().split(' ').filter((w) => (w.length > 2 || w === 'qc' || w === 'kg') && !STOP.has(w));
  const lev1 = (a, b) => { // distance d'édition ≤ 1 (une lettre en trop, en moins ou différente)
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  };
  // index : pour chaque réponse, ses mots-clés (racines) ; poids d'un mot = rareté parmi les réponses
  const IDX = BOT.map((e) => {
    const keys = new Map();
    for (const w of words(norm(e.k))) keys.set(stem(w), w);
    for (const w of words(norm(e.q))) if (!keys.has(stem(w))) keys.set(stem(w), w);
    return { e, keys, re: (P[e.id] || []).map((p) => ({ r: new RegExp(p.replace(/^!/, '')), w: p[0] === '!' ? 8 : 4 })) };
  });
  const DF = new Map();
  for (const x of IDX) for (const s of x.keys.keys()) DF.set(s, (DF.get(s) || 0) + 1);
  const W = (s) => 1 + Math.log(BOT.length / (DF.get(s) || 1));

  // petites phrases de politesse et hors sujet
  const TALK = [
    { re: /^ ?(salut |bonjour |bonsoir )?(tu (peux|pourrais) m aider|j ai (une|des|un) (question|questions|probleme|souci)|aide moi|aidez moi|besoin d aide|help)( stp| svp| s il te plait)? ?$/, a: 'Bien sûr ! Écris ta question en quelques mots (par exemple « délai de livraison » ou « comment suivre mon colis »), ou choisis-en une ci-dessous.' },
    { re: /^ ?(salut|bonjour|bonsoir|coucou|hello|hey|hi|cava|ca va|salam|re)( (ca va|toi|a toi|tout le monde|bot|le bot))* ?$/, a: 'Salut 👋 Pose-moi ta question sur la commande LoveGoBuy, ou choisis-en une ci-dessous.' },
    { re: /^ ?(ok |top |super |parfait |nickel |d accord )?merci( (beaucoup|bcp|bien|pour|ton|ta|la|les|tes|aide|reponse|reponses|a|toi|le|bot|infos?|encore|mille fois|frero|frere|chef))* ?$/, a: 'Avec plaisir 🙌 Une autre question ?' },
    { re: /^ ?(ok|okay|oki|d accord|dac|ca marche|super|top|parfait|cool|nickel|genial|ah ok|oui|non|bien recu|compris)( merci)? ?$/, a: 'Parfait ! Si tu as une autre question, je suis là.' },
    { re: /\b(t es|tu es|es tu|t es qui|qui es tu|c est qui|un robot|un bot|une ia|un humain|une vraie personne)\b/, only: true, a: "Je suis l'assistant du site : je réponds aux questions les plus posées sur la commande LoveGoBuy. Pour parler à une vraie personne, passe par le groupe de discussion.", act: 'group' },
  ];
  // sujets dont le bot ne parle pas : il renvoie vers le groupe, sans rien affirmer
  const ASIDE = /\b(rep|reps|replica|replique|fake|faux|contrefa\w*|copie|vinted|hacoo|taxe|taxes|tva|frais de douane|droits de douane|payer la douane|declar\w*)\b/;

  const answer = (text) => {
    const t = norm(text);
    if (!t.trim()) return null;
    for (const x of TALK) if (x.re.test(t) && (!x.only || words(t).length <= 4)) return { talk: x.a, act: x.act };
    if (ASIDE.test(t) && !/\b(saisi|confisqu)/.test(t)) return { talk: "Pour cette question, le mieux est de demander directement sur le <b>groupe de discussion</b> : on te répondra au cas par cas.", act: 'group' };
    const ws = words(t);
    const scored = IDX.map((x) => {
      let sc = 0, hits = 0, kw = 0, strong = false;
      for (const { r, w } of x.re) if (r.test(t)) { sc += w; hits++; if (w > 4) strong = true; }
      for (const w of ws) {
        const s = stem(w);
        if (x.keys.has(s)) { sc += W(s); kw++; continue; }
        if (w.length >= 5) for (const [ks, k] of x.keys) if (k.length >= 5 && lev1(w, k)) { sc += W(ks) * 0.8; kw++; break; }
      }
      return { e: x.e, sc, hits, kw, strong };
    }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
    // une seule tournure reconnue suffit ; sans tournure, il faut au moins deux mots-clés de la même réponse
    const sure = scored.filter((x) => x.hits || x.kw >= 2);
    if (!sure.length || sure[0].sc < 1.8) {
      // question d'un ou deux mots (« livraison », « colis ») : on propose les réponses possibles
      if (ws.length && ws.length <= 2 && scored.length && ws.every((w) => IDX.some((x) => x.keys.has(stem(w))))) return { pick: scored.slice(0, 3).map((x) => x.e) };
      return { none: true, near: scored.slice(0, 3).map((x) => x.e) };
    }
    const strong = sure.find((x) => x.strong);
    if (strong) return { e: strong.e };
    const [a, b] = sure;
    // nettement devant → on répond ; trop serré → on demande
    if (!b || a.sc - b.sc >= 2 || a.sc >= b.sc * 1.45) return { e: a.e };
    return { pick: sure.filter((x) => x.sc >= a.sc * 0.7).slice(0, 3).map((x) => x.e) };
  };
  window.VXBOT = { BOT, answer, norm, debug: (q) => { const t = norm(q), ws = words(t); return IDX.map((x) => [x.e.id, x.re.filter(({ r }) => r.test(t)).length, ws.filter((w) => x.keys.has(stem(w)))]).filter((x) => x[1] || x[2].length); } };
})();

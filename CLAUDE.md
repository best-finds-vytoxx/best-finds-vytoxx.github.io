# Notes de maintenance (pour Claude)

Propriétaire : Léonard (Vytoxx). Site : https://best-finds-vytoxx.github.io/ (dépôt best-finds-vytoxx/best-finds-vytoxx.github.io). Parle-lui en français, simplement. Il ne manipule pas GitHub lui-même :
c'est Claude qui enregistre et pousse chaque changement, puis vérifie le site en ligne.

## Règles

- Ne jamais afficher le prix des posts Telegram. Seul prix affiché : celui de LoveGoBuy (`data/prices.json`, relevé automatiquement).
- Toujours lancer `npm test` avant de pousser. Le workflow relance aussi les tests avant de toucher au site.
- Après chaque push : attendre la fin du workflow (onglet Actions) puis contrôler le site en ligne.
- Ne pas modifier `data/articles.json`, `data/clicks.json` ni `images/` à la main : c'est le robot qui les écrit.
  Corrections manuelles → `data/overrides.json` (le robot les applique et refait la couverture).

## Fonctionnement

- `.github/workflows/update.yml` : toutes les 15 min → tests → `scripts/scrape.mjs` → `scripts/prices.mjs` → `scripts/clicks.mjs` → commit → déploiement Pages.
  Posts supprimés du canal, retirés du site avec leurs photos sans intervention : à chaque passage pour les posts récents
  (article connu entre le plus petit et le plus grand numéro lus, absent des pages ; rien si plus de la moitié manque),
  et toutes les 2 h (`SWEEP_HOURS`, date `sweptAt`) par une relecture complète du canal (seulement si elle est complète
  et a trouvé au moins 60 % des articles). Relecture immédiate : date du moment dans `data/sweep.json` (`requestedAt`), pousser.
- Corrections automatiques (à ne plus faire à la main) :
  prix (`prices.mjs`) ; catégorie d'un titre sans mot-clé devinée d'après les photos (`autoCat`, `guessCategory` dans pick.mjs,
  modèle CLIP de rank-worker ; pantalons/ensembles jamais devinés) ; couverture refaite si la famille ou l'objet change
  (`coverFor` = « kind:noun ») ; bottes acceptées de profil dès largeur/hauteur ≥ 1 (`minRatio`) ; même modèle en version normale
  et « TOP quality » → seule la plus chère reste (`markVersions` dans parse.mjs : `dupOf` + `lesser`, recalculé à chaque passage).
- `scripts/parse.mjs` : lecture des pages t.me/s, catégories (`detectCategory` puis `MERGE`), description, lien LoveGoBuy
  (le lien intitulé « lien LoveGoBuy », pas celui de l'emoji 🔗).
- `scripts/scrape.mjs` : téléchargement des photos (originaux du canal, sans recompression, `PHOTO_REV`), choix de la
  couverture (`pick.mjs` + `rank-worker.mjs`, modèle CLIP), détourage par lots dans un processus séparé
  (`cutout-worker.mjs`), budget de temps par passage (`BUDGET_MIN`), sauvegarde après chaque groupe.
  Changer `COVER_REV` refait toutes les couvertures ; `PHOTO_REV` re-télécharge toutes les photos.
- `scripts/cutout.mjs` : détourage principal `vision.py` (via `vision.mjs`) : Grounding DINO repère le produit d'après
  son nom (`promptFor`), recadrage sur lui (règle, vignette, boîte et papiers restent dehors), puis BiRefNet
  (`models/birefnet-general.onnx`, téléchargé et mis en cache par le workflow, ~9 Go de mémoire, ~18 s par photo).
  Puis nettoyage (règles, boîtes, carton, vignette du canal). Si échec : ancienne méthode @imgly, puis `grabcut.mjs`.
  `watermark.mjs` repère la vignette panda « VYTOXX ». Chaque couverture a une miniature `cover-sm.webp` (480 px).
- Revue visuelle des couvertures : planche de toutes les `cover.webp`, puis `cover` dans `data/overrides.json`
  pour les mauvaises vues (talons, emballage, détail).
- Catégorie « Accessoires » affichée « Autres » sur le site (MERGE dans app.js). Crampons = Chaussures.
- `data/overrides.json` : `{ "id": { "cover": n°photo, "category": "Bas", "kind": "wear|shoe|acc", "crop": [g,h,d,b], "hide": true } }`
  (`hide` retire l’article du site : lien mort, article plus disponible).
- `data/prices.json` : `{ checkedAt, rate: { eurPerCny, k, usd, at }, items: { id: { cny, eur, pid, at, checked, offSeen?, off? } } }`,
  écrit par `scripts/prices.mjs` à chaque passage. CNY = prix Weidian (`thor.weidian.com/detail/getItemSkuInfo`, champ
  `itemDiscountLowPrice` / 100), identique à LoveGoBuy (270 relevés sur 275 ; les 5 autres avaient changé chez le vendeur).
  Euros comme LoveGoBuy : taux à 4 décimales = cours CNY→USD du marché (open.er-api, sinon BCE via frankfurter) × k propre
  à la source (`K_BY_SOURCE` : 0,98 et 0,97725, mesurés le 11/11/2026 sur 9 pages LoveGoBuy, toutes au taux 0,1465 ;
  le cours BCE ne suit pas LoveGoBuy d'un jour à l'autre), puis `Math.floor(cny × taux × 100) / 100` sans correctif
  (comme leur site : 180 CNY → 26,36 €), vérifié sur 22 relevés à la main. Écart relevé à la main → recalculer k
  (taux LoveGoBuy ÷ cours de la source le même jour). Ne jamais faire lire LoveGoBuy par le robot (il bloque les robots).
  Nouvel article ou lien changé : relevé au passage suivant ; chaque prix revérifié environ toutes les 20 h.
  Article introuvable ou stock 0 chez le vendeur à deux relevés espacés de 20 h : `off` → masqué du site et des aperçus,
  réaffiché dès qu'il revient (rien n'est marqué si le relevé échoue pour la majorité des produits).
  Le prix n'est affiché que si `pid` = lien actuel de l'article. Le site LoveGoBuy bloque les robots : ne pas l'interroger.
- Site : `index.html` + `assets/app.js` (routage par #, accueil à chaque arrivée) + `assets/style.css` + `assets/config.js`.
  Accueil : carte « liquid glass » (classe `.lg`) avec le panda détouré `assets/img/panda-hero.webp` sur la lumière floutée
  de la bannière (`hero-glow.webp`), puis les 3 aides pour commander. Couleurs d’identité : `--sun --terra --linen --navy --lgb`.
  Liquid glass sur tout le site : variables `--gl-*` et bloc « LIQUID GLASS SUR TOUT LE SITE » en fin de style.css ;
  la lumière floutée reste derrière chaque page (`html::before`). Pas d’italique, pas de police de code.
- Conventions du canal : vêtements photo 1 = face, photo 2 = dos ; chaussures récentes photo 1 = talons, photo 2 = face ;
  dernière photo = une chaussure seule de profil, sur sa boîte et la balance.
- Chaussures : couverture = UNE chaussure, vue de côté, bout à gauche, talon à droite, à plat (demande de Léonard), choisie
  automatiquement par `scripts/shoe-cover.mjs` (`autoShoe`, appelé par `cutout-worker.mjs`) : Grounding DINO repère chaque
  chaussure (`visionBoxes`, requête `detect` de vision.py), l'autre chaussure est effacée, détourage, puis orientation
  (quart de tour pour une chaussure couchée photographiée d'en haut, miroir si le bout est à droite, remise à plat).
  Priorité à la dernière photo (chaussure debout sur sa boîte) ; elle frôle souvent le cadre sans être coupée. Une vraie
  coupe = bord parfaitement droit aligné sur le cadre au bout du pied ou en haut (`cutEdges`) ; le talon est droit par nature.
  Si la dernière photo ne va pas, les autres sont essayées : vue debout d'abord, sinon la chaussure sur sa boîte même un peu
  coupée, en dernier recours une vue de dessus tournée. Rien de bon : ancienne logique (`sideCut`, puis vue de face).
  Réglages à la main (`data/overrides.json`, priorité sur l'automatique) : `side` (n° photo ou false), `flip`, `rotate`,
  `crop`, `erase` (zones à effacer), `keep`. `SIDE_REV` dans scrape.mjs refait toutes les chaussures (groupes de 12,
  ancienne couverture gardée si le nouvel essai échoue). Labo : branche `lab` (`lab/shoes.mjs`, 10 machines, résultats
  sur `lab-out-N`) pour essayer une règle sur toutes les chaussures avant de la mettre en service.
- Limite connue : un titre vague (« Nike running », « Nike Run Division ») est rangé dans Ensembles même si le post ne montre
  qu'un haut ou un bas. Essai de vérification par photos (`guessOutfit`, `lab/outfit.mjs`) non concluant le 11/11/2026 (un
  pantalon seul pris pour une tenue) : pas en service. Corriger par `category` dans overrides.json en attendant.
- Contrôle qualité automatique : `scripts/audit.mjs`, à chaque passage après les prix. Il relit tout le site (prix valable,
  détourage, fichiers, titre, lien, catégorie, fraîcheur des relevés) et écrit `data/health.json` (réécrit seulement si le
  résultat change), affiché en haut du tracker (`health()` dans tracker.js) et dans le compte rendu. Niveau `auto` = le robot
  corrige seul au passage suivant ; `voir` = a résisté (ex. détourage raté 3 fois : `coverTries`, un essai par jour dans
  scrape.mjs). Tout nouveau type de problème signalé par Léonard : ajouter le contrôle ici ET la correction dans le robot.
- Doublons (même lien LoveGoBuy, souvent une autre couleur) : `markDuplicates` garde le post le plus récent (`dupOf` sur les autres) ;
  le site (chargement dans app.js) ajoute les photos des posts en double à la suite de celles de l'annonce gardée.
  Jamais pour les versions normale/TOP (`lesser`, liens différents).
- Titres : nettoyés à chaque passage (`cleanTitle` : caractères pleine largeur « （NFC） » des vendeurs → « (NFC) »).
- Chat bot (`#aide`) : `assets/bot.js` (réponses `BOT`, tournures `P` par identifiant, langage SMS `SMS`, politesse `TALK`,
  sujets écartés `ASIDE` → renvoi au groupe ; question floue → le bot propose 2-3 questions). Tests : `test/bot.test.mjs`
  (ajouter un cas à chaque question mal comprise). Réponses validées par Léonard (coupons 485 € ≈ 500 €, un coupon par colis ;
  délais 3–7 j + 6–18 j ; prix optimaux 500 g–5 kg, le volume compte ; remboursement 8 j / 5 j, sur le solde ; stockage 60 j ;
  ligne la moins chère entre LoveGoBuy EU, DHL, DPD ; suivi : Colis › Détails › numéro de suivi, puis AfterShip en Europe). Jamais : taxe 2 €/article, 1.1, rep, Vinted, Hacoo, noms de helpers.
  Groupe de discussion : `chat` dans `assets/config.js` (t.me/LoveGoBuy_fr).
- Statistiques : compteur privé Cloudflare (`cloudflare/worker.js`, base D1 « vytoxx-stats », secrets PASS et KEY,
  compte Cloudflare de Léonard) à l'adresse `statsUrl` de `assets/config.js`. Le site envoie des compteurs anonymes
  (`stat()` dans app.js → POST /hit, codes listés dans worker.js) ; seul le tracker connecté les lit (POST /login → jeton
  90 jours, GET /stats). Le Worker se modifie dans le tableau de bord Cloudflare (Edit code), pas depuis GitHub.
  Tracker de Léonard : `tracker.html` (noindex), ouvert par une zone invisible sous « Canal Telegram » dans le menu
  (`.dr-secret`). Bouton Actualiser = lecture en direct. Jours et heures à l'heure de Paris (table `h` : heure par heure).
  Graphiques dans le temps en courbes. « Articles les plus cliqués » = même calcul que le Top du moment du site. Chart.js 4.4.1 hébergé sur le site (`assets/vendor/`), script du tracker dans `assets/tracker.js`. Le « Top du moment » reste sur abacus
  (clics par article, public par nature puisqu'affiché sur le site).
- Aperçus de partage : `scripts/og.mjs`, lancé au déploiement (pas enregistré dans le dépôt) : `og/home.jpg` (accueil) et, par article,
  `og/<id>.jpg` (1200×630, produit détouré, titre, prix LoveGoBuy, 500 €) + `p/<id>/index.html` (balises d'aperçu, renvoi vers `/?p=<id>`).
  Le bouton Partager d'une fiche donne `/p/<id>/?v=2` ; « Partager le site » donne `/s/` (page d'aperçu de l'accueil, renvoi en JS, jamais de meta refresh). Polices : `scripts/fonts/` (Bricolage Grotesque, Instrument Sans).
- Sécurité : politique CSP en `<meta>` dans index.html et tracker.html (aucun script en ligne, aucun script externe ; ajouter
  tout nouvel hôte dans `connect-src`/`img-src`). Tracker : anti-cadre, `form-action 'none'`, pas de referrer.
  Worker : /hit refusé sans l'origine du site, 300 envois max / 10 min par appareil ; /login 8 échecs/h par appareil et 60 au total,
  IP jamais stockées en clair ; le jeton dépend de PASS (changer PASS déconnecte tous les appareils).

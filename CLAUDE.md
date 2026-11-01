# Notes de maintenance (pour Claude)

Propriétaire : Léonard (Vytoxx). Site : https://best-finds-vytoxx.github.io/ (dépôt best-finds-vytoxx/best-finds-vytoxx.github.io). Parle-lui en français, simplement. Il ne manipule pas GitHub lui-même :
c'est Claude qui enregistre et pousse chaque changement, puis vérifie le site en ligne.

## Règles

- Ne jamais afficher le prix des posts Telegram. Seul prix affiché : celui relevé sur LoveGoBuy (`data/prices.json`).
- Toujours lancer `npm test` avant de pousser. Le workflow relance aussi les tests avant de toucher au site.
- Après chaque push : attendre la fin du workflow (onglet Actions) puis contrôler le site en ligne.
- Ne pas modifier `data/articles.json`, `data/clicks.json` ni `images/` à la main : c'est le robot qui les écrit.
  Corrections manuelles → `data/overrides.json` (le robot les applique et refait la couverture).

## Fonctionnement

- `.github/workflows/update.yml` : toutes les 15 min → tests → `scripts/scrape.mjs` → `scripts/clicks.mjs` → commit → déploiement Pages.
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
- `data/overrides.json` : `{ "id": { "cover": n°photo, "category": "Bas", "kind": "wear|shoe|acc", "crop": [g,h,d,b], "hide": true } }`
  (`hide` retire l’article du site : lien mort, article plus disponible).
- `data/prices.json` : `{ checkedAt, items: { id: { cny, eur, pid } } }`, relevé dans le navigateur de Léonard sur les
  pages LoveGoBuy (le site LoveGoBuy bloque les robots). Le prix n'est affiché que si `pid` = lien actuel de l'article.
- Site : `index.html` + `assets/app.js` (routage par #, accueil à chaque arrivée) + `assets/style.css` + `assets/config.js`.
  Accueil : carte « liquid glass » (classe `.lg`) avec le panda détouré `assets/img/panda-hero.webp` sur la lumière floutée
  de la bannière (`hero-glow.webp`), puis les 3 aides pour commander. Couleurs d’identité : `--sun --terra --linen --navy --lgb`.
  Liquid glass sur tout le site : variables `--gl-*` et bloc « LIQUID GLASS SUR TOUT LE SITE » en fin de style.css ;
  la lumière floutée reste derrière chaque page (`html::before`). Pas d’italique, pas de police de code.
- Conventions du canal : vêtements photo 1 = face, photo 2 = dos ; chaussures récentes photo 1 = talons, photo 2 = face.
- Chat bot (`#aide`) : tableau `BOT` dans `assets/app.js`, réponses validées par Léonard (coupons 485 € ≈ 500 €, un coupon par colis ;
  délais 3–7 j + 6–18 j ; prix optimaux 500 g–5 kg, le volume compte ; remboursement 8 j / 5 j, sur le solde ; stockage 60 j ;
  ligne la moins chère entre LoveGoBuy EU, DHL, DPD ; suivi : Colis › Détails › numéro de suivi, puis AfterShip en Europe). Jamais : taxe 2 €/article, 1.1, rep, Vinted, Hacoo, noms de helpers.
  Groupe de discussion : `chat` dans `assets/config.js` (t.me/LoveGoBuy_fr).
- Statistiques : le site incrémente des compteurs anonymes par jour (`stat()` dans app.js, clés `dAAAAMMJJ-<code>` sur
  abacus) ; `scripts/stats.mjs` les relève à chaque passage et les écrit CHIFFRÉES (un bloc par jour, RSA-OAEP + AES-GCM
  avec la clé publique `scripts/stats-key.json`) dans `stats.enc.json` sur la branche `stats`. Le robot ne peut pas relire.
  Tracker de Léonard : `tracker.html` (noindex), ouvert par une zone invisible sous « Canal Telegram » dans le menu
  (`.dr-secret`). La clé privée y est chiffrée par le mot de passe (PBKDF2 600 000 + AES-GCM, `VAULT`), puis gardée
  non exportable dans IndexedDB de l'appareil. Changer le mot de passe = régénérer la paire de clés (les anciens jours
  deviennent illisibles). Bouton Actualiser : fichier chiffré + compteurs du jour en direct. Chart.js 4.4.1 (cdnjs).

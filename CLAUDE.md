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
- `scripts/cutout.mjs` : détourage (@imgly) + nettoyage (règles, boîtes, carton, vignette du canal) ; en cas d'échec
  sur un vêtement, seconde méthode `grabcut.mjs` (OpenCV). `watermark.mjs` repère la vignette panda « VYTOXX ».
- `data/overrides.json` : `{ "id": { "cover": n°photo, "category": "Bas", "kind": "wear|shoe|acc", "crop": [g,h,d,b] } }`.
- `data/prices.json` : `{ checkedAt, items: { id: { cny, eur, pid } } }`, relevé dans le navigateur de Léonard sur les
  pages LoveGoBuy (le site LoveGoBuy bloque les robots). Le prix n'est affiché que si `pid` = lien actuel de l'article.
- Site : `index.html` + `assets/app.js` (routage par #, accueil à chaque arrivée) + `assets/style.css` + `assets/config.js`.
- Conventions du canal : vêtements photo 1 = face, photo 2 = dos ; chaussures récentes photo 1 = talons, photo 2 = face.

# Best Finds — site automatique du canal Telegram

Le site lit le canal public **t.me/lovegobuy_france** toutes les 15 minutes.
Chaque nouveau post qui commence par 🔍 devient un article : titre, marque, catégorie, poids, description,
toutes les photos (téléchargées et compressées, donc elles ne disparaissent pas), une photo **détourée**
(fond supprimé automatiquement) et le lien LoveGoBuy du post. **Aucun prix n'est jamais enregistré ni affiché.**

À l'arrivée sur le site, un pop-up propose le lien d'inscription LoveGoBuy (500 € de coupons sur la livraison).

Tout tourne gratuitement sur GitHub : un robot (GitHub Actions) met les données à jour, GitHub Pages héberge le site.

## Mise en ligne (10 minutes, une seule fois)

1. Crée un compte sur github.com si tu n'en as pas.
2. Crée un nouveau dépôt **public** (bouton « New repository »), par exemple `best-finds`. Ne coche rien.
3. Dans le dépôt vide, clique sur « uploading an existing file » et glisse **tout le contenu** du dossier
   (y compris le dossier `.github` : sur Mac, affiche les fichiers cachés avec Cmd + Maj + .). Valide avec « Commit changes ».
4. Va dans **Settings → Pages**, et dans « Source » choisis **GitHub Actions**.
5. Va dans **Settings → Actions → General**, tout en bas « Workflow permissions » : choisis **Read and write permissions**, enregistre.
6. Va dans l'onglet **Actions**, ouvre « Mise à jour des articles » et clique **Run workflow**.
   Le premier passage lit tout l'historique du canal (≈ 300 articles) et les ajoute par lots de 40,
   les plus récents d'abord (téléchargement + détourage ≈ 10 min par lot). Les passages automatiques suivants
   terminent l'historique : tout est en ligne en 2 heures environ.
7. L'adresse du site s'affiche dans Settings → Pages (du type `https://ton-pseudo.github.io/best-finds/`).

Ensuite tu n'as plus rien à faire : chaque nouveau post du canal apparaît sur le site au plus tard 15 à 20 minutes après.

## Personnaliser

- Nom, phrase d'accroche, lien d'inscription et montant du pop-up : `assets/config.js`
- Logo et bannière : `assets/img/` (`logo.webp`, `banner.webp`, `banner-1200.webp`, `banner-mobile.webp`)
- Couleurs et polices : le haut de `assets/style.css` (`--bg`, `--ink`, `--accent`…)
- Le visiteur peut choisir fond crème ou fond blanc (bouton rond en haut à droite) ; le mode sombre suit son téléphone.

## Ce que le robot reconnaît dans un post

```
🔍Nom de l'article          → titre (la marque et la catégorie sont déduites du titre :
                              Hauts, Bas, Accessoires ou Ensembles)
💸Prix : ~21€               → ignoré : jamais repris sur le site
⚖️Poids: ~ 288g             → poids (les fourchettes 514-660g marchent aussi)
🔗lien LoveGoBuy (lien)     → bouton « Voir l'article sur LoveGoBuy »
photos de l'album           → photo détourée + galerie (jusqu'à 10 photos)
```

La description est rédigée à partir du post (type d'article, marque, poids, nombre de photos de contrôle).
Toute ligne qui parle d'argent (€, $, prix…) est écartée.

Le détourage tourne directement sur GitHub (aucun service payant). Il essaie la 1re photo, et si le résultat
est mauvais (fond mal retiré, objet à moitié transparent) il passe à la 2e puis à la 3e. Les règles graduées
posées à côté des articles sont retirées automatiquement dans la plupart des cas.

Les posts sans 🔍 (annonces, sondages, réponses) sont ignorés.
Si un post est modifié sur Telegram, la fiche est mise à jour au passage suivant.

## Classement « Top du moment » (clics sur les produits du site)

Le classement repose uniquement sur les clics faits sur le site, jamais sur les vues du canal Telegram.
Sont comptés, pour chaque article :
- l'ouverture de sa fiche (clic sur l'article depuis l'accueil, le catalogue, le Top ou les suggestions) ;
- le clic sur « Voir l'article sur LoveGoBuy » et sur « Copier le lien LoveGoBuy ».

Chaque visiteur compte au plus une ouverture et un clic LoveGoBuy par article et par jour, pour qu'une seule personne
ne puisse pas fausser le classement. Le Top et le tri « Les plus demandés » portent sur les 30 derniers jours.

Rien à configurer : les compteurs sont gérés par un service gratuit (Abacus) et le robot GitHub les relève à chaque
passage (toutes les 15 minutes) dans `data/clicks.json`. Avant les premiers clics, le Top affiche un message d'attente.
Pour remettre le classement à zéro, change `namespace` dans la section `clicks` de `assets/config.js`.

## Tuto pour commander

La vidéo est dans `assets/video/tuto.mp4` (convertie pour le web). Pour la remplacer, garde le même nom de fichier.
Les étapes cliquables sous la vidéo se modifient dans `assets/app.js` (liste `CHAPTERS`, en secondes).

## Réglages avancés (dans `.github/workflows/update.yml`, section `env` à ajouter si besoin)

- `BATCH` (40) : nombre d'articles ajoutés au maximum par passage.
- `RECENT_PAGES` (3) : pages relues à chaque passage une fois l'historique complet.

## Tester sur ton ordinateur

```
npm install
npm test           # vérifie la lecture des posts sur des pages capturées
npm run scrape     # lit le vrai canal et remplit data/ et images/
npx serve .        # ouvre le site sur http://localhost:3000
```

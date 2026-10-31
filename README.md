# Vytoxx Best Finds — le site du canal Telegram Vytoxx

Site : https://best-finds-vytoxx.github.io/

Le site se remplit tout seul à partir du canal **t.me/lovegobuy_france**. Tu n'as rien à faire sur GitHub :
pour un changement, demande-le simplement à Claude, qui l'enregistre et le met en ligne lui-même.

## Ce qui se passe automatiquement

Toutes les 15 minutes, un robot (onglet **Actions** de ce dépôt) :

1. lit les derniers posts du canal ; chaque post qui commence par 🔍 devient un article ;
2. récupère toutes ses photos, telles que publiées (sans perte de qualité) ;
3. choisit la photo de face (les choix vérifiés à la main sont dans `data/overrides.json`) ;
4. détoure cette photo (fond, boîte, règle et vignette du canal retirés) ;
5. range l'article dans sa catégorie : Hauts, Bas, Chaussures, Ensembles, Électronique ou Accessoires ;
6. met le site à jour.

Un nouveau post apparaît sur le site 15 à 20 minutes après sa publication.

## Pour que tes posts soient bien lus

```
🔍Nom de l'article        → titre (marque et catégorie sont déduites du titre)
⚖️Poids: ~ 288g           → poids affiché sur le site
🔗lien LoveGoBuy (lien)   → bouton « Voir l'article sur LoveGoBuy »
photos de l'album         → galerie et photo détourée
```

Le prix du post Telegram n'est jamais repris. Le site affiche le prix relevé sur la page LoveGoBuy
(`data/prices.json`), quand il a été relevé.

## Si quelque chose ne va pas

- Un rond rouge ✗ dans l'onglet **Actions** : le robot s'est arrêté avant de toucher au site (le site reste tel quel).
  Préviens Claude.
- Une photo de couverture à corriger, une catégorie fausse, un changement d'apparence : demande-le à Claude.

Les détails techniques (pour Claude) sont dans `CLAUDE.md`.

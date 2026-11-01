# Compteur privé (Cloudflare)

`worker.js` reçoit les compteurs anonymes du site (POST /hit) et ne les donne qu'au tracker connecté
(POST /login avec le mot de passe, puis GET /stats avec le jeton). Données dans une base D1.

Mise en place (tableau de bord Cloudflare, compte gratuit) :
1. Storage & Databases > D1 > Create : nom `vytoxx-stats`.
2. Workers & Pages > Create > Worker « Hello World » : nom `vytoxx-stats`, Deploy, puis Edit code :
   remplacer tout le code par `worker.js`, Deploy.
3. Worker > Settings > Bindings > Add > D1 database : nom de variable `DB`, base `vytoxx-stats`.
4. Worker > Settings > Variables and Secrets > Add, type Secret : `PASS` (mot de passe du tracker) et `KEY` (phrase aléatoire longue).
5. Adresse du Worker : https://vytoxx-stats.jean-plouy59.workers.dev (dans `statsUrl` de `assets/config.js`).

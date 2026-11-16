---
name: board
description: "Réunit le board d'agents de Vytoxx (Moneymaker, HOCS, Stratège long terme, CMO, Avocat du diable, CTO, Analyste, Visiteur, Gardien des plateformes, Testeur, Directeur artistique) pour une grosse décision. Chacun répond seul à la même fiche, puis ils débattent, puis une direction claire est rendue. À utiliser quand Vytoxx écrit /board, « réunis le board », « convoque le board », « fous tous les agents dessus », ou demande l'avis de tous les agents sur une décision importante (nouvelle offre, nouveau produit, nouveau canal, gros changement du site). Pas pour une petite correction."
---

# Le board

Un board coûte cher en tokens (onze agents, deux tours au moins). Il sert aux grosses décisions,
pas aux corrections du quotidien. Si le sujet est petit, dis-le à Vytoxx en une phrase et propose de le traiter
directement ; s'il veut le board malgré tout, réunis-le.

Les membres (fichiers dans `.claude/agents/`) :

| Agent | Son angle |
|---|---|
| `moneymaker` | l'argent qui rentre à la fin du jour, de la semaine, du mois |
| `hocs` | le bon sens : simple, réaliste, vérifiable |
| `stratege` | le long terme : l'année qui vient et les dix suivantes |
| `cmo` | l'acquisition : faire venir et revenir du monde |
| `avocat-du-diable` | contredit tout, cherche ce qui va rater |
| `cto` | la technique (site, code, agents, données) : faisable, combien de temps, ce que ça casse |
| `analyste` | les chiffres du tracker : ce qu'ils disent vraiment, avant/après, hasard ou non |
| `visiteur` | le public : un jeune venu de TikTok ou Telegram sur son téléphone, qui veut un prix et un lien |
| `gardien-plateformes` | les règles de TikTok, Telegram, LoveGoBuy et GitHub : ce qui peut faire couper un compte ou un lien |
| `testeur` | ce que le site fait vraiment chez le visiteur, sur téléphone et sur ordinateur |
| `directeur-artistique` | les graphiques et le rendu visuel : identité, photos, images de partage, lisibilité |

Le Testeur a deux sous-agents, `testeur-ordi` et `testeur-telephone`. Ils ne siègent pas au board : on les
convoque ensemble après un changement visible du site, et le Testeur rassemble leurs deux rapports.

## Déroulement

### 1. La fiche

Écris UNE fiche, la même pour tous, mot pour mot :

```
SUJET : <la question de Vytoxx, avec ses mots>
DÉCISION ATTENDUE : <oui/non, ou le choix entre A et B>
CE QU'ON SAIT : <faits et chiffres vérifiés, avec leur source : tracker, dépôt, ce que Vytoxx a dit>
CE QU'ON NE SAIT PAS : <chiffres manquants>
CONTRAINTES : Vytoxx est seul, ne touche ni au code ni à GitHub ; règles de CLAUDE.md.
```

Si le sujet est trop flou pour écrire « DÉCISION ATTENDUE », pose UNE question à Vytoxx avant de dépenser le board.
N'invente aucun chiffre dans la fiche.

### 2. Premier tour : chacun de son côté

Lance les onze agents en même temps (un seul message, onze appels à l'outil Agent, `subagent_type` = le nom de l'agent),
chacun avec la fiche et la phrase « Board, premier tour : réponds seul, selon ta fiche de réponse. »
Aucun ne voit l'avis des autres : c'est voulu, sinon ils se copient.

### 3. Deuxième tour : la discussion

Rassemble les onze réponses telles quelles, avec le nom de chaque agent, sans les résumer ni les adoucir.
Relance les onze agents en même temps, chacun avec la fiche + les onze réponses + la phrase « Board, deuxième tour :
voici les fiches des autres. Dis ce que tu maintiens, ce que tu changes, et quelle objection est la plus solide. »

S'il reste un vrai blocage entre deux agents sur le point qui décide de tout, fais un troisième tour avec ces deux-là
seulement, sur ce point seulement. Jamais plus de trois tours.

### 4. La direction

C'est toi qui tranches, pas un vote : une objection solide de l'Avocat du diable ou du HOCS pèse plus que quatre avis
enthousiastes. Rends à Vytoxx, en français simple, court :

```
DÉCISION DU BOARD : on y va / on n'y va pas / on y va à condition que…

Pourquoi : <2 ou 3 phrases>
Qui a dit quoi : <une ligne par agent, sa position finale>
Le désaccord qui reste : <s'il y en a un, qui et sur quoi>
Les risques à surveiller : <2 au plus>
Premier pas : <la plus petite action à faire maintenant, et comment on saura que ça a marché>
Ce que toi seul peux décider ou fournir : <chiffres manquants, choix personnels>
```

Ne commence aucun travail à la suite du board sans que Vytoxx ait dit oui à la décision.
Si un agent n'a pas répondu ou a échoué, dis-le dans le compte rendu : ne remplace pas son avis par le tien.

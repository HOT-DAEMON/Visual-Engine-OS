# Nez — loi de placement des narines

Un défaut mesuré, une cause, un correctif ajusté sur les références, des preuves visuelles, et ce qui reste faux.

## Le défaut

`docs/NOSE-REFS-03-05.md` mesure sur les dessins de la réf. 03 une séparation des narines (écart des centres / largeur de la boîte du nez) de **0,381–0,496, médiane 0,431**. Le moteur donnait **0,300** pour le nez par défaut (mesure du rendu éclairé) :
les narines étaient collées à la columelle. Même `nostrils.columella = 1` n'atteignait que 0,365 (les 12 réglages testés étaient tous hors plage : 0,236–0,365) : la columelle ne suffisait pas, c'est la loi de placement qui était en cause.

## La cause (`src/face/nose/nostrils.ts`)

La narine était posée à `lo + extX`, c'est-à-dire contre le bord interne du couloir (`lo` = demi-columelle + 3 % de la largeur du nez), alors que le couloir va jusqu'à 78 % de la crête alaire (`hi`).
Nez par défaut : couloir 5,0 → 18,7 px, centre de la narine à 7,8 px, marge libre de 8,2 px jamais utilisée.

## Le correctif

Une constante `NOSTRIL_PLACEMENT = 0,42` : la narine est posée contre la columelle, puis s'éloigne de 42 % de la **marge libre** restante (`hi − lo − 2·extX`).

- **Ajustée, pas choisie à l'œil** : la valeur fait retomber le nez par défaut sur la médiane de la réf. 03 (0,432 contre 0,431).
- **Toujours dans le couloir** : la marge est calculée après réduction de la narine trop grande, donc elle n'atteint jamais `hi` (test sur 12 réglages, 2 côtés).
- **Les axes existants restent actifs** : la columelle module la séparation (0,394 → 0,469 pour 0 → 1), l'évasement et la largeur ne l'écrasent pas.

| Réglage | Avant | Après |
|---|---|---|
| défaut (silhouette éclairée) | 0,300 | **0,432** |
| défaut / pyramide / cloche-ailes (enveloppe) | 0,325 / 0,378 / 0,372 | 0,468 / 0,491 / 0,490 |
| columelle 0 → 1 | 0,236 → 0,365 | 0,394 → 0,469 |
| évasement, largeur, forme, taille, inclinaison (10 réglages) | 0,260 – 0,329 | 0,407 – 0,436 |

Validation : plage de la **réf. 05** (0,26–0,55, non utilisée à l'ajustement) ; 12 réglages dans la plage de la réf. 03.
**Limite assumée** : pyramide et cloche-ailes sont à 0,490–0,491 sous la mesure « enveloppe », à 0,005 du plafond mesuré (0,496) ; relever `K` les ferait sortir de la plage par le haut.

## Effet sur les visages

Seules les narines bougent (3 à 4 px sur un nez de 48 px). Régression visuelle sur `HEAD` propre : 34 cas `exact` ; après le changement 18 cas `changed`, RMS 1,6–8,95, au plus 1,15 % de pixels > 8/255, et la différence absolue ne montre que les narines (planche 01).
`hard-05` (encre) a un RMS élevé pour 0,12 % de pixels : deux petits points très contrastés sur fond blanc. Références mises à jour sciemment (`regress:update`) après examen des images.

## Preuves (`artefacts/nez-placement/`)

1. `01-avant-apres-visages.png` : 7 cas de régression (nez au premier plan) avant / après / différence ×4.
2. `02-dessous-avant-apres.png` : dessous éclairé à 40°, 3 nez, avant (ligne 1) / après (ligne 2).

Régénération : `scripts/artefacts-nose-placement.ts <dossier>` sur l'ancien commit (`git worktree`) puis sur l'arbre courant, puis `python3 scripts/compose-nose-placement.py <avant> <après> <sortie>`.

## Tests

`tests/nose-nostril-placement.test.ts` (6) : constante dans ]0,1[ ; défaut à ± 0,03 de la médiane r03 et dans la plage r05 ; 12 réglages dans la plage r03 ; columelle monotone (0 < 0,5 < 1, écart > 0,05) ; narines dans le couloir ; symétrie.
`tests/nose-lit-verify.test.ts` : plage respectée et **contrôle négatif** (l'ancien écart 0,300/0,432 reste détecté). `tests/relief-underview.test.ts` : plage sur 3 nez.

## Ce que ce correctif ne fait PAS

- **Le dessous éclairé se lit toujours comme un museau** : les narines écartées restent de petits creux ronds, loin des ouvertures sombres allongées de la réf. 04 (longueur du trait mesurée 0,215 de la largeur, aspect médian 1,52). Forme, longueur et profondeur des creux ne sont pas traitées.
- La constante `K` est un ajustement sur UNE médiane de dessins ; elle n'est pas une mesure anatomique sur des visages réels.
- Vue de face : la nouvelle position n'a pas de référence de face à comparer (les réf. 03/04/05 sont des vues de dessous).

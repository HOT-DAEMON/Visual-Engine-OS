# Rotation — couche de vérification de rendu des cheveux posés

Code : `src/verify/hair-pose.ts` (`checkHairPose`, exportée par `src/verify/index.ts`). Tests : `tests/hair-pose-verify.test.ts` (20, avec contrôles négatifs). Même vocabulaire que `checkHairBoundary` : `geometry` / `anatomy` / `style`, sévérité `error` ou `warn`.

## Contrôles
| Couche | Id | Ce qui est mesuré |
|---|---|---|
| géométrie | `pose.finite` | aucune coordonnée non finie (masses, mèches, lisière, liens) |
| géométrie | `pose.layers` | ordre et nombre des calques conservés |
| géométrie | `pose.strand-width` | largeur d'une mèche posée / de face ∈ [0,45 ; 1] par rangée (queues exclues `TIP_SHARE = 0,3`, tolérance `WIDTH_SLACK = 0,002 W`, valeur mesurée : max 0,655 px sur 253 000 rangées) |
| géométrie | `pose.root-glued` | racine d'une mèche à `spine` sur la coque projetée |
| géométrie | `pose.hairline-cross` | lisière posée sans auto-croisement (comparée à la ligne de base de face) |
| anatomie | `pose.shell-bound` | la coque reste dans/sur le crâne posé : 49 enveloppes de rangée entre `topY + 0,02 H` et `min(jawY, archY)` |
| anatomie | `pose.hairline-on-skull` | implantation sur la surface du crâne projetée |
| anatomie | `pose.alpha` | les mèches `over` s'effacent côté lointain (alpha ≤ attendu) |
| style | `pose.edge-step` | saut vertical du bord de la coque (avertissement) |
| style | `pose.hairline-smooth` | dents de scie de la lisière posée (avertissement) |

## Contrôles négatifs (le détecteur doit échouer sur une géométrie sabotée)
mèche étirée, mèche écrasée, racine décollée, lisière hors du crâne, lisière auto-croisée, coque gonflée de 20 px, `NaN`, fondu `over` supprimé, calques permutés ; cas `bald` : aucun contrôle.

## Corpus et résultat
10 coiffures × 3 graines × 7 lacets : **2 610 contrôles, 0 erreur, 80 avertissements** (`artefacts/rotation-hair-strands/verification.json`).

## Limites
- Les avertissements de style ne mesurent pas le chaos visuel des mèches longues (superpositions) : il faut un contrôle de « recouvrement de mèches `over` sur la peau du visage ».
- Aucune vérification de cohérence entre traits du visage posés et cheveux (oreille couverte/dégagée).
- Corpus à 3 graines : le corpus multi-graines de la tranche 10 (≥ 10 coiffures, plus de graines, −45° à +45°) reste à étendre.

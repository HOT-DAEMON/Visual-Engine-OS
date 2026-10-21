# Dépendances et trois déformations (T10, T12)

## Dépendances entre paramètres (`face/structure/dependencies.ts`)

Table déclarative `DEPENDENCY_RULES` (id, `when`, `recompute`, `preserve`) lue par les tests : chaque paramètre `when` est poussé, chaque grandeur `recompute`
DOIT changer, chaque grandeur `preserve` NE DOIT PAS bouger (`tests/face-structure.test.ts`). La table ne peut donc pas mentir.

| Règle | Déclencheur | Recalculé | Préservé |
|---|---|---|---|
| chin-projection | `chin.projection` | raccord latéral, sillon labio-mentonnier, ombre sous-mentonnière | longueur de la mandibule, largeur du cou, crâne |
| chin-width | `chinWidth` | largeur du menton | hauteur du gonion, cou, crâne |
| jaw-bone-width | `jawWidth` | silhouette, longueur du corps | crâne, largeur du menton |
| masseter-volume | `softTissue.masseter.volume` | silhouette | os, crâne, menton |
| fat | `softTissue.fat` | silhouette, angle apparent | os, crâne |
| mouth-open | `mouth.open` | abaissement, dents inf., bas de la lèvre inf., platysma | os, dents sup. (haut), crâne |

Formules (une seule fois, `resolveDependencies`) : raccord latéral `(2–7 % W) × (0,7 + 0,8 × projection)` ; ombre sous-mentonnière
`(3–8 % H) × (0,8 + 0,9 × projection) × (1 + 0,4 × épaisseur)`. Une ligne fausse de la table (ex. « chin-width recalcule le raccord latéral ») a été
détectée par ce test puis retirée : la table décrit ce que le code fait réellement.

## Trois déformations (`schema/face-deform.ts`)

- A — morphologique : tous les paramètres hors `deform` (forme de base, fixée à la génération).
- B — articulatoire : `deform.articulation` (`jawShift`, `protrusion`, `headPitchDeg`, `clench`) + `mouth.open` ; pose de la mandibule par skinning à poids (`MOUTH.md`).
- C — expressive : `deform.expression` (`smile`, `grimace`, `anger`, `caricature`) → pulsions de tissu (`face/deform/expression.ts`).

Coefficients à intensité 1 : sourire = commissures +2,2 % H en haut, +2 % W vers l'extérieur, joues +1,4 % H ; grimace = commissures +3,5 % W, lèvres tendues, dents découvertes ;
colère = lèvre supérieure +1,4 % H, ailes +12 %, plis ×1,7 ; moue = commissures vers le bas + fronce du menton. `gain = 1 + 1,5 × caricature` multiplie tout.

## Comment elles se combinent sans s'écraser

1. Les déformations B et C sont des DÉPLACEMENTS ajoutés à A ; elles ne réécrivent jamais un paramètre de A.
2. L'expression ne lit pas l'ouverture, l'ouverture ne lit pas l'expression (test).
3. L'expression est une SOMME : sourire(0,5) + grimace(0,5) = somme des pulsions (test, tolérance 1e-9).
4. Le contour osseux n'est jamais déplacé par l'expression : gonion, largeur de menton, os, contour du crâne identiques (test sur 6 mouvements, mâchoire massive).
5. Champ de tissu (`field.ts`) : somme de noyaux gaussiens (commissures, joues, lèvres) ; les courbes de plis sont DÉPLACÉES par ce champ (le pli se creuse et glisse).
6. Maintien du volume : une région déplacée est ramenée à son aire d'origine par homothétie centrée (`volume.ts`) ; l'étirement mesuré est exposé (`stretch`).

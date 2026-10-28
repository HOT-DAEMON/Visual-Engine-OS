# Rubans de trait v2 — cellule 01 (`01-tousled`)

Suite de `HAIR-GRAMMAR-RIBBONS.md` (v1). La v1 donnait des traits gras et irréguliers, des tons plats à 2 niveaux ; la v2 corrige l'extraction à la source.

## Ce qui change
| Problème v1 | Cause | Correction v2 (`analyze-01b.py`) |
|---|---|---|
| Traits gras, masses noires écrasées | plafond absolu de largeur 3,4 px sur tout | **masses pleines** séparées (`solids`) : ce qui survit à une ouverture par un disque de 2,4 px, reconstruit et contouré (anneaux, trous évenodd) |
| Traits en lambeaux | moyenne glissante sur un squelette de 1 px | **spline lissante** (`splprep`) par branche, rééchantillonnée ~2,5 px |
| Pointes brutes | capuchon rond partout | **effilement** (0,25 → 1) sur 28 % de la longueur (≤ 5 px) aux seules extrémités **libres** ; largeur plancher 0,3 px |
| Tons plats | 2 niveaux, gris choisis | **5 bandes**, seuils 246/236/222/205/180, gris = **moyenne mesurée** dans la bande (242/229/214/195/130) |
| Contour en escalier | contours bruts | lissage circulaire du contour + `approxPolyDP` |
Piège évité en cours de route : une 1re version retirait les masses du squelette → arcs **en pointillés** et blobs lourds ; le squelette est désormais pris sur l'encre complète (les masses se superposent, union de noirs).

## Format (`profiles/tousled.ribbons.json`)
`ribbons[]` (points `(u, v, w)` en hauteurs de tête), `solids[]` (`role`, `ring`), `tones[]` (`level`, `gray`, `rings`). Rendu : papier → bandes claires→sombres → un seul `<path>` d'encre (masses + rubans). Rubans en polyligne à 1 décimale (écart avec Bézier < 0,1 px).

## Résultats mesurés (`artefacts/hair-grammar-ribbons/metrics.json` vs `metrics-v1.json`)
| Mesure | v1 | v2 |
|---|---|---|
| IoU de silhouette | 0,658 | **0,766** |
| Rappel d'encre (tol. 2 px) | 0,971 | **0,989** |
| Précision d'encre | 1,00 | 1,00 |
| Part d'encre (réf. 0,213) | 0,180 | **0,209** |
| Écart perceptuel (flou) | 0,0518 | **0,0384** |
| Construction SVG (médiane) | 6,4 ms | **4,1 ms** |
| Rastérisation 312 px (médiane) | 9,0 ms | 7,8 ms |
| Taille SVG | 92 Ko | 99 Ko |
Machine à 1 cœur, 15 passes après échauffement. Le SVG n'est **pas** plus léger qu'en v1 : il contient plus de matière (187 rubans + 14 masses + 5 bandes) ; le polyligne l'a ramené de 173 à 99 Ko. La rastérisation gagne peu : elle est dominée par la surface remplie, pas par le nombre de nœuds.

## Vérification (3 couches, 15/15 vertes)
Géométrique (finitude, rubans/masses/tons dégénérés), anatomique (volume au-dessus du crâne, débord avant, largeur, frange vs nez, mèches vs menton), style (épaisseur médiane/maximale, rapport longueur/largeur, 3 à 6 niveaux de ton, **gris strictement décroissant avec le niveau**). Les seuils encadrent la référence : ils protègent d'une dérive, ils ne prouvent pas la ressemblance. Le plafond d'épaisseur (5,1 px) découle de la règle d'extraction (diamètre du disque de masse).

## Verdict honnête
Net progrès structurel et visuel (preuves `04`, `05`), mais **la cellule 01 n'est pas « parfaite »** : voir `HAIR-GRAMMAR-RIBBONS-REMAINING.md`. Source = 188 px par cellule, JPEG : le plafond de fidélité est celui de l'image.

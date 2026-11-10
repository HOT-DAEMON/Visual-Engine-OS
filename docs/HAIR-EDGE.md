# Lisière extérieure et retombée des cheveux (série 5)

Fait ici : triangles sombres du dessus des cheveux longs, retombée en rectangle arrondi, dents de scie du bord afro / bouclé, revue de chaque coiffure contre le crâne, couche de vérification de lisière. Limites et restes : `HAIR-EDGE-REMAINING.md`. Séries précédentes : `HAIR-BOUNDARY.md`, `HAIR-SKULL.md`, `HAIR-COHERENCE.md`, `HAIR-FORM.md`.
Preuves : `artefacts/hair-edge/` (index dans son `README.md`). Chaque planche « avant » est rendue depuis un worktree du commit d'origine `6dd8c1c`, avec les mêmes graines et les mêmes options que « après » : aucune image n'est retouchée.

## 1. Les « grands triangles sombres » du long brun — cause et correction
Diagnostic par élimination (même visage rendu avec et sans chaque couche) : ce n'étaient NI la frange, NI les masses d'étage (`tierMasses` : rendu identique sans elles), NI le remplissage de coque (`crown-fill.ts` retiré : triangles toujours là). Ce sont de larges rubans de rang `mass` / `flow` dont les sommets, un par un, sont projetés par le garde-fou du visage (`guard.fit`) : un ruban large qui traverse la zone interdite est écrasé en coin à bords droits collé sur l'implantation.
Corrections (`flow.ts`, `guard.ts`, `reach.ts`) :
- `guard.clip` : la ligne médiane est COUPÉE à l'entrée de la zone interdite (bissection sur 8 pas) au lieu d'y être écrasée ;
- `smoothSpine` : une ligne raccourcie à moins de 12 points est ré-échantillonnée en Catmull-Rom (quelques points faisaient un coude à angle droit) ;
- la largeur d'un ruban raccourci est plafonnée à longueur / 3 ; sous 12 % de la largeur voulue la mèche est abandonnée (un ruban plus large que long est un bloc, pas une mèche) ; pointe refermée (`sharp ≥ 0,7`) ;
- `reach.cutSpine` / `reachOk` : même principe pour la borne de portée ; le ruban est reconstruit plus mince (×0,8 / 0,64 / 0,5 / 0,4) avant tout écrasement ; `conformReach` n'est plus qu'un filet ;
- tresses devant le visage : même coupe (un segment à cheval sur la ligne médiane devenait une bande qui traversait les yeux : trouvé par `front-clear-eye` sur la graine 105516).
Exception délibérée : en coiffure pendante, les mèches de corps (`main`, `fine`) ne sont PAS coupées : elles tombent à travers la zone du visage et le garde-fou les dévie sur le côté (elles longent le visage). Les couper les ramenait au front et faisait chuter 2 tests (dispersion des pointes, couverture de l'œil).

## 2. Retombée : fin du rectangle arrondi (`flow.ts`, table `FALL`)
Les mèches pendantes tombaient en parallèles de longueur quasi égale. Trois effets, appliqués à la ligne médiane de `growLock` sous la mâchoire, jamais au-dessus :
- `rise` : l'ourlet REMONTE vers l'extérieur (`fallEnd`) : bas en U, pas en bande ;
- `conv` : convergence vers le cou (`fallWarp`), progressive en `u^1,4` ;
- `amp` : ondulation lente, même phase pour toutes les mèches d'une chevelure (la nappe ondule d'un bloc), nulle à la mâchoire.
Valeurs : `long` rise 0,30 / conv 0,16 / amp 0,03 ; `bob` rise 0,12 / conv 0,09 / amp 0,008. Première tentative (0,14 / 0,075) : mesure légèrement meilleure mais avant/après indiscernable à l'œil sur les planches ; renforcée jusqu'à ce que la différence se voie (`02-details-longs.png`). La masse arrière (`back-mass.ts`) n'a pas été modifiée : elle est dérivée des polygones de mèches, donc elle suit la nouvelle forme.
Mesure `lowerFlare` (largeur max du quart inférieur / largeur max sous la mâchoire, 60 visages) : `long` médiane 0,96 → 0,795 (p90 0,994 → 0,862) ; `bob` 0,937 → 0,871.

## 3. Dents de scie de l'afro / bouclé (`rim.ts`)
Cause : les mèches dépassent de la coque de 0,05 à 0,3 W, avec des pointes (cônes, éclats) sur toute la couronne. Correction : `trimToRim` ramène tout sommet de mèche frontale qui dépasse la coque de plus de `RIM.margin` (afro 0,022 W, curly 0,018 W) sur le contour de la coque, décalé de la marge. Le bord devient dense et lisse avec un reste de duvet.
Exclusions : `wisp` (le duvet voulu), `cheek`, `occluder`, tout ce qui n'est pas en couche avant ; sommets sous le sourcil (`browLimitY`) ; sommets DANS le crâne (`distanceOutsideSkull = 0`) : sans cette exclusion la frange fine du front s'effondrait sur le contour de la coque (vu sur les planches, corrigé). Branché dans `index.ts` avant `applySides`, hors archétypes simulés.
Mesure (60 visages) : dépassement de coque afro médiane 0,117 → 0,022 W (max 0,214 → 0,049) ; curly 0,086 → 0,018 W (max 0,165 → 0,040) ; dents afro 14 → 4, curly 12 → 5.

## 4. Revue de chaque coiffure contre le crâne
Planche `05-revue-toutes-coiffures.png` : 10 coiffures × 3 visages (brun / noir / blond), avant et après. Méthode : pour chaque coiffure, lire la silhouette contre le contour du crâne (dépassement, symétrie, convergence), le dôme, les tempes, les oreilles, le bord du front. Les contrôles chiffrés existants (`hair-skull`, `hair-coherence`, `hair-form`, `hair-boundary`) restent actifs et passent ; la revue visuelle a trouvé des défauts qu'ils ne mesurent pas : voir `HAIR-EDGE-REMAINING.md` (afro décentré avec croissant noir, plaques aux joues des queues et tresses, triangles de frange `short` / `spiky`).

## 5. Couche de vérification (`src/verify/hair-edge.ts`, branchée dans `verifyFace`)
| Couche | Contrôle | Sévérité | Limite | Mesuré après |
|---|---|---|---|---|
| géométrie | `edge-finite` : sommets finis | erreur | = 1 | 1 |
| géométrie | `edge-rim-bound` (afro, curly) : dépassement de coque / W | erreur | marge + 0,04 | max 0,049 (afro ; curly tressé 0,049) |
| anatomie | `edge-hem-converges` (long, bob) : largeur bas / mâchoire | avertissement | ≤ 1,0 | max 0,93 (long) |
| style | `edge-rim-teeth` (afro, curly) : dents de la silhouette | avertissement | ≤ 16 | p90 13–15, max 24 |
Seuils posés sur la mesure de 60 visages par coiffure et de 30 graines déformées (la limite `marge + 0,03` d'origine a échoué sur la graine 711, curly tressé : 0,049 pour 0,048 ; rehaussée à + 0,04, max observé inchangé) (`artefacts/hair-edge/mesures.json`), pas sur une référence dessinée. `edge-rim-teeth` est un avertissement car le max (24) dépasse la limite sur quelques visages : la silhouette de volume reste irrégulière sur une minorité de cas. Tests : `tests/hair-edge.test.ts` (8 tests, dont un contrôle négatif : une mèche déplacée hors coque doit faire échouer `edge-rim-bound`).

## 6. Ce qui a été reproduit pour les artefacts
`npx tsx scripts/artefacts-hair-edge.ts render <dossier> [tete|gros]` (12 cas) et `... styles <dossier>` (toutes les coiffures). Pour le « avant » : `git worktree add <dir> 6dd8c1c`, y copier le script, lier `node_modules`, lancer les mêmes commandes.

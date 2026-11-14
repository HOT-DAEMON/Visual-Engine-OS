# Coiffure `spiky` : vraies pointes, dessin 2D et 3D

Branche `feat/hair-grammar`. Preuves : `artefacts/hair-3d/` (`details.png`, ligne 2). Reste à faire : `HAIR-3D-REMAINING.md`.

## Cause racine (2D)
`coneLocks` (`src/face/hair/shapes.ts`) n'agissait que si le tirage aléatoire `flow.mode ∈ {cones, mixed}` : la plupart des `spiky` n'avaient aucun cône. Et `fitReach` ramène toute mèche trop longue à la même hauteur : un dessus crénelé uniforme (« bloc »).

## Correction à la source (2D)
`SPIKY_CONES` (`shapes.ts`) : pour `style === 'spiky'` les cônes sont **toujours** actifs : au moins 12, netteté ≥ 0,8, groupes de 2 (et non 3 : les cônes se fondaient en créneaux), largeur de base 4 – 9 % de W, longueur tirée dans le budget `REACH.spiky.up` à 50 – 95 % (au plus 0,34 H) : des pointes de longueurs inégales qui ne sont plus écrasées par `fitReach`. Les autres coiffures sont inchangées (`spiky` seul).

## 3D
- `HairPart` `{ kind: 'spike' }` (`hair-volume-types.ts`) : racine (azimut, hauteur), direction (`up`, `out`, `sx`), longueur, rayon, puissance du profil.
- `spikesOf` (`hair-features.ts`) : (1) les cônes 2D `kind: 'cone'` sont repris tels quels (racine, direction, longueur) : à 0° la silhouette est celle du dessin ; leur dx (axe x du monde) est décomposé en part sortante (sin az) et tangente (cos az) ; (2) le reste du dôme reçoit un semis déterministe (graine de coiffure) en anneaux (`SPIKE.rings`), hors du devant sous `frontYMax` et hors du contour déjà couvert, longueurs 55 – 95 % de la médiane 2D, plus couchés vers l'extérieur en descendant.
- `spike()` (`hair-parts.ts`) : cône concave `(1 − t)^power`, 8 sections, enfoncé de `EMBED` = 0,012 U dans la coque, pointe qui retombe de 6 % de sa longueur ; rastérisé avec le crâne (même rotation, même tampon).
- Contour : les épis sont du **même groupe de contour** que la coque (un trait entre épi et dôme laissait des marques sombres sur le crâne) : seule leur silhouette est cernée.
- `tube()` : repère robuste (axe x ou z selon la tangente) : un épi qui part droit de côté ne dégénère plus.

## Vérification
`geo.spike.outward` (cos ≥ 0,15 avec la normale de la coque : aucun épi ne rentre dans le crâne), `anat.spike.count` (≥ 12 : 28 sur la graine 9000), `anat.spike.len` (0,04 – 0,3 U : 0,079). `style.teeth` borné à 60 pour `spiky` (les pointes sont voulues).
Distinction de face (`styleDistinctness`) : spiky / short 0,11 – 0,17, spiky / buzz 0,18 – 0,42 (borne ≥ 0,04).

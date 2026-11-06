# Lisière du visage sur la tête en rotation

Relie `src/face/hair/boundary` (lisière du visage) à `src/head-turntable` (commit 327f2b9, tête complète en rotation). Fichiers neufs :
`hair-region.ts`, `hair-bridge.ts` ; modifiés : `types.ts` (`HairlineSpec.region` optionnel), `paint.ts`, `index.ts`. La planche de référence est inchangée (sans `region`, comportement d'origine).
Preuve : `artefacts/hair-shapes/02-tete-complete-en-rotation.png` (6 coiffures × 0°, 45°, 90°, 135°, 180°). Tests : `tests/head-hair-bridge.test.ts`.

## Principe
- Même paramétrage elliptique (`x = a sin θ`) des deux côtés : un azimut du visage est un azimut de la tête.
- Ordonnée : `U = 0,04 + (y − sommet) / (menton − sommet) × (1,05 − 0,04)` (`faceYToU`) ; 0,04 U = épaisseur de cheveux au sommet de la tête tournante.
- **Région** (`regionFromBoundary`) : polygone dans le plan déroulé (azimut°, U) = [côté gauche → front → côté droit → nuque] + points artificiels à ±190°.
  Il représente la **poche de peau entre implantation et patte** que la lisière à une valeur `y(azimut)` d'origine ne sait pas exprimer.
- Lisière lissée par coupe-coin de Chaikin (2 passes, points artificiels conservés), puis **champ de distance signé** mémoïsé (0,5° × 0,004 U ; ≈ 0,15 s) :
  un pixel = une interpolation. Intérieur → cheveux ; trait d'encre à ±0,00275 U du bord, sur les deux côtés.
- `headSpecFromFace(params, boundary, peau)` : spec complète (lisière, couleur de peau et d'ombre, couleur de cheveux et d'ombre) ; le reste de la spec de référence est repris tel quel.

## Vérification (`src/verify/head-hair.ts`, dans `verifyFace`)
géométrie : région finie, fidélité (chaque point réel de la lisière à ≤ 0,012 U du bord) ; anatomie : yeux, sourcils, bouche hors région ; style : tracé déroulé sans angle aigu (avertissement).

## Limites
Voir `HAIR-SHAPES-REMAINING.md` (volume de cheveux 3D, mèches longues, vent en 3D).

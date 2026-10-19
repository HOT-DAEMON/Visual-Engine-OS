# Couche de vérification du rendu

Code : `src/verify/` (`geometry.ts`, `anatomy.ts`, `style.ts`, `index.ts`, `types.ts`). Tests : `tests/hair-v2.test.ts` (bloc « génération v2 et vérification »).
Preuves : `artefacts/hair-v2/metrics.json` (300 seeds, détail par contrôle).

```ts
verifyFace(face: RandomFace): Report   // { ok, checks, failures, warnings }
```

Un contrôle porte `layer`, `id`, `severity` (`error` ou `warn`), `value`, `limit`, `message`. `Report.ok` = aucun `error` en échec.
Fonction pure : elle recalcule la géométrie et **compile la scène** pour inspecter le SVG réellement émis.

## Cohérence géométrique (`geometry`)

`finite` (aucun NaN/∞) · `min-vertices` · `non-degenerate` (mèches épaisses d'aire non nulle) · `bounds` (±1,8 W, −1,5…1,6 H) ·
`hairline-above-brow` · `face-interior-clear` (aucun sommet de mèche *avant* hors joue/occluder dans la zone centrale du visage) · `scene-compiles`.

## Cohérence anatomique (`anatomy`)

`eye-anchor-*` (canthus de l'œil = repère du visage, écart 0) · `eye-side-*` (pas de franchissement de la ligne médiane) · `eye-in-head-*` ·
`mouth-below-nose` · `front-clear-eye-*` / `front-clear-nose` / `front-clear-mouth` (recouvrement des mèches avant ≤ 0,02) ·
`occlusion-*` (mesuré = demandé ± 0,12) · `occluder-spill-*` (une cible non demandée reste libre) · `ear-covered|free|tucked-*` (couverture
mesurée sur la zone d'oreille) · `ear-height-*` · `occluder-attached` (warn) · `forehead-visible-fringe` (warn).

## Style artistique (`style`)

`cel-max-3-tones` · `cel-hard-edges` (aucun dégradé dans les bandes) · `cel-highlight-band` · `light-shadow-distinct` ·
`shadow-near-main` / `highlight-keeps-hue` (warn) · `gradient-differs` · `hair-skin-contrast` (warn) · `silhouette-asymmetric` (warn).
`paletteStats(faces)` : part de vives, familles de teinte, part avec dégradé.

## Résultats mesurés

300 seeds aléatoires v2 : **300/300 passent** sans erreur ; 0 mèche avant sur un œil, le nez ou la bouche. Les avertissements restants sont
esthétiques (cheveux de luminance proche de la peau, front peu visible sous une frange dense, asymétrie faible sur des coupes très courtes).
Le contrôle **détecte** une incohérence : un canthus décalé de 5 px fait échouer `verifyFace` (test dédié).

## Moteur de visage (nez, menton, mâchoire, peau, contact, contours)

`src/verify/face-engine.ts`, appelé par `verifyFace`. Trois couches chiffrées, une lumière de référence (azimut 330°, élévation 55°).
- **Géométrie** : nombres finis, polygones du nez non dégénérés, contour C1 (≤ 3°) et monotone, longueur du visage fixe quelle que soit la hauteur du menton,
  ombres ni collées (`≤ 0,55`) ni flottantes (part au contact `≥ 0,35`), écart ombre/composant, lumières de contour bornées.
- **Anatomie** : racine entre sourcils et ligne des yeux, racine plus étroite que l'écart des canthi, pointe entre racine et base, nez au-dessus de la bouche,
  narines DANS leurs ailes, sous la pointe, axe convergent, columelle respectée, sillon mentolabial entre lèvre et menton, mâchoire plus large que le menton,
  angle mandibulaire 95°–140°, abaissement ≤ ouverture, bouche dans le contour.
- **Style** : reflet non métallique (chroma ≤ 0,3), rugosité variée entre régions, reflets au bord doux, terminateur doux (net en `cel`), reflets qui suivent la lumière.
Chaque contrôle est testé en NÉGATIF (`tests/face-engine-verify.test.ts`) : on fabrique l'erreur, le contrôle doit la détecter. Rapport sur 120 visages :
`artefacts/face-anatomy/verification-report.json`.

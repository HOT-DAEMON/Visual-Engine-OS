# Profil 2D (`src/skull`) et mesures de voûte

Avant ce travail, `vaultPoints` (`skull/vault.ts`) ne lisait **aucun** des paramètres de voûte : seules la 3D (turntable) les lisait. Le contour de profil est l'enveloppe de toutes les coupes : il lit ce qui change la profondeur ou la hauteur, et pas ce qui ne change que la largeur.

## Ce que le profil lit (amplitudes en fraction de H, `PROFILE_VAULT`)

| Mesure | Effet sur le contour de profil | Preuve (déplacement max lo ↔ hi, en H) |
|---|---|---|
| `parietalFlat` | l'épaule de la calotte et le bregma montent vers le niveau du vertex (plat) ou descendent (pointu) | planche `03-profil-2d-lit-la-voute.png` |
| `parietalBulge` | l'éminence est repoussée vers l'arrière et le haut (±0,014 H, ±0,009 H) | idem |
| `parietalHeight`, `parietalAzimuth` | l'éminence monte / descend (±0,025 H), glisse le long du sommet → occiput | idem |
| `occipitalFlat` | occiput vertical (+) ou plus arrondi (−, amplitude volontairement douce) | idem |
| `occipitalSlope` | le bas de l'occiput recule (+) ou surplombe (−), ±0,02 H | idem |
| `nuchalLine` | l'inion sort vers l'arrière (±0,014 H) | idem |
| `glabella` | la supraglabelle avance (±0,012 H) | idem |
| `frontalFlat` | la bosse frontale recule (+0,01 H) | idem |
| `mastoid` + `mastoidSize` / `Direction` / `Slope` | modelé sous la peau derrière l'oreille (`mastoidDetail`, contours à 50 % et 15 %, **même fonction** que le relief 3D) | fonction partagée testée (taille, direction, pente) ; le dessin SVG lui-même n'est pas testé au pixel |

Chaque mesure de contour (hors mastoïde) est testée : le contour bouge de plus de 0,004 H entre −1 et +1, et le nominal (0) est identique à l'ancien contour **à 0** (`tests/skull-enlargement.test.ts`, bloc « profil 2D »).

## Ce que le profil ne lit pas, et c'est correct

`cranialBreadth`, `templeBreadth`, `frontalBreadth`, `temporalFlat`, `temporalHollow`, `planeTransition`, `parietalConvexity`, `asymWidth` : largeur seule, la silhouette de profil ne change pas (test : déplacement exactement 0). Ils se lisent de face et de dessus.

## Reste à faire

- Sutures (`suturesShow`) et `boneShow` : non dessinés en profil.
- Les amplitudes sont des conventions d'anatomie artistique bornées, pas calibrées sur des mesures.
- Le profil 2D et la 3D lisent les mêmes paramètres mais par deux codes : une pose clé de profil (90°) qui devrait venir du même modèle reste à unifier (voir `ROTATION-CONTRACT.md`).

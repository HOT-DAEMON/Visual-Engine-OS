# Pose 3D du visage (3/4) — `src/face/pose/`

Module de GÉOMÉTRIE PURE (pas de SVG) : donne, pour un lacet (`yaw`) et un tangage (`pitch`), la position projetée, le raccourcissement et la visibilité de chaque composant, plus la silhouette du crâne et du cou. **Il n'est pas encore branché au rendu** : les composants se dessinent toujours de face (voir `FACE-POSE-REMAINING.md`).

## Repère
x vers la droite de l'image, y vers le bas, z vers la caméra. `yaw > 0` : le visage se tourne vers la DROITE de l'image ; l'œil de gauche vient alors vers la caméra (plus large), celui de droite fuit (raccourci).

## Hiérarchie (parent → enfants → frères)
```
head ─┬ skull ─┬ forehead, earL, earR
      ├ face ──┬ browL, browR, eyeL ─ irisL, eyeR ─ irisR, nose, cheekL, cheekR, mouth
      ├ jaw ─ chin
      └ neck   (hérite de 55 % de la rotation : TWIST)
```
- Les positions locales sont dans le repère du PARENT ; une rotation du parent entraîne ses enfants (`tree.ts`).
- Les FRÈRES gardent leurs décalages relatifs : l'écart sourcil → œil en y est conservé à toute rotation (testé).
- Un nœud peut n'hériter que d'une fraction de la rotation (`ratio`) et porter une rotation propre (`own` : regard, mâchoire).

## Conséquences sur chaque enfant du visage
| Composant | Effet du lacet |
|---|---|
| Yeux, sourcils | raccourcissement `cos(azimut + yaw)/cos(azimut)` ; l'œil lointain est masqué à partir de `cos < 0,05` |
| Nez | saillie de 0,16 W : sa pointe glisse vers le côté de la rotation plus que la bouche |
| Bouche, menton, mâchoire | glissent avec la profondeur de surface (`zAt`) |
| Joues | raccourcies comme les yeux (azimut de surface) |
| Front | sur la surface du crâne |
| Oreilles | azimut ±78° : visibles de face, l'oreille lointaine disparaît à ≈ 9° |

## Crâne complet (`skull.ts`)
Ellipsoïde (rx, ry, rz = 0,92 rx) au-dessus de la mâchoire, cône tronqué dessous ; `zAt(x, y)` donne la profondeur ; `halfAt(y, yaw)` la demi-largeur projetée `√((hx cos θ)² + (hz sin θ)²)`.

## Cou complet (`neck.ts`)
Cylindre elliptique (a = demi-largeur, b = 0,85 a), axe légèrement en arrière (`zAxis = −0,12 rz`) ; demi-largeur projetée `√((a cos θ)² + (b sin θ)²)` avec θ = 0,55 · yaw.

## Preuves
`artefacts/hair-masses/05-pose-3-4-schema.png` : schéma à 0°, 20°, 35°, 50°, 70° (ellipses pleines = visible, pointillés = masqué). C'est un schéma de géométrie, pas un rendu de visage.
Tests : `tests/face-pose.test.ts` (6).

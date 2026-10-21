# Bouche structurée (T7) et articulation de la mandibule (T11)

Fichiers : contrat `schema/face.ts` (`mouth.*`), géométrie `src/face/mouth/{geometry,types}.ts`, rendu `render/face/structure/mouth.ts`.

## Éléments individualisés (`MouthGeo`)

| Élément | Champ | Contrôle |
|---|---|---|
| Lèvre supérieure / inférieure | `upperLip`, `lowerLip` (polygones) | `mouth.upperLip`, `mouth.lowerLip` (plénitude, épaisseur séparée) |
| Arc de Cupidon + tubercule | `cupid.{peakLeft,peakRight,dip,tubercle}` | `mouth.cupid.{depth,width,tubercle}` |
| Commissures G / D | `corners.{left,right}` | `mouth.cornerAsym` (−1…1) + expression |
| Ouverture + cavité | `cavity`, `gapPx` | `mouth.open`, `mouth.cavity` |
| Dents sup. / inf. | `upperTeeth`, `lowerTeeth` | `mouth.teeth.{upper,lower}` |
| Gencives, langue | `gums`, `tongue` | `mouth.gums`, `mouth.tongue` |
| Largeur | `halfWidth` | `mouth.width`, `mouth.fit` (adaptation à la mâchoire) |
| Courbure / irrégularité de la ligne | `closure` | `mouth.curve`, `mouth.lineWave` |
| Plis péri-commissuraux | `folds` | `mouth.cornerFolds` + champ de tissu |

La ligne de fermeture (41 échantillons) passe par les deux commissures, creuse au centre (`curve`) et peut onduler en S (`lineWave`).

## Adaptation au visage

`mouth.fit` mélange largeur absolue (0) et largeur proportionnelle à celle du visage à la hauteur de la bouche (1, référence 0,4 W) ; la bouche reste toujours
à moins de 80 % de la demi-largeur du contour (large sur mâchoire carrée, étroite sous un menton proéminent, extrême en caricature : tests).

## Maintien du volume (H)

L'épaisseur des lèvres est divisée par l'élargissement : aire ∝ largeur × épaisseur = constante (test : ±4 %). La tension (grimace) ne change pas l'épaisseur :
elle redresse la ligne (amincir sans allonger violerait la conservation). Le retroussement de la lèvre supérieure déplace ses DEUX bords ensemble ;
il ne sépare les lèvres que si les dents sont découvertes (`sep = clamp(1,3 × teethBare)`) : un sourire fermé n'a pas de fente (défaut trouvé, `ERRORS-5.md`).

## Articulation : modèle à deux os avec poids (`face/deform/skin.ts`)

Crâne immobile, mandibule mobile ; un point lié avec le poids `w` se déplace de `w × (translation de la mandibule)`.
Poids : centre de la lèvre inférieure 0,88 → commissure 0,3 (transition continue), dents inférieures 0,94, menton 1, lèvre supérieure 0.
Translation latérale (`jawShift`, ±2 % de W) : déplace dents et lèvre inférieure, pas les dents supérieures. Protrusion : remonte la denture inférieure.
Test : la lèvre inférieure descend plus au centre qu'à la commissure ; les dents supérieures ne bougent pas.

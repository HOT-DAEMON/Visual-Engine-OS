# Volume de cheveux 3D : la coiffure tourne avec la tête

Branche `feat/hair-grammar`. Fait suite à `HEAD-TURNTABLE-HAIR.md` (lisière seule) et à `HAIR-SHAPES-REMAINING.md` (« volume de cheveux 3D » restant).
Preuves : `artefacts/hair-volume/` (générateur `scripts/artefacts-hair-volume.ts`). Vérification : `HAIR-VOLUME-VERIFY.md`. Reste à faire : `HAIR-VOLUME-REMAINING.md`.

## Exigence de départ et décision
« Implémente une vraie rotation 3D de chaque coiffure, branchée sur la rotation du crâne et du visage déjà commencée ; n'invente pas une autre rotation. »
→ **Aucune rotation nouvelle.** Le volume est composé de maillages (`Mesh`) rastérisés par le MÊME rastériseur (`raster.ts`), avec le MÊME tampon de profondeur et la MÊME fonction `toCam` que le crâne, le cou et les oreilles. Les 10 coiffures non chauves (`buzz, short, spiky, curly, afro, bob, long, ponytail, bun, braids`) passent par ce chemin sans exception ; `bald` ne produit aucun volume (`hairVolumeOf` → `null`).

## Pipeline (fichiers neufs dans `src/head-turntable/`)
| Étape | Fichier | Rôle |
|---|---|---|
| silhouette 2D | `hair-silhouette.ts` | rastérise la masse réelle du moteur de cheveux 2D (`hairGeometry`) → demi-largeurs gauche/droite par rangée |
| volume | `hair-volume.ts` (+ `hair-volume-types.ts`) | convertit px → U avec l'échelle de la lisière (`faceYToU`), lisse, symétrise afro/curly, décide rideau (bob/long), pièces |
| coque | `hair-shell.ts` | surface du crâne (`skullSurfacePoint`, relief des bosses pariétales inclus) gonflée de l'épaisseur de la coiffure ; découpée à la lisière par un `clip` évalué par pixel |
| pièces | `hair-parts-spec.ts`, `hair-parts.ts` | chignon (ellipsoïde), queue, tresses (tubes) posés sur les sections du crâne |
| mèches | `hair-strands.ts`, `hair-hash.ts` | motif calculé par pixel depuis (azimut, hauteur) : colonnes entières → périodique, aucune couture, convergence au sommet |
| vérification | `verify-hair-volume.ts` | 3 couches (géométrique, anatomique, style) : `HAIR-VOLUME-VERIFY.md` |

Modifiés : `mesh.ts` (`PART.hair/hairPart/hairBun`, `Mesh.clip`, `skullSurfacePoint` partagé avec `headMesh`), `raster.ts` (appel de `clip`), `types.ts` (`HeadTurnSpec.hairVolume?`), `parts.ts`, `paint.ts` (branche cheveux), `engines/from-host.ts` (la spec issue d'un visage porte son volume), `verify-head.ts`, `verify-style.ts`, `verify-host.ts`, `index.ts`.

## Règles de forme
- **Épaisseur** d = demi-largeur de la silhouette − demi-largeur du crâne, au moins `T_MIN` (0,008 U) mesurée dans le plan horizontal le long du déplacement (sinon 0,004 devant où la profondeur est réduite).
- **Racines** : l'épaisseur croît de `T_MIN` à sa valeur pleine sur `RAMP` = 0,045 U depuis la lisière ; devant, sur `RAMP_FRONT` = 0,24 U de hauteur (pas de visière).
- **Masses rondes** (afro, curly) : gauche/droite moyennées → volume centré sur le crâne, jamais penché (le moteur 2D garde un souffle d'asymétrie).
- **Rideau** (bob, long) : sous la nuque, ouverture avant de 80° / 78° d'azimut (le visage et le devant du cou restent dégagés), évasement limité à 0,3 U/U, ourlet irrégulier par colonne (`hemY`), départ à la plus extérieure du cou et du crâne (`clearNeck`) : plus de fenêtre de peau dans le dos.
- **Profondeur** : `kzF/kzB` par coiffure (masses rondes = 1 ; longs lisses plaqués devant 0,5, reculés derrière 0,85–0,9).
- **Mèches** : droites/ondulées = colonnes de teinte propre qui dérivent ; bouclés/crépus = cellules de Voronoï éclairées en petits dômes ; tressés = côtes ; racines assombries près de la lisière ; creux plus sombres que la mèche.

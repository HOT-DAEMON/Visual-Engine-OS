# Bas du cou — suite 2 : fin du « seau » elliptique

Suite de `HEAD-TURNTABLE-NECK-CUT.md`. Défaut signalé : à tangage +30° et lacet 90°, la coupe du cou se lit comme un **seau elliptique** (grande ellipse brune pleine, bord net). Même avec la pente de 25°, le plan de coupe restait un plan : dès que la caméra passe sous le menton il est vu en ellipse (0,54 – 0,66 du cou à 30° / 90°, mesuré dans la suite 1).

## Principe (têtes issues d'un visage ; la planche garde son disque horizontal mesuré)

La référence `rotation-3d/01` (lignes du haut, caméra sous le menton) n'a jamais d'envers visible : le cou **continue** vers le bas et c'est le **bord du cadre** qui le coupe en ligne droite. On reproduit ce comportement :

1. **Plus de plan de coupe** : `neckMeshes` ne génère plus le disque ; le cou se prolonge de `NECK_EXT` = 1,0 U sous sa base (section constante : la cloche des trapèzes est déjà atteinte à `y1`). 1 U couvre un tangage de ±60° (la prolongation doit dépasser la ligne de coupe à toutes les vues ; 10 rangées).
2. **Coupe par le cadre** (`neck-clip.ts`) : le rendu ne dessine pas les pixels du cou sous la ligne horizontale de l'image passant par le point le plus bas de l'**anneau de l'orifice thoracique** (`neckCutRing`, l'ancien bord oblique coplanaire, conservé comme repère) vu sous la caméra courante (roulis, lacet, tangage, perspective). Le bas du cou est donc une droite, à la hauteur où se terminait l'ancienne coupe.
3. L'anneau oblique reste le repère anatomique (devant plus bas que la nuque, 25°) : il ancre clavicules et fosse sus-sternale (`engines/neck-relief.ts`, inchangé) et fournit les contrôles de géométrie et d'anatomie.

Fichiers : `mesh.ts` (`neckMeshes`, `neckCutRing`, `NECK_EXT`), `neck-clip.ts` (nouveau), `raster.ts` (argument `neckClipY`), `render.ts`, `verify-neck-cut.ts`. Fichiers inchangés : `engines/neck3d.ts`, `engines/neck-relief.ts`, `paint.ts`.

## Mesures

| Vue | Part de plan de coupe (pixels), avant | après |
|---|---|---|
| tangage 30°, lacet 90° | 0,54 – 0,66 (suite 1) | **0** |
| tangage 60°, lacet 0° / tangage 40°, lacet 45° / 30°, lacet 135° | 0,72 – 0,77 (suite 1, 60°) | **0** |

Planéité du bas du cou dans l'image (largeur de la dernière rangée / 6 rangées plus haut) : ≥ 0,9 pour les têtes issues d'un visage ; la planche (disque) < 0,7 à 30° / 90° : le contrôle n'est pas aveugle.

## Contrôles (`verify-neck-cut.ts`, 6 par tête issue d'un visage, 0 pour la planche)

Géométrie : `head.neck.cut.planar`, `.frame`, `.drop` (inchangés, lus sur l'anneau). Anatomie : `head.anat.neck.cut.tilt` (15° – 45°). Style : **`head.style.neck.cut.bucket`** (aucun pixel de plan de coupe aux vues de tangage 30° – 60° : `BUCKET_VIEWS`) et **`.flat`** (bas du cou droit, ≥ 0,9). Ils remplacent `.socle` et `.seen`. Tests : `tests/head-turntable-neck-cut.test.ts` (9).

## Preuves

`artefacts/face-perimeters-perspective/02-avant-apres-tete-3d-graine-11.png` et `-77.png` (grille lacet × tangage, avant à gauche, après à droite) ; `04-cou-tangage-plus30-graine-11.png` et `-77.png` (ligne tangage +30°).

## Reste à faire

- La coupe est une droite de cadre, pas une **ligne d'épaules** : pas de trapèzes ni de clavicules au-delà du cou, épaules plus étroites que la réf. 07 (inchangé).
- Le bas du cou est une droite horizontale à toutes les vues : sur les références en plongée (lignes du bas de `01`) le cou finit en V (col et fosse) ; non reproduit.
- La largeur de la prolongation vaut celle de la base de la cloche (≈ 0,8 U) : un buste très large sort aux vues de profil ; `NECK_EXT` = 1 U non optimisé en coût (rangées de maillage ajoutées : 10).
- Une scène qui compose `head_3d` sur un corps : la jonction cou / épaules du corps n'a pas été revérifiée avec la nouvelle fin de cou (les tests de jonction existants passent).
- 25° reste une convention non mesurée sur référence.

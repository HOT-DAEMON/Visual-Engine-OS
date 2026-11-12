# Coupe oblique du cou (orifice thoracique)

> **Mise à jour :** le plan de coupe décrit ci-dessous n'est plus généré pour les têtes issues d'un visage (il se lisait comme un « seau » à tangage > 0) ; l'anneau oblique reste le repère. Voir `HEAD-TURNTABLE-NECK-CUT-2.md`. Les contrôles `.socle` et `.seen` sont remplacés par `.bucket` et `.flat`.

Suite de `HEAD-TURNTABLE-NECK-BELL.md` et `-NECK-RELIEF.md`. Problème de départ : le cou finissait sur un **disque plat horizontal**, vu en grande ellipse dès que la caméra passe sous le menton (effet « buste sur socle »). Sur la vue de la planche (tangage 17,73°) il représentait **42 – 48 %** des pixels du cou ; les références `rotation-3d/03`, `05` et `07` montrent au contraire un cou qui se prolonge vers les trapèzes et les clavicules.

## Principe

Le plan de coupe suit l'orifice supérieur du thorax : le bord ANTÉRIEUR (manubrium, fosse sus-sternale) est plus bas que le bord POSTÉRIEUR (T1). Avec la caméra sous le menton, ce plan, tourné vers le bas et l'arrière, n'est vu qu'au-delà de la pente (25°) et très raccourci ; en dessous le cou continue simplement.

**Réglage : 25°, une CONVENTION.** Un manuel d'anatomie consulté pendant le travail (extrait CBSPD) décrit l'orifice oblique, ≈ 45° ; à 45° le devant descendrait de ≈ 0,2 U et sortirait du cadre commun. La pente de la plaque supérieure de T1 (≈ 25°) est une valeur **de mémoire, non revérifiée**. Pour une valeur sourcée, mesurer la réf. `rotation-3d/07`.

## Ce qui change (têtes issues d'un visage seulement ; la planche garde son disque)

| Fichier | Changement |
|---|---|
| `engines/neck3d.ts` | `CUT_TILT_DEG`, `CUT_SLOPE`, `isBellHead`, `neckCutY(e, z, y1)` ; sous `y1` la section est constante (pas de prolongement des lignes du crâne) |
| `mesh.ts` | `neckMeshes` : chaque colonne descend jusqu'au plan à son azimut ; la hauteur du bord est le **point fixe** de `y = y1 + pente·(z(y) − zc1)` (8 itérations) : bord exactement coplanaire ; normale du plan de coupe `(0, 1, −pente)` ; 30 rangées au lieu de 12 pour la cloche (planche : 12, identique) |
| `engines/neck-relief.ts` | clavicule et fosse sus-sternale ancrées sur la coupe locale (`neckCutY`) et non sur `y1` |

## Mesures (têtes issues de visages, graines 3, 5, 6, 11, 21, 40)

| Vue | Part du plan de coupe dans le cou, avant | après |
|---|---|---|
| planche (tangage 17,73°) | 0,42 – 0,48 | **0,000** |
| tangage 60°, lacet 0° | 0,89 – 0,94 | 0,72 – 0,77 |
| tangage 30°, lacet 90° | 0,59 – 0,69 | 0,54 – 0,66 |

Planche (disque conservé) : 0,26 — la mesure détecte donc bien l'ancien comportement.

## Contrôles (`verify-neck-cut.ts`, 6 par tête issue d'un visage, 0 pour la planche)

Géométrie : `head.neck.cut.planar` (≤ 1e-6 U), `.frame` (point le plus bas ≤ 1,5 U), `.drop` (devant − nuque 0,03 – 0,3 U). Anatomie : `head.anat.neck.cut.tilt` (15° – 45°). Style : `head.style.neck.cut.socle` (≤ 5 % à 17,73°), `.seen` (peint à 60° : 5 % – 90 %). Contrôles par tête : 91 → 97. Tests : `tests/head-turntable-neck-cut.test.ts` (8).

## Preuves

`artefacts/head-turntable-v7/02-cou-coupe-oblique-tete3.png` et `-tete5.png` (avant / après, tangage 0° – 60°) ; `03-tete-complete-tete3.png` et `-tete5.png` (toute la tête, tangage −45° – 60°, lacet 0° – 90°).

## Reste à faire

Voir `PIPELINE-HEAD-3D-REMAINING.md`. Propre à la coupe : à 90° de lacet la coupe se lit comme une tranche en biais, et le plan reste très visible sous 45° de tangage (0,54 – 0,66) ; la coupe est toujours un plan, pas une ligne d'épaules (pas de trapèzes ni de clavicules au-delà du cou, épaules plus étroites que la réf. 07) ; 25° non mesuré sur référence ; coût de calcul des 18 rangées ajoutées non remesuré.

# Membre supérieur — itération 04 : tronc redressé, omoplate, vue de dos

Branche `feat/hair-grammar`. Suite de `BODY-UPPER-LIMB-03.md`. Ce qui reste : `BODY-UPPER-LIMB-04-REMAINING.md`. Preuves visuelles : `artefacts/upper-limb-04/`.

## Consignes traitées (une par une)
| Consigne | Traitement | État |
|---|---|---|
| Modéliser le haut du dos et l'omoplate | `src/body/volume/back.ts` : lame, épine, angle inférieur, rhomboïde, infra-épineux, grand rond re-placés en cotes anatomiques | fait, **rendu visuel limité** (voir REMAINING) |
| Redresser la colonne du tronc | `trunk.ts` : surface dorsale (lordose comblée), bassin avancé, fessier abaissé, thorax inférieur approfondi | fait, mesuré |
| Mesurer la vue de dos | `scripts/body-refs/back-measure.ts` + masques `ref-01.*.silhouette.gz` | fait pour 0,5 h ; **partiel** au-delà |
| Fidélité pixel par pixel | IoU de profil, erreur de profondeur, bandes `profile-edges.ts` | amélioré, **pas parfait** |
| Couche de vérification géométrie / anatomie / style | `src/verify/back.ts` (`verifyBack`) + `tests/body-back.test.ts` | fait |
| Dossier d'artefacts avec la tête | `artefacts/upper-limb-04/` (image 01 : corps avec tête complète) | fait |
| Docs ≤ 200 lignes, suites si besoin | ce fichier + REMAINING (chacun < 200 lignes) | fait |

## Résultats mesurés (même outil avant/après, `scripts/body-refs/snap.ts`)
- Profil de `ref-04` (adultMale, yaw 90, zone cou → crête iliaque) : **IoU 0,801 → 0,840**, erreur de profondeur par ligne **12,9 % → 7,3 %**.
- Ligne avant poitrine → crête : −0,9° (ref-04 : −1°). Axe osseux C7 → crête : 0,8° (borne de la vérification ±4°).
- Vue de dos de `ref-01` (femme, largeur de silhouette à 0,5 h sous le cou) : 1,75 contre 1,71 têtes (+2 %).

## Méthode du redressement (`src/body/volume/trunk.ts`)
Les écarts ont d'abord été mesurés par bande (`profile-edges.ts`, unités de hauteur de tête), puis corrigés un à un :
1. **Fessier trop haut** : sommet du gaussien à la crête → déplacé de `navel+0,2 tl` à `navel+0,5 tl` (le dos débordait de 0,29 h dans la bande navel→crête).
2. **Lordose lombaire** : l'axe osseux `spine.z` est inchangé (les angles de Cobb restent vérifiés), mais la **surface** du dos n'en montre que 35 % (`FILL`) : les érecteurs comblent le creux. La cyphose reste entière.
3. **Thorax inférieur** : point-clé ajouté entre mamelon et taille, rapport profondeur/largeur 0,9 (le moteur manquait de 0,14–0,19 h).
4. **Bassin** : décalage antéro-postérieur lissé de la taille à la crête (`torso.pelvisShift`, défaut 0,3 ≈ 0,12 h). Une grille 3×3 (`pelvisShift` × `ribDepth`) a montré un IoU plat (0,837–0,843) et une erreur de ligne meilleure à 0,3 : défaut retenu pour cette raison, pas pour l'IoU.
5. Profondeur du bassin à la crête abaissée (0,78 → 0,64 × largeur).

Nouveaux paramètres (`VolumeParams.torso`) : `ribDepth` (± autour de 0,9), `pelvisShift` (défaut 0,3, ± 0,4 h). Nouvelles mesures (`VolumeSet.measures`) : `trunkLeanDeg`, `frontLineDeg`, `c7Y`, `t12Y`.

## Omoplate (`src/body/volume/back.ts`)
- **Cotes** : unité verticale `u` = une vertèbre thoracique = (T12 − C7)/12 ; sommet de la lame sur l'acromion du cadre, racine de l'épine ≈ 1 u plus bas, angle inférieur 5,5 u plus bas. En largeur, fractions de la demi-largeur biacromiale : bord médial 0,27–0,30, glène 0,80.
- L'ancienne omoplate faisait ≈ 0,25 h de haut : trop courte d'environ 60 %.
- **Atome caché** : nouvelle propriété `Volume.hidden` + option de rendu `showHidden`. La lame et l'angle inférieur existent dans les données (repères, vérification) mais ne sont pas dessinés : la peau n'occulte pas les os dans ce moteur, et la lame, dessinée, ressemblait à une plaque.
- Dessinés : épine (tiers médial seulement), infra-épineux et grand rond en coussinets plats ; rhomboïde re-placé sur le bord médial.
- Un tracé du bord médial en trait fin a été essayé puis retiré : isolé, il se lisait comme une aiguille.

## Vérification (`src/verify/back.ts`, 3 couches)
Géométrie : paire symétrique (≤ 0,08 h), centre à 0,30–0,80 × demi-largeur d'épaules, sections finies. Anatomie : hauteur de lame 4,2–6,8 vertèbres, angle inférieur à 7–10,5 vertèbres sous C7, épine oblique vers le haut et en dehors, axe C7→crête ±4°, ligne avant ±8°. Style : lame cachée par défaut, relief dessiné selon le palier musculaire. Deux contrôles négatifs prouvent que les contrôles échouent quand ils le doivent.

## Corrections annexes
- `tests/body-pixel.test.ts` : le contrôle « pas de NaN » portait aussi sur l'image PNG en base64, où « NaN » peut apparaître par hasard (faux positif apparu avec la nouvelle géométrie) ; il ignore désormais les `href="data:…"`.
- `scripts/body-refs/profile-iou.ts` : `profileFit` accepte des paramètres de volume.
- `references/anatomy/measures.json` : entrée `ref-01` (premières mesures en pixels), masques `ref-01.{back,front,side}.silhouette.gz`.

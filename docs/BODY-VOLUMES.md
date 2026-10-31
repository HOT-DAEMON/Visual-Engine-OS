# Volumes 3D du corps (`src/body/volume/`)

Couche **3D continue** ajoutée au moteur du corps : chaque muscle est un volume indépendant (sections elliptiques lofts), la caméra est libre,
l'éclairage vient des normales. Le moteur d'atomes 2D (`src/body/*.ts`) reste intact : cette couche est **ajoutée**, pas fusionnée.

## Principe : rendu = f(géométrie, matière, lumière, caméra)
1. `bodyVolumes(corps, ancre, paramsVolume)` → `VolumeSet` (pur, mémoïsé par contenu, immuable). **La caméra n'y entre jamais.**
2. `renderVolumes(set, options)` → SVG : projection orthographique, tri en profondeur, dégradé de section éclairé par les normales, occlusion
   aux extrémités, ombre de contact, fibres. Contours teintés peau, **jamais noirs**.
3. `volumeMarkup(...)` = les deux ensemble, mémoïsé (un point de vue déjà rendu coûte ≈ 0,2 ms).

## Modules (≤ 150 lignes chacun)
| Fichier | Rôle |
|---|---|
| `vec3.ts`, `camera.ts` | Vecteurs ; caméra `yaw` (0 face · 90 profil · 180 dos) + `pitch`, orthographique |
| `loft.ts` | Points de contrôle → sections (Catmull-Rom), repère (t,u,w), `ringPoint` (point + normale exacte) |
| `spine.ts` | Colonne : 4 bosses gaussiennes (cervicale +, dorsale −, lombaire +, sacrée −) ; angles de Cobb mesurés C2→C7, C7→T12, T12→S1 |
| `trunk.ts` | Enveloppe du tronc par hauteur (largeur, profondeur, ventre, fessiers), `point(y, ψ, lift)` + normale par dérivées, contrapposto appliqué **ici** |
| `neck.ts` | Cou elliptique sur la lordose cervicale |
| `front.ts`, `back.ts` | Muscles et repères du torse (liste ci-dessous) |
| `limb.ts` | Chaîne épaule→coude→poignet (abduction, balancement, flexion, pronation), muscles du bras et de l'avant-bras, tendons, veines |
| `hand3d.ts` | Paume, éminences, 5 doigts relâchés (3 phalanges + sphères MCP/PIP + pulpe + ongle), tendons du dos de la main |
| `shade.ts`, `render.ts` | Lumière globale (ambiant + clé + contour + reflet large), palette d'ombre rosée ; rendu SVG |
| `build.ts`, `markup.ts` | Assemblage, mesures, mémoïsation |

## Contrat d'un `Volume` (`types.ts`)
`id` unique · `kind` (muscle, os, graisse, peau, articulation, tendon, veine, repère) · `group` · `side` · `parent` (existant, vérifié) ·
`level` 0 enveloppe / 1 masses / 2 muscles / 3 fibres-repères-mécanique · `layer` (profondeur anatomique 0–8) · `tier` (palier de musculature qui
le révèle, `muscle-tiers.ts`) · `stations[]` · `fibres[]` (angles de section) · `origin`/`insertion` (lus par la vérification anatomique).
Composants indépendants : chacun se construit seul à partir du tronc/de la chaîne, aucun ne lit un autre muscle.

## Contenu exigé et livré
- **Dos** : trapèze supérieur/moyen/inférieur, rhomboïde, infra-épineux, grand rond, grand dorsal, érecteurs (médial + latéral), grand et moyen
  fessier, omoplate, épine de l'omoplate, sillon vertébral.
- **Face** : pectoral (chef claviculaire + sterno-costal, fibres en éventail), seins (adulte, projection propre), abdominaux **4 × 2 blocs tous
  différents** (hauteur, largeur, épaisseur, décalage G/D), oblique externe, dentelé (4 digitations), intercostaux (6 sillons/côté), ligne blanche,
  ombilic, crête iliaque, V inguinal, clavicule, sterno-cléido-mastoïdien, pomme d'Adam (si dimorphisme > 0,2).
- **Bras** : deltoïde en 3 chefs, biceps (2 chefs), brachial, triceps (3 chefs), brachio-radial, fléchisseurs, extenseurs, 3 tendons extenseurs, 2 veines.
- **Mains** : doigts relâchés (longueurs, orientations, flexions différentes, déterministes par `seed`), coussinets, éminences.
- **Posture** : courbures par axe indépendant, contrapposto (bascule épaules/bassin opposée + torsion + décalage), balancement par bras, ventre,
  profondeur du thorax, fessiers, coudes fléchis, pronation, sphères d'articulation (`joints: true`).
- **Hiérarchie** : dans la donnée (`level`, `layer`, `tier`) **et** dans l'image (`level` 0→3, écorché `hideFromLayer`, `mode: 'atoms'`).

## Options de rendu (`VRenderOpts`)
`skin`, `camera`, `light`, `level`, `mode` (`skin`|`atoms`), `hideFromLayer`, `joints`, `forceTier`, `trunkOnly`, `quality` (`full`|`fast`), `uid`
(préfixe des identifiants de dégradés : **un `uid` par SVG inséré dans une même page**, sinon le premier dégradé gagne).

## Vérification (3 couches, `src/verify/volume.ts`, 17 archétypes)
Géométrie : valeurs finies, repères orthonormés, ids/parents, muscles posés sur le tronc, yaw 0° = 360°, indépendance de la caméra.
Anatomie : 37 structures exigées, origine/insertion ≥ 85 %, angles de Cobb (bandes mises à l'échelle de la maturation), profondeur/largeur du thorax,
abdominaux irréguliers, 5 longueurs de doigts distinctes, 10 sphères d'articulation. Style : jamais de noir, contours ≤ 0,65 % de la tête,
hiérarchie des niveaux strictement croissante. Tests : `tests/body-volumes.test.ts` (symétrie miroir, mémoïsation, courbures, ventre/fessiers).

## Artefacts
`artefacts/body-volumes/` (`npx tsx scripts/artefacts-volume.ts`) : 01 vues libres · 01b face + tête du moteur de visage · 02 écorché par couches
(face, dos) · 03 hiérarchie · 04 atomes · 05/05b morphologies · 06/06b bras et mains · 07 posture · 08 tête complète (face + profil) ·
09 comparaison aux références · `rapport.json` (vérifications + temps).

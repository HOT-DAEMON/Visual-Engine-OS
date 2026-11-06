# Tête en rotation — branchement sur les moteurs existants

Suite de `HEAD-TURNTABLE.md`. Calage des paramètres : `HEAD-TURNTABLE-ENGINES-FIT.md`. Vérification : `HEAD-TURNTABLE-VERIFY.md`. Reste à faire : `HEAD-TURNTABLE-REMAINING.md`.
Preuves visuelles : `artefacts/head-turntable-engines/` (voir son `README.md`).

## Pourquoi ce document

La première version du module `src/head-turntable/` était un moteur NEUF posé à côté du dépôt : il n'importait que l'encodeur PNG (`core/png`) et réinventait l'oreille
(plaque ellipsoïdale), la mâchoire (sections annotées à la main), le cou (cylindre), le nez et la bouche. La consigne était de CONTINUER les moteurs existants.
Cette étape inverse la dépendance : la géométrie de la tête est DÉRIVÉE des moteurs `src/face/*`, `src/skull/*`, `src/geometry/eye/*` ; `head-turntable` ne garde que
ce qui leur manque (rotation 360°, caméra, rastérisation, contours, cadre de calage, vérification). Un test (`tests/head-turntable-engines.test.ts`) échoue si un
module du pont cesse d'importer l'un de ces moteurs.

## Carte : moteur existant → ce que le pont en tire (`src/head-turntable/engines/`)

| Moteur existant | Ce que le pont lit | Où |
|---|---|---|
| `face/landmarks` (`faceLandmarks`) | ligne des yeux, canthus, base du nez, bouche, menton, gonion, angle gonial, largeur du cou | `face-model.ts` |
| `face/outline` (`headOutline`, `halfWidthAt`) + `face/jaw` | demi-largeur a(y) de la tête de face, du crâne au menton | `rows.ts` |
| `skull/geometry` (`skullGeometry`) | profil de peau : front, nez, lèvres, menton (zf), dos du crâne (zb), repères nommés (glabelle, pronasale, pogonion…) | `profile.ts`, `rows.ts` |
| `skull/neck` (`xFront`, `xBack`, inclinaison) | faces antérieure et postérieure du cou, centre et profondeur de chaque section | `neck3d.ts` |
| `face/nose` (`noseGeometry`) | silhouette de la pyramide nasale → largeur du profil du nez ; narines ; ailes | `nose-mouth.ts`, `face-parts.ts` |
| `face/mouth` (`mouthGeometry`) | lèvres, cavité, dents, langue, ligne de fermeture → profil des lèvres et texture de la bouche | `nose-mouth.ts`, `face-parts.ts` |
| `face/ear` (`earModel`, `earPlacement`, `placeEarPoint`) | modèle complet de l'oreille (hélix, anthélix, conque, tragus, lobe…), hauteur, ouverture, relief | `ear3d.ts`, `ear-field.ts`, `ear-paint.ts` |
| `geometry/eye` (`openingGeometry`, `openingPolygon`) | polygone de l'ouverture de l'œil (paupières), coins | `face-parts.ts` |

## Unités et repères (`units.ts`)

Les moteurs travaillent en pixels d'hôte avec une hauteur de tête H. On les appelle avec **H = 1000 px : 1 px = 0,001 U**. Le crâne des moteurs va du vertex au bas du
menton ; la planche mesure du sommet des CHEVEUX : la coupe de cheveux ajoute `Y0 = 0,05 U` au-dessus du vertex (sans elle, la ligne des yeux de la planche, 0,629 U,
sortirait du schéma : `eyeLine ≤ 0,58`). Repère de profil des moteurs : x vers l'avant depuis le porion ; z_tête = `zPorion` + x (zPorion est ajusté).

## Table de sections dérivée (`rows.ts`)

Pour chacune des 27 hauteurs de la planche : **a** = `halfWidthAt(outline)` ; **zf** = plan du visage SANS nez ni lèvres, tiré des repères du profil de peau (le nez et les
lèvres sont des bosses posées dessus) ; **zb** = dos du crâne (chaîne arrière du profil), puis, sous la nuque, le **plan mandibulaire**. Ce dernier n'existe pas dans les
moteurs (le profil s'arrête au menton) : il est DÉRIVÉ de l'angle gonial du moteur, `α = angle gonial − 90° − ramus`, avec une courbure `mandArc` (le corps de la mandibule est
un arc), et fondu au dos du crâne par un maximum lisse. La coupe de cheveux étire le haut du crâne sous 0,4 U et ajoute une épaisseur `hairTh` sur les côtés.

## Oreille (`ear3d.ts`, `ear-field.ts`, `ear-paint.ts`)

1. `earModel(FaceEars)` donne les structures du plan (u avant→arrière, v haut→bas, relief signé). `earPlacement(p, landmarks, model)` donne hauteur et haut de l'oreille par la
   règle du moteur : racine de l'hélix sur la ligne des yeux, bas du lobe sur la base du nez.
2. **`placeEarPoint`** (nouvelle fonction exportée de `face/ear/project.ts`) place un point (u, v, h) dans le monde 3D avant caméra ; `projectPoint` (vues 2D du moteur
   d'oreille) est désormais « `placeEarPoint` + caméra de lacet » : une seule formule de placement, comportement inchangé (tests `ear-*` verts, test d'équivalence ajouté).
3. Attache : le bord antérieur est posé sur la surface du crâne à la hauteur y ET à la profondeur `zA = zPorion + cos α · x(conduit)` (section elliptique à ce z, pas la largeur
   maximale du contour).
4. Maillage fermé : face externe (relief du moteur, échantillonné dans `earField`), rebord, dos (relief inversé : la conque devient un bombement, l'hélix un bord). Rangées radiales
   depuis le centre du contour, une par point du contour : la silhouette est EXACTEMENT le contour du moteur. Chaque sommet porte (u, v) ; la rastérisation les interpole (`GBuf.uv`).
5. Peinture : par pixel, (u, v) → structure dominante, relief, distance aux arêtes « tracées » (hélix, anthélix, tragus, antitragus, conque, crus) interpolée bilinéairement. Les creux
   sont ombrés, les arêtes tracées à l'encre ; trait de la silhouette de l'oreille à 0,6 × celui de la tête (la planche a un trait d'oreille plus fin).
6. Paramètres du style (fixés, voir `engine-fixed.ts`) : ouverture 28°, largeur +0,78, racine d'hélix à 0,34. L'ouverture résout `w·sin α = 0,115` (vue de face) et `w·cos α = 0,146`
   (profil) → 38° ; ramenée à 28° pour la vue de 135° où un pavillon plan à 38° est de chant.

## Constat sur le moteur d'oreille (à décider, NON corrigé dans le moteur)

`placeEarPoint` applique `side × rotationDeg` dans le plan de l'oreille, mais le plan de l'oreille GAUCHE n'est pas miroité (u va de l'avant vers l'arrière des deux côtés) : avec
`rotationDeg ≠ 0` la rotation est donc inversée entre les deux oreilles (écart mesuré 0,067 U entre l'oreille droite et le miroir de la gauche, contrôle `eng.ear.mirror`). Le pont
compense (`rotationDeg: side × rotationDeg`). Corriger le moteur changerait le rendu des oreilles gauches des autres artefacts (`artefacts/ear-system`) : décision laissée au propriétaire.

## Cou, nez, lèvres, yeux, bouche

- **Cou** (`neck3d.ts`) : sections elliptiques ; demi-largeur = `lm.neck.half` ; centre et profondeur = `xFront`/`xBack` du moteur de crâne ; facteur `neckScale` (0,77) sur la profondeur
  (le minimum du moteur, 0,34 H, dépasse le cou de la planche) ; évasement de 10 % [mesuré]. Le haut du cou démarre DANS le crâne (y = 0,62) : son bord n'est jamais visible.
- **Nez et lèvres** (`nose-mouth.ts`) : z = profil de peau du moteur de crâne ; demi-largeur = silhouette du nez / polygones des lèvres du moteur ; ailes à la crête de l'aile du moteur de nez.
- **Œil** (`face-parts.ts`) : forme `round` de `openingGeometry`, hauteur réglée (3 corrections) pour que haut et bas tombent sur `hUp`/`hLo` mesurés ; iris, pupille, reflets : planche.
- **Bouche, narines** (`face-tex.ts`, `face-parts.ts`) : cavité, dents, langue, lèvres et ligne de fermeture du moteur de bouche ; narines du moteur de nez.

## Ce qui reste MESURÉ et non dérivé (étiqueté dans `spec.ts`)

Tailles d'œil et d'iris, sourcils, ouverture de la bouche, rougeur, lisière des cheveux (recalée sur la nouvelle tête), palette, tangage de caméra 17,73°, évasement du bas du cou.

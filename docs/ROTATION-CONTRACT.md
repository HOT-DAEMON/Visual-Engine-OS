# Rotation 2D/3D — contrat (étape 1, documentation seule)

Branche `feat/hair-grammar`. **Aucun fichier de code n'a été modifié pour cette étape.** Objectif : faire tourner un élément graphique autour de X, Y, Z dans l'espace puis le reprojeter en 2D, **sans** conversion en maillage ni volume. Tout ce qui suit a été mesuré sur le code (commandes en fin de document), pas déduit des commentaires.

## 1. Repère et conventions réellement implémentées

Repère commun aux quatre modules de rotation : **X vers la droite de l'image, Y vers le BAS, Z vers la caméra**, projection orthographique (x, y) ; Z ne sert qu'à la profondeur et à la visibilité.

| Axe | Geste | Sens positif mesuré | Où c'est implémenté | Manque |
|---|---|---|---|---|
| **Y** (lacet) | « non » | `yaw > 0` : un point de face `(0,0,100)` va à `x = +50` (le visage regarde la DROITE de l'image) | `face/pose/tree.ts` (`rotY`), `geometry/eye/turn3d.ts`, `lighting/head-turn.ts`, `head-turntable/math.ts` : **les quatre concordent** | aucun |
| **X** (tangage) | « oui » | `pitch > 0` : le même point va à `y = −34,2` pour 20° = **vers le HAUT** de l'image (la face se lève) pour `poseTree`, `turnPoint`, `toCam` et la lumière ; **vers le BAS** (`dy = +34,2`) pour `projectGaze` (`lighting/gaze3d.ts`) | idem ; `poseTree` l'applique **après** le lacet, autour du pivot de la tête | **ambiguïté signalée (§4)** ; le tangage déplace les positions mais pas les formes (pas de raccourcissement vertical : `FACE-POSE-REMAINING.md` n°7) |
| **Z** (roulis, dans le plan de l'image mais autour de l'axe de visée) | « pencher la tête » | — | `head-turntable/roll.ts` (voie volumétrique seulement) | **absent de `PoseNode`, de `poseTree` et de `turn3d.ts`** ; ne pas l'émuler par un `rotate()` SVG global |
| **Rotation 2D** | rotation de l'image | `HostSpec.transform.rotationDeg` | `render/host.ts` → `objectTransform()` | c'est la rotation de l'**objet dans la scène**, pas celle de la tête : ne jamais les confondre |

## 2. Contrat minimal (compatible avec le code actuel)

Six notions, avec ce qui existe déjà et ce qui manque :

| Notion | Existant | Manque |
|---|---|---|
| `localPosition` | `PoseNode.local` (px, repère du PARENT) | — |
| `localRotation` (X/Y/Z propres, degrés) | `PoseNode.own` : **Y seulement** | `ownX`, `ownZ` si un nœud doit les porter (regard, mâchoire) |
| `worldTransform` | résolu à la demande dans `poseTree` (`ratio` = fraction héritée) | pas exposé en matrice |
| `cameraTransform` | **confondu avec l'objet** : `yawDeg`/`pitchDeg` tournent la tête autour de `origin` | à séparer si une caméra doit bouger sans tourner l'objet |
| `projection` | orthographique `(x, y)`, échelle `scaleX = cos(az+yaw)/cos(az)` | perspective : n'existe que dans `head-turntable/math.ts` (`PERSP_*`) |
| `visibility / depth` | `Posed.z`, `visible = cos(azimut+lacet) > 0,05` | pas d'occlusion entre composants |

**Règle d'ordre (existante, à garder)** : lacet hiérarchique (parent → enfants, fraction `ratio`), puis tangage global autour du pivot `origin` (sommet du cou). Les frères gardent leurs décalages relatifs dans le repère du parent.

## 3. Exemple chiffré : trois rotations distinctes d'un même point

Point `P = (60, 40, 80)`, pivot `(0,0,0)`, 30° (résultat de `poseTree`, sauf Z) :

| Rotation | x | y | z |
|---|---|---|---|
| Y seul (lacet +30°) | 91,96 | 40 | 39,28 |
| X seul (tangage +30°) | 60 | −5,36 | 89,28 |
| Y puis X (+30°, +30°) | 91,96 | 15 | 54,02 |
| Z seul (roulis +30°) — **formule du contrat, non implémentée** | 31,96 | 64,64 | 80 |

Trois comportements distincts : Y change x et z, X change y et z, Z ne change que x et y. Seules les deux premières lignes sont exécutées par du code existant.

## 4. Ambiguïtés signalées (non tranchées : décision à prendre)

1. **Signe du tangage.** `schema/eye-head-turn.ts` écrit « `pitchDeg > 0` : la tête s'incline vers le bas (menton rentré) ». `poseTree`, `turnPoint`, `toCam` et `rotateLightForHeadTurn` font monter la face (`y` négatif). Seul `projectGaze` (réutilisé par `headTurnOf`) fait descendre. L'œil `sphere` combine `turnOpening` (vers le haut) et `headTurnOf` (vers le bas) : voir `ROTATION-STEP-03-EYES-RESULT.md`. **Je ne corrige rien tant que le sens voulu n'est pas fixé.**
2. `azimuthDeg` est borné à ±55° dans `HeadTurn`, alors que `PoseNode.azimuth` va jusqu'à ±90° (profil) : deux plages pour la même grandeur.
3. `random-face-anatomy.ts:110` utilise aussi `azimuthDeg` pour la **lumière** (0–360) : même nom, autre sens.

## 4 bis. Chemin réel jusqu'au rendu SVG (mesuré, pas lu)

Trace d'exécution V8 (`NODE_V8_COVERAGE`) d'un `compileScene` sur `generateRandomFace(11)` (objets `host, eye, eye`, 972 460 octets de SVG) :

- **Appelés au rendu** : `render/host.ts` (`compileHost`) → `render/face/face.ts` (`hostFace`, `faceParts`, `faceSurface`, `skinAppearance`, `contactSpecs`) → `face/outline.ts` (`headOutline`, `halfWidthAt`) ; cheveux : `render/face/hair.ts` (`renderHair`) ← `face/hair/index.ts` (`hairGeometry`) ; yeux : **objets séparés** `render/eye/eye.ts` (`compileEye`, **2 appels**) et `lighting/head-turn.ts` (`headTurnOf`, `rotateLightForHeadTurn`).
- **`face/pose/skull.ts` (`skullOf`) et `neck.ts` (`neckOf`) : 1 appel**, par `face/hair/boundary/skull-surface.ts` (profondeur du crâne pour la lisière des cheveux). **`posedFace` et `poseTree` ne sont jamais appelés** : l'arbre de pose n'est pas branché au rendu (confirme `FACE-POSE-REMAINING.md` n°1 et 2).
- **`geometry/eye/turn3d.ts` : aucune fonction exécutée** à ce rendu : `headTurn.model` vaut `flat` par défaut ; `turnOpening` n'est appelé que pour `sphere` (`render/eye/eye.ts:45`).
- **`head-turntable/` : un seul appel d'`engineRows` et de `sectionAt`, à l'IMPORT** (`head-turntable/spec.ts:38` construit une constante au chargement) ; aucun maillage n'est construit pendant le rendu 2D. La voie volumétrique est un autre type d'objet (`head_3d`, `render/head-3d.ts`).

## 5. Tests existants exécutés (résultats exacts)

```
npx vitest run tests/head-turn-sphere.test.ts tests/face-pose.test.ts
 ✓ tests/head-turn-sphere.test.ts (9 tests)   ✓ tests/face-pose.test.ts (6 tests)
 Test Files 2 passed (2) · Tests 15 passed (15)
npx vitest run tests/head-turn.test.ts
 ✓ tests/head-turn.test.ts (16 tests) · Tests 16 passed (16)
```
`face-pose.test.ts` teste la géométrie pure, pas le rendu SVG ; aucun test ne couvre le roulis Z ni le tangage de `poseTree` sur le rendu. Aucun test n'a été inventé pour cette étape.

## 6. Critère d'arrêt

Le chemin réel est identifié et le contrat est cohérent avec le code **à une réserve près** : le sens du tangage (§4.1). Aucune implémentation n'est lancée ici ; l'étape 2 (silhouette) reste à l'autre agent.

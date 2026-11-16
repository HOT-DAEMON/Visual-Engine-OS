# Rotation — étape 3 : yeux (résultat de l'audit)

Suite de `ROTATION-STEP-03-EYES.md` et du contrat `ROTATION-CONTRACT.md`. Fichiers ajoutés : `tests/rotation-eyes.test.ts`, `scripts/artefacts-rotation-eyes.ts`, `artefacts/rotation-step-03-yeux/`. **Aucun fichier du moteur d'yeux, du visage, des cheveux ni du crâne n'a été modifié pour cette étape.**

## 1. Ce qui est prouvé (code existant, sans modification)

| Exigence | Preuve | Résultat |
|---|---|---|
| Identité à 0° | `tests/head-turn-sphere.test.ts` (existant) | conforme, octet pour octet |
| Loi `cos(azimut + lacet) / cos(azimut)` | mesuré : lacet 35°, rapport d'ouverture 1,0509 (az −22°) et 0,5874 (az +22°), **identique à la loi à 4 décimales** (`mesures.json`) | conforme |
| Œil gauche ≠ œil droit | à +35° : œil gauche (az −22°) plus large et plus tourné vers la caméra (`facing` 0,974) que le droit (az +22°, `facing` 0,545) ; image `yeux-p35deg.png` | conforme |
| Symétrie miroir | `turnPoint` : (x, y ; +35°, −22°) = miroir de (−x, y ; −35°, +22°) à 1e-9 près ; image `yeux-m35deg.png` | conforme |
| Visibilité | à 75°, `facing` < 0 pour az +22°, > 0 pour az −22° | conforme |
| Pas de double parallaxe | le modèle `sphere` n'ajoute **aucun** `headWrap` dans `compileEye` ; `flat` en ajoute un ; avec `parallax: true` la géométrie = géométrie recentrée + `shift`, exact à 1e-6 | conforme |
| Solidarité paupières / cils / sourcil / contenu | structurelle : `compileEye` passe la **même** ouverture tournée `g` à la sclère, au globe, aux paupières et au sourcil (`render/eye/eye.ts`) ; visible sur les rendus (cils et paupières suivent l'ouverture) | conforme |

Résultat des tests : `npx vitest run tests/rotation-eyes.test.ts` → **6 réussis, 1 échec attendu (`it.fails`)**, `tsc --noEmit` propre.

## 2. Défauts constatés (non corrigés : décision de convention requise)

1. **Signe du tangage entre `flat` et `sphere`.** Même champ `headTurn.pitchDeg` : `flat` (`headTurnOf`/`projectGaze`) déplace l'œil vers le BAS (`dy` = +34,2 pour 20°, conforme au commentaire du schéma) ; `sphere` (`turnPoint`, avec `parallax`) vers le HAUT (`y` = −34,2). `poseTree`, `toCam` et l'éclairage vont dans le sens de `sphere`. Porté par un `it.fails` : le jour où une convention unique est choisie, ce test **bascule en échec visible**. Je ne corrige pas : le sens voulu n'est pas fixé et trois modules sur quatre suivent déjà `sphere`.
2. **Les yeux d'un visage hôte ne reçoivent aucune pose de tête.** `generateRandomFace(11)` produit deux objets `eye` compilés par `compileEye`, **sans** `headTurn` (test : `headTurn` indéfini pour les deux), donc modèle `flat`, azimut 0, quel que soit l'angle. Au moment de l'audit (`3d78330`) rien dans l'hôte ne portait de lacet ; depuis `8558f3b` le visage a `params.headPose.yawDeg` (étape 2), **que les yeux ne reçoivent toujours pas** : `generateRandomFace` n'écrit aucun `headTurn`. L'azimut anatomique de chaque œil existe pourtant dans l'arbre de pose (`faceNodes`, `azOf`) mais n'est lu par personne. **Les yeux de l'hôte ne sont pas connectés.** Conformément à `ROTATION-STEP-03-EYES.md` (« documenter ce blocage sans le corriger »), le branchement `headPose.yawDeg` → `headTurn` des deux yeux (azimut gauche/droite issu de `faceNodes`) est une étape séparée, après validation de l'étape 2.
3. `azimuthDeg` est borné à ±55° (`HeadTurn`) alors que l'arbre de pose va à ±90° (contrat §4.2).

## 3. Ce qui reste à faire (documenté, non fait)

- Choisir **une** convention de tangage et l'appliquer aux deux modèles (changement d'API visible : décision à prendre).
- Brancher `headTurn` des yeux d'un hôte sur `headPose.yawDeg` (azimut gauche/droite issu de `faceNodes`) : **étape séparée**, à lancer après validation de l'étape 2 (publiée par l'autre agent en `8558f3b`).
- Occlusion de l'œil lointain par l'arête du nez : absente (`FACE-POSE-REMAINING.md` n°3).
- Sourcil : suit l'ouverture, mais n'a pas d'azimut propre (il est traité comme faisant partie de l'œil).
- Les rendus ne montrent que les yeux ; aucun visage ni cheveu n'est tourné (étapes 2 et 4).

## 4. Pourquoi un script de plus plutôt que `artefacts-eyes.ts`

`scripts/artefacts-eyes.ts` (planche 05) compare un seul œil par style à 0° et 40°, azimut −22°. L'audit demandait une **paire gauche/droite** aux angles +35° et −35° avec la même graine, ce que cette planche ne contient pas ; le nouveau script réutilise `compileScene` tel quel, sans nouveau moteur.

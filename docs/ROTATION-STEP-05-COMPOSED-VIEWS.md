# Rotation — étape 5 : rotations composées et vues intermédiaires

Branche : `feat/hair-grammar`

## Objectif
Vérifier que plusieurs angles appliqués ensemble donnent une pose stable et continue, et que les vues intermédiaires ne cassent ni proportions ni occlusions.

## Faits à vérifier
- `poseTree()` applique un lacet Y hiérarchique puis un tangage X global.
- `PoseNode.own` ne décrit actuellement qu'une rotation autour de Y.
- Aucun roulis Z n'apparaît dans le contrat `PoseNode` inspecté.
- Le rendu SVG de `faceParts()` ne montre pas encore d'appel à `posedFace()` dans le fichier inspecté. Vérifier l'état réel avant tout test de rendu intégré.
- Les tests actuels de `face-pose` couvrent surtout yaw seul ; ils ne prouvent pas les rotations composées dans le rendu.

## Fichiers à inspecter
- `src/face/pose/tree.ts`
- `src/face/pose/index.ts`
- `tests/face-pose.test.ts`
- `src/render/face/face.ts`
- `src/render/host.ts`

Ne modifier aucun autre fichier sans justification directe.

## Travail demandé
1. Vérifier l'ordre exact des rotations et leurs repères : tête, parent/enfant, caméra et image.
2. Tester yaw + pitch simultanés, dans les deux ordres de signe : (+yaw,+pitch), (+yaw,−pitch), (−yaw,+pitch), (−yaw,−pitch).
3. Vérifier la continuité des vues intermédiaires : yaw −90° à +90° par pas de 15° ; pitch −30° à +30° par pas de 15°.
4. Vérifier les transitions de visibilité des yeux et oreilles, l'écart entre les yeux, le déplacement du nez, la silhouette du crâne et l'alignement tête/cou.
5. Vérifier qu'une rotation composée ne crée ni NaN, saut de position, inversion gauche/droite ni changement brutal de visibilité hors seuil géométrique attendu.
6. Vérifier séparément le roulis Z. S'il n'existe pas dans le contrat, le noter comme capacité absente ; ne pas l'émuler avec une rotation SVG globale.
7. Vérifier que les rotations composées atteignent réellement le rendu SVG. Si `posedFace()` n'est toujours pas branché, arrêter l'audit de rendu et rapporter ce blocage.

## Interdictions
- Ne pas ajouter le roulis ou un nouvel ordre d'Euler dans cette étape.
- Ne pas modifier le modèle géométrique ni la grammaire des composants.
- Ne pas convertir le visage ou les cheveux en volumes 3D.
- Ne pas corriger plusieurs défauts à la fois.
- Ne pas déclarer une rotation validée sur la seule base d'un test mathématique si le rendu SVG ne l'utilise pas.

## Preuves obligatoires
- Tableau compact des combinaisons yaw/pitch testées et résultats.
- Captures SVG comparables à yaw −45°, 0°, +45° ; puis au moins deux poses combinées (+35°, +20°) et (+35°, −20°).
- Une séquence de vues intermédiaires à seed fixe, dimensions et paramètres constants.
- Tests automatisés exécutés avec commandes et résultats exacts.
- Vérification de continuité : coordonnées finies, dimensions positives, transitions d'occlusion explicables.
- Liste des capacités présentes/absentes : yaw, pitch, roll, rotations propres des nœuds, projection intégrée au SVG.

## Critère d'arrêt
Si le rendu SVG n'utilise pas encore la pose calculée, ne pas prétendre valider les vues finales et ne pas ajouter de code de contournement. Livrer uniquement le diagnostic et le plus petit prérequis bloquant.

Aucune étape suivante sans validation des preuves.

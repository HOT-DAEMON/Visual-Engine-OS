# Rotation — étape 2 : première connexion au rendu SVG

Branche : `feat/hair-grammar`

## Objectif
Faire apparaître une rotation de tête issue de `posedFace()` dans le rendu SVG existant. Première tranche limitée à la silhouette de la tête. Pas de refonte du visage.

## Faits vérifiés
- `src/render/host.ts` appelle `faceParts()`, puis enveloppe le résultat dans `objectTransform()`.
- `src/render/face/face.ts` construit les calques SVG, mais n'appelle pas `posedFace()`.
- `src/face/pose/index.ts` expose déjà `posedFace()` et `skullHalf()`.
- `docs/FACE-POSE-REMAINING.md` confirme que la silhouette posée n'est pas utilisée au rendu.
- `tests/face-pose.test.ts` teste la géométrie, pas le rendu SVG.

## Fichiers à inspecter
- `src/render/host.ts`
- `src/render/face/face.ts`
- `src/face/outline.ts`
- `src/face/pose/index.ts`
- `tests/face-pose.test.ts`

Ne remonter vers d'autres fichiers que si un import ou un appel direct l'exige.

## Travail demandé
1. Identifier la source actuelle de l'angle de tête. Ne pas confondre `HostSpec.transform.rotationDeg` (rotation de l'objet dans la scène) avec le lacet anatomique de la tête.
2. Ajouter un paramètre explicite de pose de tête uniquement si le schéma possède déjà un champ adapté. Sinon, arrêter et signaler le champ manquant : ne pas modifier le schéma dans cette étape.
3. Calculer `posedFace(lm, yaw, pitch)` une seule fois dans le chemin de rendu.
4. Utiliser cette pose uniquement pour produire la silhouette SVG du crâne en lacet. Conserver la géométrie frontale à yaw = 0.
5. Ne pas transformer globalement le groupe SVG : cela ferait tourner l'image dans le plan, pas la tête dans l'espace.
6. Garder les composants internes, yeux, nez, bouche, oreilles et cheveux inchangés dans cette étape.

## Interdictions
- Pas de conversion en mesh ou volume 3D.
- Pas de modification de `poseTree` ou `turn3d.ts`.
- Pas de rotation des yeux, du nez, de la bouche, des oreilles ou des cheveux.
- Pas de changement du rendu de scène ni de `objectTransform()`.
- Pas de refactorisation générale de `faceParts()`.

## Preuves obligatoires
- Test de rendu SVG : yaw = 0 reproduit la silhouette frontale existante.
- Test de rendu SVG : yaw positif et négatif produisent des silhouettes distinctes et symétriques en direction.
- Test de rendu SVG : yaw intermédiaire (ex. 30°) produit une silhouette finie, sans NaN ni coordonnées invalides.
- Fournir les commandes de tests réellement exécutées et leurs résultats.
- Fournir 3 captures comparables : 0°, +30°, −30°, même seed, mêmes dimensions, mêmes paramètres.
- Vérifier qu'aucun changement n'apparaît à yaw = 0 hors différence numérique négligeable.

## Critère d'arrêt
Si la silhouette ne peut pas être générée correctement avec les données actuelles de `posedFace()`, ne pas inventer de géométrie. Expliquer précisément le blocage et proposer le plus petit correctif séparé.

Ne pas commencer l'étape 3 (yeux) avant validation de ces preuves.

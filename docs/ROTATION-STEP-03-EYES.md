# Rotation — étape 3 : audit et validation des yeux

Branche : `feat/hair-grammar`

## Objectif
Vérifier que `turn3d.ts` donne une rotation spatiale cohérente à l'enveloppe de l'œil, sans déformer artificiellement son dessin ni dupliquer la rotation.

## Faits vérifiés
- `src/geometry/eye/turn3d.ts` projette les six points de contrôle de l'ouverture sur une sphère, puis les reprojette en 2D.
- `src/render/eye/eye.ts` appelle déjà `turnOpening()` lorsque `headTurn.model === 'sphere'`.
- `src/schema/eye-head-turn.ts` expose yaw, pitch, azimuth, radiusFactor et parallax.
- `tests/head-turn-sphere.test.ts` couvre identité, loi de compression, styles, miroir, facing et rendu SVG.
- Le rendu autonome `compileEye()` est donc déjà branché. Ne pas refaire ce branchement.

## Fichiers à inspecter
- `src/geometry/eye/turn3d.ts`
- `src/render/eye/eye.ts`
- `src/schema/eye-head-turn.ts`
- `tests/head-turn-sphere.test.ts`
- `src/render/face/face.ts` (uniquement pour vérifier si les yeux du visage hôte utilisent ce même moteur)

## Travail demandé
1. Exécuter les tests existants `head-turn-sphere.test.ts` et relever les résultats exacts.
2. Vérifier les conventions de signe yaw/pitch entre `turn3d.ts`, `HeadTurn` et `lighting/head-turn.ts`.
3. Vérifier que `azimuthDeg` distingue bien œil gauche et œil droit dans un visage, et que la valeur n'est pas laissée à 0 par défaut lorsqu'une position anatomique est connue.
4. Vérifier le sens de `parallax` : pas de double déplacement entre `turnOpening()`, le placement de l'œil et `headWrap`.
5. Vérifier que paupières, cils, pli, sourcil et contenu de l'œil restent solidaires de l'ouverture tournée.
6. Déterminer séparément si les yeux intégrés au visage hôte passent par `compileEye()` ou non. Si non, le signaler : ne pas créer de branchement spéculatif dans cette étape.
7. Corriger uniquement un défaut démontré par un test ciblé. Si aucun défaut n'est démontré, ne modifier aucun code.

## Interdictions
- Ne pas réécrire `turn3d.ts`.
- Ne pas changer le modèle géométrique sphérique.
- Ne pas modifier le rendu des autres composants du visage.
- Ne pas ajouter un deuxième moteur de rotation.
- Ne pas toucher aux cheveux ni à la silhouette du crâne.
- Ne pas modifier le schéma sans preuve d'un champ manquant.

## Preuves obligatoires
- Résultat exact des tests existants.
- Test ciblé gauche/droite avec azimuts opposés (+22° / −22°) : compression et visibilité cohérentes.
- Test de non-double-parallaxe.
- Trois rendus SVG comparables : 0°, +35°, −35°, avec même seed et mêmes dimensions.
- Conclusion explicite : œil autonome validé / défaut identifié ; œil du visage hôte connecté / non connecté.
- Pour toute correction : capture avant/après et test qui échouait puis réussit.

## Critère d'arrêt
Si les tests passent et que le seul défaut est l'absence d'intégration des yeux du visage hôte, documenter ce blocage sans le corriger ici. L'intégration au visage hôte doit faire l'objet d'une étape séparée, après validation de l'étape 2.

# Pose 3/4 — ce qui reste à faire (par composant)

Fait : arbre de poses, crâne et cou paramétriques, projection orthographique, raccourcissement, visibilité, tests.

## Pas fait
1. **Rendu 3/4 du visage** : aucun composant n'utilise encore `posedFace`. Il faut une transformation par composant (échelle x = `scaleX`, décalage = position posée) appliquée dans `render/face/*`.
2. **Contour de la tête** : `outline.ts` reste frontal ; la silhouette 3/4 (`skullHalf`) n'est pas utilisée pour tracer le visage. Le menton et la mâchoire n'ont pas de profil propre (joue côté fuyant).
3. **Nez** : pas d'occlusion de l'œil lointain par l'arête du nez (la saillie est modélisée, pas le recouvrement) ; pas de narine cachée.
4. **Yeux** : `head-turn.ts` raccourcit déjà l'enveloppe palpébrale ; il n'est pas relié à l'arbre (deux sources de vérité à unifier).
5. **Oreilles** : modèle `morphology` non relié (azimut fixe ±78°).
6. **Cheveux en 3/4** : les masses de région sont définies de face ; pas de projection par l'arbre.
7. **Tangage** : `pitch` tourne les positions mais pas les formes (pas de raccourcissement vertical).
8. **Cou** : torsion fixe 55 % ; pas de tendon sterno-cléido-mastoïdien ni de pomme visibles.
9. **Valeurs** (rz, saillies, azimuts) : choisies à la main, non calibrées sur des visages 3/4 réels ni sur les 12 références.
10. Le schéma d'artefact n'est pas une preuve de rendu.

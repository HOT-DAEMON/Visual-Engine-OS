# Tête en rotation — état par composant et reste à faire

Suite de `HEAD-TURNTABLE.md`. Légende : ✅ fait et vérifié · ⚠️ fait avec une limite connue · ⬜ non fait. Rien n'est marqué fait sans contrôle ou artefact.

## Lecture de la consigne « améliorer le moteur du membre supérieur »

Les références de `references/face/` ne contiennent aucune information sur le bras, l'épaule ou la main. Je n'ai donc RIEN extrait de ces images pour le membre
supérieur et je n'ai pas touché au code `src/body/`. Le seul point de contact légitime est la JONCTION tête → cou → épaules (largeur et profondeur du cou, évasement
vers les trapèzes) : ⬜ non branchée. Voir « Prochaines étapes » (1). Si la consigne visait autre chose, c'est à préciser.

## Par composant

| Composant | État | Fait (preuve) | Reste à faire |
|---|---|---|---|
| **Crâne** | ⚠️ | 26 sections calées sur les silhouettes 0°/90°/180° ; validé hors échantillon à 2,3 – 3,8 px (`silhouette_error.csv`) | forme FIGÉE d'une seule tête ; pas de paramètres (largeur, longueur, hauteur) ni de morphing ; pas de bosses frontales / temporales / occipitales |
| **Mâchoire, menton** | ⚠️ | dessous de mâchoire en diagonale (profil 90°), menton arrondi de face | rangées y ≥ 0,85 ANNOTÉES, pas mesurées (cachées par le cou) ; pas d'angle mandibulaire ; menton légèrement pointu à 90° ; à relier au moteur `face-structure` (mandibule T5/T11) au lieu de le dupliquer |
| **Cou** | ⚠️ | cylindre elliptique, dos du cou mesuré, plan de coupe | droit (la planche penche), jonction avec le menton en angle vif, pas de muscles ni de trapèzes ; reste de l'encre sombre à la nuque à 70° – 110° |
| **Yeux** | ⚠️ | texture sur la surface : iris, pupille, reflets, paupière, cils ; position ajustée (1,8 px) ; œil lointain correct en 3/4 (`detail_sheet.png`) | pas de globe 3D (la bosse de la cornée ne sort pas du profil) ; regard fixe ; pas de lien avec le moteur d'yeux existant (12 types de paupières, `headTurnOf`) |
| **Sourcils** | ⚠️ | arc quadratique à extrémités effilées | pas d'expression : froncement mesuré (≈ 30°, réf. 02) non implémenté |
| **Nez** | ⚠️ | profil du nez et des lèvres repris du profil 90° (avancée 0,04 U, contrôle `nose.protrusion`) ; ailes, narines | forme figée ; narines vues du dessous très simples ; trait du dos du nez à améliorer en 3/4 |
| **Bouche** | ⚠️ | sourire ouvert (dents, intérieur, lèvres) ; position à 3,5 – 6,4 % U | CAVITÉ non creusée : l'intérieur est peint sur les lèvres (écart 0,064 U à 45° – 70°) ; pas d'expressions ; pas de lien avec la bouche T7 de `face-structure` |
| **Peau** | ⚠️ | deux tons + rougeur, ombre sous le menton, palette mesurée | pas de matériau (diffusion), à relier à `SKIN-LIGHT` ; lumière fixe, pas d'occlusion ambiante |
| **Oreilles** | ⚠️ | plaque ellipsoïdale ouverte de 50°, hélix et conque ; position 0,53 – 0,79 U | détail pauvre (pas de lobe, tragus, antihélix réels) ; l'oreille LOINTAINE est visible à 20° alors que la planche l'omet ; vues de dos très schématiques |
| **Cheveux** | ⚠️ | calotte à lisière y(azimut) calée sur les masques (IoU moyen 0,80) | IoU 0,61 – 0,72 de face et en 3/4 (frange et pattes impossibles à décrire) ; pas de mèches ; pas de lien avec `hair-grammar` (cette branche) |
| **Joues, front** | ⚠️ | rougeur ; front plat de la table de sections | pas de modelé (pommettes, arcades) |
| **Vérification** | ✅ / ⚠️ | 54 contrôles, 3 couches, hors échantillon, défauts injectés détectés | un seul crâne ; style jugé par proxys (voir `HEAD-TURNTABLE-VERIFY.md`) |

## Défauts visibles connus (voir `comparison/side_by_side_sheet.png`)

1. Jonction cou / mâchoire : cylindre raccordé en angle vif, là où la planche a une transition douce avec ombre.
2. Nuque des cheveux : bord plat, alors que la planche dessine un V (140° – 180°).
3. Petit bloc d'encre sombre à la nuque vers 70° – 110° (remplissage d'un angle rentrant par le contour).
4. Menton en pointe à 90° ; lèvres : traits d'encre qui débordent aux commissures en vue de face.
5. Oreilles trop simples ; oreille lointaine visible à 20°.

## Prochaines étapes (par ordre de valeur)

1. **Jonction tête → cou → épaules** pour le membre supérieur : brancher la largeur et la profondeur du cou sur `src/body/volume/neck.ts`, ajouter l'évasement vers les trapèzes, tester la continuité au point de raccord.
2. **Cavité de la bouche** (creuser les lèvres) puis expressions : froncement (réf. 02), yeux écarquillés à iris rétréci (réf. 05, iris / œil 0,25).
3. **Paramétrer le crâne** : 3 ou 4 axes (largeur, longueur, hauteur, menton) et vérifier la généralité sur d'autres têtes.
4. **Mesurer `rotation_head_1.jpg`** : elle varie le TANGAGE (vue de dessus, de dessous) ; ajuster b par vue et valider le moteur hors du tangage unique de la planche.
5. **Relier** au moteur d'yeux (`headTurnOf`), à `face-structure` (mâchoire, bouche) et à `hair-grammar` (lisière) au lieu de dupliquer leurs modèles.
6. **Oreilles** : modèle de surface réel (hélix, antihélix, tragus, lobe) mesuré sur les vues de 90° et 135° – 160°.

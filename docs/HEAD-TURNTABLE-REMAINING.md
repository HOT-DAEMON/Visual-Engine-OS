# Tête en rotation — état par composant et reste à faire

Suite de `HEAD-TURNTABLE.md` et de `HEAD-TURNTABLE-ENGINES.md`. Légende : ✅ fait et vérifié · ⚠️ fait avec une limite connue · ⬜ non fait. Rien n'est marqué fait sans contrôle ou artefact.
Artefacts : `artefacts/head-turntable-engines/` ; contrôles : `HEAD-TURNTABLE-VERIFY-CHECKS.md` ; calage : `HEAD-TURNTABLE-ENGINES-FIT.md`.

## Lecture de la consigne « améliorer le moteur du membre supérieur »

Les références de `references/face/` ne contiennent aucune information sur le bras, l'épaule ou la main. Je n'ai RIEN extrait de ces images pour le membre supérieur et je n'ai pas touché
à `src/body/`. Le seul point de contact légitime est la JONCTION tête → cou → épaules. Le cou vient maintenant de `skull/neck` (inclinaison, lignes avant et arrière) mais n'est PAS branché sur
`src/body/volume/neck.ts` ni sur les trapèzes : ⬜. Si la consigne visait autre chose, c'est à préciser.

## Par composant

| Composant | État | Fait (preuve) | Reste à faire |
|---|---|---|---|
| **Crâne** | ⚠️ | dérivé de `headOutline` + `skullGeometry`, calé sur la planche : rms a 0,007 / zf 0,017 / zb 0,027 U (`fit_report.json`) ; silhouettes 2,7 – 4,3 px | 12 paramètres sur 34 finissent à la borne (voûte basse, front très bombé, coupe de cheveux 0,05 U) : le grand front de la planche est obtenu en déformant le crâne ; un paramètre de VOLUME DE CHEVEUX dans le moteur le règlerait proprement ; précision plus faible que l'ancienne table libre (3,2 / 3,9 px contre 2,5 / 3,2) |
| **Mâchoire, menton** | ⚠️ | contour de face = `headOutline` + `face/jaw` (menton à 0,01 U de la mesure) ; dessous de mâchoire dérivé de l'angle gonial ; mâchoire sans angle vif (`eng.jaw.smooth`) | le PLAN MANDIBULAIRE n'existe pas dans les moteurs : dérivé ici (angle gonial − 90° − ramus + courbure `mandArc` = 2,3 à la borne) et trop raide (45°, canon 15° – 35°) ; menton 0,027 U trop en avant de profil (zf 0,427 vs 0,405 à y = 1,0) ; menton en V vu de face ; à ajouter au moteur `face/jaw` : profil de profil de la mandibule |
| **Cou** | ⚠️ | sections de `skull/neck` (inclinaison 25,7°), demi-largeur de `lm.neck.half`, haut enfoui dans le crâne ; dos du cou à ≤ 0,015 U de la silhouette à 90° (t de 0,925 à 1,0) ; la nuque (t = 0,8) reste à 0,066 U | `neckScale` = 0,77 est un facteur hors moteur (le minimum de profondeur du moteur dépasse le cou de la planche) ; pas de muscles (SCM) ni de trapèzes (le cahier des charges du futur moteur de cou est `docs/TODO-NECK-SYSTEMS.md`, arrivé en amont pendant ce travail : le cou du turntable n'en tient pas compte et devra être rebranché dessus) ; jonction avec la mâchoire encore en angle vif ; petit bloc d'encre à la nuque à 110° – 135° |
| **Yeux** | ⚠️ | ouverture = polygone de `geometry/eye` (forme `round`, hauteur réglée sur `hUp`/`hLo` mesurés) ; iris, pupille, reflets de la planche | pas de globe 3D ; regard fixe ; seule la forme `round` utilisée (12 types de paupières disponibles) ; cils = un trait, pas `upperLashes` ; `turn3d` non branché |
| **Sourcils** | ⬜ | arc quadratique inchangé (non branché sur `geometry/eye/eyebrow`) | brancher `browGeometry` ; froncement (réf. 02, ≈ 30°) |
| **Nez** | ⚠️ | profil = `skull/` (z) + silhouette de `face/nose` (largeur) ; narines = polygones du moteur ; projection 0,097 U (canon 0,03 – 0,1) | projection au maximum du canon ; bout du nez relevé au maximum retenu ; racine du nez (nasion) non creusée : plan de visage lissé entre glabelle et sous-nez ; ailes encore deux ellipsoïdes |
| **Bouche** | ⚠️ | cavité, dents, langue, lèvres, fermeture = `face/mouth` | lèvre inférieure épaisse (0,06 U, paramètre à la borne) ; sourire en croissant plus étroit que la bouche ouverte de la planche (dents peu visibles) ; cavité toujours peinte sur les lèvres, pas creusée ; pas d'expressions |
| **Peau** | ⚠️ | deux tons + rougeur, ombre sous le menton, palette mesurée | pas de matériau (diffusion), à relier à `SKIN-LIGHT` ; lumière fixe, pas d'occlusion ambiante |
| **Oreilles** | ⚠️ | maillage fermé du moteur `face/ear` (hélix, anthélix, conque, tragus, lobe), placé par `placeEarPoint`, relief au dos, encre aux arêtes ; vues 0° – 160° dans `03-oreille-moteur-5-vues.png` ; contrôles `eng.ear.*` | à 135° le pavillon plan est quasi de chant (la planche montre ~0,08 U de plus : écart −0,03 U) ; l'oreille LOINTAINE reste visible à 20° (la planche l'omet) ; très encrée (0,42 de la surface) ; aucune oreille MESURÉE à 135° – 160° pour valider la forme ; rotation du moteur à corriger côté gauche (voir `HEAD-TURNTABLE-ENGINES.md`) ; `ears.family` unique (humain) |
| **Cheveux** | ⚠️ | calotte à lisière y(azimut), recalée sur la nouvelle tête (IoU 0,76) | IoU 0,55 – 0,64 à 45° – 70° (recul de 0,04 par rapport à la version autonome) ; frange et pattes impossibles à décrire ; pas de mèches ; la lisière reste une constante mesurée : NON reliée au moteur de lisière de cette branche (`src/face/hair/boundary`, commit e1c3aa0 : `skullSurface`, `projectBoundary`, `buildBoundary`, style de bord, pattes), arrivé pendant ce travail et non étudié |
| **Joues, front** | ⚠️ | rougeur ; front de la table de sections | pas de modelé (pommettes, arcades) |
| **Vérification** | ✅ / ⚠️ | 78 contrôles, 3 couches, hors échantillon, 13 tests (`head-turntable-engines.test.ts`), défauts injectés détectés | un seul crâne ; style jugé par proxys ; bornes `eng.*` écrites après avoir vu les valeurs |

## Défauts visibles connus (voir `apres/comparison/side_by_side_sheet.png`)

1. Jonction cou / mâchoire en angle vif (la planche : transition douce avec ombre).
2. Nuque des cheveux : bord plat, la planche dessine un V (140° – 180°) ; bloc d'encre sombre à la nuque entre 110° et 135°.
3. Menton trop en avant de profil et en V de face ; lèvres inférieures épaisses.
4. Oreille lointaine visible à 20° ; oreille de dos (135°) trop mince.
5. Bouche en croissant, dents peu visibles.

## Prochaines étapes (par ordre de valeur)

1. **Moteur de mâchoire / crâne** : ajouter au moteur (et non au pont) le profil de la mandibule (plan mandibulaire, angle gonial de profil) et un volume de cheveux ; supprimer `neckScale` et `mandArc`.
2. **Oreille** : décider de la correction du signe de rotation dans `placeEarPoint` ; mesurer une oreille à 135° – 160° ; masquer l'oreille lointaine à 20° selon la convention de la planche.
3. **Jonction tête → cou → épaules** pour le membre supérieur : brancher `src/body/volume/neck.ts`, trapèzes, continuité au raccord.
4. **Sourcils et paupières** : `browGeometry`, `upperLashes`, autres formes d'œil ; puis cavité de la bouche et expressions (froncement réf. 02, yeux écarquillés réf. 05).
5. **Cheveux** : relier la lisière au moteur `face/hair/boundary` (projection sur la surface du crâne : le repère 3D de `skullSurface` est celui de l'hôte, à convertir en U comme `engines/units.ts`) ; viser IoU ≥ 0,8 à 45° – 70°.
6. **Mesurer `rotation_head_1.jpg`** (tangage variable) et valider les moteurs hors du tangage unique de la planche ; autres têtes pour tester la généralité.

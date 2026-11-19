# Yeux — PASSE 9 : iris mesurés des réfs 03 / 05 / 06 / 09, seconde galerie de 100 yeux, règles d'iris, almond hors échantillon

Tout ce qui suit est recalculable : `python3 scripts/eye-refs/extract_iris_photos.py`, `python3 scripts/eye-refs/extract.py`, `npx tsx scripts/artefacts-eyes-pass9.ts` (→ `artefacts/eyes-pass9/`, rapport chiffré `06-rapport-passe9.json`).
Aucun moteur par référence : les 4 familles d'iris s'ajoutent aux 6 existantes (`IRIS_FAMILIES` est INCHANGÉ) et n'utilisent que `iris.layers`, `iris.detail`, `highlights`, `pupil`.

## 1. Mesures d'iris (réfs 03, 05, 06, 09) — `references/eyes/measures-iris-photos.json`
Entrée humaine : centre / rayons approchés de l'iris et seuil de luminance de la pupille par œil (annotations relues sur `01-iris-photos-superposition.png`). Tout le reste est calculé :
limbe (gradient radial sur 72 rayons + `cv2.fitEllipse`), pupille (composante sombre), profil radial (12 bandes : moyenne, quartile sombre, quartile clair), 8 secteurs angulaires, anneau limbique, reflets (V > 0,93), sclère voisine.

| réf. | pupille / iris | aspect pupille H/L | aspect limbe | reflet spéculaire (dx, dy, r) | texture (écart de luminance à 5°) |
|---|---|---|---|---|---|
| 03 | 0,232 | 1,471 (fente brun-rouge) | 1,108 | −0,52 ; −0,61 ; 0,18 | 36,7 |
| 05 | 0,174 | non fiable (reflet dans la pupille) | non fiable (ellipse inclinée à 66°) | 0,19 ; −0,22 ; 0,13 | 22,5 |
| 06 | 0,101 | 1,158 | 1,10 | 0,20 ; −0,29 ; 0,08 | 35,2 |
| 09 | 0,105 | non fiable (trait de lumière horizontal) | 1,06 | 0,60 ; −0,36 ; 0,10 | 42,1 |

Enseignements : (a) la MOYENNE de couleur par bande est un ton qui n'existe pas dans l'image (fibres claires + fond sombre) : les familles utilisent les QUARTILES sombre / clair (premier essai à la moyenne : iris délavés) ;
(b) le reflet spéculaire est toujours dans la moitié haute de l'iris (dy de −0,66 à −0,15) et une tache claire de caustique est dans la moitié basse (03 : dy +0,65, rayon 0,33 ; 09 : dy +0,44) → `detail.bottomGlow`, règle `specular-in-upper-iris` ;
(c) pupilles minuscules (0,10) sous l'ancien plancher du schéma (0,12) → `pupil.size` min 0,12 → 0,08.

## 2. Quatre familles d'iris — `src/generation/eye-iris-families-photo.ts`
`slit-sunburst` (03 : base jaune, rayons sombres, calotte bleu-vert haute, caustique basse, pupille étirée), `ember-sky` (05 : fond brun-rouge, accents orange, calotte de ciel), `gold-filigree` (06 : fond brun-orangé, filigrane jaune, collerette vive à r = 0,41, limbe presque noir), `frost-fern` (09 : marine, fougères cyan, collerette fibreuse).
- MESURÉ (constantes comparées au JSON par `tests/eye-iris-photo.test.ts`) : pupille / iris, aspect de pupille (03, 06), aspect du limbe, reflet spéculaire, quartiles sombre / clair aux bandes 0,125 · 0,458 · 0,875.
- INTERPRÉTÉ (non mesurable) : motif des filigranes / fougères, nombre de fibres, lueur, valeurs de `detail` (collerette, accent, sparkles).
- Pupille à aspect mesuré par `deform.squash` (s = (1 − A)/(1 + A/2), taille corrigée pour garder le rayon d'aire équivalent) : test sur le contour rendu (1,471 ± 0,05). 05 et 09 : aspect non consommé (documenté).
- Cause d'un voile gris trouvée par isolation : les `facets` d'iris (quadrilatères translucides) désaturent ; retirées de `frost-fern`. Un fini `flat` retirerait gradients et fibres : `applyPhotoIris` impose `finish: 'shaded'` et `archetype: null`.

## 3. Seconde galerie — `src/generation/eye-gallery-ext2.ts` (100 yeux de plus, aucun œil existant modifié)
- Même mécanisme que `eye-gallery-ext.ts` (échantillonnage du plus éloigné sur les profils d'enveloppe, `candidates` partagé), flux pseudo-aléatoire distinct, distances calculées contre les 48 + 100 existants.
- Distance minimale : 0,0129 aux 148 existants (seuil `NEW2_MIN_DIST` = 0,012 ; 0,02 pour la galerie 1, l'espace est plus occupé), 0,0157 entre les 100 nouveaux. 12 enveloppes représentées (diamond : 5, les autres 8 ou 9).
- 65 yeux sur 100 reçoivent une famille photo (slit-sunburst 24, ember-sky 17, gold-filigree 12, frost-fern 12), 35 gardent l'iris naturel. La famille est tirée dans un flux à part (graine ^ 0x3c6ef372).
- Pour réutiliser `buildExtraEye` sans le dupliquer : exports ajoutés dans `eye-gallery-ext.ts` (`STYLES`, `WIDTH`, `candidates`, `profileVector`, `dist`, `existingVectors`, `buildExtraEye`, `lashFamilyForRecipe`) et paramètre optionnel `override` appliqué AVANT la calibration du rayon d'iris. Sans `override`, comportement historique (tests de la galerie 1 verts).
- Têtes : `eyeSource: 'extended2'` (248 identités, `eye-pool.ts` + `random-face.ts`) ; `'extended'` et `'gallery'` gardent leurs tirages.
- Résultat sur les 100 : 0 erreur `verifyEye`, 0 échec pixel. Avertissements (non bloquants) : `svg-weight` 30 (iris riches), `envelope-vs-reference-profile` 7, `pupil-to-iris` 8, `upper-peak-max` 6, `pupil-darker-than-iris` 5, `lower-peak-max` 4, `iris-to-opening-width` 4.

## 4. Couche de vérification (géométrie / anatomie / style) — `scripts/lib/verify-eye-render.ts`
| couche | règle | définition | preuve |
|---|---|---|---|
| géométrie | `pupil-core-centred` | cœur sombre de la pupille (≤ minimum + 22, disque 0,45) centré sur l'iris au `pupil.center` près (+ 0,2) | 100 yeux sans échec |
| anatomie | `specular-in-upper-iris` | tout reflet primaire de réflexion ancré à l'iris est en y ≤ 0,05 (réfs : toujours dans la moitié haute) | test : bas échoue, haut passe |
| style | `iris-texture` | écart moyen de luminance entre points voisins (5°, 4 anneaux 0,4 à 0,85) ≥ 2 ; ≥ 8 si l'œil demande `iris.detail` | test : voile gris + détail à 0 échoue (3,3 < 8) ; familles photo 11,9–21,8 |
Une première règle « p85 − p15 de luminance » a été ABANDONNÉE : un iris gris uni donnait 49 (ombrage du moteur) contre un minimum de galerie de 23. Non appliquées aux yeux `finish: 'flat'`.

## 5. Almond — validation hors échantillon (aucune correction appliquée)
`extract.py` trace maintenant 03 et 05 (ancres lues sur une grille de 20 px, ± 10 px soit ≈ 3 % de la largeur ; 03 : canthus externe sous les cils, tracé incertain). `fit-almond.ts` reste ajusté sur 04, 07, 11 ; `scripts/eye-refs/almond-holdout.ts` évalue 03 et 05 sans les y mêler.
| œil | RMS haut | RMS bas | sommet haut moteur / réf. | sommet bas moteur / réf. |
|---|---|---|---|---|
| 04, 07, 11 (entraînés) | 0,007–0,024 | 0,013–0,033 | 0,55 / 0,45–0,60 | 0,55–0,60 / 0,45–0,65 |
| 03 (hors échantillon) | 0,033 | 0,051 | 0,60 / 0,45 | 0,55 / 0,40 |
| 05 (hors échantillon) | 0,018 | 0,058 | 0,50 / 0,75 | 0,65 / 0,45 |
Essai d'ajustement sur 5 yeux (non écrit) : RMS bas moyen 0,0358 → 0,0321, haut 0,0192 → 0,0203, mais 04 et 07 se dégradent en bas : gain négligeable, `ALMOND_REF` inchangé. Cause : le sommet de la paupière basse varie de 0,40 à 0,65 d'un œil à l'autre ; huit facteurs ne peuvent pas le suivre. Piste : exposer un paramètre `lowerPeak` (déplace le minimum le long de l'axe). Borné par `tests/eye-almond-holdout.test.ts`.

## 6. Reste à faire (voir aussi `EYES-REMAINING.md`)
- ⬜ Almond : paramètre `lowerPeak` exposé (puis refit 5 yeux) ; retracer 03 (canthus externe) et ajouter 10a / 10b au contrôle hors échantillon.
- ⬜ Iris : texture 12–22 contre 22–42 sur les références ; filigranes fins (traits, pas des anneaux à masque) ; réfs 08 et 10 sans mesure d'iris ; aspect de pupille de 05 et 09 non fiable ; limbe de 05 incliné.
- ⬜ Seuil `iris-texture` (8) issu de 4 familles ; yeux naturels de la galerie 2 : minimum 2,5 (règle plancher à 2, non discriminante pour eux).
- ⬜ Hors yeux : cohérence de teinte avec le style de la tête ; `svg-weight` (30 avertissements) à réduire ; `finish` non relié à `random-eye`.
- ⬜ Enveloppes 12–17 : « 100 formes supplémentaires » issues des silhouettes mesurées (réfs 13 / 14 / 15 / 17) non refaites ici.

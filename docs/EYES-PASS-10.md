# Yeux — PASSE 10 : iris des réfs 04 / 07 / 08 / 10, troisième galerie, `lowerPeak`, deux corrections de géométrie

Date : 2026-11-20 · branche `feat/hair-grammar` · artefacts : `artefacts/eyes-pass10/` · rapport chiffré recalculé : `artefacts/eyes-pass10/08-rapport-passe10.json`
Règle tenue : aucun moteur par référence. Les références enrichissent `iris.layers` / `iris.detail` / `highlights` / `pupil` (systèmes en place) ; les galeries 1 et 2 gardent leurs identités.

## 1. Deux défauts des passes précédentes, trouvés et corrigés
- **Limbe d'iris de la passe 9 (extracteur)** : `cv2.fitEllipse` renvoie un axe « w » TOURNÉ de `angDeg` (66° à 110° pour 05, 06, 09, 04, 07, 10a) ; la passe 9 le lisait comme rayon horizontal.
  Aspect du limbe stocké 05 / 06 / 09 : 1,085 / 1,10 / 1,06 ; réel 0,947 / 0,929 / 0,957 (iris plus larges que hauts, visible sur les images). Les bandes radiales étaient aussi normalisées sur de mauvais axes.
  Correctif : `rx`, `ry` = étendues alignées aux axes, appartenance à l'ellipse dans le repère tourné (`fitA`, `fitB`, `angDeg` gardés pour le tracé). Les constantes des 4 familles de la passe 9 sont régénérées depuis le JSON (tests verts).
  **Effet visible** : l'aspect et certaines couleurs d'iris des yeux de la galerie 2 qui utilisent ces familles changent légèrement (l'aspect de 05, jugé « non fiable » en passe 9, est maintenant mesuré : 0,947).
- **Contrat de hauteur des yeux gauches** : `apexHeights` orientait sa normale vers le bas seulement pour une corde dirigée vers la droite ; pour `outerSide: 'left'` les deux apex valaient 0 et `enforceApexHeights` rendait les courbes inchangées.
  `sharp` et `drooping` n'avaient donc AUCUN contrat de hauteur côté gauche (bbox à gauche 329 / 306 contre 434 / 399 à droite pour height 400, soit −24 % / −23 %). Correctif : normale toujours vers le bas.
  `openingProfile` avait le même défaut (œil gauche tourné de 180° : `aspect` 0, paupières permutées ; les règles d'enveloppe de `verifyEye` ne mesuraient rien de réel sur les yeux gauches des visages) : miroir en entrée.
  Conséquence mesurée : `tests/anatomy-contract.test.ts`, yeux hors de l'orbite a priori 14 → 17 sur 80 (le surcroît de hauteur de la passe 8 s'étend aux yeux gauches) ; les bornes a priori < 1,4 et publiée ≤ 1 tiennent.
  Preuve : `tests/eye-lower-peak.test.ts` (symétrie gauche / droite, 12 enveloppes) ; image `07-symetrie-gauche-droite.png`.

- **Références visuelles permanentes** (`references/visual/`) : 33 des 34 cas sont passés `changed` (RMS 3–15, jusqu'à 5 % de pixels) car leurs yeux gauches `sharp` / `drooping` avaient la hauteur fautive ; la comparaison avant / après montre deux yeux de tailles visiblement différentes AVANT (std-01, std-02) et symétriques APRÈS.
  Régénérées par `scripts/regress.ts update-some` (action explicite, uniquement les 33 cas changés ; le 34ᵉ, `close`, est resté tel quel). `tests/orbit-publish.test.ts` précisé : `grown` peut désigner une orbite qui se recentre sans s'agrandir (`growth` = 1) ; la surface ne grandit que si `growth` > 1.
- **Conséquence sur les galeries 1 et 2** : 16 des 48 yeux d'origine sont `outerSide: 'left'`. Leurs profils servaient de « formes déjà occupées » avec la géométrie gauche inversée, et les corriger change la sélection (hash des recettes des galeries 1 et 2 modifié).
  Les 200 yeux déjà livrés NE doivent pas changer : les 48 vecteurs d'origine sont FIGÉS dans `src/generation/eye-existing-vectors-legacy.ts` (`existingVectors()`, galeries 1 et 2) ; `existingVectorsTrue()` recalcule avec la géométrie corrigée (galerie 3, mesures).
  Empreintes SHA-1 des recettes : galerie 1 `28571347…0f8d`, galerie 2 `7cb6ed3b…6fc56e`, identiques à celles d'avant la passe 10 (épinglées dans `tests/eye-gallery-ext3.test.ts`).
  Vérification de la distinction annoncée aux passes 8 et 9 avec les VRAIS profils des 16 yeux gauches : galerie 1 ≥ 0,0189, galerie 2 ≥ 0,0162, galerie 2 contre les 48 + galerie 1 : 0,0129 (valeur annoncée). Elle tient ; la galerie 3 est sélectionnée contre les vrais profils.

## 2. Mesures d'iris (réfs 04, 07, 08 ×2, 10 ×2) — `references/eyes/measures-iris-photos.json`
Même extracteur (`scripts/eye-refs/extract_iris_photos.py`), 6 entrées de plus (ids `04`, `07`, `08a`, `08b`, `10a`, `10b`), superposition `01-iris-photos-superposition.png`, bandeau `02-iris-references.png`.
- 04 : pupille coupée en quatre par la croix de lumière → fermeture morphologique 15 px (stable de 15 à 25 px : 0,276–0,289 du rayon).
- Ajouts de mesure de TON (les quartiles seuls mélangeaient pics saturés et fond sombre) : luminance moyenne, part sombre (L < 50), saturation des pics (15 % de plus grand S×V), couleur VIVE par bande radiale et par secteur.
- Limites : 10a (limbe coupé par la paupière : aspect 0,785 non fiable ; pupille noyée dans l'étoile : 0,044) ; 07 (pupille coupée par le double reflet : aspect non fiable).

## 3. Cinq familles d'iris additives — `src/generation/eye-iris-families-photo2.ts`
`prism-star` (04), `emerald-facets` (07), `lime-cyan` (08 ; aspect tiré ENTRE 08a 1,080 et 08b 1,202), `fire-halo` (10a), `ice-star` (10b). Ni les 6 familles de `eye-iris-families.ts` ni les 4 de `-photo.ts` ne changent (`tests/eye-iris-photo2.test.ts`).
- **Cause d'un premier rendu voilé** : les couches se posaient sur le `iris.material` hérité de l'œil (dégradé cyan par défaut) ; `PhotoIris.base` (optionnel) le REMPLACE par un dégradé radial mesuré. Les 4 familles de la passe 9 n'en ont pas : inchangées.
- Mesuré : pupille / iris, aspects, reflet principal, quartiles, couleurs vives (bandes et secteurs), haut / bas. Interprété : motifs (facettes, bulles, nombre de pointes d'étoile), lueurs, valeurs de `detail`. Pupille de 10a ramenée au plancher du schéma (0,08).
- Le reflet principal de 07 / 10 est un ÉCLAT EN ÉTOILE (`sparkle`), pas un blob.

Parité référence / moteur sur les pixels (`scripts/lib/eye-iris-tone.ts`, mêmes formules que l'extracteur) :
| famille | luminance réf. / moteur | part sombre réf. / moteur | pics saturés réf. / moteur |
|---|---|---|---|
| prism-star | 126,1 / 134,8 | 0,154 / 0,032 | 0,783 / 0,440 |
| emerald-facets | 128,8 / 147,0 | 0,101 / 0,002 | 0,738 / 0,525 |
| lime-cyan | 169,4 / 157,0 | 0,003 / 0,020 | 0,786 / 0,649 |
| fire-halo | 89,1 / 74,5 | 0,373 / 0,312 | 0,720 / 0,407 |
| ice-star | 103,3 / 98,8 | 0,297 / 0,063 | 0,729 / 0,483 |
Tenu et testé : luminance à ± 25, teinte de l'anneau vif à ≤ 40° (10a, 10b, 08), 10a ≥ 0,2 de pixels sombres, texture d'iris ≥ 15 (4 familles sur 5 ; `lime-cyan` 9,7–10,8, au-dessus du seuil 8 de la règle).
**NON atteint** : la saturation des pics (0,41–0,65 contre 0,72–0,79), la part sombre de `ice-star` (0,063 contre 0,297) et le détail atomique (voir § 7).

## 4. Troisième galerie — `src/generation/eye-gallery-ext3.ts` (100 yeux de plus)
- `selectRecipes` (extrait de la galerie 2, comportement identique : empreinte SHA-1 des 100 recettes de la galerie 2 inchangée, épinglée dans les tests) contre les 248 profils existants, flux 0x51a7e3d9, graines 20000 + i·151 (sans collision avec les galeries 1 et 2).
- Distance minimale 0,0096 aux 248 existants (seuil 0,009 ; galerie 2 : 0,0129), 0,0153 entre les nouveaux. L'espace se sature : `diamond` 2 yeux, `diamond_v2` 5, les 10 autres enveloppes 9–10. Familles : 28 / 19 / 14 / 12 / 12 pour 5 familles photo 2, 15 naturels.
- `applyIrisPreset` (extrait de `applyPhotoIris`, partagé) puis calibration du rayon d'iris : un seul chemin.
- `eyeSource: 'extended3'` (348 identités : 248 + 100) dans `eye-pool.ts` / `random-face.ts` ; `gallery`, `extended`, `extended2` : visages identiques (empreintes épinglées dans `tests/eye-gallery-ext3.test.ts`).
- Résultat : 0 erreur `verifyEye`, 0 échec pixel sur 100 yeux (`04-galerie3-100-yeux.png`, `05-tetes-entieres.png`, `05b-*`).

## 5. Couche de vérification (géométrie / anatomie / style) — `scripts/lib/verify-eye-render.ts`
- `pupil-darker-than-iris-pixels` : 9 points (+ 4 diagonales : une étoile à 4 branches couvre le centre et les axes). Exemption bornée : éclat `sparkle` ancré à l'iris, centré dans la pupille et au moins aussi grand qu'elle (réfs 04, 10 : pupille noyée). Contre-exemple testé : pupille claire SANS éclat échoue toujours.
- `pupil-core-centred` : seulement pour une pupille ronde non occultée (fente verticale coupée par un reflet ; iris sombre partout). `specular-in-upper-iris` et `iris-texture` restent appliquées à tous.
- Un premier essai plaçait l'exemption sur tout le bloc d'iris et désactivait aussi la texture et le reflet : repéré par un test, corrigé.

## 6. Almond — `shape.lowerPeak` (position du creux de la paupière basse)
- Paramètre optionnel `[0,3 ; 0,75]` (0 = canthus interne, 1 = externe) ; absent = forme historique. `src/geometry/eye/lower-peak.ts` : les deux contrôles bas glissent ensemble le long de la corde (bissection), apex haut ET bas d'origine conservés (un recalage sur `hLo` changeait la hauteur native de round / chibi / triangle : repéré par mesure, abandonné).
- Consommé sur les 12 enveloppes à ± 0,01 ; canthi, hauteur, fraction haute et profil haut inchangés.
- Références (`scripts/eye-refs/lowerpeak-eval.ts`, valeur LUE sur la mesure, rien d'ajusté) : erreur du profil bas 04 0,0133 → 0,0068 ; 11 0,0327 → 0,0099 ; 07 0,0245 (déjà au bon creux) ; 03 hors échantillon 0,0507 → 0,0463 ; 05 hors échantillon 0,058 → 0,0191. Moyenne 0,0358 → 0,0213. Image : `06-almond-lowerpeak.png`.
- `ALMOND_REF` (huit facteurs) est inchangé ; le paramètre n'est PAS encore branché dans les galeries ni dans la génération de visages (§ 7).

## 7. Reste à faire (voir aussi `EYES-REMAINING.md`)
- ⬜ Détail atomique : prisme arc-en-ciel et rayons de 04, bulles nettes et facettes de 07, six pointes d'étoile (10b), anneau et braises de 10a. Saturation des pics et part sombre : tableau § 3.
- ⬜ Brancher `lowerPeak` : tirage dans la plage mesurée 0,40–0,65 dans les galeries et `generateRandomFace` (les profils de recette devront l'inclure pour que la distinction reste prouvée).
- ⬜ 10a : aspect du limbe et pupille non mesurables (paupière, étoile). 08b ne sert qu'à l'aspect de `lime-cyan`.
- ⬜ Galerie 3 : espace de formes saturé (`diamond`) ; une galerie 4 demande de nouvelles recettes d'enveloppe (réfs 13 / 17), pas un échantillonnage plus serré.
- ⬜ `verifyEye` avertit encore `pupil-darker-than-iris` (33 yeux, non bloquant : pupille noyée dans l'étoile) ; `svg-weight` 45.
- ⬜ Les yeux gauches de `compressed` et des autres styles sans contrat de hauteur n'ont pas été re-mesurés séparément (le correctif ne touche que `sharp` et `drooping`).

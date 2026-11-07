# Tête en rotation — variété : le crâne et la mâchoire suivent le visage

Suite de `HEAD-TURNTABLE-JAW.md`. Code : `src/head-turntable/engines/from-face.ts`, `engines/{rows,jaw-model,spec-engine}.ts`, `parts.ts`, `face-tex.ts`, `paint.ts`, `color.ts`. Tests : `tests/head-turntable-jaw.test.ts` (groupe « variété »).
Artefacts : `artefacts/head-turntable-v2/03-galerie-6-tetes-9-lacets.png`, `04-silhouettes-superposees.png`, `galerie/galerie.csv`.

## 1. Le grief

« La rotation 3D du crâne et du visage n'est pas cohérente avec les formes de visage variées que le moteur propose : on a l'impression d'avoir la même chose pour tous les cas. »
Cause trouvée : `engineHead()` utilisait `fit.skull`, un `SkullParams` **figé** (celui ajusté sur la planche). Le moteur de crâne sait pourtant DÉRIVER le crâne du visage (`skull/derive.ts` : largeur d'hôte → indice
céphalique → longueur ; front ← `templeY` / `eyeLine` ; pommettes ← `cheek` ; cou ← `neck.width`) et `generateRandomProfile(seed)` fournit visage + crâne dérivé. Le turntable n'en tirait que la largeur de face.

## 2. Ce qui a été fait : `variedHead(seed)` / `headSpecFromProfile(profile)`

Une tête 3D se construit maintenant depuis n'importe quel profil du moteur (`generateRandomProfile`) :

| Quoi | D'où vient | Constant (repère de la planche, pas une forme de tête) |
|---|---|---|
| Visage, largeur d'hôte `W` | `profile.face.params`, `W = 1000·largeur / hauteur` | — |
| Crâne | `profile.skull` (dérivé du visage) | porion, axe du cou, épaisseur de coupe des cheveux, `neckScale` |
| Mâchoire, menton | `face/jaw` (angle, `taper`, `chin.form`) + `jaw-model.ts` | courbure `mandArc` : inutilisée (bordure dérivée du gonion 2D) |
| Œil, sourcil, bouche | mis à l'échelle de la planche (rapport `orbit.rx`, `lips.half`) : **rapport 1 = planche identique** | formes (`round`, arc du sourcil) |
| Nez (ailes) | posées à `nose.baseY − 0,0147`, rayon × `alaX / alaX_planche` | — |
| Rougeur | mi-hauteur yeux ↔ bouche, 0,897 de la demi-largeur du visage | — |
| Peau, cheveux | de la graine ; encre = peau × rapport de la planche, assombrie jusqu'à un contraste WCAG ≥ 3,2 | — |
| Lisière des cheveux | `lm.hair` (front, tempe) décalée comme la planche ; pas de masque `region` | flanc, nuque |
| Table de sections | `DENSE_YS` : 0,05 U au crâne, 0,0125 U de y = 0,6 à 1,0, plus fin au menton | la planche garde ses 27 rangées (comparables à `REF_ROWS`) |

Corrections de composants rendues nécessaires par les têtes autres que la planche (la planche n'est modifiée que là où la mâchoire change : contour mâchoire / menton, ombre du bas de joue, filet des lèvres ; 0 pixel changé sur yeux, sourcils, nez, oreilles, 0,03 – 0,15 % au bord de la chevelure par l'interpolation Hermite : carte `artefacts/head-turntable-v2/08-pixels-modifies-planche.png` ; les 2 668 tests du dépôt passent) :
- **ailes du nez** : ellipsoïdes à `y = 0,775` codé en dur → atterrissaient sur la bouche des nez plus bas (« boules » aux commissures) ;
- **rougeur** : constantes de la planche → un triangle rose sur la mâchoire à 90° ;
- **coupe du cou** : saumon fixe → ombre de la peau × rapport de la planche ;
- **encre** : `#493831` invisible sur peau foncée → contraste garanti ; mesures d'encre (`verify-*`) rendues dépendantes de la palette.

## 3. Le vrai invariant — et une correction de mon propre récit

Hypothèse initiale : « l'indice céphalique 3D suit celui du moteur ». **Fausse telle quelle** : le moteur de crâne dérive la longueur pour une largeur de crâne de 0,8 × la largeur d'hôte, alors que la vue de face
(donc la 3D) montre le contour 2D complet (≈ 0,95 × `W`). Rapport IC 3D / IC moteur ≈ 1,31 – 1,41 pour les 12 graines ; avec le crâne figé il vaut 1,30 – 1,44 : **il ne discrimine pas** (la longueur de crâne ne varie que de ±6 %
par construction de l'axe `length`). Chaque vue 2D reste fidèle à son moteur (face = contour 2D, profil = crâne dérivé) ; c'est voulu.

Invariants retenus (`head.anat.skull.length` et tests) :
- la **profondeur 3D du crâne retrouve `derivation.lengthH`** (écart ≤ 0,02 U ; un crâne figé fait jusqu'à 0,044 sur un visage large de rapport 0,91) ;
- sur 12 graines : corrélation (rapport d'hôte, profondeur 3D) > 0,9, étendue de profondeur > 0,08 U ; avec le crâne figé l'étendue est < 0,01 U ;
- variété de forme (6 graines) : écart-type de la profondeur > 0,025 U, de la largeur relative de mâchoire > 0,02, de la hauteur du gonion > 0,01.

Variété réelle mesurée (12 graines) : profondeur du crâne au sourcil 0,757 – 0,854 U ; largeur de mâchoire à y = 0,95 / largeur maximale 0,36 – 0,51 ; gonion y = 0,78 – 0,84 ; voir `galerie.csv`.

## 4. Limites connues (documentées, non corrigées)

1. **Amplitude du crâne** : l'axe `length` borne la longueur à ±6 % ; les têtes diffèrent surtout par la largeur de face, la mâchoire, la voûte, le front. Un crâne vraiment dolicho-/brachycéphale demande d'étendre l'axe.
2. **Pavillon pointillé** : l'oreille des têtes autres que la planche porte des îlots d'encre (hachures du moteur d'oreille sous-échantillonnées) : `head.style.specks.*` en information (planche ≤ 6 ; graines 5 et 6 : 22 et 15).
3. **Bouche fermée** : lèvres fines, sans ombre de commissure ; la bouche de la planche est un grand sourire ouvert, la texture n'est calée que dessus.
4. **Yeux** : proportionnés à `orbit.rx` mais forme `round` unique ; sur un visage large ils paraissent très grands ; pas d'écart inter-oculaire propre (l'écart vient des repères).
5. **Cheveux** : calotte courte uniquement ; aucune coiffure du moteur (`face/hair`) : lisière dérivée seulement du front et de la tempe.
6. **Cou** : largeur dérivée de `neck.width`, mais toujours un cylindre non raccordé ; à 135° – 180° la mâchoire large le dépasse de chaque côté.
7. **Une seule planche mesurée** (`rotation_head.jpg`) : aucune des 12 graines n'est comparée à une référence ; la vérification est une cohérence interne (voir `HEAD-TURNTABLE-VERIFY-HEAD.md`).

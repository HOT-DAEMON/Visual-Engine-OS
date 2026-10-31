# Membre supérieur : rendu par pixel et fidélité à la référence

Branche `feat/hair-grammar`. Ce document décrit ce qui a été **réellement fait** et **mesuré** ; ce qui reste est dans `BODY-UPPER-LIMB-REMAINING.md`.

## 1. Extraire l'information des références (`scripts/body-refs/`)
| Outil | Rôle |
|---|---|
| `extract.py` | masque de silhouette de `ref-02` (fond sombre ignoré : seuil luminance/saturation + plus grande composante) |
| `references/anatomy/measures.json` | repères mesurés sur l'image : tête 109 px, hauteur 7,7 têtes, demi-envergure d'épaules 1,22 tête, envergure des bras 3,29 têtes, bout des doigts, entrejambe… |
| `references/anatomy/ref-02.silhouette.gz` | masque binaire (bits) rechargé par les tests |
| `iou.ts` | rend le corps de face dans la grille de la référence, aligne par DEUX repères (base du cou, bout des doigts), mesure l'IoU et l'écart de largeur par ligne |
| `overlay.ts` | superposition rouge (réf.) / vert (moteur) / jaune (recouvrement) |
| `calibrate.ts` | recherche par coordonnées : dit quels axes du moteur manquent d'amplitude |

Région comparée : du cou à la crête iliaque (y = 365) en entier ; en dessous seulement bras et mains (le tronc du moteur s'arrête aux hanches, les jambes de la référence sont exclues). Cette région est une convention écrite dans `measures.json`, pas un fait de la référence.

**Limite** : seule `ref-02` a donné un masque exploitable. `ref-04` (gris sur gris) échoue au seuillage ; `ref-01`, `ref-03`, `ref-05` n'ont pas été mesurées en pixels.

## 2. Résultats mesurés (veryMuscular, vue de face)
| Mesure | Avant | Après |
|---|---|---|
| IoU de silhouette (haut du corps) | 0,724 | **0,766** |
| Écart de largeur moyen par ligne | 14,7 % | **10,2 %** |
| Envergure / référence | 0,909 | **0,975** |
| Largeur d'épaules / référence | 0,878 | **0,945** |
| IoU `muscular` / `adultMale` | 0,709 / 0,692 | 0,765 / 0,734 |

« Avant » = même outil exécuté sur le commit `bbb1f82` (`artefacts/upper-limb/03a-silhouette-avant.png`).
`calibrate.ts` avant modification : six axes (clavicleSlope, trapezius, chest, upperArm, armThickness, shoulderDrop) saturaient à leur borne pour atteindre au mieux 0,80 : l'amplitude de la structure manquait, d'où les changements ci-dessous plutôt qu'un réglage de paramètres.

## 3. Changements du moteur
1. **Largeur d'épaules** : coefficient musculaire 0,10 → 0,23 (`frame.ts`) ; **chute de l'acromion** : suppression du terme `−0,03·mus` ; pivot gléno-huméral 0,075 h → 0,095 h sous l'acromion.
2. **Deltoïde** : origine remontée moins haut (−0,55 → +0,05 rayon) : la calotte ne dépasse plus la ligne de la clavicule.
3. **Coude** : l'enveloppe du bras se rétrécit vers le rayon de l'avant-bras (profil lissé) et l'enveloppe de l'avant-bras démarre à ce même rayon (avant : 86 → 53 px, une marche).
4. **Essai rejeté, consigné** : ajouter +8° d'abduction à pleine musculature fait passer l'IoU de 0,77 à 0,55.
5. Les 2388 tests existants restent verts ; `tests/body-pixel.test.ts` ajoute 6 tests dont un plancher de non-régression (IoU ≥ 0,75, écart ≤ 12 %).

## 4. Rendu par pixel (`src/body/volume/pixel.ts`)
Même géométrie, même sélection (`selectVolumes`, extraite de `render.ts`) et même ordre de peinture que le rendu vectoriel ; l'ombrage est calculé **à chaque pixel** :
- maillage des lofts (22 secteurs par anneau), **calottes** aux extrémités des muscles ;
- G-buffer : normale interpolée, profondeur, volume propriétaire, θ de section ;
- **passe peau** : toutes les enveloppes partagent un tampon de profondeur (raccord épaule/coude/cou) ; les volumes situés derrière la surface de peau sont masqués ; tendons et veines coupés hors de la peau ;
- éclairage global `tone` (ambiant, diffus, contour, reflet) par pixel, **occlusion ambiante** par horizon sur la profondeur, **rainures** entre volumes (voisin d'une couche supérieure), **stries de fibres** (θ) ;
- sur-échantillonnage 2×, PNG encodé sans dépendance (`src/core/png.ts`) et incrusté dans le SVG : le moteur reste un moteur SVG.
Coût mesuré : ≈ 2,4 s pour une vue de 900 px de haut (non optimisé, pas de cache pixel).

## 5. Vérification du rendu (`src/verify/pixel.ts`, 3 couches, mesurée sur l'image)
| Couche | Contrôles |
|---|---|
| Géométrie | silhouette connexe unique ; symétrie miroir (IoU > 0,80) ; marche de rayon au coude < 12 % |
| Anatomie | épaules plus larges que le tronc à la taille ; avant-bras / bras entre 0,70 et 1,00 |
| Style | ni noir ni blanc purs ; relief réel (écart-type de luminance > 14) ; teinte de peau conservée |
Première exécution : un contrôle a échoué à cause de **ma mesure** (la ligne de taille traversait les bras) ; elle mesure maintenant le segment central.

## 6. Artefacts (`artefacts/upper-limb/`, `npx tsx scripts/artefacts-upper-limb.ts`)
`01` corps + tête complète · `02` vues 0/35/90/145/180° · `03a/03b` silhouette avant/après · `04` référence vs moteur · `05` avant-bras et mains · `rapport.json`.

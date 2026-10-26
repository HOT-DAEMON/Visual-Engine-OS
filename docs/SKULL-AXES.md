# Crâne dérivé de la face, profil branché sur les moteurs de la face

Branche `feat/skull-axes` (depuis `feat/skull-profile`). Preuves : `artefacts/skull-axes/` (`npx tsx scripts/artefacts-skull-axes.ts`).
Reste à faire : `docs/SKULL-AXES-REMAINING.md`.

## 1. Dérivation des axes du crâne depuis la face (`src/skull/derive.ts`)

Le crâne n'est plus tiré à part : il est DÉDUIT des paramètres de la face, puis reçoit une petite variation libre BORNÉE.

Chaîne principale (la seule qui touche la longueur) :

1. **Largeur de face** : rapport `r = W/H` de l'hôte (la largeur maximale du contour est à `templeY`).
2. **Largeur de tête** : `breadthH = BREADTH_SCALE · r` avec `BREADTH_SCALE = 0,8` (en unités de H : 0,64 H pour `r = 0,8`).
3. **Indice céphalique cible** : `0,74 + 0,6 (r − 0,71)`, borné à [0,70 ; 0,90] (monotone : face plus large → tête plus ronde).
4. **Variation libre** : ± `CI_FREE = 0,025` sur l'indice (tirage du flux dérivé `seed ^ 0x5c011`).
5. **Longueur** : `L = largeur / indice`, convertie en axe `length` (`L = (0,80 + 0,06·length)·H`, `frame.ts`), bornée à [−1, 1] et consignée.

Autres axes dérivés (relations monotones documentées, variation libre ± `AXIS_FREE = 0,08`) :

| Axe du crâne | Lu sur la face | Relation |
|---|---|---|
| `frontalBulge` | `templeY` | plus la largeur maximale est haute, plus le front est plein |
| `vaultHeight` | `eyeLine` | yeux bas → voûte haute |
| `foreheadSlope` | `templeY`, `eyeLine` | front plus plein et voûte plus haute → front plus vertical |
| `zygoma` | `cheek.boneProjection`, `cheek.lateralWidth` | 0,6 · projection + 0,4 · largeur latérale |
| `neckDepth` | `neck.width` (fraction de W) × aspect/0,8 | largeur de cou 0,16–0,72 → 0–1 |

Les axes que la face ne détermine pas (occiput, inion, maxillaire, C7, lordose, trapèze, thyroïde, vaultPeak, scalp, inclinaison du cou, nuque) restent tirés librement. L'ordre des tirages est INCHANGÉ : leurs valeurs sont celles d'avant.
`Derivation` renvoie la trace complète (cible, variation, valeur retenue par axe, corrections du résolveur).

## 2. Profil branché sur les moteurs de la face

Avant : œil, sourcil et coiffure génériques propres au profil. Maintenant (`hair: 'auto'` par défaut dans `generateRandomProfile`) :

- **Œil** (`eye-data.ts`, `render-eye.ts`) : lu sur l'œil RÉELLEMENT posé sur le visage (`EyeFit`). Hauteur de fente = `hEff · fit.scale / H` (même échelle que la face) ; iris (rayon, couleurs du matériau), sclère, pupille, cils (nombre, longueur, courbure, allongement externe, couleur), pli, liner, sourcil (position mesurée par `browGeometry`, épaisseur, arc, inclinaison, longueur, effilement, couleur). Profondeur de la lentille = 0,38 × largeur frontale (perspective). La tête du sourcil reste dans le contour de la peau.
- **Cheveux** (`hair-shape.ts`, `render-hairs.ts`) : mêmes paramètres `FaceHair` que la face (style, texture, longueur, volume, frange, implantation, queue/chignon/tresses, graine). Implantation du front = celle de la face ; retombée = MÊME formule (`hairHangFrac`) ; point d'attache = MÊME formule que `tieSpots`. Dégradé racine → pointe, bandes de reflet et d'ombre cel, mèches, bord ondulé selon la texture résolue.
- **Pilosité** (`beard-shape.ts`) : moustache (sous-nasal → vermillon), barbe (cheek / menton / dessous selon `stubble|short|full|long|goatee`), favoris, lisière diffuse par semis de poils.

## 3. Couche de vérification (3 couches + contrôles croisés)

`verifyProfile(face, skull, { eye, faceEyeHeightH, faceSize, derivation })` ajoute `src/verify/skull-cross.ts` : chaque contrôle compare une grandeur mesurée en profil à la même grandeur mesurée en face.

| Couche | Contrôle | Gravité |
|---|---|---|
| géométrie | `face-width-source` (largeur lue = largeur max du contour de face) | error |
| géométrie | `cephalic-index-matches-derivation` (|indice mesuré − indice appliqué| ≤ 0,035) | error |
| anatomie | `cephalic-index-range` / `-max` (0,68–0,92) | error |
| géométrie | `eye-height-matches-face` (taille de l'œil, ≤ 2 %), `eye-line-matches-face` | error |
| anatomie | `eye-inside-head`, `iris-inside-eye`, `brow-above-eye`, `brow-below-supraglabella` | error |
| anatomie | `hair-presence-matches-face`, `hair-style-matches-face`, `hair-texture-matches-face` | error |
| style | `hair-color-matches-face`, `iris-color-matches-face` (lus dans le SVG émis) | error |
| anatomie | `hair-length-matches-face` (chevelure retombante, ≤ 0,12 H), `hair-reaches-jaw-matches-face`, `hair-hang-formula` | warn |
| anatomie | `facial-hair-presence-matches-face`, `beard-length-matches-face` | error / warn |

Résultat sur 300 graines : 0 rapport invalide, 0 erreur (`artefacts/skull-axes/verification.json`). Test de détection : un œil de profil agrandi de 50 % sans que la face change est rejeté.

## 4. Temps de génération

Mesures par étape (60 têtes, ms/tête, moteur sur Node) : face + dérivation 6 ; rendu SVG profil 26 ; rastérisation 1–59 (cache disque : 1,8 en rechargement, ≈ 59 à froid) ; vérification complète 62 (92 avant optimisation).
Gain de cette tâche : la géométrie de cheveux de la face (≈ 75 ms) n'est calculée par la vérification croisée QUE pour les coiffures retombantes ; la pilosité de la face que s'il y a une barbe. La géométrie n'a pas été simplifiée pour gagner du temps.

## 5. Fichiers (≤ 200 lignes chacun)

`derive.ts` 85 · `eye-data.ts` 68 · `render-eye.ts` 110 · `hair-shape.ts` 160 · `render-hairs.ts` 60 · `beard-shape.ts` 68 · `verify/skull-cross.ts` 110 · tests `skull-axes.test.ts`.

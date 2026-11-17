# Rotation — décisions, validations et reste à faire (état de la branche `feat/hair-grammar`)

## A. Validations demandées
1. **Profondeur du crâne** : mesurée. Indice céphalique mesuré 0,975 → profondeur/largeur = **1,026**, retenue `DEPTH_RATIO = 1,03` (remplace la convention 0,92 de l'étape 1, qui n'était pas mesurée). Effet : à ±30° le contour reste quasi constant (section presque circulaire) ; le mouvement visible vient donc des traits internes (voir `ROTATION-FACE-FEATURES.md`).
2. **Profondeur avant/arrière distincte** : proposée, NON adoptée. Les valeurs de référence sont face 0,92·rx et dos 1,14·rx ; l'ellipse unique 1,03 est une moyenne. Une silhouette asymétrique (arrière plus profond) exige un modèle à deux demi-ellipses dans `Skull` : à décider par l'utilisateur.
3. **Correction du modèle de crâne de l'étape 1** (section `(hx(y), k·hx(y))`, `hx` = demi-largeur réelle du contour) : appliquée dans `skull.ts` ; **à valider par l'utilisateur** sur `artefacts/rotation-silhouette-hair/02-geometrie-masses-silhouette.png`.

## B. Prérequis hors cheveux
- Étape 3 (yeux, nez, bouche, oreilles, sourcils suivent la pose) : faite par composant, voir `ROTATION-FACE-FEATURES.md`.
- Étape 5, partie 1 : lacet composé dans le rendu SVG : fait ; **tangage** absent du schéma, **roulis** absent du contrat → « capacité absente », non émulé par rotation SVG globale (interdit).

## C. Tranches cheveux
| Tranche | État |
|---|---|
| 4 mèches + pièces attachées | faite, preuves `artefacts/rotation-hair-strands/`, limites dans `ROTATION-HAIR-STRANDS.md` |
| 5 éléments liés | faite (projection), lissage et dégradé à finir : `ROTATION-HAIR-LINKED.md` |
| 6 pièces attachées | faite en rigide (profondeur d'ancrage) ; alpha/profondeur à affiner |
| 7 cheveux sous le menton / cou (`neckHalf`), défauts à 0° (crochets d'oreille, base d'afro) | NON faite |
| 8 tangage puis roulis | NON faite (capacité absente) |

## D. Recette finale
| Étape | État |
|---|---|
| 9 couche de vérification étendue aux poses | faite (`ROTATION-HAIR-VERIFY.md`) |
| 10 corpus multi-graines (10 coiffures, −45° à +45°) | partiel (3 graines, −45° à +45° couvert) |
| 11 références 0° inchangées | vérifié (`scripts/regress.ts check`) |
| 12 séquence −90° → +90° pas de 15° | livrée de −75° à +75° (limite du schéma : `yawDeg` ≤ 75) |

## Décision ouverte avant la tranche 8 : vues de dos et au-delà de ±50°
Cette méthode fait tourner un dessin 2D : elle ne peut pas montrer l'arrière de la tête. Deux voies : (a) vues clés dessinées pour le dos (tours de personnage d'animation) ; (b) données cachées minimales (profondeur par courbe, mèches cachées). Recommandation : (b) limitée à la profondeur par courbe, décidée avant la tranche 8.

## Processus
- Le jeton d'accès GitHub transmis en clair ne doit figurer dans aucun fichier, commit ou doc.
- Aucun fichier de doc > 200 lignes ; toute suite est un nouveau fichier `ROTATION-*.md`.

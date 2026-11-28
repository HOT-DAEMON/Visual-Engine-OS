# Chignons — mesure de la référence 04 et construction

Outil : `scripts/hair-grammar/measure-buns.py <id> <sortie>` (Python, OpenCV). Surcouches et JSON : `artefacts/hair-engine-pass12/mesures/`.
Construction : `src/hair-grammar/profiles/buns.ts`. Bilan : `HAIR-PASS12.md`.

## Unité
Les références ont un front plus haut que le moteur (réf. 04 : œil → sommet ≈ 0,94 H contre 0,50 H). Une mesure « au-dessus des yeux » ne se transporte donc pas.
On normalise par la hauteur de tête visible `Hc` = menton − sommet du crâne HORS chignons (réf. 04 : 692 px) ; le moteur a Hc = 1,00 H.

## Règle de segmentation (auditable)
1. Fond uni : écart Lab > 40 à la médiane des bords de l'image ; région d'intérêt au-dessus de la frange (y < 330 px).
2. Ouverture 5 × 5 ; transformée en distance : les maxima locaux sont des disques inscrits (centres). Les deux plus hauts sont les chignons ; les autres sont la masse du crâne.
3. Rayon EXTÉRIEUR : cercle ajusté par RANSAC (3 000 tirages, tolérance 3 px) sur les points du contour dans l'arc extérieur-haut, hors raccord au crâne.
Les disques inscrits (r ≈ 0,10 Hc) sous-estiment le volume : ils rentrent dans les vides du dessin ; ils ne servent qu'à localiser.

## Résultats (réf. 04, Hc = 692 px)
| | centre latéral | centre / sommet du crâne | rayon extérieur | ajustement |
|---|---|---|---|---|
| chignon gauche | −0,192 Hc | +0,011 Hc | **0,203 Hc** | RANSAC, 152 points sur 283 |
| chignon droit | +0,379 Hc | +0,059 Hc | 0,133 Hc | REFUSÉ : arc partiellement masqué, rayon sous-estimé |
Valeurs lues à la main sur la grille (marquées `manual`) : ancres œil, menton, axe, sommet du crâne ; chignon droit ≈ 0,21 Hc de rayon, centre ≈ +0,31 Hc.
Retenu pour le moteur : diamètre ≈ 0,41 Hc, centres à ≈ ±0,25 Hc de l'axe, au niveau du sommet du crâne.

## Construction dans le moteur
Un chignon = deux familles au même nœud : un CORPS (pales larges à bout rond, `taper` 0,6–0,75, rayonnant autour du nœud par un champ `radial` local) et une SPIRALE
(mèches fines, `swirl` ± 0,5) posée dessus. Décollement `liftPow` 2 : profil en dôme 1 − t² (vu de face, un disque bombé ; de côté, une demi-sphère).
Moteur : diamètre 0,42 H (double), 0,52 H (haut) — contrôlé par `attach-verify.ts` sur chaque rendu.

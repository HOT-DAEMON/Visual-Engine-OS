# Cou en cloche vers les trapèzes

## Pourquoi

Les rendus v5 montraient un cou en tube coupé net (évasement ×1,27 – ×1,39, `smooth(t)²` sur 0,3 U : le gros de l'évasement n'arrivait qu'à la dernière rangée). `references/rotation-3d/05.jpg` et `07.jpg` montrent un cou en entonnoir : étroit sous le crâne, puis les trapèzes s'ouvrent vers les épaules.

## Mesure (réf. `rotation-3d/07.jpg`, vue de dos, cellule en bas à droite)

Extrémités gauche / droite des pixels non blancs par ligne (pas de 8 px), recadrage (285, 791) – (500, 991). Lignes 120 – 176 seulement (au-dessus : oreille et cellules voisines polluent la mesure). Largeur : 61 px au plus étroit, 169 px à la coupe (×2,77), sur ≈ 0,9 fois la largeur du cou. Normalisée : 0 ; 0,05 ; 0,19 ; 0,41 ; 0,63 ; 0,82 ; 0,97 ; 1 — `smooth(t)` donne 0 ; 0,06 ; 0,20 ; 0,39 ; 0,61 ; 0,80 ; 0,94 ; 1 : écart maximal 0,03. Données : `artefacts/head-turntable-v6/mesures/profil-cou-reference-07.json`.

## Modèle (`src/head-turntable/engines/neck3d.ts`, têtes issues d'un visage)

- Largeur : `a(y) = a₀ · (1 + K · g)`, `g = smooth((y − (y₁ − 0,4)) / 0,4)`, `K = 0,5 + 1,0 × skull.trapezius`, soit un rapport coupe / sous-crâne R = 1 + K ∈ [1,6 ; 2,4] (40 graines : 1,70 – 2,28).
- Profondeur : `b(y) = b₀ · (1 + 0,55 · K · g)` (le thorax est plus profond que le cou, moins qu'il n'est large).
- Nuque : le dos recule de `0,05 × skull.c7 × g` ; le devant (creux sus-sternal) reste.
- Maillage : 30 rangées de cou (12 pour la planche, inchangée : évasement mesuré de 10 %).

R ≤ 2,4 est une **convention** : la réf. donne ×2,77 pour des épaules entières d'un buste masculin musclé, coupées plus bas ; une cloche aussi large mangerait le cadre et couvrirait la mâchoire à 0°.

## Vérification

`verify-relief.ts` : `head.style.neck.flare` (borne haute 1,9 → 2,2 : R max du modèle, la marge était de 0,06), `head.style.neck.bell` (coupe / sous-crâne ∈ [1,55 ; 2,5] ; têtes issues d'un visage seulement, la planche en est exclue), `head.style.neck.monotone` (aucune diminution de largeur vers le bas : ni goulot ni bosse), `head.style.neck.step` (marche ≤ 0,03 U, inchangé et toujours vert). Tests : `tests/head-turntable-neck-bell.test.ts` (4).

## Limites constatées sur `03-reference-07-contre-moteur.png`

- Le trapèze de la réf. est une diagonale quasi droite jusqu'aux épaules ; la cloche du moteur est concave puis verticale : plus « vase » que « épaules ».
- La coupe reste un disque horizontal ; la réf. coupe en courbe, bien plus bas.
- La mesure vient d'UN dessin stylisé, d'UNE cellule : la loi `smooth` est ajustée sur 8 points, pas validée sur d'autres morphologies.
- Aucune ombre ni plan de trapèze n'est dessiné (les plans colorés de la réf. 05 ne sont pas repris) ; SCM, platysma, clavicule : ⬜ (`HEAD-TURNTABLE-RELIEF-REMAINING.md`).

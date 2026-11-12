# Périmètres d'occupation des composants enfants du visage

Suite de `FACE-ZONES.md` (sept bandes verticales du moteur `structured`). Les bandes ne disent rien des sourcils, de l'écart sourcil / paupière, de la zone entre les yeux ni des **largeurs** : ce document définit neuf périmètres, chacun par rapport à la hauteur H et à la largeur W du visage. État par composant et reste à faire : `FACE-PERIMETERS-REMAINING.md`.

## Les neuf périmètres (de haut en bas)

Mesurés sur les repères RÉSOLUS (`faceLandmarks`, source unique) et, quand les yeux posés sont fournis, sur leur géométrie exacte (fente, pli, sourcil : `eyeBands`). Le repère est celui de l'hôte (origine au centre), `y` vers le bas ; chaque périmètre est une boîte [haut, bas] × [−demi-largeur, +demi-largeur] ; les yeux gauche et droit sont moyennés (l'asymétrie naturelle n'est pas un défaut ; l'écart sourcil / paupière est contrôlé œil par œil).

| # | Périmètre (`id`) | Haut | Bas | Demi-largeur occupée | Hauteur (× H) | Largeur (× largeur du visage) |
|---|---|---|---|---|---|---|
| 1 | front (`forehead`) | implantation (`hair.centerY`) | haut des sourcils | ≤ 0,8 × contour | 0,09 – 0,38 | 0,50 – 0,85 |
| 2 | sourcils (`brows`) | point le plus haut du sourcil | point le plus bas | sourcil externe | 0,015 – 0,10 | 0,30 – 0,90 |
| 3 | **écart sourcil / enveloppe palpébrale** (`browGap`), **flexible** | bas du sourcil | haut du pli palpébral | sourcil externe | **0,008 – 0,06** | 0,30 – 0,90 |
| 4 | enveloppe palpébrale (`eyes`) | haut du pli | bas de la paupière inférieure | canthus externe | 0,05 – 0,23 | 0,45 – 0,90 |
| 5 | zone entre les yeux (`interocular`) | glabelle (bas des sourcils ou haut du pli) | max(ligne des yeux, bas de la fente) | canthus interne | 0,05 – 0,30 | 0,12 – 0,36 |
| 6 | nez (`nose`) | **bas de la zone entre les yeux** | base du nez | max(ailes, pointe) | 0,08 – 0,20 | 0,09 – 0,34 |
| 7 | philtrum (`philtrum`) | base du nez | haut de la lèvre supérieure | colonnelle + 0,02 W | 0,06 – 0,115 | 0,04 – 0,16 |
| 8 | bouche (`mouth`) | haut de la lèvre supérieure | bas de la lèvre inférieure | `lips.half` | 0,035 – 0,16 | 0,22 – 0,70 |
| 9 | bouche → base du menton (`chin`) | bas de la lèvre inférieure | base du menton | min(menton, contour) | 0,07 – 0,26 | 0,30 – 1,05 |

La chaîne 1 → 2 → 3 → 4 est contiguë (le haut de l'un est le bas du précédent) ; 6 → 7 → 8 → 9 aussi. Le nez commence SOUS la zone entre les yeux : la racine (pont) reste dans la zone 5, plus étroite que la distance intercanthale ; ailes, narines, pointe et base appartiennent au périmètre 6.

## D'où viennent les bornes

`src/face/perimeters-limits.ts` (source unique) : calibrées sur **200 visages `structured`** (graines 1 – 200) avec `scripts/artefacts-face-perimeters.ts`, puis resserrées sur les cas aberrants. Rapports canoniques (avertissements de style, pas d'échec) : intercanthale / largeur de fente 0,4 – 2,1 (canon 1) ; nez / intercanthale 0,3 – 1,6 (canon ≈ 1) ; bouche / intercanthale 0,7 – 2,8 (canon ≈ 1,5) ; menton / bouche 0,5 – 2,1 (< 0,5 : menton en pointe de bouclier).

## Ce qui est FORCÉ, ce qui est seulement VÉRIFIÉ

| Périmètre | Forcé à la construction | Vérifié (`src/verify/perimeters.ts`) |
|---|---|---|
| écart sourcil / paupière | **oui** : `fitEyeToFace(…, { perimeters: true })`, activé par `generateRandomFace` en `structured` | erreur dure, œil par œil |
| tous les autres | non | hauteur et largeur dans les bornes (avertissement), chaîne ordonnée (erreur), composant dans le contour (erreur), nez sous la zone entre les yeux (erreur) |

**Contrainte de l'écart** (`face/fit-eye.ts`). La grandeur bornée est la distance MESURÉE entre le haut du pli palpébral et le point le plus bas du contour réel du sourcil (incliné, arqué, pincé compris), pas le paramètre `gap`. Elle varie linéairement avec `gap` (pente = hauteur de fente locale × échelle) ; le sourcil faisant partie de l'empreinte de l'œil, 5 passes de point fixe (tolérance 5e-4 H) ramènent l'écart dans [0,008 H ; 0,06 H]. L'œil d'ORIGINE est repris à chaque passe (l'asymétrie d'ouverture ne se réapplique pas). Flexible : à l'intérieur de la plage l'expression garde toute sa course (écart médian 0,032 H, étendue observée > 0,03 H).

## Résultats (200 visages `structured`, `artefacts/face-perimeters-perspective/06-verification-perimetres.md`)

- 11 495 contrôles, **0 échec dur**, 4 avertissements (moyenne des deux yeux un peu au-dessus de 0,06 H).
- Écart sourcil / paupière moyen, avant la contrainte : 0,009 – 0,072 H ; après : 0,009 – 0,060 H. Le plafond agit sur les sourcils flottants (≈ 5 % des visages) ; le plancher n'a jamais agi sur ces 200 graines (min 0,009 > 0,008) mais est prouvé sur un sourcil injecté à `gap = 0` (test).
- Visages SANS sourcil (7 sur 200) : sourcils et écart non contrôlés (valeurs estimées depuis les repères).

## Fichiers

`src/face/perimeters.ts` (mesure : `facePerimeters`, `eyeBands`, `browGapPerEye`), `src/face/perimeters-limits.ts` (bornes), `src/face/fit-eye.ts` (option `perimeters`), `src/generation/random-face.ts` (activation), `src/verify/perimeters.ts` (3 couches, branché dans `verifyFace`). Tests : `tests/face-perimeters.test.ts` (6, dont 2 « non aveugles » : le contrôle échoue sur un sourcil injecté, la contrainte absente laisse l'écart hors plage). Preuve : `artefacts/face-perimeters-perspective/01-perimetres-visage.png` (4 visages, neuf périmètres superposés).

# Cheveux plus naturels sur le crâne — masses rondes, côtés, chignon (série 7)

Contexte : les masses rondes (`afro`, `curly`) se lisaient comme des masses penchées à gauche / droite, avec des rideaux de mèches le long des oreilles, des cônes, un croissant sombre hors des mèches et un dessus plat non couvert. Les attaches (`bun`) donnaient des « oreilles de souris ». Suite de `HAIR-ROUND.md` / `HAIR-DOME-ROUND.md`. Contrôles : `HAIR-NATURAL-VERIFY.md` ; franges : `HAIR-NATURAL-FRINGE.md` ; reste à faire : `HAIR-NATURAL-REMAINING.md`. Preuves : `artefacts/hair-natural/` (avant / après, mêmes graines).

## 1. Coque ELLIPTIQUE des masses rondes (`boundary/shell.ts`, `ROUND_SHELL`)
Cause : le bord extérieur de la coque était le contour du crâne décalé le long de sa normale (+ épaule) ; avec le gain d'asymétrie, la masse penchait et se terminait en marche au bas de l'aile.
Remède, pour `afro` et `curly` seulement :
- bord extérieur = DEMI-ELLIPSE à deux demi-axes (sommet, bas), tangente verticale à l'équateur, équateur COMMUN aux deux côtés (moyenne des repères gauche / droite : la boule reste centrée même si les oreilles diffèrent) ;
- demi-axe bas résolu pour passer par le bas de l'aile ; lissage `smoothMax` contre le crâne (épaisseur minimale `minShare`) ; bas d'aile arrondi (`wingCap`) ;
- plafonds d'épaisseur `maxTop` / `maxSide` (afro 0,20 / 0,15 W ; curly 0,13 / 0,11 W) ÉLARGIS par le gonflement demandé (`silhouette.puff` × `puffW`), toujours bornés par `maxT` (sans cela `puff` n'élargissait plus le bouclé : tests `hair-v2` « puff gonfle l'enveloppe » ; corrigé) ;
- soulèvement de la raie ≤ 0,008 H sur la moitié haute.
Valeurs posées par mesure sur 40–60 visages (afro / curly), pas par une référence dessinée.

## 2. Côtés symétriques (`sides.ts`, `scalp.ts`, `vocab.ts`)
`SYMMETRIC_SIDES` + `sideWant` : une masse ronde a le MÊME comportement des deux côtés ; les rideaux (bandes d'oreille) sont désactivés pour afro / curly ; `cones: false` pour curly / afro. L'oreille est couverte par la MASSE (coque), non par des bandes : le contrôle d'anatomie `ear-covered` mesure donc coque + mèches (`verify/anatomy.ts`).

## 3. Rentrage et rognage
`tuck.ts` : `curly` reçoit un rentrage (`maxInset 0,04`) comme l'afro : plus de croissant de teinte de racine sur le bouclé. `verify/hair-round.ts` : le « sommet » de la masse est le centre du plateau (sommets à < 0,03 H du plus haut), plus un sommet isolé (bruit de 3 px → 0,12 W de décalage).

## 4. Chignon et queue (`tie.ts`)
Rayon 0,10–0,19 W (latéral) / 0,11–0,20 W (dessus) ; centre décalé vers l'extérieur et le haut (dessus : y − 0,6 r ; côté : x + 0,35 r, y − 0,25 r) : la boule se pose SUR le crâne. Bornes dans `TIE` (source unique construction + vérification). Mesuré (60 visages) : rayon médian 0,140 W (0,097–0,187), part du contour hors du crâne ≥ 0,69. `verify/hair-shape.ts` : le contrôle générique `hair-reach-beyond-skull` ignore le chignon (volume voulu hors du crâne). Queue : éventail `max(0,02 W, base·W − 0,4·largeur)` → `ponytail` reach 0,423 → dans la limite. `spiky` : `crown-fill` `{ rim 0,5, all 0,5, len 0,1, max 150 }` → `shell-rim-bare` dans la limite.

## 5. Résultats (voir `artefacts/hair-natural/corpus.md`)
Corpus 40 visages × 10 coiffures : 0 erreur ; 9 avertissements, tous le MÊME visage (frange classique « rideau », `fringe-tuft-count` 30–31 pour 20). Tests : 22 fichiers cheveux / oreilles / pont tête (700 tests) + `hair-natural` (4) passent ; la suite complète n'est pas rejouée d'un bloc (> 10 min sur 2 CPU).

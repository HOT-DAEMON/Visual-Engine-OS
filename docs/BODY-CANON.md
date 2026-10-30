# Canon des proportions du corps (`src/body/canon.ts`, `frame.ts`)

**Ce sont des CONVENTIONS D'ATELIER (dessin d'anatomie), pas des mesures d'une population.** Unité : 1 hauteur de tête `h` (sommet → menton). Interpolation
linéaire entre âges-clés. Aucune de ces valeurs n'a été validée contre des données anthropométriques : les bandes de `verify/body.ts` les recoupent entre elles,
elles ne prouvent pas leur exactitude biologique.

## Table par âge (ans)
| Quantité (en h) | 0 | 1 | 2 | 6 | 10 | 15 | 20 | 70 | 95 |
|---|---|---|---|---|---|---|---|---|---|
| têtes (taille totale) | 4,0 | 4,5 | 5,0 | 6,0 | 6,75 | 7,25 | 7,5 | 7,3 | 7,1 |
| base du cou → nombril | 0,78 | 0,84 | 0,90 | 1,05 | 1,22 | 1,38 | 1,50 | 1,46 | 1,40 |
| demi-épaules (bideltoïdien/2) | 0,62 | 0,66 | 0,70 | 0,80 | 0,88 | 0,95 | 0,96 | 0,93 | 0,90 |
| demi-tronc à l'aisselle | 0,50 | 0,52 | 0,54 | 0,58 | 0,62 | 0,68 | 0,72 | 0,70 | 0,68 |
| demi-taille | 0,52 | 0,52 | 0,50 | 0,48 | 0,49 | 0,52 | 0,54 | 0,56 | 0,56 |
| demi-hanches | 0,50 | 0,50 | 0,50 | 0,52 | 0,55 | 0,60 | 0,61 | 0,61 | 0,60 |
| chute de l'acromion | 0,06 | 0,07 | 0,08 | 0,09 | 0,10 | 0,11 | 0,115 | 0,13 | 0,15 |
| bras (épaule → coude) | 0,90 | 0,95 | 1,00 | 1,15 | 1,28 | 1,34 | 1,36 | 1,34 | 1,30 |
| avant-bras | 0,75 | 0,80 | 0,88 | 0,98 | 1,08 | 1,13 | 1,15 | 1,12 | 1,08 |
| main (poignet → bout du majeur) | 0,50 | 0,55 | 0,62 | 0,70 | 0,76 | 0,79 | 0,80 | 0,79 | 0,78 |
| demi-largeur du bras (milieu) | 0,22 | 0,20 | 0,17 | 0,15 | 0,16 | 0,175 | 0,185 | 0,165 | 0,15 |
| demi-largeur de l'avant-bras | 0,19 | 0,17 | 0,145 | 0,125 | 0,135 | 0,15 | 0,16 | 0,145 | 0,13 |
| demi-poignet | 0,10 | 0,095 | 0,09 | 0,085 | 0,095 | 0,11 | 0,115 | 0,11 | 0,105 |
| demi-paume (aux articulations MCP) | 0,12 | 0,13 | 0,14 | 0,15 | 0,165 | 0,18 | 0,185 | 0,18 | 0,175 |

Stades (`stageOf`) : bébé < 2 ans · enfant < 12 · ado < 18 · adulte < 65 · âgé ≥ 65.

## Portes (lissées, smoothstep)
- `puberty(age)` : 0 jusqu'à 10 ans → 1 à 17 ans. Dimorphisme effectif `dim = sex × puberty`. **Avant 10 ans le sexe n'a aucun effet** (test : enfant fille = enfant garçon, atome pour atome).
- `senior(age)` : 0 jusqu'à 55 ans → 1 à 85 ans (épaules plus tombantes, masse musculaire −35 %).
- `muscleMaturity(age)` : 0 à 3 ans → 1 à 18 ans (un nourrisson n'a aucun relief musculaire visible).

## Modulations (`frame.ts`, coefficients nommés)
`fat = adiposity^1,2` · `mus = muscularity × maturité × (1 − 0,35 × senior)` · `vis = clamp(mus × (1 − 0,85 fat) + 0,1 (1 − fat) × maturité)`.
| Grandeur | Formule (canon × …) |
|---|---|
| demi-épaules | (1 + 0,08 dim)(1 + 0,10 mus)(1 + 0,035 fat)(1 + 0,12 `frame.shoulderWidth`) |
| demi-tronc | (1 + 0,06 dim)(1 + 0,10 fat + 0,07 mus)(1 + 0,12 `frame.chest`) |
| demi-taille | (1 + 0,06 dim)(1 + 0,55 fat)(1 − 0,04 mus)(1 + 0,12 `frame.waist`) |
| demi-hanches | (1 − 0,07 dim)(1 + 0,45 fat)(1 + 0,12 `frame.hip`) |
| chute de l'acromion | canon + 0,035 `shoulderDrop` + 0,03 `kyphosis` + 0,03 `clavicleSlope` − 0,03 `trapezius` − 0,03 mus |
| demi-bras / avant-bras | (1 + 0,30 mus + 0,35 fat + 0,06 dim) / (1 + 0,22 mus + 0,25 fat + 0,05 dim), × (1 + 0,12 `armThickness`) |
| poignet / paume | (1 + 0,05 mus + 0,12 fat) / (1 + 0,03 dim + 0,06 fat), × (1 + 0,12 `wristThickness` / `palmWidth`) |
| longueurs | canon × (1 + 0,12 `upperArm` / `forearm` / `hand`) ; doigt i : × (1 + 0,15 `fingers[i]`) |

## Proportions de la main (`hand.ts`, fractions de la main)
Paume = 0,55 ; doigts index 0,40 · majeur 0,45 · annulaire 0,42 · auriculaire 0,33 ; phalanges 0,46 / 0,30 / 0,24 du doigt ; pouce 0,20 / 0,17 / 0,15.
Écartement naturel par doigt : −8°, −1°, +5°, +12° (× 2 × `spread`). Flexions maximales : doigts 70° / 100° / 55°, pouce 25° / 45° / 35°.

## Station debout (seins) — garde-fou
Masse = `max(0, −dim)` × (0,35 + 0,65 volume) × (0,8 + 0,5 fat), **nulle avant 18 ans**. Ptôse = curseur × masse × (1 + 0,8 senior).

# Moteur capillaire — direction artistique, variation, observation de référence (TODO §A, §F, §G)

Code : `intent.ts`, `variation.ts`, `observe.ts` · tests : `tests/hair-engine-intent.test.ts` (26) · preuves : `artefacts/hair-engine/09-intentions.png`, `10-variation-niveaux.png`.

## F. Intention artistique (`applyIntent`)
Quatre axes continus (un mot de direction = un point dans cet espace) ; chacun modifie PLUSIEURS décisions à la fois, comme demandé (« gonflés et aériens ») :
| Axe | Décisions modifiées | Mesure (`measureIntent`) | Sens |
|---|---|---|---|
| `volume` −1…1 | largeur ×(1+0,45v), décollement racine/pointe ×(1+0,7v) | largeur du volume / largeur de tête | ↑ |
| `sleek` 0…1 | ondulation, retroussé, éventail, courbure ↓ | sinuosité = virage cumulé − virage net, par longueur | « lisse » ↑ |
| `weight` −1…1 | nombre ×(1+0,5w), largeur, longueur, gravité | part de l'enveloppe fermée couverte | ↑ |
| `wind` 0…1 + `windDir` | cap des familles + dir·1,5w, swirl/radial ↓ | projection du vecteur de lecture sur `windDir` | ↑ |
Presets : `airy, sleek, voluminous, windswept, heavy`. Les tests exigent la MONOTONIE de chaque mesure (3 graines moyennées, 3 à 4 pas) : l'intention se vérifie, ce n'est pas une étiquette.
Constats de mise au point : (1) la mesure de lissage par courbure brute était insensible (0,67 → 0,72) → remplacée par la sinuosité (0,56 → 0,75) ; (2) le champ de flux ne
pilote que les familles `follow` ; agir sur le champ saturait à `wind ≥ 0,25` → agir sur le cap des familles ; (3) la cohérence de lecture BAISSE avec le vent (une coiffure qui retombe est plus
« cohérente » qu'une coiffure balayée en arc) → la mesure projette sur la direction voulue.

## G. Variation par niveaux indépendants (`generateLevels`)
Sept niveaux, chacun avec SON flux : `silhouette` (racine, cap, longueur), `masses` (largeur, pic), `strands` (brins, ton), `tips` (effilement, retroussé), `texture` (onde, courbure),
`volume` (décollement, exposant, gravité), `asymmetry` (déséquilibre G/D borné ±0,35 log-largeur, ±0,12 rad). `sampleLock` consomme un nombre FIXE de tirages, donc les flux restent alignés :
le test change la graine d'un niveau et vérifie que TOUS les autres champs sont identiques, champ par champ. Répond aux cinq demandes : même silhouette/autres mèches, mêmes masses/autres pointes, etc.

## A. Observation de référence (`observe`)
À partir d'un masque + luminance + ellipse de tête : largeur et hauteur du volume, moment G/D, axe d'écoulement (tenseur de structure, mod π) et cohérence, espaces négatifs.
`observationsToSpec` → `{composition: {reading, balance}, intent: {volume, weight}}` (étalonnage mesuré sur TOUSLED, noté dans le code). Test d'aller-retour : rendre → observer rejoint la mesure interne (largeur à 10 %).

## Limites connues (à faire)
- OBSERVABLES SEULEMENT les 7 grandeurs ci-dessus. Restent à faire (liste du TODO §A) : masses dominantes, familles de courbes, types de pointes, organisation des franges,
  relations d'occlusion, texture picturale, asymétries intentionnelles : elles exigent une segmentation par mèche (non faite).
- `autofit.ts` (analyse par synthèse) n'est pas branché sur `observe` : la boucle « référence → observations → composition → autofit » n'est pas fermée.
- L'étalonnage `observationsToSpec` n'a été mesuré que sur TOUSLED ; une autre coiffure exige de refaire les sondes.
- `applyIntent` ne règle ni raie, ni frange, ni reflets adaptés (ces derniers viennent de `paint-pro` mais ne sont pas pilotés par l'intention) ; « pointes plus libres » = `flickAmt` seul.
- La mesure `wind` projette un vecteur global : un vent différent par zone n'est pas mesurable.
- Intentions fortes (`voluminous`, `heavy`) : défauts anatomiques (œil couvert), voir `HAIR-FINISH-VERIFY.md`.

# Formes de cheveux face au crâne — correctifs, mesures, vérification

Suite de `HAIR-BOUNDARY.md`. Preuves : `artefacts/hair-shapes/` (`npx tsx scripts/artefacts-hair-shapes.ts`). Reste à faire : `HAIR-SHAPES-REMAINING.md`.
Vent : `HAIR-WIND.md`. Tête en rotation : `HEAD-TURNTABLE-HAIR.md`.

## 1. Diagnostic (planche 07 d'origine, moteurs classic et v2)
Les défauts ont été lus sur les rendus, puis reliés à la géométrie du crâne :

| # | Défaut observé | Cause dans le code |
|---|---|---|
| 1 | Ailes de tempe = dalles rectangulaires à bout plat, plus sombres que le reste | mèches d'aile verticales (pas la méridienne du crâne), racines pleines (0,8 de largeur) toutes au même `y`, ton −0,12 |
| 2 | Pointes d'aile qui s'évasent hors du contour (bun, ponytail) | aucune borne sur l'abscisse de la ligne médiane |
| 3 | Frange classique en « dents de peigne » | bord inférieur en dents triangulaires (`tri`), mèches de frange à pointe d'aiguille (`sharp 0,5`) |
| 4 | Implantation plate, encoches carrées, marches | gaussiennes étroites + reposage sur le crâne point par point sans lissage |
| 5 | Mèches parasites sous le cou (queue de cheval) | `tailLocks` : longueur jusqu'à 0,7 H sans butée aux épaules |
| 6 | v2 : cônes en éventail qui sortent des joues | racines de `coneLocks` jusqu'à \|s\| = 0,85 (tempe), axe vertical indépendant du crâne, longueur non bornée |

## 2. Correctifs (moteur classic et v2 hors simulation)
- `boundary/wings.ts` : la mèche suit la **méridienne du crâne** (dérive = pente `da/dy` du contour, éteinte vers le bas), racine étroite (`root: 0,25`),
  racines étagées de `yCorner − 0,07 H`, ton −0,04 ; abscisse bornée à `a(y) + 0,5 × épaisseur de coque`.
- `flow.ts` / `ribbon.ts` / `hair-cel.ts` : option `root` (largeur relative de racine) portée par `HairLock.rootW` jusqu'au rendu cel (une seule formule de largeur).
- `hairline.ts` : trois passes de lissage [1 2 1] sur `y` (extrémités de tempe conservées), puis reposage sur le crâne.
- `fringe.ts` : feston `0,5 − 0,5 cos 2πu` au lieu du triangle ; 6 à 9 mèches ; mèches de frange plus larges (×2,0 / K) et à bout rond (`sharp 0,15`).
- `tie.ts` : une queue basse est arrêtée au bas du cou rendu (`neck.bottomY − 0,012 H`).
- `shapes.ts` (cônes v2) : racines sur le dessus du crâne (\|s\| ≤ 0,7, t ≥ 0,85), axe radial `(0,9 s, −1,1 + 0,5|s|)`, longueur ≤ 0,3 H et décroissante vers les côtés ; flux v2 ≤ 0,42 H.

Effet mesuré : voir `artefacts/hair-shapes/01-avant-apres-*.png`. Les changements sont **nets sur les ailes, la queue de cheval et la frange** et
**discrets** ailleurs ; le moteur v2 par défaut tire des cheveux simulés (Verlet) que ces correctifs ne touchent pas (voir le reste à faire).

## 3. Couche de vérification (3 couches, chiffrée, avec contrôles négatifs)
`src/verify/hair-shape.ts` (branché dans `verifyFace`) — même `HairGeometry` que le rendu :

| Couche | Contrôle | Seuil | Gravité |
|---|---|---|---|
| géométrie | `hair-shape-finite` : tous les sommets finis | = 1 | erreur |
| géométrie | `hair-reach-beyond-skull` : dépassement du contour (en W) | 0,42 (0,6 curly/afro, 1,0 long/bob) | avertissement |
| géométrie | `hair-height-above-skull` : hauteur au-dessus du sommet (en H) | 0,38 (0,6 spiky/curly/afro) | avertissement |
| géométrie | `hair-not-below-neck` : sommet sous le bas du cou (en H) | 0,02 (0,7 long/bob/braids) | erreur |
| anatomie | `hair-covers-face-skin` : part de peau yeux→bouche couverte par les formes `front` | 0,02 | erreur |
| anatomie | `hair-forehead-height` (min 0,18 / max 0,62 de H, implantation → ligne des yeux) | | avertissement |
| style | `hair-fringe-no-comb` : dents aiguës (< 75°) du bord de frange | 4 | avertissement |
| style | `hair-hairline-no-corner` : angle vif ou marche de l'implantation | 0 | erreur |

`src/verify/head-hair.ts` : mêmes trois couches pour la région de la tête tournante (`HEAD-TURNTABLE-HAIR.md`).
Tests : `tests/hair-shape-verify.test.ts` (dont 3 défauts injectés qui doivent être vus), `tests/head-hair-bridge.test.ts`.
Balayage (`artefacts/hair-shapes/04-verification-3-couches.png`, `verification.json`) : 10 coiffures × 24 graines, classic.

## 4. Ce que la vérification ne prouve pas
Les seuils sont posés à la main sur un corpus de visages du moteur. **« Contrôles passés » ne veut pas dire « beau »** : revue visuelle humaine
nécessaire sur `01-avant-apres-*.png` et `02-tete-complete-en-rotation.png`.

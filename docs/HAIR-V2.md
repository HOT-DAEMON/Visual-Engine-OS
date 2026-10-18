# Cheveux v2 — formes, volume, racines, étages, pointes, épaisseurs

Code : `src/face/hair/` (géométrie pure, sans SVG) + `src/render/face/hair*.ts` (rendu). Schéma : `src/schema/hair-v2.ts`.
Suite : `docs/HAIR-V2-FACE.md` (franges, côtés, occlusions, cel, couleurs). Moteur d'apparence : `docs/APPEARANCE.md`.
Vérification : `docs/VERIFY.md`.

Tous les champs ont un **défaut neutre** : une chevelure écrite avant la v2 se rend à l'identique (`hairEngine: 'classic'` reproduit
exactement les visages d'avant). Les unités sont des fractions de W (largeur) / H (hauteur) de l'hôte.

## Contrat du composant « chevelure »

| | |
|---|---|
| **Entrées** | `FaceParams.hair` (+ `skin`), `FaceLandmarks` (implantation, arc du crâne, sourcils, yeux, oreilles, mâchoire) |
| **Sortie géométrique** | `HairGeometry` : `locks[]` (polygone + rang + forme + calque), `base`, `bare`, `over`, `tierMasses`, `occlusions`, `sides` |
| **Sortie rendue** | `HairParts { defs, back, front, over }` : `back` avant le cou/la tête, `front` après la tête, `over` après les yeux |
| **Invariants** | aucune mèche *avant* dans la zone centrale du visage ; frange ≥ 0,008 H au-dessus des sourcils ; yeux, nez, bouche à leur place exacte ; déterministe (même seed → mêmes sommets) |
| **Enfants du visage** | yeux, nez, bouche, oreilles, pilosité : positions fixées par les repères, jamais déplacées par les cheveux |

`HairLock` : `poly` (final, après garde-fou), `rank` (`mass`·`main`·`fine`·`hairline`·`plait`), `kind` (`lock`·`flow`·`cone`·`wisp`·`fringe`·
`cheek`·`tuft`·`occluder`), `layer` (`back`·`front`·`over`), `spine/w0/sharp/profile/power` (ruban *avant* garde-fou, lu par le rendu),
`tier`, `fade`, `edgeFade`.

## Formes de mèches (`flow`, `shapes.ts`)

- **Grandes mèches en S** (`mode: ribbons|mixed`, `ribbons` 0–14) : `sCentre` = une période de sinusoïde le long de l'axe de départ
  (« S » souple), enveloppe qui démarre doucement, affaissement `(1 − float)` : à `float = 1` aucune gravité. Portée `span · H`
  modulée par le gain de silhouette du côté. Rang `mass`, effilée (`sharp` 0,92). 60 % devant, 40 % derrière (plus sombres).
- **Cônes rigides** (`mode: cones|mixed`, `cones` 0–12) : `ribbon.cone` — largeur **pleine à la racine**, bords droits (`power` 1) devenant
  concaves (aiguille) avec `coneSharp`. Paquets de 2–4 cônes éventail ±0,35 rad autour d'un axe haut/arrière.
- **Volutes et mèches libres** (`wisps` 0–24, indépendant de `mode`) : départ sur le contour du crâne, direction radiale tournée, rotation
  croissante (boucle ouverte), **sans gravité**, 0,007–0,015 W de large, pointe d'aiguille, fondu d'opacité 0,75.

## Silhouette et volume (`silhouette`, `volume.ts`)

- `puff` (0–1, jusqu'à 0,16 W) gonfle l'enveloppe en haut **et sur les côtés** pour **toutes** les textures (raide, ondulé… pas seulement afro) ;
  l'évanouissement aux temples est raccourci dès que `puff > 0`.
- `asymmetry` + `bias` (±1) : `makeGain` multiplie enveloppe, longueur et portée par côté (de ×0,35 à ×2,1, transition en puissance 0,8).
- `lift` : report de masse vers le sommet (longueur des cônes).

## Racines relevées à la raie (`rootLift`)

Autour de `partX` (largeur `width·W`), la direction initiale est tirée vers le haut (poids gaussien × `amount`) puis la gravité ajoutée
`k·(0,3 + 1,9·fall)` fait **retomber** la mèche ; `liftBump` soulève aussi la sous-couche. `fall` 0 = reste dressé, 1 = retombe franchement.

## Longueurs étagées et sous-couches visibles (`tiers`)

`count` 1–4 : chaque mèche tire un étage ; sa longueur est multipliée par `1 − step·tier` et son ton assombri ; les mèches des
étages profonds sont dessinées d'abord. `underVisible > 0` ajoute, par étage ≥ 1, une silhouette (enveloppe radiale des mèches de
l'étage) en ton `underTone` décalé de `underHue·tier`. Rognée par la sous-couche devant la tête (jamais sur le visage), copie derrière.

## Pointes (`tips`)

`irregular` : pointe fendue en deux dents inégales avec encoche (`raggedTip`) ; `flick` : le dernier quart de la ligne médiane tourne
jusqu'à ~75° **vers l'extérieur** (`flickTip`, signe de l'abscisse de la racine) ; `fade` : opacité décroissante vers la pointe
(dégradé d'opacité) ; `edgeFade` : halo translucide autour du contour (bords qui se fondent).

## Épaisseurs (`strands`) et textures mélangées (`textureMix`)

Trois niveaux : `mass` (0–8 mèches de 0,10–0,18 W, aplats), mèches moyennes (base), `fine` (multiplicateur), et `hairline` (jusqu'à 160 traits
de 0,0014–0,003 W qui suivent la ligne d'une mèche existante, décalés et divergents). `textureMix` (≤ 4 poids) assigne la texture par
**zone** de la racine (bruit lisse) : régions cohérentes (dessus ondulé, nuque crépue), pas un tirage par mèche.

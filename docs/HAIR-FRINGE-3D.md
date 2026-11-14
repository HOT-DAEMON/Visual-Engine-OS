# Frange 3D : la bande de mèches du front tourne avec la tête

Branche `feat/hair-grammar`. Suite de `HAIR-VOLUME-3D.md`. Vérification : `HAIR-VERIFY-FEATURES.md`. Reste à faire : `HAIR-3D-REMAINING.md`.

## Problème
La coque 3D s'arrêtait à la lisière d'implantation : le front, sous l'implantation, était nu quelle que soit la frange dessinée en 2D (planche : « frange hors limite / rideau », de face la coiffure 3D ne ressemblait pas au visage).

## Décision (rien d'inventé côté 3D)
Le bord inférieur de la frange est celui du moteur 2D : `geo.fringeBottom` (49 points, px de l'hôte). Il est converti en table `azimut → U` (`fringeOf`, `src/head-turntable/hair-features.ts`) :
- azimut = `skull.azOf(x, y)` (même repère que la lisière) ; table de −90° à +90°, pas `FRINGE_STEP` = 3° ; un azimut sans point prend l'interpolation des voisins, deux points proches prennent le plus bas ;
- lissage [1 2 1] ×2, **plafond** = sourcil − `FRINGE_BROW_GAP` (0,03 U) : la frange ne descend jamais sur l'œil (convention d'anatomie) ;
- côté du balayage = côté où la frange descend le plus (`side`).
La table vit dans `HairVolume.fringe` ; elle ne dépend ni de la vue ni de la rotation (portée par la tête).

## Frange du moteur v2 (`blades`, `sheer`, `wispy`)
`fringe2.ts` : « jamais de masse pleine, le front reste visible entre les mèches ». Une bande pleine recouvrait de la peau que le dessin laisse voir (mesuré : couverture de peau de l'hôte 0,87 sur la graine 77, seuil du test 0,97). La bande 3D est donc la bande de **même aire** : part `cover = BLADE_AREA × (1 − gap)` de la hauteur entre l'implantation (`geo.boundary.hairline`) et le bord des mèches ; `BLADE_AREA` = 0,6 (une lame est un triangle pointe en bas : 1/2 à 2/3 du rectangle). Après : 0,994 (graine 11) et 0,972 (graine 77). Convention, non ajustée au rendu.

## Coque (`hair-shell.ts`)
- `fringeY(vol, az)` : bord inférieur à l'azimut `az` (−∞ au-delà de `FR_AZ1` = 92°, pleine jusqu'à `FR_AZ0` = 76° : la frange se fond dans la patte), plus bruit de longueur de mèche `FR_VAR` = 0,035 U (même bruit que l'ourlet du rideau).
- `inHair` : cheveux si dans la région de lisière **ou** au-dessus de `fringeY`.
- `shellPoint` : sous l'implantation, la bande décolle du front de `FR_LIFT` = 0,016 U (pondérée devant) : jamais coplanaire avec la peau.
- `hairEdgeDistance` : distance à la lisière frange comprise ; sert aux racines sombres (`strandColor`).

## Lisière : adoucissement (`relaxRegion`)
`hair-region.ts` : moyenne glissante [1 2 1]/4 des sommets (points artificiels fixes), 10 passes, appliquée après `smoothRegion` dans `hair-bridge.ts` et `engines/from-host.ts`. Lisse les marches de < 2° d'azimut du dessin 2D. Test : `tests/hair-features-3d.test.ts`.

## Vérification
`geo.fringe.range`, `geo.fringe.track` (le bord de frange projeté par la rotation est un bord cheveux/peau : 0,94 sur la graine 9000), `anat.fringe.brow` (écart ≥ 0,015 U), `anat.fringe.eye` (≥ 0,05 U). `geo.lisiere.track` ignore les points d'implantation recouverts par la frange.

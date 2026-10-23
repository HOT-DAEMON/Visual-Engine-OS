# Moteur d'oreille — vues, alignement, familles, vérification (partie 2/2)

Partie 1 : `docs/EAR-SYSTEM.md`. Reste à faire : `docs/EAR-REMAINING.md`.

## 4. Projection (quatre vues, un seul modèle)
Le pavillon est un plan écarté du crâne de α (`attach.openingDeg`, 24° par défaut). Pour un point (u, v, h) du plan, avec s = ±1 (côté) :
`X = s·(x₀(y) + sin α·u·H + cos α·h)` · `Z = −cos α·u·H + sin α·h + pente(v)` · `x_écran = X cos φ − Z sin φ` · `y_écran = y(v)`.
- La caméra tourne autour de l'axe vertical : **l'ordonnée de chaque repère est identique dans toutes les vues** (invariant testé, `ear-views-same-model`).
- De face, la largeur est ≈ sin α (compression) ; la conque est vue à plat quand φ = 90° − α ; le profil strict vaut cos α. Testé.
- Vues : `face` 0°, `three-quarter` 45°, `profile` 90°, `close-up` 75° (lumière rasante). L'oreille gauche utilise un lacet négatif.
- `x₀(y)` suit le contour du crâne : l'oreille est attachée par son bord antérieur ; la racine de l'hélix est le pivot de la rotation locale.

## 5. Interaction avec le visage (§6)
- **Attache** (`place.ts`) : ouverture, tangage (`pitchDeg`), rotation locale, échelle relative, enfoncement.
- **Alignement demandé** : racine de l'hélix (fosse triangulaire) **sur la ligne des yeux** ; bas du lobule **sur la ligne de la bouche** (séparation des lèvres).
  Hauteur = (bouche − yeux) / (1 − niveau de la racine) ; bornée à [0,20 H ; 0,50 H] (contrainte stricte enregistrée).
  `anchors.eye` / `anchors.mouth` ∈ [0,1] (1 = exact, 0 = libre). Sans lobule (félin, équidé…) : hauteur libre 0,30 H, jamais forcée sur la bouche.
- **Cheveux** (`visibility.ts`) : `visible`, `partial`, `under_hair`, `tucked_behind`, `covers_piercing` ; mesuré sur les mèches de devant. La géométrie n'est jamais supprimée.
  `hair/sides.ts` lit la silhouette réelle de l'oreille (une seule géométrie pour rendu, ombres et cheveux).
- **Bijoux** (`jewelry.ts`) : cinq points d'attache du modèle (lobe, hélix, tragus, conque, industriel) ; refusés si la structure d'accueil manque ; gravité ; collision avec le cou.

## 6. Familles et mélanges
Sept profils : `human`, `feline`, `canid`, `equid`, `elven`, `draconic`, `alien`. Un profil déclare structures interdites, plages (bornes de **préférence**, levées par
`style.exaggeration`), matériaux et extensions compatibles, symétrie (`mirror` / `free`). `blend` mélange les poids (clés triées → déterministe) ; une structure existe
si le poids des familles qui ne l'interdisent pas atteint 0,5. Extension incompatible : retirée **et enregistrée** (strict).

## 7. Contraintes (§10)
| Niveau | Exemple | Comportement |
|---|---|---|
| strict | paroi minimale de la conque ; scapha jamais recouverte ; hauteur 0,20–0,50 H ; extension incompatible | toujours appliquée, correction enregistrée |
| préférence | plages de famille | appliquée sauf exagération |
| artistique | exagération, asymétrie | jamais bornée, seulement signalée |
L'échelle est invariante : tout est en unités de hauteur d'oreille.

## 8. Matériaux, style, éclairage
Sept matériaux (`skin`, `cartilage`, `scaly`, `membrane`, `ceramic`, `crystal`, `hybrid`) : teinte, brillance, translucidité (liseré chaud des parties fines), écailles, émission.
Réaliste : croissants de lumière/ombre par relief + éclairage de relief par filtre. Anime : deux tons, contour épais, pas de filtre. LOD : micro-reliefs au-dessus d'un seuil de détail.

## 9. Couches de vérification (`src/verify/ear.ts`, `src/verify/zones.ts`)
- **Géométrique** : nombres finis, contour simple (0 auto-intersection), structures non dégénérées et dans le pavillon, rotation maximale du contour, **mêmes ordonnées dans les quatre vues**, attache au crâne, zones qui recouvrent H.
- **Anatomique** : structures requises/interdites, ordre vertical (cymba < racine < cavum < lobule), tragus avant l'antitragus, **racine sur la ligne des yeux**, **lobule sur la ligne de la bouche**, bornes de zones, implantation entre sommet et sourcils, symétrie bornée.
- **Style** : palette cel, homogénéité des traits, cohérence avec la peau, contraste lumière/ombre.
Contrôles négatifs testés (oreille décalée de 20 px, lobule à 30 px). Branchées dans `verifyFace` via `checkFaceEngine`.

## 10. Mesures
Tests : `ear-model`, `ear-views`, `ear-verify`, `ear-zones`. Artefacts : `artefacts/ear-system/` (`scripts/artefacts-ear.ts`).

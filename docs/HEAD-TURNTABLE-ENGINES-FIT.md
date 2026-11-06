# Tête en rotation — calage des moteurs sur la planche (généré)

Suite de `HEAD-TURNTABLE-ENGINES.md`. Tableau généré par `python3 scripts/head-turntable/doc-fit.py` depuis `artefacts/head-turntable-engines/fit_report.json` : ne pas modifier à la main.

## Méthode

`npx tsx scripts/head-turntable/fit-engines.ts` ajuste 34 paramètres des moteurs existants (FaceParams, SkullParams, cou, plan mandibulaire, coupe de cheveux) par Nelder-Mead sur des paramètres
normalisés dans leurs bornes. Les bornes sont celles du schéma, RESSERRÉES pour les plus caricaturaux (lèvre inférieure, angle de la mâchoire, voûte…) afin que l'optimiseur ne
bascule pas un paramètre sur une valeur extrême pour gagner 0,001 U. Les paramètres non ajustés sont dans `engines/engine-fixed.ts`, chacun avec son origine.

**Cibles** : (1) sections a, zf, zb de la planche à 27 hauteurs (`REF_ROWS`, poids 1 ; menton y ≥ 0,95 : poids 2 sur a ; dessous de mâchoire visible y ≤ 0,9 : poids 1,5 sur zb) ;
(2) ligne des yeux 0,629 U et canthus interne (poids 4) ; (3) base du nez 0,80 et bout du nez (0,735 ; 0,527) ; (4) centre de la cavité de la bouche 0,861 ; (5) bas du menton 1,05 ;
(6) cou : demi-largeur 0,143 (poids 4), dos du cou à y = 0,9 / 1,0 / 1,05 (mesuré sur la silhouette 90°, poids 3) et à 1,2, face antérieure à 1,1 / 1,2 (annotés ±0,02).

## Résultats

Coût total 0.0627 → **0.0103** (lignes : 0.0034 → 0.0005 ; repères : 0.0593 → 0.0098).
Résidus rms sur les sections (y de 0,05 à 0,9 U) : a = **0.0067 U**, zf = **0.0166 U**, zb = **0.0265 U** (1 U = 150 px de planche : 1.0 / 2.5 / 4.0 px).
Silhouettes rendues : erreur moyenne 3,2 px sur les vues de calage et 3,9 px hors échantillon (`verification/silhouette_error.csv`), contre 2,5 / 3,2 px pour la table de sections ajustée DIRECTEMENT
sur les silhouettes : le calage via les moteurs est un peu moins précis (moins de degrés de liberté) mais reste sous les seuils (4,5 px / 5,25 px).

## Paramètres ajustés

| paramètre | famille | borne basse | borne haute | valeur | à la borne |
|---|---|---|---|---|---|
| `templeY` | face | 0.32 | 0.47 | **0.4686** | oui |
| `jawY` | face | 0.68 | 0.84 | **0.8069** |  |
| `jawWidth` | face | 0.55 | 0.95 | **0.6607** |  |
| `chinWidth` | face | 0.12 | 0.45 | **0.337** |  |
| `jaw.angle` | face | 0.3 | 0.9 | **0.9** | oui |
| `jaw.taper` | face | 0.1 | 0.95 | **0.9298** | oui |
| `chin.height` | face | 0.1 | 0.2 | **0.104** |  |
| `chin.projection` | face | 0.0 | 1.0 | **0.4756** |  |
| `chin.form` | face | 0.0 | 1.0 | **0.8409** |  |
| `chin.symphysisWidth` | face | 0.2 | 1.0 | **0.2036** | oui |
| `nose.length` | face | 0.12 | 0.22 | **0.1693** |  |
| `nose.tip.projection` | face | 0.0 | 1.0 | **0.0821** |  |
| `nose.tip.rotation` | face | -0.5 | 0.9 | **0.9** | oui |
| `mouth.y` | face | 0.72 | 0.86 | **0.8096** |  |
| `mouth.upperLip` | face | 0.1 | 0.7 | **0.1527** |  |
| `mouth.lowerLip` | face | 0.2 | 0.75 | **0.75** | oui |
| `eyeLine` | face | 0.55 | 0.58 | **0.5697** |  |
| `eyeGap` | face | 0.16 | 0.28 | **0.2294** |  |
| `length` | skull | -1.0 | 1.0 | **0.0133** |  |
| `vaultHeight` | skull | 0.15 | 0.85 | **0.1511** | oui |
| `vaultPeak` | skull | 0.0 | 1.0 | **0.2151** |  |
| `foreheadSlope` | skull | 0.0 | 1.0 | **0.1384** |  |
| `frontalBulge` | skull | 0.1 | 0.9 | **0.9** | oui |
| `occiput` | skull | 0.1 | 0.9 | **0.7218** |  |
| `maxilla` | skull | -0.6 | 0.6 | **-0.3699** |  |
| `W` | top | 700.0 | 840.0 | **737.9569** |  |
| `neckTilt` | skull | 0.1 | 0.9 | **0.9** | oui |
| `neckDepth` | skull | 0.0 | 1.0 | **0.0003** | oui |
| `neck.width` | face | 0.25 | 0.6 | **0.387** |  |
| `neckScale` | top | 0.6 | 1.1 | **0.7742** |  |
| `mandArc` | top | 0.0 | 3.0 | **2.316** |  |
| `zPorion` | top | -0.1 | 0.2 | **0.0335** |  |
| `ramusDeg` | top | 0.0 | 30.0 | **0.1155** | oui |
| `hairTh` | top | 0.0 | 0.05 | **0.05** | oui |

## Paramètres à la borne : ce que cela dit

12 paramètres sur 34 finissent à moins de 3 % de leur borne (`templeY`, `jaw.angle`, `jaw.taper`, `chin.symphysisWidth`, `nose.tip.rotation`, `mouth.lowerLip`, `vaultHeight`, `frontalBulge`, `neckTilt`, `neckDepth`, `ramusDeg`, `hairTh`). Ce n'est pas un détail : la tête de la planche est une tête de dessin animé
(front haut et bombé, mâchoire obtuse, cou court et mince) que le canon anatomique des moteurs atteint seulement en bout de plage. Conséquences et limites :

- `neckDepth`, `neckTilt`, `ramusDeg` : le cou de la planche est plus mince que le minimum du moteur ; compensé par `neckScale` (0,77), un facteur MAJEUR hors moteur, assumé et documenté.
- `jaw.angle`, `jaw.taper` : mâchoire obtuse (angle gonial ≈ 135° ; canon adulte 110° – 140° : dans la plage mais à son bord) ; plan mandibulaire dérivé à ≈ 45° (canon 15° – 35° : contrôle `eng.mandplane`, rapporté `info`).
- `vaultHeight`, `frontalBulge`, `templeY`, `hairTh` : la voûte basse + front très bombé + coupe de cheveux épaisse reproduisent le grand front de la planche ; l'optimiseur compense un décalage
  entre le vertex du moteur et le haut des cheveux. À reprendre avec un paramètre de volume de cheveux plutôt qu'en déformant le crâne (voir `HEAD-TURNTABLE-REMAINING.md`).
- `mouth.lowerLip`, `nose.tip.rotation` : lèvre inférieure épaisse et bout du nez relevé, au maximum retenu : écart de style de la planche.
- Un seul jeu de mesures, un seul visage : le calage ne prouve rien sur la généralité des moteurs ; les résidus mesurent l'accord avec CETTE planche.

## Reproduire

    npx tsx scripts/head-turntable/fit-engines.ts      # ≈ 4 min ; réécrit engines/engine-fit.ts (généré) et artefacts/head-turntable-engines/fit_report.json
    python3 scripts/head-turntable/doc-fit.py          # régénère ce fichier

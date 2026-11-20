# Moteur d'oreille — nouvelles variantes anatomiques et détails de surface

Tous les axes sont à 0 par défaut : la géométrie historique est inchangée (sauf la scapha, voir `EAR-VISIBILITY-AUDIT.md`). Axes signés dans [−1, 1] (comme les autres), tirés d'un flux propre sans bruit d'asymétrie tant que `style.asymmetry` ≤ 0,25.

## Axes morphologiques ajoutés (`schema/face-ear.ts`, construits dans `outline.ts` / `structures.ts`)
| Axe | Effet | Où | Mesure tête (px) |
|---|---|---|---:|
| `helix.darwin` | tubercule de Darwin : bosse du contour postérieur-supérieur + bloc d'hélix en relief | 1er repère du bord postérieur | 2263 |
| `helix.fold` | hélix replié (« cup ear ») : bord épaissi sur le haut, sillon d'ombre sous le pli | 10–52 % de la longueur de l'hélix | 716 |
| `lobule.cleft` | lobule fendu : encoche du bas ; le repère « bas du lobule » devient le point le plus bas | contour du lobule | 2145 |
| `lobule.stretch` | lobule étiré (bijou lourd) : plus long, cou plus étroit, trou ; apparaît au-delà de 0,25 | contour + structure `lobule:hole` | 5286 |
| `concha.wall` | rebord de conque (arête) + paroi postérieure ombrée, distincts de la cavité (05C–05E) ; négatif : conque moins creuse | `concha:rim`, `concha:wall` | 241 |
| `fossa.depth`, `fossa.width` | profondeur (relief) et largeur de la fosse triangulaire | `fossa` | 193 / 251 |
| `crus.angle`, `crus.length` | direction et longueur de la racine de l'hélix | `crus` | 123 / 75 |
| `tragus.tip` | pointe du tragus (pointu ↔ tronqué) | polygone du tragus | 144 |
| `antihelix.curvature` | courbure du corps et des branches de l'anthélix | `antihelix` | 739 |

Amplitudes aussi renforcées (au 0 identique) : cymba, épaisseur du crus, taille du tragus et de l'antitragus, orientation de l'antitragus, profondeur de scapha.

## Détails de surface SURF-05 (`render/face/ear/surface.ts`, bloc `ears.surface`, tous à 0)
Calques de rendu seedés par l'oreille (même oreille, mêmes détails), jamais de géométrie ; visibilité × LOD de `style.detail` (nul sous 0,15, plein à 0,75).
| Détail | Rendu | Mesure tête (px) |
|---|---|---:|
| `pigmentation` | rougeur du bord, cavum/cymba plus sombres, lobule rosé, marbrures | 3020 |
| `folds` | petits plis de compression : cou du lobule, base du tragus, racine de l'hélix | 152 |
| `pores` | semis de pores (réaliste seulement) | 587 |
| `vessels` | veines fines dans la scapha et le lobule (réaliste seulement) | 294 |
| `hair` | poils fins à l'entrée du conduit et sur le tragus | — (gros plan) |
En style cel : pigmentation, plis et pilosité en aplats ; pores et vaisseaux n'existent pas.

## Contraintes strictes ajoutées
- `lobule.length ≥ −1,12` : en dessous, le contour du lobule se croise (révélé par le compositeur).
- L'incisure est décalée vers le centre tant qu'elle sort du pavillon (75 % de ses points dedans).
- Tubercule de Darwin construit 0,016 U à l'intérieur du contour (sinon 50 % de ses points sur le bord).

## Preuves
`artefacts/oreille-composeur/` : `02` (têtes entières), `03` (face / trois-quarts / profil), `04` (matière et surface). Tests : `tests/ear-compose.test.ts`.

## Reste à faire (ce composant)
- Darwin : placement variable le long de l'hélix (aujourd'hui un seul site) ; hélix de Darwin bilatéral asymétrique non tiré.
- Hélix replié : le rabat est un aplat épaissi, sans occultation calculée de la scapha sous le pli.
- Lobule étiré : pas de bijou « gauge » dans le trou ; pas de déformation de la joue.
- Rebord de conque : polygone du cavum épais mais pas encore lissé en arête organique.
- Surface : pas de pores sous éclairage (stipple 2D) ; vaisseaux sans branchement par seed ; pilosité non reliée à la couleur des poils du visage.
- Paramètres EAR-01/02/03/04/05/06/07 de `TODO EAR SYSTEM.md` non traités ici : torsion et continuité de l'hélix, courbure de scapha et gradient, orientation et courbure de la fosse, volume et inclinaison de la conque, épaisseur du tragus, volume du lobule.

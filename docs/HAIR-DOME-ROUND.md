# Dôme afro : épaule arrondie et sous-couche rentrée

Suite de `HAIR-ROUND.md`. Preuves : `artefacts/hair-dome/` (`details-*`, `volumes-*`, `styles-*`, `verification/`). Limites : `HAIR-ROUND-REMAINING.md`. Contrôles : `HAIR-DOME-VERIFY.md`.

## Constat (40 visages par coiffure, graines 9000 + 71 k)
Un afro est une boule posée sur le crâne : large à hauteur des tempes, arrondie en haut. Le moteur produisait un dôme CARRÉ (la coque garde sa largeur jusqu'au sommet puis coupe), donc :
- `hair-reach-beyond-skull` : 11 afros sur 40 au-delà de 0,6 W (pire 0,651 ; avant ce travail 13 visages, 0,720) ;
- un croissant sombre (teinte de racine de la coque) restait hors des mèches sur le flanc : le rognage des mèches (`trimToRim`) les ramène sur la coque mais ne remplit pas la coque.

## Ce qui a changé
1. **Épaule** (`boundary/shell.ts`) : table `SHOULDER = { afro: { halfWidth: 0,52, slope: 0,6 } }` ; au bord extérieur, `x = smoothMin(x, halfWidth·W + slope·max(0, y − topY), 0,05 W)`. La largeur plafonne au sommet du crâne puis s'ouvre en pente douce vers le bas ; le minimum lissé évite la marche visible d'un plafond constant (essayé et rejeté). Branché par `scalp.ts` (`shoulder(style, W)`).
2. **Rognage complet** (`rim.ts`) : le rognage sur la coque s'applique aussi aux mèches de la couche `back` et aux mèches errantes (`WISP_MARGIN = 1`) ; seuls `cheek`, `occluder` et la couche `over` restent exclus. C'étaient elles qui portaient la portée à 0,61–0,63.
3. **Rentrage de la sous-couche** (`tuck.ts`, afro seulement) : chaque sommet du bord extérieur de la coque est ramené vers le centre jusqu'à la première cellule couverte par une mèche (au plus 0,05 W), déplacement lissé en 4 passes ; lisière et sommets proches du crâne intacts, au moins 40 % d'épaisseur gardée. Les mèches sont ensuite rognées une seconde fois (`retrim`) sur la coque rentrée.
4. `curly` retiré de `TUCK` : le rentrage cassait `round-top-centered` (graine 10136).

## Résultats (corpus de 40)
| Mesure | avant | après |
|---|---:|---:|
| afro `hair-reach-beyond-skull` hors limite | 11 / 40 (pire 0,651) | 0 / 40 |
| curly `hair-reach-beyond-skull` hors limite | non relevé | 0 / 40 |
| contrôles hors limite, 10 coiffures | 22 / 630 | 2 / 630 |
| rapport épaule / largeur max de la coque (afro) | ≈ 0,85 | ≤ 0,78 |
| part de bord de coque sans mèche (afro) | p90 non mesuré | p90 0,10, max 0,14 |

Détail : `artefacts/hair-dome/verification/corpus-avant.md` et `corpus-apres.md` (+ `.json`).

## Reste visible (honnête)
- Une petite pointe sombre en haut à droite de l'afro violet de `volumes-apres.png`.
- Afro 10491 (`details-apres.png`) : cuvette sombre et marche à la jonction des mèches, quelques pointes fines.
- `curly` : croissant non traité, `TUCK` ne le couvre pas.
Voir `HAIR-ROUND-REMAINING.md`.

## Reproduire
`npx tsx scripts/artefacts-hair-dome.ts artefacts/hair-dome apres` ; planches : `npx tsx scripts/artefacts-hair-round.ts artefacts/hair-dome apres` ; corpus : `npx tsx scripts/hair-corpus.ts`.

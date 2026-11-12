# Franges en touffes (série 7) — contre l'effet « peigne »

Constat : les franges `blades`, `asym_brow` et la frange classique se lisaient comme des mèches séparées régulièrement (« peigne »), sans aucune mesure.

## Moteur v2 (`fringe-blades.ts`, `fringe2.ts`)
- Les lames sont GROUPÉES en touffes qui partagent une pointe commune (`groupTips`, `CLUMP_PULL`). Pointe : `tipX = G.x + away(x)·(0,05 + 0,2·G.dx)·xF·(0,5 + 0,5·reach) + (r.a − 0,5)·0,02·W` ; hauteur `f = clamp(spec[0] + spec[1]·G.f + biais + (r.b − 0,5)·0,04, 0,2, 0,92)`, ordonnée `yAt(tipX, f)`.
- `asym_brow` regroupe ses lames par 3 (poids 0,85).
## Frange classique (`fringe.ts`)
Dents par paquets de 3–5, tirées l'une vers l'autre (`CLUMP_PULL = {x:1, y:1}`).

## Mesure (`verify/hair-fringe-tufts.ts`)
Nombre de touffes DISTINCTES : pointes à moins de 0,05 W / 0,012 H fusionnées (`tuftCount`, `TIP_X`, `TIP_Y`). Contrôle `fringe-tuft-count` (style, avertissement, limite 20). Une autocorrélation de la frange a été essayée puis abandonnée : elle ne distinguait pas peigne et frange naturelle.

## Résultat (médiane, mêmes graines)
| moteur | avant | après |
|---|---:|---:|
| `blades` | 12 | 7 |
| `asym_brow` | 10 | 4 |
| classique | 15 | 11 |

## Limite
La frange classique « rideau » de la graine 10633 reste à ≈ 30 touffes (coupes de portée crânienne à des hauteurs différentes + déplacement de texture) : avertissement documenté, voir `HAIR-NATURAL-REMAINING.md`.

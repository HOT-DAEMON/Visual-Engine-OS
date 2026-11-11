# Masses rondes (afro, bouclé) — dôme centré et remplissage

Suite de `HAIR-EDGE.md`. Preuves : `artefacts/hair-round/`. Limites : `HAIR-ROUND-REMAINING.md`. Contrôles : `HAIR-ROUND-VERIFY.md`.

## Constat (mesuré sur 40 visages par coiffure, graines 9000 + 71 k)
Un afro ou un bouclé est une masse ronde posée sur un crâne symétrique. Le moteur produisait des dômes PENCHÉS : épais d'un côté, mince de l'autre, avec un croissant noir hors des mèches.
- Cause 1 : le gain d'asymétrie `makeGain(h.silhouette, nz)` (de 0,35 à 2,1 par côté, prévu pour les silhouettes de mèches) s'appliquait aussi à la coque ronde.
- Cause 2 : `crown-fill.ts` tolérait trop de coque nue (afro 0,20 sur le bord / 0,25 au total), donc une moitié restait lisse.

## Ce qui a changé
1. `thickness.ts` : `GAIN_SPAN = { afro: 0.06, curly: 0.1 }` et `boundGain(gain, style)` ; le gain reste dans `[1 − span, 1 + span]`. Les autres coiffures sont inchangées (identité). Branché dans `index.ts` (`gain: boundGain(makeGain(...), h.style)`).
2. `crown-fill.ts` : cibles de remplissage resserrées — `afro` rim 0,10 / all 0,15 / max 230 mèches (avant 0,20 / 0,25 / 140) ; `curly` rim 0,14 / all 0,20 / max 170 (avant 0,25 / 0,30 / 110). Plus de mèches de remplissage, mais toujours rognées au bord de la coque.

## Résultats (40 visages, avant → après)
| Mesure | Coiffure | médiane | p90 | max |
|---|---|---:|---:|---:|
| `lop` (asymétrie des demi-largeurs) | afro | 0,111 → 0,009 | 0,225 → 0,021 | 0,237 → 0,024 |
| `lop` | curly | 0,069 → 0,009 | 0,133 → 0,023 | 0,140 → 0,026 |
| `bareGap` (écart de coque nue gauche/droite) p90 | afro | | 0,194 → 0,056 | |
| `bareGap` p90 | curly | | 0,242 → 0,116 | |
| `topOff` (sommet décentré / W) | afro | 0 → 0 | 0,037 | 0,068 |

Dents résiduelles (`edge-rim-teeth`, 60 visages) : p90 afro 13 → 11, curly 15 → 9 ; max curly 24 → 19 ; part > 16 : afro 0,02, curly 0,03 → 0,02.
`hair-reach-beyond-skull` (avertissement) sur afro, corpus de 40 : 13 → 11 visages, pire valeur 0,720 → 0,651 (limite 0,6) ; `shell-rim-bare` afro : 6 avertissements (pire 0,565) → 0.

## Proportions conservées (calibrage `round-*`)
Largeur de masse / largeur de tête : afro min 1,202, curly min 1,083, max ≈ 1,535 ; élévation du dôme max 0,274 H. Le dôme reste donc un volume (> 1,0) sans démesure (< 1,8).

## Pourquoi un souffle d'asymétrie reste
Une coupe parfaitement symétrique fait « casque ». ±6 % (afro) et ±10 % (curly) gardent l'organique sans pencher la masse (seuil de contrôle `lop` ≤ 0,05).

## Reproduire
`npx tsx scripts/hair-dome-diag.ts afro 40` ; planches : `npx tsx scripts/artefacts-hair-round.ts artefacts/hair-round apres`.

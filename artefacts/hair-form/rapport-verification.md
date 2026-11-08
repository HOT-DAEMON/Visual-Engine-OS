# Rapport de vérification — forme des cheveux sur le crâne

Corpus : 200 visages (10 coiffures × 8 visages imposés ; le reste tiré au hasard, graines 61000 + 17 k). Code : `src/verify/hair-form.ts`.

| couche | contrôle | visages | écarts | erreurs | valeur max. mesurée | marge minimale (limite − valeur) |
|---|---|---:|---:|---:|---:|---:|
| anatomy | `fill-clears-free-ear-left` | 128 | 0 | 0 | 2.000 | 1.000 |
| anatomy | `fill-clears-free-ear-right` | 133 | 0 | 0 | 2.000 | 1.000 |
| geometry | `fill-within-reach` | 196 | 0 | 0 | 0.301 | 0.015 |
| geometry | `fringe-reach-bound` | 196 | 0 | 0 | 0.161 | 0.051 |
| geometry | `shell-rim-bare` | 121 | 1 | 0 | 0.646 | -0.088 |
| geometry | `shell-rim-bare-hard` | 73 | 0 | 0 | 0.646 | 0.208 |
| style | `fill-style-scope` | 196 | 0 | 0 | 140.000 | 0.000 |
| style | `tier-hue-near-hair` | 116 | 0 | 0 | 33.529 | 14.471 |

« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « marge minimale » = écart le plus serré à la limite DE CE VISAGE (les limites varient avec la coiffure) ; négative = dépassement. `fill-style-scope` compte des mèches de remplissage (plafond par coiffure) ; `fill-clears-free-ear-*` des mèches dans l'oreille (tolérance 3).

## Part NUE de la moitié extérieure de la coque (8 visages par coiffure)

| coiffure | avant moy. | avant max | après moy. | après max |
|---|---:|---:|---:|---:|
| buzz | 0.98 | 1.00 | 0.98 | 1.00 |
| short | 0.60 | 0.83 | 0.36 | 0.40 |
| spiky | 0.47 | 0.74 | 0.41 | 0.58 |
| curly | 0.56 | 0.78 | 0.32 | 0.55 |
| afro | 0.70 | 0.88 | 0.29 | 0.41 |
| bob | 0.76 | 0.98 | 0.35 | 0.58 |
| long | 0.76 | 0.93 | 0.22 | 0.31 |
| ponytail | 0.88 | 1.00 | 0.88 | 1.00 |
| bun | 0.50 | 1.00 | 0.50 | 1.00 |
| braids | 0.37 | 0.57 | 0.37 | 0.57 |

« avant » = mêmes visages, formes de remplissage exclues ; zones clairsemées voulues (éclaircissement) hors mesure. Coiffures non listées dans `FILL` : inchangées par conception.

Identité du reste de la chevelure : 80 visages sur 80 ont exactement le même nombre de formes qu'avant, hors remplissage (0 différents).

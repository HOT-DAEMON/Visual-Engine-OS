# Contrôles « cheveux naturels » (`src/verify/hair-natural.ts`)

Branchés dans `verifyFace` et `scripts/hair-corpus.ts`. Mesures : `npx tsx scripts/hair-natural/natural-stats.ts` (60 visages, graines 9000 + 71 k). Tests : `tests/hair-natural.test.ts` (positif + négatifs).

| Contrôle | Couche | Gravité | Mesure | Limite | Observé (60 visages) |
|---|---|---|---|---|---|
| `natural-outline-dent` | géométrie | avertissement | largeur déjà atteinte − largeur courante, du sommet à l'équateur de la masse (afro / curly), / W | ≤ 0,01 | max 0,001 |
| `natural-ear-balance` | anatomie | avertissement | |couverture oreille G − D| si les deux sont « cachées » | ≤ 0,20 | max 0,059 |
| `bun-radius-min` | anatomie | erreur | rayon moyen du disque / W | ≥ 0,08 | min 0,097 |
| `bun-radius-max` | anatomie | erreur | idem | ≤ `TIE` (0,22) | max 0,187 |
| `bun-visible` | style | avertissement | part du contour hors de la silhouette du crâne | ≥ 0,50 | min 0,69 |

Les marges sont larges (3 à 10×) : le contrôle attrape une régression franche (cran, chignon caché ou minuscule), pas une dérive de quelques pixels. Contrôles voisins : `HAIR-ROUND-VERIFY.md` (`round-dome-centered`, `round-top-centered`, largeur, élévation) ; `ear-covered` (`verify/anatomy.ts`) mesure coque + mèches ; `fringe-tuft-count` : `HAIR-NATURAL-FRINGE.md`.

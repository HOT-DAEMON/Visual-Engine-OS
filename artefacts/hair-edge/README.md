# Preuves visuelles — lisière extérieure et retombée (série 5)

Docs : `docs/HAIR-EDGE.md` (fait), `docs/HAIR-EDGE-REMAINING.md` (limites). Chaque planche est un AVANT (worktree du commit d'origine `6dd8c1c`) à gauche et un APRÈS (code courant) à droite, mêmes graines, mêmes options, aucune retouche.

| Fichier | Ce qu'il montre |
|---|---|
| `01-tetes-entieres.png` | 12 têtes entières (long brun ×2, long noir, long blond, bob ×2, afro ×3, curly ×3) |
| `02-details-longs.png` | longs : fin des triangles sombres du dessus, ourlet en U, convergence vers le cou |
| `03-details-bob-afro.png` | bob, afro : retombée et bord du volume |
| `04-details-afro-curly.png` | afro rose / brun, curly brun / blond |
| `05-revue-toutes-coiffures.png` | revue de CHAQUE coiffure (10 × 3 visages) contre le crâne ; défauts non traités listés dans `HAIR-EDGE-REMAINING.md` 9, 14, 15 |
| `06-zoom-lisiere-afro-curly.png` | sommet de l'afro noir, de l'afro rose et du curly noir ×2 : dents de scie et épis |
| `07-mesures.png`, `mesures.json` | dépassement de coque, dents de scie, convergence ; 60 visages par coiffure, [médiane, p90, max] |

Reproduire : `npx tsx scripts/artefacts-hair-edge.ts render <dossier> tete|gros`, puis `... styles <dossier>`. Mesures : `src/verify/hair-edge.ts` (`maxBeyondRim`, `toothCount` + `silhouetteProfile`, `lowerFlare`), graines `9000 + 71 i`.

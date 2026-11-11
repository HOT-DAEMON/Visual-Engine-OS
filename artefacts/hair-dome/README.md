# Série « dôme, sous-couche, balayage du visage »

Docs : `docs/HAIR-DOME-ROUND.md`, `HAIR-FIT-SIDE.md`, `HAIR-FRINGE-CLUMPS.md`, `HAIR-DOME-VERIFY.md`. Restes : `docs/HAIR-ROUND-REMAINING.md`.

| Fichier | Contenu |
|---|---|
| `details-avant.png` / `details-apres.png` | 6 têtes entières : bob 9568 (bande à travers le visage), afros 9923 / 9284 (dôme carré), afro 10491, short 9852, spiky 9923 |
| `volumes-*`, `styles-*`, `franges-*`, `queues-*` | planches de revue, mêmes graines, avant (commit d'origine) / après |
| `verification/corpus-avant.md` / `corpus-apres.md` (+ `.json`) | revue de corpus 40 visages × 10 coiffures : 22 → 2 contrôles hors limite sur 630 |

Reproduire : `npx tsx scripts/artefacts-hair-dome.ts artefacts/hair-dome apres` ; `npx tsx scripts/artefacts-hair-round.ts artefacts/hair-dome apres` ; `npx tsx scripts/hair-corpus.ts`.
Les images « avant » viennent d'un arbre propre du commit précédent avec les mêmes graines.

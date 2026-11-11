# Preuves visuelles — masses rondes, franges et vérification (série 6)

Docs : `docs/HAIR-ROUND.md` (fait), `docs/HAIR-FRINGE-ASPECT.md` (franges, plaques aux joues), `docs/HAIR-ROUND-VERIFY.md` (contrôles), `docs/HAIR-ROUND-REMAINING.md` (reste à faire).
Chaque planche existe en `-avant` (worktree du commit d'origine) et `-apres` (code courant), mêmes graines (`61000 + (coiffure × 3 + j) × 37`), mêmes visages.

| Fichier | Ce qu'il montre |
|---|---|
| `styles-avant.png` / `styles-apres.png` | revue de CHAQUE coiffure (10 × 3 visages), têtes entières |
| `volumes-avant.png` / `volumes-apres.png` | afros et bouclés : dôme penché → dôme centré, croissant noir comblé |
| `franges-avant.png` / `franges-apres.png` | frange `short`, `spiky`, `bun` : triangles trapus → mèches plus étroites |
| `queues-avant.png` / `queues-apres.png` | queues de cheval et tresses : plus de plaques aux joues |
| `detail-plaques.png` | zoom sur la joue : les « plaques » étaient des favoris `mutton` aléatoires du gabarit de revue, pas des cheveux du crâne |
| `corpus.md` / `corpus.json` | revue chiffrée de 40 visages × 10 coiffures (graines 9000 + 71 k) : `npx tsx scripts/hair-corpus.ts 40` |

Régénération des planches : `npx tsx scripts/artefacts-hair-round.ts <dossier> <étiquette>`.

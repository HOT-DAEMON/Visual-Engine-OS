# Artefacts — cohérence crâne ↔ cheveux

`npx tsx scripts/artefacts-hair-skull.ts compose` rend « après » avec le code courant (dossier `apres/`, non versionné) et l'assemble avec `avant/` (planches brutes versionnées). `avant/` vient d'un worktree du commit `bf036dd` (mêmes graines, mêmes options, même script en mode `render`). Aucune planche n'est retouchée.

| Image | Ce qu'elle prouve |
|---|---|
| `01a-tetes-buzz-short-spiky-curly-afro.png` | Têtes entières, 5 coiffures courtes/volumineuses × 4 visages, avant / après : fin des cornes, des dômes d'afro sur des coupes courtes, des carrés de tempe de la coupe rase. |
| `01b-tetes-bob-long-queue-chignon-tresses.png` | Têtes entières, 5 coiffures longues/attachées × 4 visages, avant / après. |
| `02-cheveux-longs-masse-noire.png` | long / bob / queue × 5 visages : plus de bavoir noir sous le menton, plus de couvercle plat, plus de cornes ni de coin coloré sous le cou. |
| `03-details-dome-tempes.png` | Gros plan du dôme et des tempes (short, spiky, curly, long, ponytail). |
| `04-diagnostic-crane-coque-masse.png` | Surcouche (hors moteur, mêmes géométries) sur long, bob, short, curly (de gauche à droite) : pointillé gris = contour du crâne, bleu = coque, vert = masse arrière. |
| `05-rapport-verification.png`, `rapport-verification.md` | Les 12 contrôles (géométrie, anatomie, style) sur 323 visages. Un écart non nul n'est pas masqué. |

Docs : `docs/HAIR-SKULL.md`, `docs/HAIR-BACK-MASS.md`, `docs/HAIR-SKULL-VERIFY.md`, `docs/HAIR-SKULL-REMAINING.md`.

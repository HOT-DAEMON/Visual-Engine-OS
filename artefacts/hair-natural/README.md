# Preuves visuelles — cheveux plus naturels (série 7)

Docs : `docs/HAIR-NATURAL.md` (fait), `docs/HAIR-NATURAL-FRINGE.md`, `docs/HAIR-NATURAL-VERIFY.md`, `docs/HAIR-NATURAL-REMAINING.md` (reste à faire).
`-avant` : arbre d'origine (avant la série) ; `-apres` : code courant ; mêmes graines et mêmes visages.

| Fichier | Ce qu'il montre |
|---|---|
| `volumes-avant.png` / `volumes-apres.png` | afros et bouclés : plus de rideaux ni de cônes, boule centrée et symétrique |
| `afro-avant.png` / `afro-apres.png` | 12 afros, têtes entières (graines 9000 + 71 k) |
| `styles-avant.png` / `styles-apres.png` | 10 coiffures × 3 visages |
| `franges-avant.png` / `franges-apres.png` | franges `short`, `spiky`, `bun` en touffes |
| `queues-avant.png` / `queues-apres.png` | queues de cheval et tresses |
| `details-avant.png` / `details-apres.png` | détails (joues, côtés) |
| `curly-apres.png`, `spiky-apres.png`, `ponytail-apres.png`, `bun-apres.png` | galeries courantes (sans « avant » : voir `styles-*`) |
| `bun-detail-apres.png`, `afro-detail-apres.png` | gros plans : chignon (6 visages) ; afro seul (défaut restant : blocs sombres au bas des ailes) |
| `corpus.md` / `corpus.json` | revue chiffrée 40 visages × 10 coiffures : `npx tsx scripts/hair-corpus.ts 40 artefacts/hair-natural` |

Régénération : `npx tsx scripts/artefacts-hair-round.ts artefacts/hair-natural apres` ; `npx tsx scripts/hair-natural/gallery.ts <style> artefacts/hair-natural apres [N] [cols] [seed0] [pas] [échelle]`.

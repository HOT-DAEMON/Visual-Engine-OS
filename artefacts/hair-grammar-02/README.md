# Preuves visuelles — cellule 02 (`02-side_sweep`)
| Fichier | Ce que ça prouve |
|---|---|
| `02-side_sweep-rubans.png` / `.svg` | rendu du profil (rubans + masses + 8 bandes de ton + œil du moteur + dégradés), ×4 |
| `02-reference-vs-rubans.png` | référence (gauche) / rendu (droite), côte à côte |
| `03-superposition-…png` | noir = encre commune ; **rouge = encre de la référence manquante** ; **cyan = encre en trop** (le rouge du bord gauche = mèches de la cellule voisine, hors zone) |
| `04-zoom-frange-oeil-nez-…png` | zoom ×2 : œil du moteur d'yeux, frange, nez, bouche |
| `05-zoom-oreille-cote-…png` | zoom ×2 : oreille, retroussés, nuque |
| `extraction-masks.png` | de gauche à droite : encre, masses pleines, traits fins, zone de ton, zone « visage » |
| `metrics.json`, `verification.json` | mesures (IoU, rappel, précision, temps) et vérification 3 couches |
Régénérer : `python3 scripts/hair-grammar/analyze-cell.py scripts/hair-grammar/cells/02-side_sweep.json src/hair-grammar/profiles/side_sweep.ribbons.json artefacts/hair-grammar-02` puis `npx tsx scripts/hair-grammar/artefacts-ribbons-cell.ts scripts/hair-grammar/cells/02-side_sweep.json src/hair-grammar/profiles/side_sweep.ribbons.json artefacts/hair-grammar/refs/h02-roi-x4.png artefacts/hair-grammar-02`.
Limite : le profil est une trace de la même image que la référence ; les métriques ne mesurent pas la qualité de la grammaire (voir `docs/HAIR-GRAMMAR-02.md`).

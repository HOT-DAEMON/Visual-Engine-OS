# Changelog 14 — grammaire de coiffure, cellule 02 (branche `feat/hair-grammar`)
- Extracteur générique `scripts/hair-grammar/analyze-cell.py` + configurations `cells/01-tousled.json`, `cells/02-side_sweep.json`.
- Profil `src/hair-grammar/profiles/side_sweep.ribbons.json` ; `RibbonProfile` accepte `landmarks`, `limits`, `styleLimits` (défauts = cellule 01).
- Script d'artefacts générique `artefacts-ribbons-cell.ts` ; artefacts `artefacts/hair-grammar-02/`.
- Test pixel `tests/hair-grammar-cells.test.ts` (cellules 01 et 02).
- Docs : `HAIR-GRAMMAR-02.md`, `HAIR-GRAMMAR-02-REMAINING.md`, `HAIR-GRAMMAR-BRIDGE.md` (étude Priorité 3, sans fusion).
- Résultat honnête : cellule 02 IoU 0,976 / rappel d'encre 0,995 (trace de la même image, non probant pour la grammaire) ; temps de génération non amélioré.

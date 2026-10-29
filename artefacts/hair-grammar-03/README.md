# Preuves visuelles — cellule 03 (`03-swept_back`)
Reproduire : `python3 scripts/hair-grammar/analyze-cell.py cells/03-swept_back.json <profil> <dossier>` puis `trace-bands.py`, puis `npx tsx scripts/hair-grammar/artefacts-ribbons-cell.ts <cfg> <profil> artefacts/hair-grammar/refs/h03-roi-x4.png artefacts/hair-grammar-03`. Doc : `docs/HAIR-GRAMMAR-03.md`.

| Fichier | Contenu |
|---|---|
| `08-trois-colonnes-reference-rubans-bandes.png` | référence (masquée hors zone d'intérêt) · rubans seuls · bandes iso-tons — **la preuve principale** |
| `02-reference-vs-rubans.png` | référence (gauche) · rendu retenu (droite) ; le nom est hérité des cellules 01/02 |
| `03-superposition-noir-commun-rouge-manquant-cyan-en-trop.png` | noir = encre commune, rouge = encre de la référence manquante, cyan = encre en trop |
| `04-zoom-yeux…` `05-zoom-meches…` `06-zoom-oreille-cou…` `07-zoom-nez-bouche…` | zooms ×8 « référence · rendu » : montrent aussi les défauts (cils fondus, paliers de gris) |
| `03-swept_back-rubans.png` / `.svg` | rendu retenu (le SVG pèse ≈ 61 Ko) |
| `baseline-rubans/` | ligne de base : rubans seuls (même référence masquée) |
| `extraction-masks.png` | masques de l'extracteur (encre, masses pleines, traits fins, zone de ton, zone visage) |
| `metrics.json` · `verification.json` · `verification-iso.json` | IoU/rappel/flou ; vérification des rubans ; vérification des bandes (3 couches + mesures par zone) |
| `stats-cellules.json` | statistiques de rubans des cellules 01, 02, 03 |
| `perf/bench-rubans.json` · `perf/bench-bandes.json` | temps par étape (voir `docs/PERF-HAIR-GRAMMAR.md`) |

Limite : la référence est une cellule de 144 × 170 px (JPEG). Aucune de ces images ne prouve que la grammaire *génère* la coiffure : le profil est une trace.

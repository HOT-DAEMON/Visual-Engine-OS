# Artefacts — éclairage visible (itération 06)

Régénération : `npx tsx scripts/artefacts-lighting-06.ts` (références : `SHADOW_REFS=<dossier shadow>`, voir l'en-tête du script). Doc : `docs/LIGHT-VISIBLE-06.md`.

| Image | Ce qu'elle prouve |
|---|---|
| `01-diagnostic-avant-apres.png` | Le défaut d'origine, mesuré : même visage, mêmes 4 lumières, avant (rapports gauche/droite 1,038 · 0,941 · 0,998 · 0,988) et après (2,011 · 0,489 · 1,050 · 0,989). Les 3e et 4e lumières (haute, quasi frontale) sont symétriques ou douces par construction : ratio ≈ 1 attendu. Les cel/colorés utilisent le visage sans teinte d'ombre imposée. |
| `02-motifs-eclairage-tete.png` | 7 motifs lus sur les planches 01 / 06 / 09 ; ombre portée du nez, du sourcil, du menton ; chaque vignette passe ses 10–13 contrôles. |
| `03-styles-et-lumieres-colorees.png` | Peint, cel 2 et 3 tons, lune, bougie, contre-jour coloré, store, feuillage ; ΔL OKLab sous chaque vignette. |
| `04-corps-et-tete-avant-apres.png` | Corps entier avec la tête (toute la tête, cheveux compris) : ancien éclairage, peint, cel 3 tons. |
| `05-corps-quatre-lumieres.png` | Même corps, quatre lumières : ombres des bras sur le tronc, des muscles entre eux. |
| `06-extraction-references.png` | Les dix références avec les tons mesurés (ombre → lumière) et ΔL. |
| `07-reference-vs-moteur.png` | Planche 01 (haut) contre le moteur (bas), mêmes directions. Écarts visibles : lumière zénithale (le bas du visage est blanc dans la référence), terminateur plus anguleux dans le moteur. |
| `08-verification.png` | Les 11 contrôles (géométrie, anatomie, style) du motif « trois-quarts droite ». |
| `metrics.json` | Rapports de luminance avant/après, statistiques par motif, ΔL des références, temps de rendu. |

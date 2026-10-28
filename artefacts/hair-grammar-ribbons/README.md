# Preuves visuelles — cellule 01 par rubans de trait
- `01-tousled-rubans.png` / `.svg` : rendu du moteur (ribbon-scene)
- `02-reference-vs-rubans.png` : référence (gauche) / moteur (droite)
- `03-superposition-rouge-ref-cyan-rubans.png` : rouge = encre de la référence seule, cyan = moteur seul, noir = commun
- `metrics.json`, `verification.json` : IoU, encre, écart perceptuel, temps, trois couches de vérification
Régénérer : `python3 scripts/hair-grammar/analyze-01.py artefacts/visual-inspiration-01.jpg` (écrit directement `src/hair-grammar/profiles/tousled.ribbons.json`) puis `npx tsx scripts/hair-grammar/artefacts-ribbons-01.ts`.
Limite : rendu structurellement fidèle mais **pas parfait** (voir `docs/HAIR-GRAMMAR-RIBBONS.md`).

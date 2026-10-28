# Preuves visuelles — cellule 01 par rubans de trait (v2)
- `01-tousled-rubans.png` / `.svg` : rendu du moteur (ribbon-scene)
- `02-reference-vs-rubans.png` : référence (gauche) / moteur (droite)
- `03-superposition-noir-commun-rouge-manquant-cyan-en-trop.png` : noir = encre commune, **rouge = encre de la référence absente du moteur**, cyan = encre du moteur en trop (l'ancien contrôle masquait les manques)
- `04-avant-apres-vs-reference.png` : référence / v1 / v2 côte à côte ; `05-zoom-sommet-ref-avant-apres.png` : zoom sur le sommet du crâne
- `extraction-masks.png` : encre | masses pleines | traits fins | zone de ton
- `metrics.json` (v2), `metrics-v1.json` (avant), `verification.json` : IoU, encre, écart perceptuel, temps, 3 couches de vérification
Régénérer : `python3 scripts/hair-grammar/analyze-01b.py artefacts/visual-inspiration-01.jpg` puis `npx tsx scripts/hair-grammar/artefacts-ribbons-01.ts`.
Limite : nettement meilleur que la v1 mais **pas parfait** (voir `docs/HAIR-GRAMMAR-RIBBONS-V2.md` et `-REMAINING.md`).

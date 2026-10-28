# Artefacts — grammaire de coiffure, cellule 01
- `01-tousled-moteur.png/.svg` : rendu du moteur (3/4 gauche).
- `02-reference-vs-moteur.png` : référence (gauche) / moteur (droite).
- `03-superposition-rouge-ref-cyan-moteur.png` : rouge = encre de la référence seule, cyan = moteur seul, noir = commun.
- `metrics.json` : IoU, rappel/précision d'encre, temps, résultats des trois couches de vérification.
- `refs/` : zone de référence recadrée.
Régénérer : `npx tsx scripts/hair-grammar/artefacts-01.ts`. Le rendu n'est pas parfait : voir `docs/HAIR-GRAMMAR-01.md`.

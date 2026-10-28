# Artefacts — grammaire de coiffure, cellule 01
- `01-tousled-moteur.png/.svg` : rendu du moteur (3/4 gauche).
- `02-reference-vs-moteur.png` : référence (gauche) / moteur (droite).
- `03-superposition-rouge-ref-cyan-moteur.png` : rouge = encre de la référence seule, cyan = moteur seul, noir = commun.
- `metrics.json` : IoU, rappel/précision d'encre, temps, résultats des trois couches de vérification.
- `refs/` : zone de référence recadrée.
Régénérer : `npx tsx scripts/hair-grammar/artefacts-01.ts`. Le rendu n'est pas parfait : voir `docs/HAIR-GRAMMAR-01.md`.

## Ajustement par synthèse (session suivante)
- `00-avant-generateur-seul.png` / `metrics-avant.json` : état précédent (IoU 0,53).
- `01-tousled-moteur.png`, `02-reference-vs-moteur.png`, `03-superposition…png`, `metrics.json` : état ajusté (IoU 0,71, encre 0,95/0,93).
- `fit-journal.log` : courbe de la perte (1,49 → 0,49). Fidélité visuelle NON atteinte (docs/HAIR-GRAMMAR-REMAINING.md).

# Artefacts de la passe 11 — coupes hime et pixie à frange balayée

Tout se régénère : `npx tsx scripts/hair-grammar/artefacts-pass11.ts` (planches 01-06) ; mesures : `render-masks.ts` puis `measure-cuts.py` (voir `docs/HAIR-MEASURE.md`).

| Fichier | Ce qu'il prouve |
|---|---|
| `01-hime-toute-la-tete-3-couleurs-3-graines.png` | Hime, tête entière : 3 couleurs × 3 graines (frange franche, mèches de joue, nappe arrière) |
| `02-pixie-toute-la-tete-3-couleurs-3-graines.png` | Pixie à frange balayée, mêmes variations |
| `03-rotation-lacet.png` | Les deux coupes de −60° à +60° (mêmes mèches, graine 1) |
| `04-avant-apres-reparation.png` | Effet du solveur de réparation existant, lacets 0° et 30° |
| `05-comparaison-bob-hime-pixie.png` | Carré (passe 10) / hime / pixie, même vue |
| `06-verification-geometrie-anatomie-style.json` | 48 combinaisons (2 coupes × 3 lacets × 8 graines) : 43 valides, détail des 5 échecs |
| `07-mesure-reference-vs-moteur.png` | Masques mesurés : référence 06/47/32 à gauche, moteur à droite (surcouche rose, contour jaune) |
| `mesures/` | JSON des descripteurs, masques, surcouches, `anchors.json` |

Lecture honnête : la planche 07 montre que la règle de segmentation de la réf. 47 ne capte que la frange teinte, et que le carré moteur est plus petit que la réf. 06.

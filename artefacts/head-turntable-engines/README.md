# Artefacts — tête en rotation pilotée par les moteurs existants

Preuves visuelles du branchement de `src/head-turntable/` sur `src/face/*`, `src/skull/*` et `src/geometry/eye/*` (voir `docs/HEAD-TURNTABLE-ENGINES.md`).
Tous les fichiers sont régénérés par les scripts de `docs/HEAD-TURNTABLE.md` (fin du fichier). Les images de `avant/` viennent du commit précédent (module autonome).

| Fichier | Ce qu'il montre |
|---|---|
| `avant/01-planche-vs-moteur-AVANT.png`, `avant/02-tour-AVANT.png` | état précédent : oreille en plaque, mâchoire annotée, cou cylindrique |
| `apres/comparison/side_by_side_sheet.png` | planche | rendu, 9 lacets (0° – 180°), tête dérivée des moteurs |
| `apres/comparison/overlay_sheet.png`, `ov_*.png` | contours du rendu superposés à la planche |
| `apres/turntable/turntable_360.png`, `full_*.png`, `yaw_*.png` | tour complet 0° – 315° et rendus par lacet |
| `apres/details/*.png` | gros plans : yeux, nez + bouche, profil, trois-quarts |
| `03-oreille-moteur-5-vues.png` | l'oreille du moteur `face/ear` à 0°, 45°, 90°, 135°, 160° |
| `04-machoire-cou-5-vues.png` | mâchoire, menton et cou aux mêmes lacets |
| `05-avant-apres-045.png`, `-090.png`, `-135.png` | avant (module autonome) / après (moteurs) |
| `apres/verification/verification_report.json`, `silhouette_error.csv`, `hair_iou.csv` | 78 contrôles (géométrie, anatomie, style), erreurs de silhouette, IoU des cheveux |
| `fit_report.json` | calage des moteurs : coût avant / après, résidus, paramètres, paramètres à la borne, sections mesurées vs moteur |
| `gros-plans/*.png` | découpes brutes (oreille, mâchoire) qui alimentent les planches 03 et 04 |

Limites visibles (détail : `docs/HEAD-TURNTABLE-REMAINING.md`) : menton trop en avant de profil, jonction cou/mâchoire en angle vif, oreille presque de chant à 135°, bouche en croissant.

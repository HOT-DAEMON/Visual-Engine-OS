# Artefacts — tête en rotation

Preuves visuelles et chiffrées de `src/head-turntable` (docs : `docs/HEAD-TURNTABLE*.md`). Tout est régénéré par
`npx tsx scripts/head-turntable/artefacts-turntable.ts && python3 scripts/head-turntable/compose-artefacts.py` (annotation des références : `annotate-face-refs.py`).

| Dossier / fichier | Ce que cela prouve |
|---|---|
| `turntable/turntable_sheet.png` | les 9 lacets de la planche (0° → 180°) rendus par le moteur |
| `turntable/turntable_360.png`, `full_*.png` | le tour COMPLET de 45° en 45° (la planche s'arrête à 180°) |
| `comparison/side_by_side_sheet.png` | planche de référence | moteur, pour chaque lacet : le jugement visuel honnête |
| `comparison/overlay_sheet.png`, `ov_*.png` | contour du moteur (rouge) sur la planche, même alignement que les mesures : silhouettes et repères |
| `details/detail_sheet.png` | yeux, nez + bouche de face, 3/4 (30°), profil (90°) agrandis |
| `extraction/segmentation_masks.png` | masques de couleur (cheveux, iris, bouche, encre) sur la planche |
| `extraction/grid_0_*.png`, `grid_90_*.png` | vues quadrillées avec l'axe de rotation, le sommet et le menton mesurés (H = 150 px) |
| `references/annotated_01/02/05.png` | points relevés sur les portraits (iris, sourcils, nez, bouche) — relevé manuel |
| `verification/verification_report.json` | les 54 contrôles des 3 couches (géométrie, anatomie, style) avec bornes et valeurs |
| `verification/silhouette_error.csv` | erreur de silhouette par lacet, calage vs hors échantillon |
| `verification/hair_iou.csv` | recouvrement des cheveux rendu / planche |

Limites : voir `docs/HEAD-TURNTABLE-REMAINING.md` (défauts visibles connus, composants non faits).

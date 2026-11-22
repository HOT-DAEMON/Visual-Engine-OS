# Artefacts — moteur de cheveux, passe 4

Régénération déterministe : `npx tsx scripts/hair-grammar/artefacts-pass4.ts` (≈ 45 s). Chiffres bruts : `metrics.json`. Bilan : `docs/HAIR-PASS4.md`.
Toutes les planches montrent la TÊTE ENTIÈRE (visage, yeux, nez, bouche, cou) ; légendes : g = géométrie, a = anatomie, s = style (nombre de contrôles en échec).

| Planche | Preuve |
|---|---|
| `01-toute-la-tete-brut-repare.png` | Intention complète (planche 08 de la passe 3) à −60 … +60° : brut | réparé. À 30° la calotte passe de 0,63 à 0,82 grâce à une mèche (bleu). Style vert à tous les lacets. Points verts = raie demandée. |
| `02-raie-et-calotte.png` | Raie −0,3 / 0 / +0,4 : la calotte est comblée sans fermer le couloir de la raie. Netteté et position mesurées (voir `metrics.json` › `part`). |
| `03-profondeur-ordre-par-troncon.png` | Fiabilité de l'ordre de profondeur sur 48 cas : le volume impose ≈ 0,2× la longueur ordonnée du plan, à fiabilité égale (≈ 3 %). |
| `04-lumiere-3d-moteur-principal.png` | Mêmes mèches, élévation 20° / 55° / 85° : avant (`ld` 2D seul) | après (portée d'ombre ×2,20 / ×1,00 / ×0,45). 55° = rendu d'origine. |
| `05-segmentation-par-meche.png` | Raster de référence | mèches retrouvées (une couleur par mèche), coiffure de base et lourde. |
| `06-tetes-entieres-finales.png` | 3 graines × 2 lacets, intention complète, 0 contrôle en échec. |

Limites : voir `docs/HAIR-PASS4-REMAINING.md` (netteté de la raie en baisse, segmentation non validée sur de vraies illustrations).

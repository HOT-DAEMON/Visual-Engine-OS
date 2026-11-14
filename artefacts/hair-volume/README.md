# Preuves : volume de cheveux 3D (docs/HAIR-VOLUME-3D.md)

Générées par `npx tsx scripts/artefacts-hair-volume.ts`. Sujet : graine 9000 (autres graines : 4 et 7 dans les planches `03-`). Toutes les vues sont la MÊME tête tournante (même rotation, même rastériseur) avec ou sans volume.

| Fichier | Ce que l'on voit |
|---|---|
| `01-toutes-coiffures-6-angles.png` | les 10 coiffures non chauves (buzz, short, spiky, curly, afro, bob, long, ponytail, bun, braids ; une ligne chacune) à 0°, 60°, 120°, 180°, 240°, 300° : toute la tête, dessus, côtés, dos |
| `02-avant-apres-{afro,long,bun}.png` | ligne du haut : tête sans volume (avant) ; ligne du bas : avec volume (après) ; 8 angles de 0° à 315° |
| `03-graines-{afro,long,bun}.png` | 3 graines (4, 7, 9000) × 0°, 90°, 180° : la coiffure suit la forme de chaque crâne |
| `04-tangage-{afro,long,bun}.png` | tangage −20° / 0° / +25° × lacets 30°, 150°, 210° : rotation 3D complète, pas seulement le lacet |

Limites visibles : `docs/HAIR-VOLUME-REMAINING.md` (section « Constats de la revue visuelle »).

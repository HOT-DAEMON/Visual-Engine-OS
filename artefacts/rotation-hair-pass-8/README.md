# Artefacts — cheveux sous rotation, passe 8 (mèches conformes au crâne)

Doc : `docs/ROTATION-HAIR-PASS-8.md`. Toutes les planches montrent des TÊTES ENTIÈRES rendues par le moteur réel (`compileScene`, `headPose.yawDeg`), AVANT (commit e58b5fb) en haut, APRÈS en bas.

| Fichier | Contenu |
|---|---|
| `01-longs-avant-apres.png` | cheveux longs, graines 9004 / 9002 / 9000, lacets −45, −30, +30, +45 : la mèche qui traversait la joue et le rideau de mèches empilées disparaissent |
| `02-courtes-frisees-avant-apres.png` | courte, pointes, bouclée, afro à −45 / 0 / +45 : quasi inchangées (masses) |
| `03-longues-attachees-avant-apres.png` | bob, tresses, queue, chignon à −45 / 0 / +45 : bob nettement plus propre ; queue et chignon (pièces rigides) inchangés |
| `mesures-avant.json`, `mesures-apres.json` | 84 cas (7 coiffures × 3 graines × ±30/±45°) : écart des mèches à la surface du crâne, visage couvert, empilement, facteur de largeur |

Régénérer : `npx tsx scripts/rotation-hair-pass8-proof.ts <dossier> long:9004,long:9002 -45,-30,30,45 <nom>.png` et `npx tsx scripts/rotation-hair-pass8-metrics.ts <sortie.json>` (le même script, lancé dans un `git worktree` du commit e58b5fb, donne les mesures « avant »).

Défauts encore visibles sur ces planches (documentés, non traités) : dalle à bord droit au flanc de 9004 à ±45°, fines diagonales sous la mâchoire (9004), éventail de mèches sur le cou (9000 à −45°).

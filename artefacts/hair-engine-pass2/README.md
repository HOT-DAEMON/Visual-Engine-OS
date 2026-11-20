# Artefacts — moteur capillaire, passe 2

Régénération : `npx tsx scripts/hair-grammar/artefacts-pass2.ts` (déterministe). Chiffres : `metrics.json`. Docs : `docs/HAIR-PASS2-REMAINING.md`.

| Planche | Ce qu'elle prouve |
|---|---|
| `01-entrelacs.png` | `weaveStrands` : 2 brins (`cross`, devant alterné), même brin sans décollement (`overlap`, ablation), tresse à 3 brins (`cross+cross+cross`), avec zooms |
| `02-pont-geometrie-locale.png` | Tête entière, rendu principal avant/après lecture de `HairLock.geom`, cel et hors cel, zoom sommet |
| `03-vues-75-75-reparees.png` | Tête entière de −75° à +75° : score de défauts avant → après réparation (aucun œil/nez recouvert) |
| `04-anat-face.png` | `anat.face` : mèches sur le nez/bouche (cercles roses) détectées puis écartées, score 13 → 2 |
| `05-intentions-verifiees.png` | `generateIntended` : brut | vérifié pour 3 intentions (28→20 · 5,25→3 · 4→0) |

Limites visibles : « volume +1, lourd » reste chargé après réparation ; la planche 03 garde des résidus à 30°, 60° et −75°.

# Artefacts — cohérence cheveux ↔ tête (suite)

`npx tsx scripts/artefacts-hair-coherence.ts compose` rend « après » avec le code courant (`apres/`, non versionné) et l'assemble avec `avant/` (planches brutes versionnées). `avant/` vient d'un worktree du commit `1596835` (mêmes graines, mêmes options, même script en mode `render`). Aucune planche n'est retouchée.

| Image | Ce qu'elle prouve |
|---|---|
| `01a-tetes-short-spiky-curly-afro.png` | Têtes entières, 4 coiffures courtes/volumineuses × 4 visages, avant / après. |
| `01b-tetes-bob-long-tresses.png` | Têtes entières, cheveux pendants et tresses, avant / après (plus de cônes sur bob/long). |
| `02-attaches-chignon-queue.png` | Chignon et queue × 5 visages : posés sur le crâne, au-dessus de l'oreille, rayon et éventail bornés. |
| `03-details-dessus-du-crane.png` | Gros plan du dessus du crâne (short, bob, curly, afro, spiky) : portée au niveau du polygone, ton de racine. |
| `04-vent-borne-par-la-portee.png` | Vent fort (x 0,9, y −0,3, souplesse 1) sur short / long / curly, avant / après. |
| `05-diagnostic-portee.png` | Surcouche (code courant seulement) sur short, bob, curly, ponytail (de gauche à droite) : pointillé gris = contour du crâne, rouge = portée admise de la coiffure, bleu = polygones des mèches construites sous borne. Les mèches pendantes du bob et la queue sortent du rouge : exemptées par conception (`cranial`, attache). |
| `06-rapport-verification.png`, `rapport-verification.md` | Les 13 contrôles (géométrie, anatomie, style) sur 368 visages : 0 écart. |

Docs : `docs/HAIR-COHERENCE.md`, `HAIR-REACH-POLY.md`, `HAIR-TIE.md`, `HAIR-WIND-REACH.md`, `HAIR-VOCAB.md`, `HAIR-COHERENCE-REMAINING.md`.

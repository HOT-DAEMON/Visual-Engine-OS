# Artefacts — passe 7 du moteur capillaire

Régénération : `npx tsx scripts/hair-grammar/artefacts-pass7.ts` (planches + `metrics.json`) · `python3 -I scripts/hair-grammar/measure-ref60.py` (`measures-ref60.json`).
Bilan : `docs/HAIR-PASS7.md` · mesures : `docs/HAIR-PASS7-MEASURES.md` · reste à faire : `docs/HAIR-PASS7-REMAINING.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `01-toute-la-tete-ombre-aval.png` | Tête entière sous trois lumières : sans reflet transversal / ombre de la passe 6 / ombre de la passe 7. |
| `02-details-ombre-aval.png` | Détails des mêmes mèches : longueur de l'ombre aval (0,2 L contre 0,42 L). |
| `03-toute-la-tete-trois-lacets.png` | Tête entière à −30° / 0° / 30° : les reflets suivent la rotation, tous vérifiés. |
| `04-une-meche-trois-tons.png` | Une mèche repeinte en trois tons : creux −33,5 % sur clair, et plus d'ombre qui éclaircit le ton sombre. |
| `05-profil-ombre-aval-reference-vs-moteur.png` | Profil de luminance aval : référence 60 contre moteur ; RMS 0,121 → 0,051. |
| `06-raie-cote-detourne.png` | Raie : positions lisibles et rejetées selon le lacet (70 / 66 / 55 / 48 %). |
| `07-effet-isole-sur-les-cheveux.png` | Rendu principal, influence `hair` 1 / 0,5 / 0,15 : 0,0 % du bas du visage change. |
| `metrics.json` | Tous les chiffres des planches et de la vérification (géométrie / anatomie / style). |
| `measures-ref60.json` | Mesures brutes de la référence 60 (rubans, éventail, tête). |

Limite à garder en tête : à l'échelle de la tête entière le reflet occupe ~1,4 % de l'aire des cheveux ; les détails (02, 04) sont là pour le voir.

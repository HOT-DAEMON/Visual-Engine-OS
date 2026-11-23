# Artefacts — moteur capillaire, passe 5

Régénération : `npx tsx scripts/hair-grammar/artefacts-pass5.ts` (déterministe). Bilan : `docs/HAIR-PASS5.md` ; reste à faire : `docs/HAIR-PASS5-REMAINING.md`.

| Planche | Preuve |
|---|---|
| `01-toute-la-tete-brut-repare.png` | Tête entière, intention complète (volume · frange · raie −0,3 · pointes · poids), 5 lacets, brut → réparé. Points verts = raie demandée. Lacets −60°/−30° : raie côté détourné, affichée « non lisible » (pas de netteté inventée). |
| `02-raie-avant-apres.png` | Raie −0,4 / 0 / +0,4, graines 1–2, de face : avant (racines poussées seulement) = fenêtre chauve de 0,43–0,75 rx ; après (couloir dégagé + rideaux) = sillon. Sillon lu 3/9 → 9/9. |
| `03-raie-tous-lacets.png` | Raie −0,3 réparée à −45°…45° ; 50 cas dans `metrics.json` : couloir libre 50/50, netteté ≥ 0,6 sur 30/30 cas lisibles. |
| `04-ombre-peau-suit-la-lumiere.png` | Gros plan du front : l'ombre des mèches sur la peau suit l'azimut et l'élévation de la lumière (330°/55° = référence = rendu d'origine). |

Limites visibles : les mèches-rideaux ajoutées sont larges (« en feuille ») ; les raies à plusieurs lacets du côté détourné ne sont pas vérifiables.

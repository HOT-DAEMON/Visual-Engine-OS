# Artefacts — moteur capillaire, passe 3

Régénération déterministe : `npx tsx scripts/hair-grammar/artefacts-pass3.ts` (écrit les PNG et `metrics.json`). Détails et mesures : `docs/HAIR-PASS3.md`.

| Planche | Contenu |
|---|---|
| 01-volume-lourd-brut-repare | « volume +1, lourd », 7 lacets −75…75° : brut puis réparé (score 8–28 → 0) |
| 02-ramification | séparation 2/3 branches, pointes libres, jonction, boucle |
| 03-visibilite | part visible par mèche, mèche mal étagée avant/après réparation |
| 04-profondeur-de-volume | ordre imposé par un plan vs par dalles (découpes, croisements) |
| 05-lumiere-commune | même coiffure sous 4 azimuts de lumière (exposition 0,80 → 0,63) |
| 06-reference-boucle-fermee | référence, ajustement, erreurs par itération |
| 07-axes-art-direction | frange, raie, pointes |
| 08-toute-la-tete | intention combinée, 5 lacets ; échecs restants signalés (style CV, calotte à 30°) |

Limites : rendus produits par le moteur lui-même ; aucune illustration externe. `metrics.json` contient les chiffres cités dans les docs.

# Passe 6 — mesures sur `references/hair/60.jpg` (reflets transversaux)

Source : tutoriel « dessiner les reflets en suivant la direction des mèches ». Deux rubans mesurés (panneau A horizontal, panneau B vertical) ; le panneau C (éventail) n'est PAS mesuré.
Méthode : seuil de pixel R > 190 et G > 55 pour le reflet, grappes contiguës (une première mesure par colonnes donnait des valeurs absurdes, u0 = 0), toutes les positions en fraction de la longueur L du ruban.

| Grandeur | Panneau A | Panneau B | Retenu dans `RING` |
|---|---|---|---|
| Centre du reflet (fraction de L) | 0,47 | 0,46 | pas une constante : suit l'argmax de N·H |
| Étendue le long du ruban | 0,047 L | 0,071 L | `extent` 0,06 (modulée 0,7–1,3 par la force) |
| Couverture en largeur | 0,67 | 0,91 | `coverage` 0,8 |
| Dentelure des bords (σ) | 0,010–0,020 L | idem | `jag` 0,015 |
| Zone sombre aval | 0,20–0,21 L | idem | `shoulderLen` 0,2 |
| Creux de luminance aval | 13 niveaux sur 36 (≈ −36 %) | idem | 3 paliers de 0,12 : 1 − 0,88³ = 0,32 |

## Non mesuré (seuils d'ingénierie)
- `minNH` 0,78 (cos 38,7°) et `fullNH` 0,97 (cos 14°) : bornes de la force du reflet.
- `bodyWidth` 0,4 : le centre est cherché là où la largeur ≥ 40 % du maximum ; sur la sonde, 5 reflets sur 19 tombaient sur la pointe.
- `minCoverage` 0,3 : sous ce seuil, la courbure interdit la bande.

## Limites de l'échantillon
- Deux rubans seulement ; leur rapport longueur/largeur est ~4,5, celui d'une mèche ~9. On ne sait pas si l'étendue se règle sur la longueur (choix retenu : elle vient de la courbure le long de la mèche) ou sur la largeur.
- Les rubans du tutoriel sont droits : la couverture mesurée (0,67–0,91) vaut pour des rubans droits ; sur une lame pliée elle est réduite par la courbure (voir `HAIR-PASS6.md` §4).
- Les valeurs sont un ordre de grandeur de l'illustrateur, pas une loi.

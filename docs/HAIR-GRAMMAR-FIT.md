# Ajustement par synthèse des mèches (autofit)

## Principe
Le générateur de familles tire des mèches plausibles mais ne peut pas retrouver *une* image donnée. On ajoute un **optimiseur générique** (`src/hair-grammar/autofit.ts`, `raster.ts`) qui ajuste les paramètres de chaque mèche (`LockSpec`) contre une référence. Il ne change ni la primitive de mèche ni le rendu : seules les données changent (`profiles/tousled.fitted.json`). Il servira tel quel pour les 11 autres cellules.

## Boucle
1. Rendu logiciel de la scène (couches back → visage → front → over, remplissages opaques, encre, croissants, brins) : ≈ 15 ms/évaluation à l'échelle ×2 (le SVG + resvg coûte ≈ 60 ms).
2. Perte = rappel d'encre + précision d'encre (distances chamfer plafonnées à 5 px) + 2,2·(1 − IoU de silhouette) + 2,5·écart de ton flou + 6·pénalité « cheveux sous la ligne du cou » (garde anatomique intégrée).
3. Mouvements : perturbation gaussienne de 1–3 paramètres (84 %), re-tirage d'une mèche (6 %), ajout (5 %), suppression/élagage (5 %) ; pas décroissant, acceptation stricte (déterministe à graine fixée).

## Résultats (cellule 01, `artefacts/hair-grammar/`)
| Mesure (tolérance 2 px cellule) | Avant | Après |
|---|---|---|
| IoU de silhouette | 0,53 | 0,71 |
| Rappel d'encre | 0,75 | 0,95 |
| Précision d'encre | 0,73 | 0,93 |
| Part d'encre (réf. 0,213) | 0,158 | 0,227 |
Vérifications géométrique, anatomique, style : vertes. Journal : `fit-journal.log` (deux passes, 40 000 + 30 000 itérations).

## Limites (honnêtes)
- Les métriques à tolérance se laissent « gagner » par des traits nombreux : le rendu **n'est pas** visuellement fidèle (voir `02-reference-vs-moteur.png`). Rappel/précision de 0,95 ≠ ressemblance.
- Le modèle de tête 3D reste un facteur limitant : visage plus frontal et plus grand que la référence, cheveux contraints par la coque.
- Le rastériseur de l'optimiseur n'inclut pas encore les ombrages ajoutés au rendu (voir REMAINING).

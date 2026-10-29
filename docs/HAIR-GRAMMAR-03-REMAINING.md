# Cellule 03 et grammaire — reste à faire (par composant)

## Fidélité visuelle de la cellule 03
1. **Cils et paupière** : se fondent en une masse noire (zoom `04`). Piste : seuils plus sombres localisés (zone œil) ou rubans de cils superposés ; mesurer sur le rappel d'encre dans la zone, pas seulement l'IoU global.
2. **Posterisation des gris** (zoom `05`) : paliers visibles dans les hachures derrière l'oreille et la nappe balayée. Pistes : plus de seuils *dans les zones de hachures seulement*, ou dégradés linéaires par bande ; chaque piste coûte en nœuds et en temps de rendu (voir `PERF-HAIR-GRAMMAR.md`).
3. **Halos clairs autour des traits** : bord anticrénelé de la source seuillé en bandes 236/210. Piste : retirer les anneaux clairs adjacents aux traits sombres (< 1 px).
4. **Contours ≈ 5 % trop lourds** (part d'encre rendu 0,1425 vs référence 0,1402 dans la métrique IoU).
5. **Oreille et cou** : tracés comme encre du visage, pas par le moteur d'oreille (`ear-system`).
6. **Hachures sombres derrière l'oreille** : bien placées, détail simplifié.
7. **Classement hair/face** toujours par polygones dessinés à la main (`cells/03-swept_back.json`) ; la mèche près de l'œil proche est comptée « cheveux » à 0,9 % dans sa zone protégée.

## Grammaire (objectif d'origine) — non fait
8. **Génération à partir de paramètres** : toujours absente. `HAIR-GRAMMAR-STATS.md` donne les premières distributions (3 cellules) ; il manque le champ d'écoulement depuis la raie, le tirage de mèches, la hiérarchie masse → mèche → fil, et surtout un **test de génération** (produire 03 à partir de paramètres et comparer à la référence).
9. **Fragments, pas mèches** : les « rubans » sont des branches de squelette coupées aux jonctions (longueur médiane 0,10 H ≈ 10 px). Une vraie mèche se compose de plusieurs fragments : regrouper par continuité de direction.
10. **Cellules 04 à 12** : configuration (repères, zones protégées, polygones visage) à écrire ; la chaîne `analyze-cell.py` + `trace-bands.py` est générique.
11. **Cellules 01 et 02 en bandes** : non converties (01/02 gardent leurs rubans ; 02 garde l'œil du moteur). Gain attendu : construction et fidélité comme 03. À décider avec toi car cela remplace l'œil du moteur de 02.
12. **Rotation de vue / pose sur la coque 3D** (`head.ts`, `lock.ts`) : les rubans et bandes sont en repère 2D 3/4.
13. **Style** : la couche « style artistique » vérifie l'épaisseur, les niveaux de gris, la part d'encre ; elle ne juge ni l'élégance ni le rythme des mèches. Revue humaine nécessaire.

## Performance
14. Rastérisation finale **+ 20 à 30 % plus lente** avec les bandes (superposition de 8 couches) ; seule la construction (−98 %) et la taille (−52 %) s'améliorent nettement (`PERF-HAIR-GRAMMAR.md`). Pistes non faites : bandes disjointes (risque de coutures d'anticrénelage), résolution adaptative, pool de workers sur machine multi-cœurs (la mesure a été faite sur 1 cœur).

## Priorité 3 (pipeline principal)
15. Rien n'est fusionné, volontairement. Les étapes 1 à 5 de `HAIR-GRAMMAR-BRIDGE.md` restent à faire ; l'adaptateur de repère `HeadFrame ↔ FaceLandmarks` n'est pas écrit.

## Sécurité
16. **Le jeton GitHub collé dans la conversation (`ghp_…`) est exposé en clair : à révoquer maintenant dans GitHub → Settings → Developer settings → Tokens, puis remplacer par un jeton à portée minimale (ce dépôt seulement).** Il n'est écrit dans aucun fichier du dépôt.

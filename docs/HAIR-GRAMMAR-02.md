# Grammaire de coiffure — cellule 02 (`02-side_sweep`)

Suite de `HAIR-GRAMMAR-RIBBONS-V2.md`. Image source : `artefacts/visual-inspiration-01.jpg` (2ᵉ cellule de la rangée du haut, visage en 3/4 tourné vers la gauche).

## Ce que la cellule montre (lu sur la grille, pixels de l'image)
| Élément | Mesure | En hauteurs de tête (H = 109,5 px, origine = iris proche) |
|---|---|---|
| Iris proche | (181, 94) | origine (0, 0) |
| Pointe du nez / bouche / menton | y = 118 / 130 / 148 | v = 0,219 / 0,329 / 0,493 |
| Contour du visage (joue gauche) | x ≈ 167 | u = −0,128 |
| Sommet du crâne (déduit : menton − 1 H) | y ≈ 38,5 | v = −0,507 |
| Sommet de la chevelure | y ≈ 5 | v ≈ −0,81 → volume au-dessus du crâne ≈ 0,30 H |
| Oreille | x 249–259, y 83–112 | haut de l'oreille à v ≈ −0,10, lobe à v ≈ +0,16 |
| Pointes de la frange | y ≈ 108 (x 190–225) | s'arrêtent 0,10 H **au-dessus** de la pointe du nez ; la frange cache le sourcil et la moitié haute de l'œil |
Constat de forme (ce que la grammaire doit savoir dire) : raie haute côté gauche ; masse balayée d'avant-gauche vers arrière-droite en nappe continue ; bandes de reflet blanches qui suivent le balayage ; frange longue, effilée, tombant en oblique devant l'œil ; côtés courts, plaqués, pointes retroussées derrière l'oreille ; petite touffe au-dessus de la tempe gauche. L'échelle est la même que pour la cellule 01 (iris→menton ≈ 55 px dans les deux) : les tailles de mèches sont directement comparables.

## Ce qui a été fait
1. **Extracteur générique** `scripts/hair-grammar/analyze-cell.py` : plus aucune constante propre à une coiffure. Tout vient d'une configuration `scripts/hair-grammar/cells/*.json` (recadrage, origine, unité, zone d'intérêt, seuils, zones « visage », repères anatomiques, bornes de vérification). La cellule 01 est reproductible avec la même chaîne (`cells/01-tousled.json` : 14 masses, 187 rubans, mêmes comptes qu'avant).
2. **Profil 02** `src/hair-grammar/profiles/side_sweep.ribbons.json` : 15 masses de cheveux, 104 rubans de cheveux (123 avec le visage), 8 bandes de ton.
3. **Corrections trouvées en comparant au rendu** (chacune vue sur `artefacts/hair-grammar-02/02-reference-vs-rubans.png`) :
   - nez et bouche absents (traits gris plus clairs que le seuil d'encre) → seuil propre à la zone visage (`ink_t_face` = 175) ;
   - taches de gris sur le front → zone de ton exclue sur la peau (`tone_exclude_polys`) ;
   - trait de mâchoire trop épais → plafond de largeur des rubans du visage (2,6 px) ;
   - gris « 27 » à la bande la plus sombre (zones sans papier, division ≈ 0/0) → gris mesuré seulement là où il reste du papier non encré ;
   - dégradé du reflet en aplats → 8 niveaux de ton, lissage σ = 3,5 (au lieu de 5 niveaux, σ = 5).
4. **Vérification généralisée** : repères (`landmarks`), bornes anatomiques (`limits`) et bornes de style (`styleLimits`) sont désormais dans le profil ; défauts = ceux de la cellule 01 (comportement inchangé pour 01).
5. **Test pixel automatique** `tests/hair-grammar-cells.test.ts` (cellules 01 et 02) : rendu déterministe, IoU et rappel d'encre minimaux, trois couches vertes, échelle commune.

## Mesures (`artefacts/hair-grammar-02/metrics.json`)
| Mesure | Valeur |
|---|---|
| IoU de silhouette | 0,976 |
| Rappel / précision d'encre (tolérance 2 px) | 0,995 / 0,999 |
| Part d'encre (réf. 0,322) | 0,326 |
| Écart perceptuel (flou) | 0,035 |
| Construction SVG (médiane) | 5,2 ms |
| Rastérisation 284 px (médiane) | 9,4 ms |
| Taille SVG | 84 Ko |
| Vérification | géométrie, anatomie, style : vertes |
Machine à 1 cœur. Avec 5 niveaux de ton : 3,3 ms / 7,1 ms / 69 Ko → les 8 niveaux coûtent environ +30 % de rastérisation pour un dégradé plus doux.

## Lecture honnête de ces chiffres
- IoU 0,976 et précision 0,999 ne mesurent **pas** la qualité d'une grammaire : le profil est une **trace** de l'image elle-même, comparée à cette même image. Ils prouvent que la chaîne d'extraction ne perd presque rien, pas que la grammaire sait produire cette coiffure à partir de paramètres.
- Le rouge de la superposition au bord gauche (`03-…`) vient de mèches de la cellule voisine, exclues volontairement : elles sont comptées « manquantes » dans les métriques (légère sous-estimation).
- **Écart visible restant** : les corps de mèches de la référence sont des gris foncés rayés de clair ; le rendu a du noir avec des fentes blanches. Les reflets blancs fins du balayage sont rendus en bandes lissées, pas en traits nets. Détails dans `HAIR-GRAMMAR-02-REMAINING.md`.
- Verdict : la cellule 02 n'est **pas** « parfaite pixel par pixel ». Elle est nettement plus fidèle que la 01 (IoU 0,77), surtout parce que la coiffure est lisse et faite de grandes masses.

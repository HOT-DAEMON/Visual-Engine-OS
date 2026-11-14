# Flux des mèches, rasé et lisière : un rendu moins mécanique

Branche `feat/hair-grammar`. Fichiers : `hair-strands.ts`, `hair-features.ts` (`flowOf`). Vérification : `HAIR-VERIFY-FEATURES.md`.

## Constat
Colonnes de mèches toutes de même largeur, toutes parallèles (« rendu mécanique ») ; `buzz`, `short` et `spiky` se ressemblaient ; racines sombres calculées sans la frange.

## Mèches droites / ondulées (`straight`)
- **Largeurs inégales** : déformation de la colonne par deux sinusoïdes à nombre entier de périodes par tour (11 et 29 : périodique, aucune couture à 360°), pente cumulée < 1 (une colonne ne s'inverse pas). Coefficient de variation des largeurs ≥ 0,1 (test).
- **Paquets** : quatre colonnes voisines partagent un écart de teinte (`N` multiple de 4).
- **Flux** (`flowShift`, exporté) : décalage du motif en cellules = TOURBILLON autour du vertex (nul sous y = 0,55 U) + BALAYAGE du front (vers le côté où la frange descend, nul au-delà de 92° d'azimut). Sens et force tirés de la graine (`flowOf`) ; périodique en azimut (test). Boucles et chaume : pas de sens de mèche.
## Boucles / crépu (`voronoi`)
Troisième échelle : des paquets d'environ trois boucles (cellules ×3) partagent une teinte et sont séparés par un creux plus marqué.
## Rasé (`buzz`)
`stubble()` : grain fin (cellules ×4 plus étroites), peu contrasté, sans trait de mèche. La racine se fond dans la teinte de la peau près de la lisière (`0,45 × racine + 0,03`) : pas de bord dur peau / casque. Un premier réglage (0,12 constant) faisait échouer `style.tint` (> 90) : réduit.
## Lisière
Racines sombres : `hairEdgeDistance` (frange comprise) à la place du champ de la seule région. Adoucissement des sommets : `relaxRegion` (voir `HAIR-FRINGE-3D.md`).
## Pièces
- Tresse : vrai tressage (un toron tous les `BRAID_PITCH` = 1/9 U, chemin en zigzag, renflement par toron, bout en touffe), même pas que les côtes de la texture `braided`.
- Queue : section presque ronde (rz = 0,92 rx), éventail plus fort (0,85) : un volume de cheveux rassemblés, plus un pan.

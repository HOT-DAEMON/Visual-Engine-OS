# Statistiques de rubans — cellules 01, 02, 03 (données pour la grammaire générique)

Script : `scripts/hair-grammar/ribbon-stats.ts` → `artefacts/hair-grammar-03/stats-cellules.json`. Tout est en hauteurs de tête H (même unité 109,5 px pour les trois cellules, voir réserve dans `HAIR-GRAMMAR-03.md`). Population = rubans de rôle `hair`.

| Statistique | 01-tousled | 02-side_sweep | 03-swept_back |
|---|---|---|---|
| Rubans de cheveux | 165 | 104 | 76 |
| Longueur médiane / p90 (H) | 0,086 / 0,202 | 0,102 / 0,219 | 0,097 / **0,253** |
| Largeur moyenne médiane (H) | 0,017 | 0,034 | 0,016 |
| Rapport longueur/largeur médian | 4,7 | 3,2 | **7,7** |
| Courbure médiane (rad/H) | 5,09 | 5,88 | **4,27** |
| Direction dominante (axiale, 0° = →, 90° = ↓) | 56° | 59° | 49° |
| Alignement R (1 = parallèles, 0 = isotrope) | **0,21** | 0,33 | 0,33 |

## Lecture
- **Ce qui distingue vraiment les coiffures** : alignement R (01 ébouriffée : mèches dans toutes les directions ; 02 et 03 balayées) et rapport longueur/largeur (03 : mèches fines et longues). Ce sont de bons candidats de **paramètres** : *désordre*, *finesse*, *portée*.
- **Ce qui ne distingue presque rien** : la direction dominante (49–59°) : 01 aussi est balayée vers le bas-droite en moyenne ; la longueur médiane (0,09–0,10 H, ≈ 10 px).
- **Limites** : ce sont des *fragments* de squelette (coupés aux jonctions), pas des mèches ; 3 points de données ne font pas une distribution ; la courbure d'un fragment de 10 px est dominée par le bruit de numérisation. Aucune de ces valeurs n'a été utilisée pour *générer* quoi que ce soit.
- **Spécifique à 03 (relations au visage)** : volume 0,31 H au-dessus du crâne ; frange 0,10 H au-dessus de l'iris ; côtés coupés à hauteur d'iris ; arrière 0,11 H derrière l'oreille. Ce sont des **contraintes de portée** (jusqu'où une mèche peut aller) à exprimer par rapport aux repères du visage, pas en pixels.

## Conséquence pour la Priorité 3 (voir `HAIR-GRAMMAR-BRIDGE.md`)
La voie la moins risquée reste de **nourrir des paramètres** du moteur principal (désordre, finesse, portée relative aux repères) plutôt que de lui injecter de la géométrie ; ces trois cellules montrent que ces paramètres existent et diffèrent. Les bandes iso-tons (couche de rendu) sont **incompatibles** avec le moteur principal (gris absolus mesurés vs teinte relative + éclairage) : elles ne doivent pas y entrer.

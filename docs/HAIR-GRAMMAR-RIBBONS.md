> **Remplacé en partie par la v2** : voir `HAIR-GRAMMAR-RIBBONS-V2.md` (extraction `analyze-01b.py`, masses pleines, tons mesurés). Ce document décrit la v1 ; son script `analyze-01.py` et son format `poly` sont obsolètes.

# Grammaire de coiffure — rubans de trait (cellule 01)

## Pourquoi un changement d'approche
L'ajustement aveugle de mèches 3D (`autofit`, session précédente) donnait IoU 0,71 mais un rendu brouillon : il optimisait des métriques, pas la structure visible. Ici on **analyse la structure de l'image** (squelette de l'encre) puis on l'exprime avec une primitive de la grammaire.

## Primitive : `ribbon.ts`
Un **ruban** = trait d'encre à largeur variable : suite de points `(u, v, w)`. Une mèche dessinée = deux rubans qui convergent en pointe + une masse de ton. Tout est dans le **repère de tête** `HeadFrame` : origine = iris de l'œil proche, unité = hauteur de tête H (109,5 px dans la cellule), y vers le bas. La taille d'une mèche se lit donc par rapport au visage (0,5 = demi-tête), pas en pixels.
| Fichier | Rôle |
|---|---|
| `ribbon.ts` | `Ribbon`, `ToneMass`, `HeadFrame`, contour (bords gauche/droit + capuchons), chemin lissé |
| `ribbon-scene.ts` | scène : fond → masses de ton (2 niveaux) → encre ; SVG de chemins, **aucun filtre** |
| `ribbon-verify.ts` | vérification en 3 couches (géométrique, anatomique, style) |
| `profiles/tousled.ribbons.json` | données de la cellule 01 (repère de tête) |
| `scripts/hair-grammar/analyze-01.py` | extraction : encre → squelette → branches → rubans ; masses de ton |
| `scripts/hair-grammar/artefacts-ribbons-01.ts` | rendu, comparaison, métriques, temps, vérification |

## Extraction (`analyze-01.py`)
1. Cellule 188 px ×4 (bicubique) ; encre = gris < 105 dans la zone cheveux + visage (< 150 px).
2. Squelette (skimage) → branches entre extrémités/jonctions ; éperons < 6 px élagués.
3. Largeur = 2 × transformée de distance, médiane glissante + plafond 1,25 × médiane (supprime les bulles aux jonctions) et **plafond absolu 3,4 px**.
4. Classement `hair` / `face` par boîtes de repères (yeux, nez, bas du visage). Les traits du visage de cette cellule sont rendus pour la comparaison, ils ne remplacent pas le moteur de visage.
5. Masses de ton : gris lissé **sans** les pixels d'encre (convolution normalisée, σ = 8), 2 niveaux (230–247, < 230), contours simplifiés.

## Résultats mesurés (`artefacts/hair-grammar-ribbons/metrics.json`)
| Mesure | Mèches 3D autofit (avant) | Rubans (maintenant) |
|---|---|---|
| IoU de silhouette | 0,71 | 0,66 |
| Rappel d'encre (tol. 2 px) | 0,95 | 0,97 |
| Précision d'encre | 0,93 | 1,00 |
| Part d'encre (réf. 0,213) | 0,227 | 0,180 |
| Écart perceptuel grossier (flou) | non mesuré | 0,052 |
| Construction SVG (médiane) | 12,9 ms | 6,5 ms |
| Rastérisation 312 px (médiane) | 24,2 ms | 8,1 ms |
Temps mesurés sur une machine à 1 cœur, 15 passes après échauffement ; les rubans sont une primitive plus simple (pas de marche 3D), donc la comparaison de vitesse porte sur deux approches différentes, pas sur une optimisation de la même.

## Verdict honnête
**Nette amélioration structurelle** (épi haut-gauche, enchaînement des mèches en S, retroussés, frange diagonale, mèches latérales sont présents et à la bonne place : voir `02-reference-vs-rubans.png`). **Pas « parfait »** : traits un peu irréguliers/gras par endroits, masses de ton plus plates que les dégradés de l'original, détails de l'iris et des cils absents, contour de mâchoire trop épais. L'IoU de silhouette a baissé (0,71 → 0,66) à cause du plafond de largeur ; c'est un compromis assumé (voir REMAINING).

## Ce que cela ne prouve pas
Les rubans de la cellule 01 sont des **données extraites**, pas une coiffure générée : la grammaire sait les dessiner et les vérifier, mais le tirage de nouvelles coiffures à partir de statistiques de rubans (longueur, courbure, cap relatif au champ d'écoulement) reste à faire — voir `HAIR-GRAMMAR-RIBBONS-REMAINING.md`.

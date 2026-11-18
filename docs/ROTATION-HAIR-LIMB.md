# Lisière sous pose, consciente du limbe (passe 7)

Code : `src/face/pose/hairline-limb.ts` (nouveau), `src/face/pose/hair-pose-lines.ts` (branché). Tests : `tests/hair-limb-line.test.ts` (nouveau), `tests/face-pose-hair-strands.test.ts` (2 tests réécrits). Preuves : `artefacts/rotation-hair-limb/` (`01-lisiere-avant-apres.png`, `02-tempe-derriere-horizon.png`, script `scripts/rotation-hair-limb-proof.ts`). Contexte : `ROTATION-HAIR-PASS-6.md` §2.1.

## 1. Mécanisme du défaut (établi, mesuré)
La lisière était projetée point par point (`Skull.projectX`). À la tempe :
- **côté qui passe derrière l'horizon** (n_z = cos(φ+a) < 0) : la pente tombe à ρ(1−ψ)² (≈ 0,045 à 45°). La fin de tempe est écrasée sur le limbe ; comme `hangHalf(y)` varie le long de la courbe, la ligne monte puis REDESCEND sur le même contour : un V fin (bras à ≈ 3 px, virage jusqu'à π) ;
- **côté qui se présente** : la bande est dépliée (pente 2 à 3), les arêtes s'étirent.
Ce n'est donc pas un défaut de la ligne de face (le coin frontal n'est pas la cause principale) mais de la carte.

## 2. Solution : cinq opérations dans l'espace projeté, extrémités fixes
1. **Coupe à l'horizon** : la partie contiguë à une extrémité dont n_z < `HIDE_NZ` (0,1, ≈ 6° au-dessus de l'horizon) est remplacée par la CORDE entre le point d'émergence (bissection sur n_z) et le coin de tempe. Une tempe cachée ne se dessine pas.
2. **Échantillonnage adaptatif** du visible : corde de face ≤ ds ET corde projetée ≤ ds (le dépliage n'étire plus d'arête).
3. **Rééchantillonnage à pas d'arc constant** (ds = 0,006 W) : plus d'amas de points sur la bande écrasée.
4. **Retour dans la silhouette** (`inside`) avant ET après la relaxation (celle-ci moyenne avec des extrémités fixes ; la silhouette n'est pas convexe partout).
5. **Relaxation de courbure** : les sommets dont le virage dépasse κ × pas local sont adoucis ; κ = courbure frontale maximale + 0,05 rad par pas moyen (`curvatureCap`). On borne la COURBURE, pas le virage par sommet.
Chaque point posé garde un indice continu `u` dans la ligne de face : l'azimut et la hauteur de la lisière (qui portent les pattes) sont reportés par interpolation (`posedFront`). La boucle de frontière (`posedBoundary`) remplace son tronçon `front` par cette ligne ; les autres tronçons (pattes, oreille, nuque) restent projetés point par point.

## 3. Piège de mesure découvert (à ne pas refaire)
Le contrôle `pose.hairline-smooth` lit le virage par SOMMET : échantillonner plus fin le fait passer sous le seuil sans changer la courbe. Après une première correction il affichait 0/480 alors qu'une mesure sur fenêtre d'arc fixe donnait 152 poses sur 192 avec un coin trop vif. La vraie garde est `pose.hairline-corner` (`ROTATION-HAIR-VERIFY-2.md`).

## 4. Résultats (grille de 480 poses, mêmes poses avant / après ; fenêtre d'arc fixe : sous-grille de 192 poses)
| Mesure | Avant | Après |
|---|---|---|
| `pose.hairline-smooth` (virage de sommet) | 300 / 480 | 0 / 480 |
| `pose.edge-step` | 20 / 480 | 0 / 480 |
| coin sur fenêtre d'arc fixe > 1,35 × face + 0,05 rad | 152 / 192 | 0 / 192 |
| extrémités (coins de tempe) | exactes | exactes (égalité stricte testée) |
| ligne hors silhouette du crâne | oui (jusqu'à plusieurs px) | jamais (`inside`) |

## 5. Contrats modifiés (honnêteté)
- Ancien contrat « lacet seul : ordonnées intactes, abscisse strictement croissante, y exact à 1e-6 » → remplacé par : extrémités exactes, repli en x ≤ 0,6 % W, décalage de hauteur ≤ 0,8 % W (mesuré : ≤ 2,2 px de hauteur, ≤ 1,7 px de repli, venus de la relaxation).
- La lisière posée s'écarte de la projection brute jusqu'à ≈ 6,7 px sur le tronçon caché, PAR CONCEPTION (corde au lieu d'un repli).
- `posedHairline.at(s)` est désormais uniforme en longueur d'arc, plus indexé par sommet.
- `pose.edge-step` ne discrimine plus : la boucle posée est dense, le rapport est trivialement petit. Elle reste dans la liste comme filet de sécurité ; la garde utile est le coin sur fenêtre fixe.
- Limite : la chevelure n'est pas reconstruite en 3D ; la corde sur la tempe cachée est un choix de dessin (ligne droite sur le limbe), pas une surface.

## 6. Reste à faire (lisière)
- Valider à l'œil sur tous les styles à ±60°/±75° (preuves limitées au style `short`, 4 graines).
- Même traitement pour la lisière de nuque et le tronçon oreille (aujourd'hui projetés point par point : pas de défaut mesuré).
- Appliquer la coupe à l'horizon à la coque (`base`) elle-même : elle est encore projetée point par point.

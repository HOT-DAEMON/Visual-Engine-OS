# Nez 3D : largeur de face tranchée contre la planche (16 nov. 2026, 2e passe)

Suite de `NOSE-ALAR-SEAT.md` §7 (« le nez 3D de face est 1,5 × plus large que la silhouette 2D, non corrigé, à trancher contre la planche »). Restes : `NOSE-REFS-REMAINING.md`.

## 1. Quelle planche peut trancher ?
- **Planche de nez `06.png` : aucune.** `extract_06.py` normalise chaque forme par sa propre boîte : elle ne fournit qu'un profil de largeur normalisé et un rapport L/H, jamais une largeur en unités de tête.
- **Planche de rotation de tête (`references/face/rotation_head.jpg`, vue 0°) : oui.** C'est elle qui a calé le crâne (`REF_FIT`, 1 U = 150 px de tête).
- **Le « 0,30 » de `HEAD-TURNTABLE-REFERENCES.md` n'est pas une annotation** : `annotate-face-refs.py` n'a des points d'ailes que pour `01.jpg` (0,395). Il n'a pas été utilisé comme preuve.

## 2. Mesure sur les pixels (`references/nez/measures-planche-rotation-nose-width.json`)
Tache d'ombrage du nez de la vue 0° (distance RVB à la peau médiane des deux joues, ouverture morphologique, plus grande composante, seuils 10 → 18) : **14 à 17 px de large, soit 0,093 à 0,113 U**. Écart des iris mesuré sur les pixels : 50,06 px (0,334 U), soit 2 × `eye.x` du calage (0,339 U) : l'échelle est cohérente.
Limite : le nez de la planche est un ombrage d'animation, les ailes ne sont pas tracées ; la fourchette dépend du seuil (d'où une bande, pas une valeur).

## 3. Verdict (`scripts/nose-refs/width-3d-vs-2d.ts`, `artefacts/nez-largeur-3d/mesures.json`)
| Tête de la planche | Largeur de face (U) |
|---|---|
| Mesure sur les pixels | 0,093 – 0,113 |
| Silhouette 2D du moteur | 0,103 (dans la bande) |
| 3D **avant** | 0,155 (1,51 ×, hors bande) |
| 3D **après** | 0,103 (1,005 ×) |

La silhouette 2D était juste ; le 3D était faux. Cause : l'ellipsoïde d'aile était centré SUR la crête `alaX` (que la silhouette et la règle `nose.width` traitent comme la demi-largeur) : son bord externe sortait de `ex` = 0,026 U. Ce n'était donc pas un calage à la main sur le 3D.

## 4. Correctif (`src/head-turntable/parts.ts`)
Le bord externe de l'aile est ancré sur la crête : centre à `alaX − ex × ALA_OUTER_ANCHOR − pull`, `ALA_OUTER_ANCHOR = 1` (0 = ancien comportement). `ALA_EX` (0,026) exporté. `alaPull` et ses constantes sont inchangés ; la pose sur la joue (`surfaceZ` à l'abscisse de l'aile) aussi.

## 5. Résultats (40 graines 500 + 37·k × 4 types, `artefacts/nez-largeur-3d/stats.json`, `npx tsx scripts/nose-refs/width-3d-stats.ts`)
| Nez | Largeur 3D ÷ 2D avant → après (médiane) | Rappelé à 30° avant → après | Saturés avant → après | Débordement 45° max (U) / part > 0,01 |
|---|---|---|---|---|
| libre | 1,518 → 1,010 | 2,5 % → 0 | 0 → 0 | 0,025 / 15 % |
| pyramide | 1,532 → 1,019 | 17,5 % → 2,5 % | 0 → 0 | 0,049 / 57,5 % |
| cloche-ailes | 1,507 → 1,003 | 15 % → 2,5 % | 0 → 0 | 0,049 / 57,5 % |
| plat-trapèze | 1,532 → 1,019 | 72,5 % → 10 % | **4 → 0** | 0,058 / 100 % |

Le plat-trapèze n'était donc pas « aux limites du modèle 3D » : la cause du rappel massif était cette largeur excédentaire. Débordement à 30° : 0 sur les quatre types.
Le 45° reste **sans borne** : le nez dépasse le contour (normal en trois-quarts) ; seul le chiffre est donné ici.

## 6. Preuves visuelles (`artefacts/nez-largeur-3d/`)
- `01-avant-apres-tetes.png` : têtes 3D complètes éclairées (3 nez × lacets 0°, 30°, 45°), avant à gauche, après à droite (`scripts/artefacts-nose-width3d.ts`, lancé sur l'ancien commit puis le nouveau).
- `02-zoom-nez-avant-apres.png` : nez ×3 (lacets 0° et 30°). Après : ailes plus étroites, ombres portées des ailes nettement réduites.
- `03-planche-largeur.png` : le nez de la planche ×10 avec les largeurs superposées (vert = bande mesurée, bleu = 2D, orange = 3D après, rouge = 3D avant). Le rouge sort largement du nez ; les trois autres l'encadrent.

## 7. Vérification du rendu
- **Géométrie** : `eng.nose.front-width` (bloquante, 0,97–1,08) = `frontWidthRatio` (`nose-contour.ts`, calcul pur) ; valeurs mesurées 1,000–1,032. Garde : l'ancien comportement donne 1,5.
- Tests : `tests/nose-width-3d.test.ts` (4 : rapport ≤ 1,05 sur 16 têtes ; ancien comportement détecté ; largeur de la planche dans la bande mesurée ; plus aucune saturation du plat-trapèze).
- `tests/nose-alar-seat.test.ts` **modifié** : ses graines ne débordent plus, donc la contrainte est exercée sur un nez élargi (`alaX × 1,3`, saturation `× 2,6`) et l'ancien défaut est reconstruit en décalant l'aile de `ex`. L'échec de ces 4 tests après le correctif était attendu ; je l'avais d'abord manqué (sortie tronquée).
- Régression visuelle (`scripts/regress.ts check`) : inchangée (33 exacts, 1 proche).

## 8. Non fait
- **Anatomie / style** : aucune règle nouvelle ; la largeur absolue du nez n'est pas comparée à un canon (la planche est stylisée).
- La planche ne donne ni largeur des ailes seules, ni profil à 45° : l'ellipsoïde d'aile (`ey`, `ez`) n'est pas validé contre elle.
- **Défaut visible** : l'ellipsoïde de l'aile lointaine se lit encore comme un anneau clair sur la joue (avant et après).
- Écart résiduel de 0 à 3 % (ratio jusqu'à 1,032) : la crête alaire dépasse parfois la demi-largeur maximale de la silhouette 2D. Cause non isolée (pas d'ablation faite).

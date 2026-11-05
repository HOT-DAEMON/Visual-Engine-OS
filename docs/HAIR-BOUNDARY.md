# Lisière des cheveux — définition, câblage, vérification

Branche `feat/hair-grammar`. Reste à faire et limites : `HAIR-BOUNDARY-REMAINING.md`. Preuves : `artefacts/hair-boundary/`.

## 1. Ce qu'est la lisière
Une **boucle fermée posée sur la surface du crâne**, en coordonnées (hauteur `y`, azimut `az`; `az = 0` face, `+π/2` côté droit de l'image, `π` nuque).
Elle sépare le territoire des cheveux du reste de la tête. Quatre tronçons (`EdgeKind`) :

| Tronçon | Rôle | Source |
|---|---|---|
| `front` | ligne d'implantation (tempe gauche → tempe droite) | `buildHairline` (forme, recul, irrégularité, raie), puis `onSkull` |
| `sideburn` | bord avant de la patte, pointe arrondie, bord arrière | `sideburnProfile` (bande unique, partagée avec le garde-fou) |
| `ear` | arche au-dessus de l'oreille, contour arrière jusqu'à la mastoïde | `earSpans` (même géométrie d'oreille que le rendu) |
| `nape` | de la mastoïde à la ligne de la nuque, centrée à `az = π` | `napeY = max(jawY − 0,02 H, bas d'oreille + 0,04 H)` |

Le parcours est `[front G→D, côté droit → nuque, côté gauche remonté]` ; le côté gauche est le miroir du droit avec ses propres oreilles.

## 2. Surface du crâne (`boundary/skull-surface.ts`)
Section horizontale à la hauteur `y` = ellipse de demi-axes `(a(y), b(y))`.
- `a(y)` = demi-largeur du **vrai contour de face** (`halfWidthAt(lm.outline, y)`) : la silhouette de face est la silhouette à lacet 0.
- `b(y)` = profondeur propre : `rz·√(1−u²)`, `u = (y−cy)/ryTop` au-dessus du centre du crâne, `u = (y−cy)/(1,316·(jawY−cy))` en dessous, plancher `0,3 rz`.
  Le crâne de la pose (`pose/skull.ts`) se referme à 0 à la mâchoire puis saute à `0,62 rz` : un pôle sans réalité anatomique qui dégénérait la nuque (trou de 0,17 H dans la boucle). D'où ce profil propre.
- `normal(y, az)` : normale **exacte** du gradient de `(x/a)² + (z/b)² = 1` (pentes verticales de `a` et `b` par différences centrées).
- `project(y, az, yaw, pitch)` : rotation rigide (lacet puis tangage autour du haut du cou), orthographique, `visible = nz > 0,05`.

## 3. Câblage dans la pipeline
`hairGeometryRaw` (`src/face/hair/index.ts`) construit `boundary = buildBoundary(p, lm)` **avant** tout le reste :
- `HairGeometry.boundary` est exposé ; `hl = boundary.hairline` : la ligne d'implantation du reste du moteur EST le tronçon `front`.
- `guard.ts` lit `sideburnProfile` (même bande que le tracé de la patte : plus de double définition).
- `scalp.ts` → `capShell` (`boundary/shell.ts`) : la **coque** est la sous-couche des cheveux, bord intérieur = lisière, bord extérieur = contour épaissi selon la coiffure
  (table `SHELL` : rapport latéral et portée `none | ear | cover` ; `afro`/`bob`/`long` couvrent l'oreille, `buzz`/`short`/`spiky`/`ponytail`/`bun`/`braids` la dégagent ; archétypes simulés `own` : portée `none`).
- `wings.ts` : mèches de flanc entre la lisière et le contour (PRNG propre, aucune pour `buzz`), conicité `1 − 0,5·u^1,3`.
- Rendu (`render/face/hair-detail.ts`, `hairlineTransition`) : la transition peau / cheveux suit la chaîne `sideburn(−1) + front + sideburn(+1)`, ombre décalée vers la peau,
  largeur et opacité et cheveux fous lus dans `edge-style.ts`.

## 4. Style du bord (`edge-style.ts`)
`edgeStyle(style, texture, couleurCheveux, couleurPeau, irrégularité)` → `{crisp, contrast, shadowAlpha, shadowWidth, strayShare, strayAlpha}`.
- netteté = `STYLE_CRISP × TEXTURE_CRISP` (buzz 0,15 … braids 0,9 ; droit 1 … crépu 0,45) ;
- contraste = √ de la différence de luminance cheveux / peau ; ombre et cheveux fous en dépendent (blond sur peau claire : bord doux ; noir sur peau claire : bord dur).
Preuve : planche 06 (peau mesurée sur le matériau de l'hôte, étiquetée).

## 5. Repères de racine et vent (interface, `frames.ts`)
`rootFrames(boundary, n)` : `n` racines équiréparties à l'abscisse curviligne, chacune `{pos, normal, flow, kind}` (normale exacte, flux tangent par différence centrée, flux·normale < 1e-4).
`windDir(frame, wind, k)` : composante **tangentielle** du vent pondérée par la souplesse `k` → `{dir, lift}`. `projectBoundary(b, yaw, pitch)` : la boucle après rotation.
Ce sont les interfaces pour la rotation et le vent ; leur branchement dans les moteurs de rendu n'est PAS fait (voir REMAINING).

## 6. Défaut réel trouvé et corrigé
Avant : des points de l'implantation sortaient du contour du crâne, jusqu'à **1,535 ×** la demi-largeur (graine 10310, recul 0,88). Planche 03.
`hairline.ts` : `onSkull` ramène chaque point à `0,985·a(y)` (bissection vers le bas jusqu'à `min(low, templeY)`, repli par écrêtage de x). Après : maximum 0,985 sur les 120 cas testés (40 graines × recul 0 / 0,5 / 1).

## 7. Vérification (`src/verify/hair-boundary.ts`, 15 contrôles, branchée dans `verifyFace`)
| Couche | Contrôle | Seuil |
|---|---|---|
| géométrie | `boundary-finite` ; `boundary-inside-contour` (≤ 1) ; `boundary-matches-face-projection` (1e-6 W) ; `boundary-no-self-crossing` (tronçons visibles contigus) ; `boundary-closed-no-hole` | écart 3D voisin ≤ 0,12 H |
| anatomie | `boundary-above-brows` (−0,03 H) ; `boundary-sideburn-above-eyes` (−0,03 H) ; `boundary-clears-ear` ; `boundary-nape-below-ears` (+0,02 H) ; `shell-off-face-skin` (≤ 2 %) ; `shell-clears-free-ear-{left,right}` (≤ 25 %) | |
| style (warn) | `hairline-smooth` (≤ 0,05 H) ; `hairline-balance` (selon irrégularité, raie, recul) ; `hairline-edge-readable` (contraste + ombre ≥ 0,1) | |

Mesure : corpus de **600 visages** (10 coiffures × 5 textures × 2 moteurs × 6 graines ; le test en rejoue 3 graines par combinaison) : **0 échec**, `artefacts/hair-boundary/verification.json`, planche 08.
**Contrôles négatifs** (`checkHairBoundary(face, override)`) : 8 sabotages (hors contour ×6, sous les sourcils, auto-croisement, trou, traversée d'oreille, coque sur la peau + nuque, oreille libre couverte) — chacun doit être détecté.
Seuils posés à la main sur ce corpus, pas appris d'une référence (voir REMAINING).

## 8. Tests
`tests/hair-boundary.test.ts` (59 tests) : implantation sur le crâne ; corpus ; chauve → aucun contrôle ; contrôles négatifs ; rotation rigide (distances 3D conservées) ; visibilité lacet 0 / 60 ;
repères (normale unitaire, tangence, sur la surface) ; vent ; ordre du style de bord ; coque dégagée / couverte, épaisseur selon coiffure.
Suite complète (après fusion avec `327f2b9`) : 95 fichiers, 2579 tests verts ; `tsc --noEmit` propre ; `npm run regress` : sortie 0 (34 images, rms ≤ 0,26/255 : les références n'ont pas bougé).

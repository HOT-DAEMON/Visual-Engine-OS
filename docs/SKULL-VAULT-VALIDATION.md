# Voûte crânienne — protocole de validation et résultats

Preuves dans `artefacts/skull-vault/` (index : `artefacts/skull-vault/README.md`). Principe : **une valeur n'est consommée que si elle change des pixels**. Une valeur différente dans un JSON ne prouve rien.

## Protocole
- **Banc d'essai** (`vault-lab.ts`) : graine 3, tête **chauve** (sans cheveux la voûte se lit), éclairage rasant (azimut 300°, élévation 40°), cadre identique pour toutes les valeurs d'un paramètre. Seule la valeur change.
- **Trois valeurs** par paramètre : minimum, nominal, maximum (`vault-proof.ts`, source unique des tests et des planches). Nominal = 0 pour les mesures neutres, valeur de la graine pour les paramètres existants.
- **Six vues** : face, 3/4, profil, 3/4 arrière, dos, dessus. Les vues où l'effet est attendu viennent du registre (★ sur les planches).
- **Seuils fixés avant la mesure** : écart de silhouette ≥ 0,4 % de l'union, ou ≥ 0,5 % des pixels dont la luminance change de plus de 0,05. Exception : `asymFaceCoupling` (effet = dissymétrie de quelques mm) est jugé sur la dissymétrie de silhouette, seuil 0,1 %.
- **Preuve** = au moins une vue attendue où min ↔ max est perceptible **et** où min ↔ nominal ou nominal ↔ max l'est aussi.
- **Combinaisons** : `scalp` et `boneShow` filtrent le relief osseux, ils se prouvent avec les reliefs actifs ; `asymFaceCoupling` avec un visage asymétrique.

## Couche de vérification de rendu (`verify-vault.ts`)
Valable pour toute combinaison, extrêmes compris (testé sur la tête nominale et une combinaison extrême ; 13 familles et 12 tirages aléatoires dans `verification/`).

| Couche | Contrôles |
|---|---|
| Géométrie | coupes valides (hauteurs croissantes, a ≥ 0, zf > zb, exposants ∈ [1,5 ; 3,3]) ; montée du sommet < 0,1 U ; relief ≤ 0,06 U ; saut entre échantillons voisins ≤ 0,014 U ; relief < 0,002 U près du plan de face, 0,05 U sous la glabelle **de la tête** |
| Anatomie | ordre vertex < front < glabelle < ptérion < mastoïde ; glabelle 0,03–0,2 U au-dessus de la ligne des yeux ; pariétal derrière le ptérion ; tempe 3–9× plus profonde que la glabelle ; sutures masquées par défaut ; occipital, mastoïdes, pariétaux visibles de dos |
| Style | contour de la **calotte** lisse (t < 0,31 U, dérivée seconde ≤ 0,06 U en face, profil, dos ; mesuré : 12 têtes de base ≤ 0,029, extrêmes ≤ 0,039) ; modelé et non bruit (énergie haute fréquence ≤ 0,075 ; mesuré : base ≤ 0,060, extrêmes ≤ 0,046) |

Visibilité et occlusion (`vault-visibility.ts`) : test de face puis lecture de l'image rendue sur 3×3 pixels (occluseur majoritaire : tête, oreille, sourcil, cheveux, nez, cou). Détail par structure : `verification/registre-placements.json`.

## Tests (`tests/skull-vault.test.ts`)
Paramètres neutres par défaut ; remappage vertical (monotone, C¹, inverse) ; registre (identifiants canoniques, parents direct et lointain, voisinage réciproque, aucun paramètre orphelin) ; tissus ; contraintes strictes / caricature / préférences ; corrélations ; effets mesurés (hauteur, largeur indépendante du visage, asymétrie propre, couplage) ; visibilité et occlusion ; couche de vérification ; preuve de 7 paramètres en direct + enregistrement complet (`verification/proofs.json`, **aucun paramètre sans effet perceptible**).

## Résultats
| Paramètre | min | nominal | max | Meilleure vue | Silhouette | Ombre | Preuve |
|---|---|---|---|---|---|---|---|
| `frontalFlat` | -1 | 0 | 1 | dessus | 0.36 % | 12.00 % | ✓ |
| `frontalBreadth` | -1 | 0 | 1 | dessus | 0.06 % | 12.53 % | ✓ |
| `parietalBulge` | -1 | 0 | 1 | dos | 0.00 % | 3.04 % | ✓ |
| `parietalFlat` | -1 | 0 | 1 | face | 3.03 % | 4.46 % | ✓ |
| `cranialBreadth` | -1 | 0 | 1 | dessus | 12.80 % | 29.05 % | ✓ |
| `parietalConvexity` | -1 | 0 | 1 | profil | 0.00 % | 6.56 % | ✓ |
| `temporalFlat` | -1 | 0 | 1 | 3/4 | 1.92 % | 10.24 % | ✓ |
| `templeBreadth` | -1 | 0 | 1 | 3/4 | 2.18 % | 13.02 % | ✓ |
| `temporalHollow` | -1 | 0 | 1 | 3/4 | 0.16 % | 5.44 % | ✓ |
| `planeTransition` | -1 | 0 | 1 | 3/4 | 3.25 % | 16.85 % | ✓ |
| `occipitalFlat` | -1 | 0 | 1 | 3/4 arr. | 3.43 % | 12.95 % | ✓ |
| `occipitalSlope` | -1 | 0 | 1 | 3/4 arr. | 1.83 % | 13.73 % | ✓ |
| `mastoid` | -1 | 0 | 1 | 3/4 arr. | 0.32 % | 2.88 % | ✓ |
| `glabella` | -1 | 0 | 1 | 3/4 | 0.00 % | 1.29 % | ✓ |
| `nuchalLine` | -1 | 0 | 1 | dos | 0.00 % | 3.06 % | ✓ |
| `suturesShow` | 0 | 0 | 1 | 3/4 arr. | 0.08 % | 2.19 % | ✓ |
| `asymParietal` | -1 | 0 | 1 | dessus | 1.60 % | 3.91 % | ✓ |
| `asymOccipital` | -1 | 0 | 1 | dessus | 2.12 % | 2.53 % | ✓ |
| `asymFrontal` | -1 | 0 | 1 | dessus | 0.01 % | 3.22 % | ✓ |
| `asymWidth` | -1 | 0 | 1 | dessus | 8.47 % | 21.94 % | ✓ |
| `asymFaceCoupling` | 0 | 0.5 | 1 | dessus | 0.51 % | 0.00 % | ✓ |
| `boneShow` | -1 | 0 | 1 | 3/4 arr. | 0.30 % | 4.41 % | ✓ |
| `scalp` | 0.05 | graine | 0.95 | 3/4 | 0.15 % | 2.58 % | ✓ |
| `length` | -1 | graine | 1 | dessus | 10.25 % | 24.35 % | ✓ |
| `vaultHeight` | 0 | graine | 1 | profil | 12.03 % | 7.20 % | ✓ |
| `vaultPeak` | 0 | graine | 1 | 3/4 arr. | 2.08 % | 3.77 % | ✓ |
| `foreheadSlope` | 0 | graine | 1 | dessus | 2.98 % | 26.99 % | ✓ |
| `frontalBulge` | 0 | graine | 1 | dessus | 0.57 % | 14.00 % | ✓ |
| `browRidge` | 0 | graine | 1 | 3/4 | 0.17 % | 1.94 % | ✓ |
| `occiput` | 0 | graine | 1 | 3/4 arr. | 1.24 % | 10.12 % | ✓ |
| `inion` | 0 | graine | 1 | dos | 0.00 % | 2.79 % | ✓ |
| `zygoma` | 0 | graine | 1 | 3/4 | 3.13 % | 23.19 % | ✓ |
| `maxilla` | 0 | graine | 1 | profil | 8.04 % | 13.89 % | ✓ |

**Interactions** (grilles 3 × 3, cellules voisines perceptibles) : `cranialBreadth × vaultHeight` 12/12 ; `length × cranialBreadth` 12/12 ; `frontalFlat × frontalBreadth` 12/12 ; `occipitalFlat × occipitalSlope` 12/12 ; `temporalHollow × templeBreadth` 12/12 ; `parietalBulge × parietalFlat` 10/12 ; `mastoid × scalp` 4/12 ; `asymParietal × asymOccipital` 12/12. `mastoid × scalp` reste faible : l'épaisseur du cuir chevelu ne fait qu'atténuer un relief fin.

**Familles** : 13 combinaisons, 0 échec(s) de la couche de vérification. **Tirages aléatoires** (`generateRandomProfile(seed, { vault })`) : 12 têtes, 0 échec(s).

**Non prouvés visuellement ici** : volume de cheveux 3D de l'hôte (lit `skullSurfacePoint`, chaîne hôte non exercée) ; `thyroid`, `napeHairline` et `neck*` (hors voûte, aucun effet sur la tête chauve).

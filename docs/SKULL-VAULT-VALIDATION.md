# Voûte crânienne — protocole de validation et résultats

Preuves dans `artefacts/skull-vault/` (index : `artefacts/skull-vault/README.md`). Principe : **une valeur n'est consommée que si elle change des pixels**. Une valeur différente dans un JSON ne prouve rien.

## Protocole
- **Banc d'essai** (`vault-lab.ts`) : graine 3, tête **chauve** (sans cheveux la voûte se lit), éclairage rasant (azimut 300°, élévation 40°), cadre identique pour toutes les valeurs d'un paramètre. Seule la valeur change.
- **Trois valeurs** par paramètre : minimum, nominal, maximum (`vault-proof.ts`, source unique des tests et des planches). Nominal = 0 pour les mesures neutres, valeur de la graine pour les paramètres existants.
- **Six vues** : face, 3/4, profil, 3/4 arrière, dos, dessus. Les vues où l'effet est attendu viennent du registre (★ sur les planches).
- **Seuils fixés avant la mesure** : écart de silhouette ≥ 0,4 % de l'union, ou ≥ 0,5 % des pixels dont la luminance change de plus de 0,05. Exception : `asymFaceCoupling` (effet = dissymétrie de quelques mm) est jugé sur la dissymétrie de silhouette, seuil 0,1 %.
- **Preuve** = au moins une vue attendue où min ↔ max est perceptible **et** où min ↔ nominal ou nominal ↔ max l'est aussi.
- **Combinaisons** : `scalp` et `boneShow` filtrent le relief osseux, ils se prouvent avec les reliefs actifs ; `asymFaceCoupling` avec un visage asymétrique ; en passe 2, `browRidge` se prouve avec l'arcade active (`browArch` = 1, car il échelonne l'arcade), `asymMastoid` avec `mastoid` = 0,5 et `asymParietalHeight` avec `parietalBulge` = 1 (une asymétrie compare deux côtés : il faut qu'il y ait quelque chose à comparer).

## Couche de vérification de rendu (`verify-vault.ts`)
Valable pour toute combinaison, extrêmes compris (testé sur la tête nominale et des combinaisons extrêmes ; 18 familles et des tirages aléatoires dans `verification/`). La passe 2 ajoute ses contrôles dans `verify-vault-2.ts`, appelé par `verify-vault.ts` (ci-dessous).

| Couche | Contrôles |
|---|---|
| Géométrie | coupes valides (hauteurs croissantes, a ≥ 0, zf > zb, exposants ∈ [1,5 ; 3,3]) ; montée du sommet < 0,1 U ; relief ≤ 0,06 U ; saut entre échantillons voisins ≤ 0,014 U ; relief < 0,002 U près du plan de face, 0,05 U sous la glabelle **de la tête** |
| Anatomie | ordre vertex < front < glabelle < ptérion < mastoïde ; glabelle 0,03–0,2 U au-dessus de la ligne des yeux ; pariétal derrière le ptérion ; tempe 3–9× plus profonde que la glabelle ; sutures masquées par défaut ; occipital, mastoïdes, pariétaux visibles de dos |
| Style | contour de la **calotte** lisse (t < 0,31 U, dérivée seconde ≤ 0,06 U en face, profil, dos ; mesuré : 12 têtes de base ≤ 0,029, extrêmes ≤ 0,039) ; modelé et non bruit (énergie haute fréquence ≤ 0,075 ; mesuré : base ≤ 0,060, extrêmes ≤ 0,046) |

Visibilité et occlusion (`vault-visibility.ts`) : test de face puis lecture de l'image rendue sur 3×3 pixels (occluseur majoritaire : tête, oreille, sourcil, cheveux, nez, cou). Détail par structure : `verification/registre-placements.json`.

### Passe 2 (`verify-vault-2.ts`, `docs/SKULL-VAULT-2.md`)
| Couche | Contrôle ajouté | Borne et provenance |
|---|---|---|
| Géométrie | `vault.geo.symmetry` : reliefs de la voûte symétriques gauche/droite quand ni `asymWidth` ni `asymMastoid` ne sont demandés | écart maximal 0 (tolérance numérique 1e-9) |
| Anatomie | `vault.anat.arch.orbit` : axe de l'arcade (à 30°) au-dessus de la ligne des yeux | 0,03 – 0,2 U (même canon que la glabelle) |
| Anatomie | `vault.anat.eminence.between` : éminence frontale entre bregma et arcade | marge ≥ 0,05 U |
| Anatomie | `vault.anat.bun.level` : chignon entre lambda et inion | marge ≥ 0,1 U |
| Anatomie | `vault.anat.line.above` : crête temporale (à 76°) au-dessus du ptérion | 0,05 – 0,4 U |
| Anatomie | `vault.anat.parietal.anchor` : l'ancre du registre se déplace comme le sommet du relief (éminence nette, `parietalBulge` ≥ 0,3) | ≤ 1 (tolérance 0,05 U et 7,5°) ; mesuré sur 94 voûtes tirées + extrêmes : pire 0,034 U et 4,9° ; une ancre immobile ferait 0,06 U et 14° |
| Anatomie | `vault.anat.visible.front` / `.back` : éminence frontale, arcade, crête métopique tournées vers la caméra de face ; chignon de dos | 3 sur 3 ; 1 sur 1 |
| Style | `vault.style.silhouette.back` : contour postérieur de profil (t de 0,03 à 0,6 U) sans cassure | ≤ 0,037 ; mesuré : 12 têtes nominales ≤ 0,0243, extrêmes ≤ 0,0243 ; borne = 1,5 × le pire |
| Style | `vault.style.relief.curvature` : dérivée seconde du relief (pas 0,0125 U en y, 3° en azimut) | ≤ 0,024 ; mesuré : pire 0,0159 (extrême) ; borne = 1,5 × le pire |

Cette couche a trouvé trois défauts réels pendant la passe : des amplitudes trop raides une fois cumulées avec un cuir chevelu fin (transmission 1,6), une crête temporale doublée par `suturesShow`, et un contrôle d'ancre pariétale mal posé (il comparait le centre d'une gaussienne au sommet d'un champ modulé). Lire aussi le sens corrigé de `parietalHeight` dans `SKULL-VAULT-2.md`.

## Tests (`tests/skull-vault.test.ts`, `tests/skull-vault-2.test.ts`)
Paramètres neutres par défaut ; remappage vertical (monotone, C¹, inverse) ; registre (identifiants canoniques, parents direct et lointain, voisinage réciproque, aucun paramètre orphelin) ; tissus ; contraintes strictes / caricature / préférences ; corrélations ; effets mesurés (hauteur, largeur indépendante du visage, asymétrie propre, couplage) ; visibilité et occlusion ; couche de vérification ; preuve de 7 paramètres en direct + enregistrement complet (`verification/proofs.json`, **aucun paramètre sans effet perceptible**).

La passe 2 a ses tests dans `tests/skull-vault-2.test.ts` : formes pures, effet de chaque mesure dans sa région et nulle part ailleurs, nominal exactement nul, asymétries, ancre pariétale, contraintes et corrélations, couche de vérification (extrêmes, 24 tirages aléatoires, défaut injecté), preuve visuelle des 10 nouvelles mesures + `browRidge`.

## Résultats
| Paramètre | min | nominal | max | Meilleure vue | Silhouette | Ombre | Preuve |
|---|---|---|---|---|---|---|---|
| `frontalFlat` | -1 | 0 | 1 | dessus | 0.83 % | 12.22 % | ✓ |
| `frontalBreadth` | -1 | 0 | 1 | dessus | 0.07 % | 11.37 % | ✓ |
| `parietalBulge` | -1 | 0 | 1 | dos | 0.00 % | 3.01 % | ✓ |
| `parietalFlat` | -1 | 0 | 1 | face | 3.34 % | 6.59 % | ✓ |
| `cranialBreadth` | -1 | 0 | 1 | dessus | 12.81 % | 27.77 % | ✓ |
| `parietalConvexity` | -1 | 0 | 1 | profil | 0.00 % | 6.29 % | ✓ |
| `temporalFlat` | -1 | 0 | 1 | 3/4 | 2.01 % | 10.50 % | ✓ |
| `templeBreadth` | -1 | 0 | 1 | 3/4 | 2.28 % | 13.03 % | ✓ |
| `temporalHollow` | -1 | 0 | 1 | 3/4 | 0.22 % | 6.99 % | ✓ |
| `planeTransition` | -1 | 0 | 1 | dessus | 4.07 % | 18.17 % | ✓ |
| `occipitalFlat` | -1 | 0 | 1 | 3/4 arr. | 3.47 % | 12.00 % | ✓ |
| `occipitalSlope` | -1 | 0 | 1 | 3/4 arr. | 2.02 % | 15.94 % | ✓ |
| `mastoid` | -1 | 0 | 1 | 3/4 arr. | 0.38 % | 3.38 % | ✓ |
| `mastoidSize` | -1 | 0 | 1 | 3/4 arr. | 0.59 % | 4.22 % | ✓ |
| `mastoidDirection` | -1 | 0 | 1 | 3/4 arr. | 0.23 % | 2.32 % | ✓ |
| `mastoidSlope` | -1 | 0 | 1 | profil | 0.06 % | 1.22 % | ✓ |
| `parietalHeight` | -1 | 0 | 1 | dos | 0.00 % | 4.33 % | ✓ |
| `parietalAzimuth` | -1 | 0 | 1 | profil | 1.04 % | 4.54 % | ✓ |
| `glabella` | -1 | 0 | 1 | 3/4 | 0.28 % | 2.84 % | ✓ |
| `nuchalLine` | -1 | 0 | 1 | dos | 0.00 % | 6.08 % | ✓ |
| `suturesShow` | 0 | 0 | 1 | 3/4 arr. | 0.12 % | 2.97 % | ✓ |
| `asymParietal` | -1 | 0 | 1 | dessus | 1.54 % | 3.81 % | ✓ |
| `asymOccipital` | -1 | 0 | 1 | dessus | 2.17 % | 2.78 % | ✓ |
| `asymFrontal` | -1 | 0 | 1 | dessus | 0.01 % | 3.15 % | ✓ |
| `asymWidth` | -1 | 0 | 1 | dessus | 8.53 % | 22.82 % | ✓ |
| `asymFaceCoupling` | 0 | graine | 1 | dessus | 0.57 % | 0.00 % | ✓ |
| `frontalEminence` | -1 | 0 | 1 | dessus | 0.51 % | 13.70 % | ✓ |
| `browArch` | -1 | 0 | 1 | 3/4 | 0.48 % | 3.75 % | ✓ |
| `metopicRidge` | -1 | 0 | 1 | dessus | 0.42 % | 5.02 % | ✓ |
| `occipitalBun` | -1 | 0 | 1 | dos | 0.00 % | 14.03 % | ✓ |
| `inionSize` | -1 | 0 | 1 | dos | 0.00 % | 3.51 % | ✓ |
| `temporalLine` | -1 | 0 | 1 | 3/4 | 0.20 % | 3.73 % | ✓ |
| `temporalMuscle` | -1 | 0 | 1 | 3/4 | 0.08 % | 5.11 % | ✓ |
| `asterion` | -1 | 0 | 1 | profil | 0.00 % | 1.63 % | ✓ |
| `asymMastoid` | -1 | 0 | 1 | 3/4 arr. | 0.51 % | 3.71 % | ✓ |
| `asymParietalHeight` | -1 | 0 | 1 | dos | 0.00 % | 2.35 % | ✓ |
| `boneShow` | -1 | 0 | 1 | dessus | 1.50 % | 6.85 % | ✓ |
| `scalp` | 0.05 | graine | 0.95 | 3/4 | 0.86 % | 8.01 % | ✓ |
| `length` | -1 | graine | 1 | dessus | 10.42 % | 23.82 % | ✓ |
| `vaultHeight` | 0 | graine | 1 | profil | 12.21 % | 6.38 % | ✓ |
| `vaultPeak` | 0 | graine | 1 | 3/4 arr. | 1.78 % | 3.33 % | ✓ |
| `foreheadSlope` | 0 | graine | 1 | dessus | 2.82 % | 25.27 % | ✓ |
| `frontalBulge` | 0 | graine | 1 | dessus | 0.50 % | 13.48 % | ✓ |
| `browRidge` | 0 | graine | 1 | 3/4 | 0.39 % | 3.77 % | ✓ |
| `occiput` | 0 | graine | 1 | 3/4 arr. | 1.17 % | 9.74 % | ✓ |
| `inion` | 0 | graine | 1 | dos | 0.00 % | 2.81 % | ✓ |
| `zygoma` | 0 | graine | 1 | 3/4 | 3.42 % | 24.34 % | ✓ |
| `maxilla` | 0 | graine | 1 | profil | 8.34 % | 14.23 % | ✓ |

**Interactions** (grilles 3 × 3, cellules voisines perceptibles) : `cranialBreadth × vaultHeight` 12/12 ; `length × cranialBreadth` 12/12 ; `frontalFlat × frontalBreadth` 12/12 ; `occipitalFlat × occipitalSlope` 12/12 ; `temporalHollow × templeBreadth` 12/12 ; `parietalBulge × parietalFlat` 12/12 ; `mastoid × scalp` 5/12 ; `asymParietal × asymOccipital` 12/12 ; `browArch × glabella` 12/12 ; `frontalEminence × browArch` 12/12 ; `occipitalBun × occipitalFlat` 12/12 ; `temporalMuscle × temporalLine` 12/12 ; `browArch × browRidge` 12/12. `mastoid × scalp` reste faible : l'épaisseur du cuir chevelu ne fait qu'atténuer un relief fin. Les cellules contraintes (`occipitalFlat × occipitalSlope`, `temporalHollow × templeBreadth`, et en passe 2 `occipitalBun × occipitalFlat`) comptent une correction stricte, sans effet sur la perceptibilité des voisines.

**Familles** : 18 combinaisons (13 de la passe 1, 5 de la passe 2), 0 échec de la couche de vérification. **Tirages aléatoires** (`generateRandomProfile(seed, { vault })`) : 12 têtes avec les nouvelles mesures, 0 échec ; en passe 2, 24 têtes supplémentaires (variété 0,9, tendances 0,5), 0 échec (`artefacts/skull-vault-2/verification/aleatoire-passe2.json`).

**Non prouvés visuellement ici** : volume de cheveux 3D de l'hôte (lit `skullSurfacePoint`, chaîne hôte non exercée) ; `thyroid`, `napeHairline` et `neck*` (hors voûte, aucun effet sur la tête chauve).

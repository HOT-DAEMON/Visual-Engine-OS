# PERF-4 — vérification géométrie / anatomie / style et paramètres consommés

## `figureEquivalence` (`src/verify/figure-equivalence.ts`)

Compose, pour prouver qu'une approximation de vitesse ne dégrade pas la figure, les trois couches du moteur :
- **pixels** : `measureEquivalence` / `equivalenceChecks` de `render-equivalence.ts` (corrélation de contours, silhouette, traits sombres, couleur moyenne, contraste, grain) —
  bornes calibrées au dépôt, **inchangées** ;
- **géométrie** : le champ de relief de la tête est IDENTIQUE (l'approximation ne touche que la lumière) ;
- **anatomie** : part éclairée de chaque zone de la tête (gauche, droite, haut, bas, orbite, cou, ombre sous le menton) : écart ≤ `LIT_ZONE_TOL` = 0,02 ;
- **style** : part d'ombre du visage et de pénombre : écart ≤ `LIT_STYLE_TOL` = 0,02.
Les deux tolérances ont été fixées AVANT la mesure ; 20 vérifications par figure.

## `headCastScale` (option, défaut 1 = exact)

Ombre portée de la tête sur grille ×2 (`castShadowScaled`, déjà utilisée pour le corps et ×4 par la tête 3D). `head.cast` : 427 → 95 ms (600 px) ; figure : 2 441 → 2 073 ms à froid,
1 036 → 676 ms si seule la lumière change.
- **×2 est revendiqué** : 3 personnes × 3 lumières = 9 configurations, 0 échec (`tests/figure-approx-verified.test.ts`). **Marge la plus serrée** : adulte féminine, lumière 200°/60°, traits sombres 0,9899 pour une borne de 0,985 (les contours restent ≥ 0,9994 et la silhouette vaut 1,00000 sur cette personne).
- **×4 n'est PAS revendiqué** : 1 configuration sur 9 dépasse la borne des traits sombres (0,9696 < 0,985, adulte féminine, lumière 200°/60°).
- Contrôles négatifs (les bornes ne sont pas vacuement larges) : une lumière tournée de 40° échoue ; une image décalée de 3 px échoue.
- Image : `artefacts/figure-perf/03-tete-ombre-x1-x2-verification.png` (différence ×10 : uniquement de fines lignes de pénombre).

## Paramètres de la figure consommés et localisés (`tests/figure-params-consumed.test.ts`, 18 tests)

Chaque paramètre est modifié seul ; le test prouve OÙ l'image change et où elle ne doit pas changer (`artefacts/figure-perf/04-…png`).

| Paramètre | Tête | Corps |
|---|---|---|
| azimut, élévation, dureté, taille de source, intensité, style cel2 / cel3, peau | change | change |
| `ao`, `groove`, `shadowReach`, `quality`, `camera.yaw`, `ss`, `heightPx` | inchangée | change |
| `headPpu` (grille de la tête) | change | **mineur** : seulement le bord de l'ombre portée par la tête (< 1 % des pixels) |
| `headCastScale` | change | inchangé |

Constats consignés : (1) `headPpu` agit légèrement sur le corps, car la tête est l'occulteur de l'ombre sur le cou et la poitrine : couplage légitime, borné et testé.
(2) Le paramètre `skin` de `litFigure` recolore le corps et les teintes de la couche d'éclairage, PAS le visage (sa peau de base vient du SVG de la scène) : l'appelant doit passer la
même peau au visage et à la figure. (3) Les options `ao`, `reach` et `fadeNeck` de `HeadLitOpts` ne sont PAS atteignables depuis `litFigure` : elles ne sont pas exposées, donc pas
consommées par ce pipeline (voir `PERF-4-REMAINING.md`).

Portée : ces preuves couvrent les paramètres de la FIGURE (lumière, rendu, cadrage, grilles). Les paramètres de forme du crâne et de ses voisins (mâchoire, cou, épaules) relèvent des
contrats et vérifications existants (`anatomy-contract`, `skull-axes`, `neck-junction`) ; ils n'ont pas été re-balayés ici.

# PERF-4 — couches à clés de dépendance et preuves d'exactitude

## Principe

`litFigure` était monolithique : un changement de lumière refaisait tout. Il est découpé en couches pures ; chacune est mise en cache sous une clé qui nomme EXACTEMENT ses
dépendances (`src/perf/layers.ts` : `LayerCache` LRU borné, compteurs d'appels / réutilisations / temps par couche, `clearLayerCaches`). Les valeurs en cache sont des tampons
IMMUABLES (vérifié : aucun appelant n'écrit dans le champ de relief ni dans l'ombre de la tête).

## Corps (`src/body/volume/`) — `pixel.ts` n'est plus qu'un orchestrateur

| Couche | Fichier | Dépend de | Ne dépend PAS de | Cache |
|---|---|---|---|---|
| G-buffer (maillage, profondeur, normales, θ, paliers) | `gbuffer.ts` | jeu de volumes, caméra, `showHidden/level/hideFromLayer/joints/trunkOnly/forceTier`, `quality`, `ss`, `heightPx` | lumière, peau, AO, rainures | 2 entrées |
| Occlusion + rainures | `occlusion.ts` | G-buffer | tout le reste | 2 entrées |
| Ombre portée du corps | `shade-pixels.ts` (`bodyCast`) | G-buffer, direction et douceur de la lumière, occulteur (`proxyKey`), `shadowReach` | peau, style | 4 entrées, si l'occulteur est nommé |
| Ombrage par pixel + sur-échantillonnage + PNG | `shade-pixels.ts` | tout | — | jamais |

## Tête (`src/relief/overlay.ts`)

| Couche | Dépend de | Ne dépend PAS de |
|---|---|---|
| champ de relief (`head.field`) | paramètres du visage, repères, nez, grille (`ppu`), `zc`, `neckAxisZ` | lumière, peau |
| occlusion ambiante (`head.ao`) | champ, rayon et portée (liés à la largeur) | lumière, peau |
| ombre portée (`head.cast`) | champ, direction, portée, pénombre, `castScale` | peau |
| couche d'éclairage (PNG multiply / screen) | tout | jamais en cache |

Clé de la tête = SHA-1 de `canonical([p, lm, nose, grille, zc, neckAxisZ])` (contenu complet, aucune hypothèse de dérivation). `HeadLit.key` nomme l'occulteur « tête » : l'ombre du
corps est en cache par contenu (`proxyKey`). **Contrat** : le jeu de volumes est désigné par son IDENTITÉ (`idOf`) ; `bodyVolumes` est pur ET mémoïsé par contenu (mêmes entrées → même objet) ; `tests/figure-immutable.test.ts` prouve que le moteur ne le
modifie pas (jeu gelé en profondeur rendu sans erreur, tampons de la tête inchangés après des rendus suivants). Un appelant externe qui le muterait n'est pas empêché (`PERF-4-REMAINING.md`). Mémoire : un G-buffer pèse ≈ 43 octets/pixel (≈ 100 Mo à 1 100 px) → 2 entrées au plus.

## Optimisations EXACTES (même résultat au bit près)

- `castShadow` : tables par pas calculées une fois (même expressions, même ordre) ; **borne d'arrêt exacte** : aucun pixel n'est plus profond que `dmax` et `z + pente·t` ne fait
  que croître avec le pas ; dès que `dmax − base − bias ≤ 0`, tous les pas suivants donnent `ex ≤ 0` (l'arrondi flottant est monotone) → ils n'auraient rien changé. 817 → 427 ms.
- `ambientOcclusion` (tête) et `occlusionOf` (corps) : 16 décalages précalculés, plus aucun tableau créé par pixel. 312 → 87 ms ; occlusion corps ≈ 370 → 150 ms.
- `shaderOf(m)` (`src/relief/model.ts`) : `shadeAt` sans allocation, invariants du modèle (demi-angle normalisé, exposant spéculaire, largeur du terminateur) calculés une fois ;
  `shadeAt` reste la définition de référence. `tone` (ancien éclairage) n'est plus calculé quand le modèle de lumière le rend inutile. Ombrage du corps 483 → 200 ms.
- Rasterisation du G-buffer : constantes de triangle sorties de la boucle pixel.
- `occ` reste en `Float64Array` : c'est la valeur exacte de l'ancien calcul en ligne ; un `Float32Array` l'aurait arrondie et décalé des pixels.

## Preuves

| Preuve | Où | Ce qu'elle établit |
|---|---|---|
| 7 empreintes SHA-1 (SVG, pixels du corps, champs `lit` et `cast` de la tête), à froid puis couches chaudes | `tests/figure-layers.test.ts`, `tests/fixtures/figure-golden.json` | égalité octet pour octet avec l'ancien rendu (7 configurations : 6 morphologies/lumières/styles cel/caméra de côté/qualité rapide/grille de tête + ancien éclairage) |
| 120 champs aléatoires × lumières × options, `castShadow` et `ambientOcclusion` | `tests/cast-exact.test.ts`, oracle figé `tests/helpers/cast-ref.ts` | égalité bit à bit avec l'ancien code |
| 3 styles × 40 lumières × 2 000 normales, `shaderOf` vs `shadeAt` | `tests/shader-exact.test.ts` | égalité bit à bit |
| Contrôle négatif : borne d'arrêt décalée de 3 | exécuté à la main | le test d'exactitude ÉCHOUE (cas n° 1), puis repasse une fois le code restauré |
| Avant/après réel, ancien code en worktree `ddbbad4` | `artefacts/figure-perf/01-…png`, `mesures.json` | 0 pixel différent sur 754 560 |
| Réutilisation des couches | `tests/figure-budget.test.ts` | changer seulement la lumière : relief, AO, G-buffer, occlusion réutilisés (0 calcul) ; ombres et ombrage refaits |

La référence figée contient le SVG de scène APRÈS la correction des identifiants (`PERF-4-GUARD.md`), validée séparément par la régression visuelle du dépôt.

## Coût par couche (1 100 px, à froid)

`head.field` 303 ms · `head.cast` 396 · `head.ao` 87 · `body.gbuffer` 750 · `body.occlusion` 150 · `body.cast` 133 · `body.shade` 200 · `body.encode` 47. Le G-buffer est le premier poste restant.

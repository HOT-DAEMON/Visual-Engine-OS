# PERF-4 — vitesse de la figure complète (tête + cou + corps) avec preuves

Suite de `PERF.md` / `PERF-2.md` / `PERF-3.md`. Cible : `litFigure` (`src/relief/figure.ts`), le pipeline qui rend la tête de face, le cou et le corps entier éclairés.
Détails : couches et preuves d'exactitude → `PERF-4-LAYERS.md` ; garde `resvg` et identifiants → `PERF-4-GUARD.md` ; vérification et paramètres → `PERF-4-VERIFY.md` ;
ce qui n'est PAS fait → `PERF-4-REMAINING.md`. Preuves visuelles : `artefacts/figure-perf/` (6 images + `mesures.json`).

## Où partait le temps (mesuré, 1 cœur, figure à 1 100 px)

| Étape | Avant | Remarque |
|---|---|---|
| `litFigure` complet | ≈ 3,5–3,9 s | tête ≈ 1,4 s, corps ≈ 2,1 s |
| rastérisation `resvg` | 127 ms (380 px) | PAS le goulot : tout le coût est du calcul JS par pixel |
| `castShadow` (ombre portée par marche de rayon) | 24 % du profil | 817 ms par lumière pour la tête seule |
| ombrage par pixel du corps + `shadeAt` | ≈ 20 % + 7 % | objets alloués par pixel (GC 6–10 %) |
| occlusion ambiante | 8 % | tableaux créés par pixel |
| flous « boîte » du JS | 1,3 % | négligeables |

## Résultat (même machine, médiane de 3, `scripts/bench-render.ts`, section `figure`)

| Cas | Avant | Après |
|---|---|---|
| premier rendu d'un personnage (à froid) | 3 848 ms | **2 441 ms** (−37 %) |
| seule la lumière change (relief, AO, G-buffer, occlusion réutilisés) | 3 848 ms | **1 036 ms** (÷ 3,7) |
| balayage de 6 lumières | ≈ 21 s | ≈ 8,5 s |
| option `headCastScale: 2`, à froid / lumière seule | — | 2 073 ms / 676 ms |

**Le rendu par défaut est identique octet pour octet** à l'ancien : 0 pixel différent sur 754 560 (`artefacts/figure-perf/01-avant-apres-identiques.png`, ancien code
rendu depuis un worktree de `ddbbad4`) et 7 empreintes SHA-1 figées (`tests/figure-layers.test.ts`). Seule `headCastScale: 2` est une approximation, opt-in, vérifiée.

## Les quatre demandes

1. **Garde `resvg` + identifiant dupliqué** : faits, avec tests et contrôles négatifs → `PERF-4-GUARD.md`.
2. **Couches à clés de dépendance + identité au pixel** : fait pour le corps et la tête → `PERF-4-LAYERS.md`.
3. **Budgets par composant dans le banc existant** : `src/perf/budget.ts` (unités de calibration, indépendantes de la machine), `tests/figure-budget.test.ts`,
   section `figure` de `scripts/bench-render.ts`. Un composant sans budget déclaré fait échouer le test.
4. **Flous → textures précalculées** : MESURÉ, NON IMPLÉMENTÉ, avec la raison chiffrée → `PERF-4-REMAINING.md`. À la place, une approximation éprouvée du dépôt
   (ombre de la tête sur grille ×2) est proposée en option, avec la couche de vérification géométrie / anatomie / style → `PERF-4-VERIFY.md`.

## Reproduire

```
npx vitest run tests/figure-layers.test.ts tests/cast-exact.test.ts tests/shader-exact.test.ts tests/pathbox-equiv.test.ts tests/core-defs.test.ts \
  tests/offcanvas.test.ts tests/figure-budget.test.ts tests/figure-approx-verified.test.ts tests/figure-params-consumed.test.ts tests/figure-immutable.test.ts
npx tsx scripts/bench-render.ts 3                 # coûts par couche vs budgets + temps réels (écrit artefacts/perf/bench.json)
git worktree add /tmp/orig ddbbad4 && ln -s $PWD/node_modules /tmp/orig/node_modules && npx tsx scripts/artefacts-figure-perf.ts
npx tsx scripts/figure-golden.ts                  # SEULEMENT pour re-figer la référence après un changement de rendu VOULU
```

## Fichiers (tous neufs sauf mention ; aucun doublon d'un fichier existant)

`src/core/{defs,affine,offcanvas}.ts` · `src/perf/{layers,budget}.ts` · `src/body/volume/{gbuffer,occlusion,shade-pixels}.ts` · `src/verify/figure-equivalence.ts`.
Modifiés : `src/core/pathbox.ts`, `src/compile.ts`, `src/body/volume/pixel.ts` (orchestrateur), `src/relief/{cast,model,overlay,figure}.ts`, `src/perf/index.ts`,
`scripts/lib/raster.ts`, `scripts/render.ts`, `scripts/bench-render.ts`. Les références (images) servent à vérifier le moteur existant : aucun moteur nouveau n'a été créé.

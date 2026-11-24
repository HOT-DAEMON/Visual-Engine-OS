# CHANGELOG-26 — vitesse de la figure complète (feat/hair-grammar)

- fix : plantage natif de `resvg` (calque `clip-path` / filtre / opacité entièrement hors cadre) → `cullOffCanvas` (`src/core/offcanvas.ts`, `affine.ts`), contrôle négatif en processus enfant.
- fix : identifiants `id` dupliqués dans `<defs>` (58 visages sur 60) → `dedupeDefs` (`src/core/defs.ts`) à l'assemblage de `compile.ts` ; aucun pixel ne change.
- perf : `pathBox` sans regex (43 → 21 ms) ; égal à l'ancienne, sauf nombres à exposant (écart voulu, testé).
- perf : figure en couches à clés de dépendance (G-buffer, occlusion, ombre, ombrage ; relief, AO, ombre de la tête) ; `src/perf/layers.ts` (cache LRU borné, compteurs).
- perf : `castShadow`, `ambientOcclusion`, `occlusionOf`, ombrage du corps et de la tête exacts et sans allocation par pixel (`shaderOf`). À froid 3 848 → 2 441 ms ; lumière seule → 1 036 ms.
- feat : `headCastScale` (ombre de la tête ×2, opt-in, vérifiée) ; `figureEquivalence` (`src/verify/figure-equivalence.ts`) ; budgets par composant (`src/perf/budget.ts`) et section `figure` de `scripts/bench-render.ts`.
- tests : `pathbox-equiv`, `core-defs`, `offcanvas`, `figure-layers`, `cast-exact`, `shader-exact`, `figure-budget`, `figure-approx-verified`, `figure-params-consumed`, `figure-immutable`.
- scripts : `figure-golden.ts`, `artefacts-figure-perf.ts`. Artefacts : `artefacts/figure-perf/`. Docs : `PERF-4.md`, `-GUARD`, `-LAYERS`, `-VERIFY`, `-REMAINING`.

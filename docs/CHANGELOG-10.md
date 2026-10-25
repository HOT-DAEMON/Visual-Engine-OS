# CHANGELOG-10 — vitesse de génération (feat/render-speed)

- perf : polices système désactivées à la rastérisation (−65 ms/rendu), pixels identiques.
- perf : `feTurbulence` remplacé par une tuile PNG pré-calculée (`src/noise`) ; mode `turbulence` conservé comme référence exacte.
- perf : pré-filtre par boîtes pour `boxCoverage`/`coverageOf` ; `num()` et `canonical()` accélérés (tests d'équivalence).
- perf : régions de flou des ombres de contact réduites à la zone réceptrice.
- fix : clé du cache de scène incluant le mode de bruit.
- sécurité : `feImage` autorisé uniquement pour des data-URI PNG ; `href` interdit ailleurs.
- vérification : `src/verify/render-equivalence.ts` (géométrie, anatomie, style) + `scripts/verify-equivalence.ts` avec contrôles négatifs.
- tests : `noise-tile`, `svg-num`, `canonical`, `raster-fonts` (+ 4 fichiers). Références visuelles réécrites (34).
- docs : `PERF-2.md`, `PERF-2-REMAINING.md`. Artefacts : `artefacts/perf-2/`.

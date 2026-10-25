# PERF-2 — ce qui reste à faire (par composant)

| Composant | Constat mesuré | Reste à faire |
|---|---|---|
| Analyse SVG (constructeur resvg) | ≈ 50 % du rendu à 170 px une fois les polices retirées ; SVG ≈ 340 ko dont 284 ko de `<path>` | dédupliquer les tracés identiques (`<use>` ou clips partagés : ≈ 82 ko de doublons, 395 `d` distincts sur 512) — nécessite d'autoriser `use` dans la liste blanche ; envisager une précision de 2 décimales pour les cheveux (change les références) |
| Flous de la couche structure (`render/face/soft.ts`) | 57 filtres, aire cumulée ≈ 3,3× le canevas à 340×420 | regrouper les flous de même σ, ou rendre à résolution réduite (non prouvé exact : à mesurer avec `verify-equivalence`) |
| `verifyFace` | 226 ms/face (> rastérisation) : `geometryDigest` appelé 6× (21 ms), `checkStructure` 30 ms | mémoïser le digest par paramètres ; utiliser `compileSceneCached` dans la vérification (gain seulement pour les vérifications répétées) |
| Campagne multi-cœur | `JOBS` existe, gain non chiffré (1 cœur) | mesurer sur ≥ 4 cœurs ; envisager `worker_threads` (évite le coût de démarrage des processus) |
| Cheveux simulés (600×700) | ≈ −30 % mesuré par ablation, pas par le banc A/B final | ajouter une famille « cheveux simulés » à `bench-perf2.ts` |
| Tuile de bruit | grain 0,87–1,01 de la référence | essayer ×4 d'échantillonnage (≈ 87 ko base64) ou aligner l'origine sur la grille de pixels si la transformation est entière |
| Références visuelles | réécrites sans relecture humaine complète | relire `references/visual/` au prochain passage |
| PR | non ouverte (comme les branches précédentes) | ouvrir `feat/render-speed` → `main` après relecture |

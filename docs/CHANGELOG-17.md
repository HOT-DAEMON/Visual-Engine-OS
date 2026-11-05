# Changelog 17 — lisière des cheveux sur la surface du crâne (branche `feat/hair-grammar`)

- **Lisière** (`src/face/hair/boundary/`) : boucle fermée `front / sideburn / ear / nape` sur la surface du crâne (hauteur, azimut), exposée par `HairGeometry.boundary`. `docs/HAIR-BOUNDARY.md`.
- **Câblage** : l'implantation du moteur = tronçon `front` ; la patte partage `sideburnProfile` avec le garde-fou ; coque (`shell.ts`) et mèches de flanc (`wings.ts`) bornées par la lisière ; transition peau / cheveux rendue le long de la chaîne complète (`hair-detail.ts`) avec style de bord (`edge-style.ts`).
- **Défaut corrigé** : l'implantation sortait du contour (jusqu'à 1,535 × la demi-largeur, graine 10310) → `onSkull` (`hairline.ts`), maximum 0,985.
- **Rotation et vent (interfaces)** : `projectBoundary`, `rootFrames`, `windDir`. Rendu tourné et intégration du vent non branchés.
- **Vérification** (`src/verify/hair-boundary.ts`) : 15 contrôles (5 géométrie, 7 anatomie, 3 style) dans `verifyFace` ; 600 visages, 0 échec ; 8 contrôles négatifs.
- Tests : `tests/hair-boundary.test.ts` (59). Suite (après fusion avec `327f2b9`) : 95 fichiers, 2579 verts. `tsc` propre, `npm run regress` sortie 0 (aucune référence modifiée).
- Artefacts : `artefacts/hair-boundary/` (planches 01–08 + `avant/`, `README.md`), `npx tsx scripts/artefacts-hair-boundary.ts`.
- Reste à faire : `docs/HAIR-BOUNDARY-REMAINING.md`.

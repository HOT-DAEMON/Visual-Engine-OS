# Journal 6 — moteur de structure du visage (nez, mandibule, menton, tissus mous, bouche, déformations, stylisation)

Branche `feat/face-structure` (partie de `feat/face-anatomy`). Cahier des charges : `docs/TODO-FACE-SPEC.md`. Vue d'ensemble : `docs/FACE-STRUCTURE.md`.

## Schéma (contrats)
- `FaceParams` gagne `anatomyEngine` (`classic` | `structured`), `mandible`, `softTissue`, `cheek`, `deform` (`articulation`, `expression`), `stylization`, `renderMode`.
- Nez : `sidewall`, `domes`, `groove`, `base`, `columella`, `philtrum`, `nostrils.opening`, `nostrils.rim` (`face-nose-regions.ts`).
- Menton : `form`, `symphysisWidth`, `symphysisDepth`, `dimple`, `groove`, `upperBlend`, `lateralBlend`, `lowerBlend`. Cou : `cervicomentalDeg`, `thickness`, `muscles`, `platysma`, `chinCoupling`.
- Bouche : `cupid`, `cornerAsym`, `lineWave`, `teeth`, `gums`, `tongue`, `cavity`, `cornerFolds`, `fit`.
- Tous les défauts sont neutres : le rendu `classic` est identique octet pour octet (test).

## Géométrie
- `face/jaw/structure.ts` : silhouette = os + muscle + graisse ; angle effectif ; forme continue du menton ; poignées du corps et du ramus.
- `face/nose/{constraints,regions,regions-types}.ts`, `face/structure/*`, `face/mouth/*`, `face/deform/*`, `face/stylize/*`.
- Largeur de base du nez : déplace le pied de l'aile (`alae.ts`) ; pente des parois : `dorsum.ts` ; contour : `contour.ts` lit `jawSilhouette`, `chinShape`, `bodyHandle`, `ramusHandle`.

## Rendu
- `render/face/structure/*` (tissu, nez, menton, bouche, plis, cou, contours, filtre d'encrage) branchés dans `faceParts` ; la bouche structurée remplace la bouche classique.
- Modes de rendu `realistic` / `anime` / `ink` ; liste blanche SVG étendue (`feFuncR/G/B`, `tableValues`).

## Génération
- `generateRandomFace(seed, { structure })` : tirage dans un flux dérivé (`seed ^ 0x5bd1e995`) ; `applyStylization` appliqué après le parse.

## Vérification et tests
- `verify/structure.ts` (3 couches) branché dans `verifyFace` ; `scripts/lib/verify-render.ts` (mesures sur pixels).
- Nouveaux tests : `face-nose-regions`, `face-structure`, `face-chin-cheek-neck`, `face-mouth`, `face-deform`, `face-stylize`, `face-structure-render`, `face-structure-verify` (dont mutations).

## Artefacts
- `artefacts/face-structure/` : planches 01–14 + `README.md` ; script `scripts/artefacts-face-structure.ts`.

## Erreurs et reste à faire
- `docs/ERRORS-5.md` ; `docs/FACE-STRUCTURE-STATUS.md`.

## Résultat final
- Suite complète : 43 fichiers, 2028 tests passent ; `tsc --noEmit` propre.
- Artefacts : 14 planches dans `artefacts/face-structure/` (rendues après les corrections nos 15 à 18 de `ERRORS-5.md`).

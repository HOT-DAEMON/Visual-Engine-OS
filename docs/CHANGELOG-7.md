# Journal — moteur d'oreille et zones du visage (branche `feat/ear-system`)

Base : `feat/face-structure`. Tâche : `docs/TODO EAR SYSTEM.md` + `-2.md`, plus : zones du visage (implantation, front, nez, philtrum, menton) et oreilles alignées.

## Zones du visage (`docs/FACE-ZONES.md`)
- `face/zones-limits.ts` (bornes), `face/zones.ts` (sept zones + frontière d'implantation), `verify/zones.ts`.
- Nez abaissé (plancher 0,17 H), philtrum plafonné (0,115 H) et plancher (0,06 H), zone du menton définie, front mesuré par rapport au crâne.
- Appliqué au moteur `structured` seulement ; `classic` identique (test).

## Moteur d'oreille (`docs/EAR-SYSTEM.md`, `-2.md`)
- Schéma `schema/face-ear.ts`, familles, mélange, résolution, contour C01–C07, onze structures + extensions, contraintes strictes.
- Placement : racine de l'hélix sur la ligne des yeux, bas du lobule sur la ligne de la bouche (mesuré, ≤ 0,5 px).
- Quatre vues d'un même modèle (invariant : mêmes ordonnées), éclairage de relief, matériaux (7), styles (réaliste / anime), bijoux, visibilité sous les cheveux.
- Couche de vérification géométrique / anatomique / style (`verify/ear.ts`), branchée dans `verifyFace`.
- `core/svg.ts` : `feDiffuseLighting`, `feSpecularLighting`, `feDistantLight` + attributs d'éclairage ajoutés à la liste blanche (primitives inertes).

## Changements d'API / comportement
- `FaceEars` étendu (champs anciens inchangés). `earGeometry` : `model`, `placement`, `front`, `align` en plus. `renderEars(p, lm, skin, ra, L?, defs?)`.
- `hair/sides.ts` : zone d'oreille = silhouette réelle (moteur `morphology`).
- Contrat `ear` : dépend aussi de `mouth` et `mandible`. Balayage de monotonie `nose.length` : 0,17 → 0,26.

## Tests
- Nouveaux : `ear-zones`, `ear-model`, `ear-views`, `ear-verify` (dont deux contrôles négatifs). Références visuelles : 17 cas difficiles réécrits après revue.

## Artefacts
- `artefacts/ear-system/` : 12 planches + `verification.md` ; script `scripts/artefacts-ear.ts`.

## Reste à faire
- `docs/EAR-REMAINING.md` (par composant). Erreurs : `docs/ERRORS-6.md`.

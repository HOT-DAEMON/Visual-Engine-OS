# Moteur de structure du visage (`anatomyEngine: 'structured'`)

Réponse aux tâches T1–T16 de `docs/TODO-FACE.md` (cahier des charges fidèle : `docs/TODO-FACE-SPEC.md`).
Suites : `FACE-STRUCTURE-NOSE.md`, `FACE-STRUCTURE-JAW.md`, `FACE-STRUCTURE-MOUTH.md`, `FACE-STRUCTURE-DEFORM.md`, `FACE-STRUCTURE-STYLE.md`, et l'état d'avancement `FACE-STRUCTURE-STATUS.md`.

## Principe

Le visage `classic` (avant cette tâche) reste le défaut et n'a pas changé d'un octet (test : `tests/face-structure-render.test.ts`, « valeur neutre = rendu classique identique »).
Le moteur `structured` s'active avec `FaceParams.anatomyEngine = 'structured'` (ou `generateRandomFace(seed, { structure: true })`). Il ajoute :
des RÉGIONS nommées (géométrie pure) → des CALQUES de rendu qui les lisent → une VÉRIFICATION qui les mesure. Chaque région est un polygone, une ellipse molle ou une polyligne exposée ;
rien n'est dessiné « à côté » de la géométrie.

## Contrats de composants (le « qui lit quoi »)

| Composant | Contrat (schéma) | Géométrie (pure) | Rendu | Vérification |
|---|---|---|---|---|
| Nez, régions | `schema/face-nose-regions.ts` | `face/nose/regions.ts`, `constraints.ts` | `render/face/structure/nose.ts` | `verify/structure.ts` |
| Mandibule, menton | `schema/face-structure.ts`, `face-jaw.ts` | `face/jaw/structure.ts`, `face/structure/{mandible,chin}.ts` | `structure/tissue.ts`, `chin.ts` | idem |
| Tissus mous, joues | `schema/face-structure.ts` | `face/structure/tissue.ts` | `structure/tissue.ts`, `folds.ts` | idem |
| Cou | `schema/face-extras.ts` (`neck.*`) | `face/structure/neck.ts` | `structure/neck.ts` | idem |
| Bouche | `schema/face.ts` (`mouth.*`) | `face/mouth/geometry.ts` | `structure/mouth.ts` | idem |
| Dépendances | — | `face/structure/dependencies.ts` | — | `tests/face-structure.test.ts` |
| Déformations A/B/C | `schema/face-deform.ts` | `face/deform/*` | `structure/folds.ts` | `tests/face-deform.test.ts` |
| Stylisation | `schema/face-style.ts` | `face/stylize/*` | `structure/ink.ts`, `ink-filter.ts` | `verify/structure.ts` (couche style) |

Chaque fichier source commence par un commentaire de contrat (entrées, sorties, invariants) et commente chaque étape de calcul.

## Ordre de calcul (une passe, sans état)

1. `FaceParams.parse` → `applyStylization` (profil « cuit » une fois, idempotent, neutre par défaut) ;
2. `faceLandmarks` (contour, repères, mâchoire) — lit `jawSilhouette` (os + muscle + graisse) et `chinShape` ;
3. `noseGeometry` → `regions` (après `resolveNoseConstraints`) ;
4. `structureGeometry` : dépendances → mandibule → menton → tissus → cou ;
5. `mouthGeometry` (lit l'expression, la pose de la mandibule, le champ de tissu) ;
6. `renderStructure` : calques classés par emplacement (`tissue`, `noseRegions`, `mouth`, `after`, `neck`) ;
7. `verifyFace` → `checkStructure` (3 couches) ; `scripts/lib/verify-render.ts` mesure l'image.

## Neutralité et migration

Tous les nouveaux axes ont un défaut NEUTRE : changer `anatomyEngine` ou toucher un axe n'affecte que ce que l'axe annonce.
Les modifications de géométrie héritée sont minimes et vérifiées : `jawWidth` devient la largeur OSSEUSE (silhouette = os + muscle + graisse,
égale à l'os tant que muscle et graisse valent 0) ; la symphyse est continue (`chin.form`, `null` = anciennes valeurs exactes) ; la largeur de base du nez
déplace seulement le pied de l'aile (défaut 0 = ancienne valeur).

## Commandes

- Tests : `npx vitest run tests/face-nose-regions.test.ts tests/face-structure.test.ts tests/face-chin-cheek-neck.test.ts tests/face-mouth.test.ts tests/face-deform.test.ts tests/face-stylize.test.ts tests/face-structure-render.test.ts tests/face-structure-verify.test.ts`
- Artefacts : `npx tsx scripts/artefacts-face-structure.ts [01 … 14]` → `artefacts/face-structure/` (voir son `README.md`).

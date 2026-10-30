# Changelog 15 — moteur de corps : tronc, épaules, membres supérieurs (branche `feat/hair-grammar`)
- `src/body/` : schéma strict (4 axes indépendants + charpente + pose de chaque bras), canon par âge, cadre en px avec Résolveur (corrections consignées), 279–285 atomes hiérarchiques,
  cinématique plane des bras, main complète (5 doigts × 3 segments, articulations, ongles/pulpes, plis, tendons, interosseux, métacarpiens, carpe), rendu SVG sans filtre en 4 niveaux de présentation.
- Contrats `contracts.ts` (13 composants), testés par perturbation de chacun des 51 paramètres + un test de contrat menteur.
- Vérification `src/verify/body.ts` : 3 couches (géométrie, anatomie, style), ~30 contrôles par corps ; 325 corps → 9 600 contrôles, 0 erreur, 0 avertissement.
- Garde-fou mineurs : aucun atome de sein avant 18 ans ; sexe sans effet avant la puberté (testé atome pour atome).
- Perf : SVG 225 → 128–131 Ko (−42 %), rastérisation du corps seul 115 → 88–100 ms à toile égale (≈ −15 à −24 %) ; recadrage −26 % en moyenne (−55 % bébé, −23 % adulte) ; SVG à chaud 0,06 ms ; visage (≈ 130 ms) non traité, donc pas de gain « drastique » global (`BODY-PERF.md`).
- Tests : `tests/body-{contracts,geometry,verify,render}.test.ts` (42 tests). Suite complète lancée avec 40 d’entre eux : 81 fichiers / 2 356 tests verts ; les 2 tests ajoutés ensuite (SVG mémoïsé, recadrage) relancés avec les 4 fichiers du corps : 42/42.
- Scripts : `artefacts-body.ts` (8 planches + 3 JSON), `bench-body.ts`. Artefacts : `artefacts/body-upper-limb/`.
- Docs : `BODY.md`, `BODY-CANON.md`, `BODY-ATOMS.md`, `BODY-VERIFY.md`, `BODY-PERF.md`, `BODY-REMAINING.md`, `ERRORS-10.md`. `verify/index.ts` exporte `verifyBody`.

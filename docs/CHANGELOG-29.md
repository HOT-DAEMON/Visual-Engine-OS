# CHANGELOG-29 — passe 11 du moteur capillaire : coupes hime et pixie, mesure des références (feat/hair-grammar)

- feat : profils `HIME` et `PIXIE` (`src/hair-grammar/profiles/`), exportés par `src/hair-grammar/index.ts`. Données seulement : même générateur, peinture, `repairCycle`, vérification G/A/S.
- feat (moteur, additif) : `FamilySpec.widthProg` optionnel, recopié sur chaque mèche par `sampleLock` (le profil `flat` de `width-program.ts` devient utilisable par une famille : frange à bord franc).
- feat (outils) : `scripts/hair-grammar/render-masks.ts` et `measure-cuts.py` : un seul estimateur pour références et rendus du moteur (unité H).
- verif : 43/48 valides (hime 22/24, pixie 21/24, 8 graines × lacets 0°, ±30°) ; 5 échecs documentés, aucun seuil assoupli.
- constats : carré ≈ 35 % trop petit vs réf. 06 ; pixie fidèle à la réf. 32 bloqué par `anat.dome` (non modifié). Voir `HAIR-PASS11-REMAINING.md`.
- tests : `hair-grammar-cuts-pass11` (16 tests). Docs : `HAIR-PASS11.md`, `HAIR-PASS11-REMAINING.md`, `HAIR-MEASURE.md`. Script : `artefacts-pass11.ts`. Artefacts : `artefacts/hair-engine-pass11/`.

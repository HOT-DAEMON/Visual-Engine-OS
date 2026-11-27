# CHANGELOG-28 — passe 10 du moteur capillaire : nouvelles coupes carré et shag (feat/hair-grammar)

- feat : profils de grammaire `BOB` et `SHAG` (`src/hair-grammar/profiles/`), exportés par `src/hair-grammar/index.ts`. Données seulement : même générateur, même peinture, même solveur `repairCycle`, même vérification G/A/S.
- fix (profil) : familles arrière nommées `back` (seule famille exemptée du contrôle « œil recouvert » par `lock-check.ts`) ; calotte dominante pour passer `rapport dominante / seconde` ≥ 1,15 sans toucher au seuil.
- verif : 47/48 cas valides (8 graines × lacets 0°, ±30° × 2 coupes), défauts localisés 173 → 0 après réparation.
- non livré : pixie (voir `HAIR-PASS10-REMAINING.md`).
- tests : `hair-grammar-cuts` (12 tests ; 19 avec `hair-grammar`). Docs : `HAIR-PASS10.md`, `HAIR-PASS10-REMAINING.md`. Script : `artefacts-pass10.ts`, `lib-cuts.ts`. Artefacts : `artefacts/hair-engine-pass10/`.

# CHANGELOG-30 — passe 12 du moteur capillaire : coupes à attache (feat/hair-grammar)

- feat : profils `DOUBLE_BUNS`, `TOP_BUN` (`profiles/buns.ts`), `PONYTAIL` (`profiles/ponytail.ts`), `TWIN_BRAIDS` (`profiles/braids.ts`), cadre commun `profiles/frame.ts`. Exportés par `src/hair-grammar/index.ts`.
- feat (moteur, additif) : `FamilySpec.field`, `FamilySpec.group`, `familyOf()`, `HairProfile.post` ; réparation des trous parasites par défaut localisé (≤ 8) + 2 corrections.
- feat : `attach-verify.ts`, couche de vérification des attaches (géométrie, anatomie, style).
- feat (outils) : `measure-buns.py`, `compose-ref04.py`, `preview-cuts.ts`, `verify-cuts.ts`, `artefacts-pass12.ts`.
- verif : 153/160 (4 coupes × 8 graines × 0/±30/±60°) ; hime 22/24 → 24/24, carré + shag 47/48 inchangés, pixie 21/24 inchangé.
- tests : `hair-grammar-cuts-pass12` (26) ; `tests/hair-grammar*` 97/97.
- docs : `HAIR-PASS12.md`, `HAIR-BUNS.md`, `HAIR-PASS12-REMAINING.md`. Artefacts : `artefacts/hair-engine-pass12/`.

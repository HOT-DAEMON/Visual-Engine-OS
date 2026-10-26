# CHANGELOG-11 — moteur de crâne en profil (feat/skull-profile)

- feat : `src/skull/` (14 fichiers ≤ 108 lignes) — contour de peau de profil (voûte, front, nez, lèvres, menton, cou, nuque), os (crâne, orbite, arcade,
  mandibule, dents, sutures, C1–C7), profondeurs de tissu mou, oreille du moteur existant projetée à 90°, 3 coiffures de profil.
- feat : hauteurs du profil = repères du visage de face (`Frame`) ; angle gonial RÉSOLU sur celui du visage de face ; contraintes consignées par `Resolver`.
- feat : `generateRandomProfile` (flux dérivé : le visage de la même graine est inchangé), `verifyProfile` (29 contrôles, 3 couches).
- perf : `verifyFace` utilise `compileSceneCached` (−22 % sur compilation + vérification) ; rendu du profil sans filtre (≈ 50 ms rendu + raster contre ≈ 777 ms pour la face).
- sécurité/SVG : `stroke-dasharray` ajouté à la liste blanche (attribut inerte, sans ressource ni script).
- tests : `tests/skull.test.ts` (15) ; suite complète 2 206 tests.
- scripts : `scripts/artefacts-skull.ts`, `scripts/bench-skull.ts`.
- docs : `SKULL-PROFILE.md`, `-ANATOMY.md`, `-VERIFY.md`, `-REMAINING.md`, `PERF-3.md`, `ERRORS-8.md`. Artefacts : `artefacts/skull-profile/` (8 images + JSON).

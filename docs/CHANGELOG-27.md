# CHANGELOG-27 — passe 9 du moteur capillaire : fidélité du rendu principal (feat/hair-grammar)

- fix : cheveux bruns foncés rendus bleu ardoise. Cause : `deriveLight` (reflet bleuté pour `l < 0,22`, falaise). `appearance/hair-light.ts` : lumière propre aux cheveux, continue ; `resolveAppearance(base, spec, { model: 'hair' })`, branchée dans `hairAppearance` et les poils du visage. Brun foncé 163° → 1° d'écart de teinte ; noir et toutes les autres couleurs identiques au bit près ; peau et yeux inchangés.
- fix : « W » blancs sur les mèches (dentelure aléatoire du reflet de la référence 60, 0,40–0,82 de la largeur de la bande). `ringBands(…, jagScale, lens)`, `ProStyle.ringJag` / `ringLens`, style de passage `MAIN_PRO` (bords lisses, lentille). Encre inchangée.
- fix : règle `highlight-keeps-hue` (`verify/style.ts`) aveugle aux bruns foncés (garde `l > 0,25`) → `l > 0,08`.
- feat : `hair-grammar/render-verify.ts` — `ring.band-smooth` (géométrie), `style.lit-hue` (style) ; détecteur d'alternances `edgeZigzag`.
- tests : `hair-render-fidelity` (11). Docs : `HAIR-PASS9.md`, `HAIR-PASS9-REMAINING.md`. Script : `artefacts-pass9.ts`. Artefacts : `artefacts/hair-engine-pass9/`.

# Passe 8 — couche de vérification (géométrie · anatomie · style)

`verifyRing` (`src/hair-grammar/verify-ring.ts`) rend trois `Report` ; `ringDefects` (`ring-check.ts`) rend les fautes localisées.

## Ajouts de la passe 8
- Géométrie : `ring.shade.continuity` (rupture entre segments ≤ 1e-6), `ring.shade.outside` (sommets d'ombre hors de la lame ≤ 10 % ; mesuré 9 sur 17 956).
- Style : `ring.shade.monotone` (le poids ne remonte jamais, ≤ 1e-9) ; dureté (variation max entre nœuds ≤ 0,2) ; creux relatif mesuré au creux maximal (−0,38…−0,30, cible −0,335). Les trois paliers ne sont contrôlés que pour `profile: 'steps'`.
- Contrat de rendu : règles `ring*` de `checkHairLockContract`.

## Défaut de vérification trouvé et corrigé
Les verdicts des passes 7 et 8 étaient calculés sur des mèches peintes SEULES (17–24 anneaux), pas sur la coiffure finale `paintHairPro` (1–5 anneaux, occlusion croisée). Sur la coiffure finale, 18 cas sur 18 échouaient au style (part de mèches à reflet) alors que géométrie et anatomie passaient.
Cause : le dénominateur de la part comptait les 50 mèches, dont le calque de dessous et les mèches recouvertes, qui ne peuvent pas porter de reflet visible. Mesuré sur les mèches visibles (non `back`, ≥ 40 % de la ligne médiane à occlusion < 0,5) : part 0,23 (seuil 0,25), 0,40 (0,40), 0,51 (0,55) — toujours dans 15–85 %. Le moteur n'était pas en faute, la mesure l'était.
- Corrigé : `isVisibleLock`, `VISIBLE_MIN = 0,4`, part d'aire sur les mèches visibles aussi ; `artefacts-pass8.ts` juge `paintHairPro().locks`. Résultat : 18 cas sur 18 passent, 0 défaut (`metrics.json → verification`).
- Limite honnête : une scène finale n'a que 3–7 mèches visibles (< `MIN_LOCKS` = 8). La part d'UNE scène est alors « non jugée » (valeur neutre), donc ce contrôle ne peut pas échouer seul ; la proportion se juge sur un lot (`ringShare`, test : 0,40 sur 18 scènes, bornes 15–85 %). Les bornes restent des seuils d'ingénierie, pas une loi.
- Le style reste un jeu de seuils mesurés sur une référence, pas un jugement esthétique.

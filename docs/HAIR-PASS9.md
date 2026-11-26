# Moteur capillaire — passe 9 : fidélité du rendu principal (teinte, reflet lisse, vérification)

Reste à faire : `HAIR-PASS9-REMAINING.md`. Preuves : `artefacts/hair-engine-pass9/` (planches 01–05 + `metrics.json`), `tests/hair-render-fidelity.test.ts` (11 tests), script `scripts/hair-grammar/artefacts-pass9.ts`.
Point de départ : « les rendus de la fusion des deux moteurs ne sont pas convaincants ». Rendu de la passe 8 regardé avant de coder ; quatre défauts nommés à l'œil, deux d'entre eux mesurés et corrigés, deux documentés (voir REMAINING).

## Défaut 1 — cheveux bruns rendus bleu ardoise (CORRIGÉ, mesuré)
- Symptôme : `#4a3326` sortait `#60647a` aux tons éclairés ; seules les mèches de ton ≤ 0 restaient brunes.
- Cause (lue dans `appearance/resolve.ts`, pas supposée) : `deriveLight` donne une lumière bleutée (h = 218°) dès `l < 0,22`, pensée pour le noir. Le brun vaut `l = 0,219` : il tombe sous le seuil, un brun à `l = 0,221` aurait une lumière chaude. Falaise de 0,13 à 0,23 (distance RVB normalisée) à `l = 0,222`.
- Correction : `src/appearance/hair-light.ts`, lumière propre aux cheveux, activée par `resolveAppearance(base, spec, { model: 'hair' })`. Le reflet bleuté est pondéré par deux rampes continues, luminosité (0,12 → 0,26) ET neutralité (saturation 0,22 → 0,45) : il reste pour le noir, pas pour un brun saturé. Branché dans `hairAppearance` (source unique du rendu et de la vérification) et dans les poils du visage.
- Mesure (planche 03, `metrics.json → hueTable`) : écart de teinte base → lumière, brun foncé 163° → 1°, brun très foncé 165° → 5°. Noir, auburn, châtain, blond, roux, rose, gris : identiques au bit près (testé). Falaise : saut RVB max 0,13–0,23 (à l = 0,222) → 0,054 au pire, à l = 0,078 (quantification 8 bits d'une base presque noire), plus rien à 0,22 ; test : < 0,06.
- Sans option, la dérivation de la peau, des yeux et des matières ne change pas (test épinglé `#4a3326 → #7d95bf`).

## Défaut 2 — « W » blancs dentelés sur les mèches (CORRIGÉ, mesuré)
- Cause : `ringBands` décale chaque dent du reflet au hasard (`rnd() × jag × 1,7`), pour imiter les peignes de l'encre de la référence 60. Sur une petite mèche du rendu lisse, la dentelure vaut 0,40 à 0,82 de la largeur de la bande.
- Correction : `ringBands(…, jagScale, lens)` ; `ProStyle.ringJag` (0 = bords lisses) et `ProStyle.ringLens` (0 = rectangle, 1 = lentille aux bouts pointus ; les références 06, 19, 21 montrent des reflets en lentille). `MAIN_PRO` (`ringJag 0`, `ringLens 0,85`, `replace`) est le style de passage vers le rendu principal. Défauts inchangés : l'encre de la passe 8 reste identique (34 tests de la passe 8 verts).
- Mesure : bords dentelés sur 5 bandes avant, 0 alternance après (`metrics.json → ringEdges`).

## Erreur de méthode attrapée en route
Mon premier détecteur comptait les inversions de convexité. Il donnait 7 à 14 inversions même avec `ringJag = 0` : un bord droit a des points alignés dont le produit vectoriel n'est que du bruit numérique. Détecteur invalide, écarté. Le second (rugosité à la corde) voyait la lentille comme rugueuse, car un arc dévie de la corde par construction. Le détecteur retenu (`render-verify.ts → edgeZigzag`) compte les ALTERNANCES de signe d'écarts significatifs (≥ 3 % de l'épaisseur) : droit = 0, arc = 0, dentelure = 1 par dent. Test : il doit voir l'ancien défaut (il le voit).

## Couche de vérification (G·A·S) — `src/hair-grammar/render-verify.ts`
- GÉOMÉTRIE : `ring.band-smooth` (bords de reflet sans dentelure), sur les `HairLock` réellement remis au rendu.
- STYLE : `style.lit-hue` (dérive de teinte des tons éclairés ≤ 45°). Sur l'ancien rendu : 5 × `ring.band-smooth` + 1 × `style.lit-hue` ; sur le nouveau : aucune faute.
- ANATOMIE : pas de doublon — portée par repères et zones protégées dans `compose-verify.ts` / `verify.ts`, reflet dans la lame dans `ring-check.ts`.
- Règle existante corrigée plutôt que doublée : `highlight-keeps-hue` de `verify/style.ts` était gardée par `l > 0,25` ; le brun (l = 0,219) lui échappait. Garde ramenée à `l > 0,08`.

## Déjà codé, vérifié avant d'écrire
Recherche dans `src/` : aucune lumière propre aux cheveux, aucun contrôle de dentelure de reflet ; `ringIsSane` jugeait la bande contre la lame (réutilisé), `checkStyle` contenait la règle de teinte (corrigée). `hueDelta`, `toHsl`, `ringPath` réutilisés.

## Fichiers
Nouveaux : `src/appearance/hair-light.ts`, `src/hair-grammar/render-verify.ts`, `tests/hair-render-fidelity.test.ts`, `scripts/hair-grammar/artefacts-pass9.ts`, `artefacts/hair-engine-pass9/`.
Modifiés : `src/appearance/resolve.ts`, `src/hair-grammar/{spec-ring,paint-pro}.ts`, `src/render/face/{hair-look,facial-hair}.ts`, `src/verify/style.ts`.
Reproduire : `npx tsx scripts/hair-grammar/artefacts-pass9.ts` ; `npx vitest run tests/hair-render-fidelity.test.ts`.

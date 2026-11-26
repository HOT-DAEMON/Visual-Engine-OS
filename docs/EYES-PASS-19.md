# Yeux — passe 19 : accord de style tête ↔ yeux (`eyeFinish`, `faceIsCel`, `eyes-finish-matches-head`)

Suite de `EYES-PASS-18.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur, un seul paramètre (`eyeFinish`), une seule définition partagée (`faceIsCel`), une règle de vérification ; les visages générés sans l'option sont identiques à l'octet.

Reproduire : `npx vitest run tests/eye-pass19.test.ts tests/verify-eye-pair.test.ts` · preuves : `npx tsx scripts/artefacts-eyes-pass19.ts` → `artefacts/eyes-pass19/` (+ `rapport.json`).

## 1. Le défaut trouvé (mesuré, pas supposé)
`generateRandomFace` met la peau en mode `cel` quand `anatomy.style === 'cel'`, mais ne disait rien aux yeux : ils gardaient le fini de leur identité (`shaded` : dégradés, vernis, ombre de paupière). Inversement, les identités « encre » des galeries étendues (réfs 13 et 17, `finish: 'flat'`, `eye-ref-looks.ts`) se posaient sur une tête lisse ombrée.
Mesure (`rapport.json`, 30 visages par source, règle `eyes-finish-matches-head`) : galerie 0, random 0, **extended 6, extended2 2, extended3 3, extended4 3** têtes lisses à yeux d'encre. Aucun cas « tête cel + yeux ombrés » n'est tiré par défaut (il faut demander `anatomy.style: 'cel'`).

## 2. Ce qui a été fait
- `src/face/head-style.ts` : `faceIsCel(params)` = `renderMode === 'anime'` ou `skin.shading.mode === 'cel'`. **Source unique** : `render/face/face.ts` (`skinAppearance`, comportement identique), le tirage des yeux et la vérification la lisent.
- `RandomFaceOptions.eyeFinish: 'auto' | 'shaded' | 'flat' | 'cel'` (`generation/random-face.ts`). `shaded` / `flat` / `cel` imposent le fini aux deux yeux. `auto` : tête cel + identité ordinaire → yeux `cel` (§2b) ; identité à yeux d'encre (déjà `flat`, réfs 13/17) sur une tête dont `anatomy.style` n'est pas imposé → tête cel ; un style imposé par l'utilisateur n'est jamais écrasé ; sinon rien ne change. Absent : visages d'avant identiques.
- Pour que `auto` lise le fini de l'identité avant de dessiner la tête, le bloc « identité + paire d'yeux » a été déplacé AVANT le tirage de l'anatomie (aucun tirage `rnd` entre les deux). Empreinte SHA-256 de 250 visages (6 sources × 40 + 10 avec options) **identique avant / après**.
- `verify/eye-pair.ts` : règle `style` / `eyes-finish-matches-head` (**avertissement**, jamais erreur : un œil peint sur une tête cel peut être voulu). La paire d'yeux passe de 9 à 10 contrôles.
- Correction annexe dans `eyes-same-finish` : la valeur par défaut comparée était `'painted'`, absente de l'énumération du schéma (`shaded` / `flat`) ; un œil sans `finish` et un œil `finish: 'shaded'` (même fini) étaient jugés différents.

## 2b. Fini `cel` (ajouté dans la même passe)
- **Mesure sur la réf. 01** (pixels) : l'iris n'a que deux aplats, jaune éclairé ≈ (235, 236, 37) et orange d'ombre ≈ (224, 115, 38) (le vert est divisé par deux, teinte de la peau voisine) ; frontière inclinée ≈ −23,5° ; au centre l'ombre couvre ≈ la moitié de la hauteur de l'anneau (frontière à y ≈ 299 pour un anneau de y 194 à 404). La **dentelure** de la frontière n'a PAS pu être mesurée de façon fiable (40 colonnes exploitables sur 270) : non chiffrée, non reproduite.
- `EyeSpec.finish` accepte `cel` = `flat` + ombre portée des paupières en aplat à bord dur. `isFlat` vaut pour `flat` et `cel` (tout ce que `flat` retire reste retiré) ; `hasCastShadow` pour `cel` seul. `render/eye/cornea.ts` et `verify/eye-cornea.ts` lisaient `finish === 'flat'` : ils passent par `isFlat`.
- Rendu (`globe-inner.ts`) : le même croissant que l'ombre douce (contour de l'ouverture décalé à l'opposé de la lumière, donc incliné comme elle), sans flou ; profondeur `CEL_SHADOW_DEPTH = 0,45` × hauteur effective (0,2 en `shaded`), teinte d'ombre du moteur d'apparence assombrie, opacité 0,4. **Profondeur et opacité sont des estimations**, non ajustées sur la mesure ci-dessus.
- **Défaut trouvé par mon propre test, corrigé** : la première version peignait l'ombre de la couleur de la peau (opacité 0,6) ; sur une surface sombre elle l'**éclaircissait** (luminance moyenne de l'ouverture 161,76 en `cel` contre 161,29 en `flat` ; bande beige sur la sclère sombre de la graine 23). Après correction : 153,5 contre 161,8. Avec la profondeur 0,2 de `shaded`, l'ombre ne dépassait de toute façon qu'en mince croissant sur la sclère et n'atteignait jamais l'iris.
- **Preuves** (`tests/eye-cel-finish.test.ts`, 5 tests) : schéma ; `isFlat` / `hasCastShadow` ; `cel` = `flat` + exactement un tracé évenodd, 0 dégradé et 0 filtre en plus ; plus sombre de ≈ 8 niveaux ; l'azimut de la lumière change le tracé (et `flat` n'en a pas) ; `toneShare` : cel 0,11, shaded 0,39, flat 0 (la métrique tolère 3 tons dominants : l'ombre dure en ajoute, d'où cel > 0) ; œil d'encre de la galerie en `cel` ≤ 0,02. Planche `01b` : trois colonnes shaded / flat / cel sur les mêmes têtes.
- **Non reproduit de la réf. 01** : le virage chaud de l'ombre (jaune → orange ; ici ombre neutre), la dentelure, la frontière droite (ici l'arc de la paupière) et la scission de l'iris en deux moitiés (l'iris n'est ombré que s'il passe sous le croissant : vu à la graine 5 seulement ; g11 et g23 : sclère seule).

## 3. Preuves (paramètre consommé et visible)
- Test : un œil `flat` dessine moins d'éléments `linearGradient` / `radialGradient` / `filter` que le même œil `shaded` (éléments de dégradé et de filtre comptés dans le SVG de la tête à partir de l'œil gauche, `rapport.json` › `celGradientsFilters` : graine 23 : 26 → 2 ; graine 5 : 22 → 2 ; graine 11 : 24 → 4 ; identique pour `cel`, dont l'ombre dure n'ajoute ni dégradé ni filtre).
- Avec `auto` : **0 violation** sur 6 sources × 30 visages (contre 14 sans). `01b-gros-plans-oeil-gauche.png` (shaded / flat / cel) : sclère grise ombrée → blanc franc, iris à dégradés et fibres → aplat ; en `cel`, ombre de paupière en aplat dur.
- `03-tete-ordinaire-inchangee.png` : une tête lisse est identique avec ou sans `auto` (JSON égal).

## 4. Ce que ces images montrent aussi, et qui n'est PAS résolu
1. **La tête « cel » n'est pas plate au pixel près.** Autour des yeux la peau garde son grain (`texture: grain` tiré à 35 %) et des taches de blush ; les cheveux gardent leurs dégradés (`01-…png`). L'accord est réel pour les yeux et pour le mode d'ombrage de la peau, pas pour toute la tête.
2. **Rendu esthétique de la tête cel obtenue par `auto` sur les yeux d'encre : pas meilleur.** Le moteur de peau y pose un terminateur d'ombre dur en diagonale (il traverse la joue en g2, la bouche en g7) et des ovales de reflet plats (`02-…png`). La règle passe, le dessin n'y gagne pas : je ne le présente pas comme une amélioration, seulement comme une cohérence de style mesurable. `auto` reste opt-in pour cette raison.
3. **L'iris `flat` / `cel` perd ses détails** : limbe, fibres et bord dentelé de la réf. 01 ne sont pas recomposés en aplats ; seule l'ombre portée l'est, en `cel` (§2b).
4. Aucune mesure de teinte de la peau contre la palette cel des références (la règle compare des modes, pas des couleurs).

## 5. Vérification
- `tests/eye-pass19.test.ts` (10 tests) : `faceIsCel` (lisse, cel, anime) ; `eyeFinish` absent / auto lisse identiques ; auto cel → `flat` ×2, `shaded` et `flat` imposés ; consommation à l'image ; balayage 6 sources × 30 ; yeux d'encre → tête cel sans écraser un style imposé ; règle dans les deux sens ; `eyes-same-finish`.
- `tests/verify-eye-pair.test.ts` mis à jour (10 contrôles ; le balayage de 180 visages utilise `eyeFinish: 'auto'`).
- Typage : `tsc --noEmit` ne signale que les erreurs préexistantes de `scripts/artefacts-figure-perf.ts` (chemins `/tmp/orig`).
- Tests exécutés, tous verts (avec `cel`) : 38 fichiers `eye-*` (tous sauf `eye-gallery-ext4`) et 12 fichiers qui consomment `checkFaceEngine` / `checkEyePair` / `generateRandomFace` (`face-engine-verify`, `face-structure(-verify)`, `ear-verify`, `host-scene`, `inter-eye-coordination`, `nose-*`, `random-*`, `face-pose-jaw`, `verify-eye-pair`) : **50 fichiers, 0 échec**, un fichier par exécution.
- Empreinte SHA-256 des objets et paramètres de 250 visages par défaut : identique avant / après (elle ne couvre pas les pixels).
- `npm run regress` : voir la ligne « Vérifié » de `EYES-REMAINING.md`.
- **NON exécutés** : la suite complète du dépôt (250 fichiers ; un lancement en un seul processus s'est arrêté sans échec relevé après 95 fichiers verts) ; `eye-gallery-ext4` (dépasse plusieurs minutes sur cette machine à un cœur) ; les tests de cheveux, de cou et de corps. Le risque résiduel est faible (empreintes de 250 visages identiques, `regress` identique) mais non nul.

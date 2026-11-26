# Yeux — passe 19 : accord de style tête ↔ yeux (`eyeFinish`, `faceIsCel`, `eyes-finish-matches-head`)

Suite de `EYES-PASS-18.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur, un seul paramètre (`eyeFinish`), une seule définition partagée (`faceIsCel`), une règle de vérification ; les visages générés sans l'option sont identiques à l'octet.

Reproduire : `npx vitest run tests/eye-pass19.test.ts tests/verify-eye-pair.test.ts` · preuves : `npx tsx scripts/artefacts-eyes-pass19.ts` → `artefacts/eyes-pass19/` (+ `rapport.json`).

## 1. Le défaut trouvé (mesuré, pas supposé)
`generateRandomFace` met la peau en mode `cel` quand `anatomy.style === 'cel'`, mais ne disait rien aux yeux : ils gardaient le fini de leur identité (`shaded` : dégradés, vernis, ombre de paupière). Inversement, les identités « encre » des galeries étendues (réfs 13 et 17, `finish: 'flat'`, `eye-ref-looks.ts`) se posaient sur une tête lisse ombrée.
Mesure (`rapport.json`, 30 visages par source, règle `eyes-finish-matches-head`) : galerie 0, random 0, **extended 6, extended2 2, extended3 3, extended4 3** têtes lisses à yeux d'encre. Aucun cas « tête cel + yeux ombrés » n'est tiré par défaut (il faut demander `anatomy.style: 'cel'`).

## 2. Ce qui a été fait
- `src/face/head-style.ts` : `faceIsCel(params)` = `renderMode === 'anime'` ou `skin.shading.mode === 'cel'`. **Source unique** : `render/face/face.ts` (`skinAppearance`, comportement identique), le tirage des yeux et la vérification la lisent.
- `RandomFaceOptions.eyeFinish: 'auto' | 'shaded' | 'flat'` (`generation/random-face.ts`). `shaded` / `flat` imposent le fini aux deux yeux. `auto` : tête cel → yeux `flat` ; identité à yeux d'encre sur une tête dont `anatomy.style` n'est pas imposé → tête cel ; un style imposé par l'utilisateur n'est jamais écrasé. Absent : rien ne change.
- Pour que `auto` lise le fini de l'identité avant de dessiner la tête, le bloc « identité + paire d'yeux » a été déplacé AVANT le tirage de l'anatomie (aucun tirage `rnd` entre les deux). Empreinte SHA-256 de 250 visages (6 sources × 40 + 10 avec options) **identique avant / après**.
- `verify/eye-pair.ts` : règle `style` / `eyes-finish-matches-head` (**avertissement**, jamais erreur : un œil peint sur une tête cel peut être voulu). La paire d'yeux passe de 9 à 10 contrôles.
- Correction annexe dans `eyes-same-finish` : la valeur par défaut comparée était `'painted'`, absente de l'énumération du schéma (`shaded` / `flat`) ; un œil sans `finish` et un œil `finish: 'shaded'` (même fini) étaient jugés différents.

## 3. Preuves (paramètre consommé et visible)
- Test : un œil `flat` dessine moins d'éléments `linearGradient` / `radialGradient` / `filter` que le même œil `shaded` (éléments de dégradé et de filtre comptés dans le SVG de la tête à partir de l'œil gauche, `rapport.json` › `celGradientsFilters` : graine 23 : 26 → 2 ; graine 5 : 22 → 2 ; graine 11 : 24 → 4).
- Avec `auto` : **0 violation** sur 6 sources × 30 visages (contre 14 sans). `01b-gros-plans-oeil-gauche.png` : sclère grise ombrée → blanc franc, iris à dégradés et fibres → aplat, ombre de paupière retirée.
- `03-tete-ordinaire-inchangee.png` : une tête lisse est identique avec ou sans `auto` (JSON égal).

## 4. Ce que ces images montrent aussi, et qui n'est PAS résolu
1. **La tête « cel » n'est pas plate au pixel près.** Autour des yeux la peau garde son grain (`texture: grain` tiré à 35 %) et des taches de blush ; les cheveux gardent leurs dégradés (`01-…png`). L'accord est réel pour les yeux et pour le mode d'ombrage de la peau, pas pour toute la tête.
2. **Rendu esthétique de la tête cel obtenue par `auto` sur les yeux d'encre : pas meilleur.** Le moteur de peau y pose un terminateur d'ombre dur en diagonale (il traverse la joue en g2, la bouche en g7) et des ovales de reflet plats (`02-…png`). La règle passe, le dessin n'y gagne pas : je ne le présente pas comme une amélioration, seulement comme une cohérence de style mesurable. `auto` reste opt-in pour cette raison.
3. **L'iris `flat` perd tout détail** : plus de limbe, de fibres ni d'ombre de paupière sur l'iris, alors que la réf. 01 (cel) garde un bord d'iris dentelé et une ombre portée de paupière en aplat. Le fini `flat` retire sans recomposer en aplats ce que le modèle d'éclairage ajoutait.
4. Aucune mesure de teinte de la peau contre la palette cel des références (la règle compare des modes, pas des couleurs).

## 5. Vérification
- `tests/eye-pass19.test.ts` (10 tests) : `faceIsCel` (lisse, cel, anime) ; `eyeFinish` absent / auto lisse identiques ; auto cel → `flat` ×2, `shaded` et `flat` imposés ; consommation à l'image ; balayage 6 sources × 30 ; yeux d'encre → tête cel sans écraser un style imposé ; règle dans les deux sens ; `eyes-same-finish`.
- `tests/verify-eye-pair.test.ts` mis à jour (10 contrôles ; le balayage de 180 visages utilise `eyeFinish: 'auto'`).
- Typage : `tsc --noEmit` ne signale que les erreurs préexistantes de `scripts/artefacts-figure-perf.ts` (chemins `/tmp/orig`).
- Tests exécutés, tous verts : les 13 fichiers qui consomment `checkFaceEngine` / `checkEyePair` / `generateRandomFace` (133 tests : `eye-pass19`, `verify-eye-pair`, `face-engine-verify`, `face-structure(-verify)`, `ear-verify`, `host-scene`, `inter-eye-coordination`, `nose-*`, `random-*`, `face-pose-jaw`) ; 23 fichiers `eye-*` / galeries 1–3 exécutés un par un (aucun échec).
- `npm run regress` : EXIT 0, 40 cas dont 4 « close » (`hard-09`, `hard-10`, `hard-13` rms 0,00 ; `hard-15` rms 1,20, 0,16 % de pixels > 8) — **valeurs identiques sur le code d'origine** (`git stash`), donc préexistants.
- **NON exécutés** : la suite complète du dépôt (250 fichiers ; un lancement en un seul processus s'est arrêté sans échec relevé après 95 fichiers verts, le lanceur fichier par fichier a été interrompu sur `eye-gallery-ext4`, qui dépasse plusieurs minutes sur cette machine à un cœur) ; ni `eye-gallery-ext4`, ni les tests de cheveux, de cou ou de corps. Le risque résiduel est faible (empreintes de 250 visages identiques, `regress` identique) mais non nul.

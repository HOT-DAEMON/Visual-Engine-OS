# Moteur capillaire — passe 6 : raie lue, lumière dans le rendu, reflet transversal

Code : `src/hair-grammar/{reference-fit-part,spec-ring,verify-ring}.ts` (nouveaux) · `{reference-fit,paint-pro}.ts` (modifiés) · `src/render/face/{hair-skin-shadow,hair,hair-detail}.ts` (modifiés).
Tests (5 fichiers, 43 tests) : `tests/hair-engine-part-fit.test.ts` · `hair-skin-shadow-opacity.test.ts` · `hair-gloss-light.test.ts` · `hair-engine-ring.test.ts` (14) · `hair-engine-ring-verify.test.ts` (10).
Suite capillaire complète : 54 fichiers, 1046 tests verts ; `tsc --noEmit` propre.
Preuves (têtes entières puis détails) : `artefacts/hair-engine-pass6/` — régénérées par `npx tsx scripts/hair-grammar/artefacts-pass6.ts`.
Reste à faire par composant : `HAIR-PASS6-REMAINING.md`. Mesures de la référence 60 : `HAIR-PASS6-MEASURES.md`.

Méthode : le document de tâches demandé (`HAIR-PASS-REMAINING.md`) n'existe pas ; la source est `HAIR-PASS5-REMAINING.md`, relu ligne à ligne. Avant chaque pièce, vérification qu'elle n'existait pas déjà (l'observateur `observe-part.ts`, `intensityFor`/`softness` du module de lumière et `hairGloss` existaient ; le câblage, non). Tout nouveau réglage est désactivé par défaut et identique au bit près à la lumière de référence.

## 1. Ce qui a été traité, ligne de `HAIR-PASS5-REMAINING.md` par ligne
| Ligne (passe 5) | Verdict | Traitement |
|---|---|---|
| « raie lue sur une référence non transformée en `Intent.part` » | FAIT | `fitFromReferencePart` : sillon net (netteté ≥ 0,5) → position de crâne par inversion de la projection → `applyPart`+`shapePart` à chaque tour de l'ajustement, même position transmise à la réparation. |
| « OPACITÉ de `skinShadow` fixe » | FAIT (intensité, douceur) | `skinShadowOpacity(L, base)` = base × `intensityFor(L,'skin')` × facteur de douceur borné [0,75 ; 1,25]. Exactement la base à la lumière de référence. Elévation : déjà traitée passe 4 (décalage). |
| « reflets (`gloss`) non pilotés » | FAIT en partie | Brillance principale × `intensityFor(L,'hair')` (intensité 0 → plus de brillance ; > 1 n'amplifie pas). Reflet du moteur de grammaire : voir §3. |
| Couche de vérification | ÉTENDUE | `verify-ring.ts` : rapports géométrie / anatomie / style du reflet (§4). |

## 2. Raie lue sur une référence (`reference-fit-part.ts`)
- Lecture : `observePart` (sillon, netteté, position image u en demi-largeurs). Un sillon incertain ou absent ne crée PAS de raie (test dédié).
- Conversion : `imageUToSkull` balaie la ligne de crâne x = xp à 47° d'élévation (jusqu'à ±0,68 rx) en ne gardant que les points tournés vers la caméra, car à fort lacet la projection n'est plus monotone. Aller-retour testé à ±30° et ±60°.
- Crochets dans `reference-fit.ts` : `FitOptions.shape` et `FitOptions.part`. Absents, comportement historique au bit près (test `part: false`).
- Mesure (planche 04, `metrics.json`) : référence portant une raie de +0,3 → raie lue 0,29, sillon net 0,95 ; référence −0,3 → −0,31, sillon net 0,94. Signe conservé.
- Limite constatée sur la planche : l'ajustement ne reproduit pas la silhouette de la référence (4 axes d'intention seulement) ; seule la raie est retrouvée.

## 3. Reflet transversal (`spec-ring.ts`, option `ProStyle.ring: 'off' | 'replace' | 'add'`, défaut `off`)
- Pourquoi : le reflet de `paint-pro.ts` est LONGITUDINAL (collé au bord éclairé). Le tutoriel de `references/hair/60.jpg` enseigne une bande TRANSVERSE aux bords déchiquetés, suivie d'une zone sombre aval. Physiquement : la bande se place où la normale du ruban est la plus proche du vecteur médian H = norm(lumière + vue) (Blinn-Phong).
- Le centre n'est PAS une constante : il suit l'argmax de N·H (corps de la mèche seulement). Une porte N·L évite un reflet sur une surface non éclairée (défaut trouvé : une lumière derrière la tête donnait plus de reflets).
- Constantes mesurées sur la référence 60 : voir `HAIR-PASS6-MEASURES.md`. Seuils d'ingénierie, NON mesurés : `minNH` 0,78 · `fullNH` 0,97 · `bodyWidth` 0,4 · `minCoverage` 0,3.
- Sur 50 mèches (graine 2, lacet 0) : 17 / 12 / 18 reflets sous trois lumières (haut-gauche, haut-droite, zénith) ; le motif change avec la lumière (planche 01).

## 4. Couche de vérification du rendu (`verify-ring.ts`)
Chaque contrôle relit la bande ÉMISE et la compare à la lame ; il ne relit pas les constantes qui l'ont construite.
- Géométrie : sommets finis · part de sommets hors de la surface peinte = 0 · |cos| bord/tangente ≤ 0,43 (transverse).
- Anatomie : aucun reflet sur le dessous du ruban · exposition au centre ≥ 0,5 (face éclairée).
- Style : part de mèches à reflet dans 15–85 % (ni mat, ni plastique ; non jugée sous 8 mèches) · étendue 0,035–0,08 · couverture moyenne 0,6–0,91 · trois paliers d'ombre · aire du reflet ≤ 35 % de celle de la lame.
- 18 cas (3 lumières × 3 graines × 2 lacets) : 18/18 vérifiés (`metrics.json`, `ringVerification`). Chaque contrôle est testé par MUTATION (contour resserré, normale NaN, dessous forcé, lumière arrière, scène trop petite).

### Défauts réels trouvés par cette vérification (et corrigés)
1. Lumière zénithale, mèches « mass » repliées : 10–15 % des sommets du reflet hors du contour. Cause : sur une lame large qui plie court, |κ|·demi-largeur·u > 1, le bord intérieur du contour se replie. Correction : couverture bornée par 0,9 / (|κ|·w) sur l'étendue de la bande ; sous 0,3, pas de reflet.
2. Faux positif du contrôle lui-même : le test pair/impair sur le contour déclarait « dehors » un point peint, quand la mèche se recouvre elle-même. Remplacé par l'union des tranches de lame.

## 5. Brillance et ombre selon l'intensité (planche 03)
À intensité 1 / 0,5 / 0,15, la brillance des cheveux et l'ombre portée des mèches faiblissent ensemble. L'intensité agit sur TOUTE la scène (nez, joues compris) : la planche ne prouve pas l'effet isolé sur les cheveux ; il est prouvé par `hair-gloss-light.test.ts` (mutations) et `hair-skin-shadow-opacity.test.ts`.

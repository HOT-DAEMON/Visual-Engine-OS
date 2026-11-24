# Yeux — passe 16 : LOD automatique, cornée / réfraction, bords palpébraux, atomes de 07 et 10a

Suite de `EYES-PASS-15.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur ; chaque ajout est un atome ou un paramètre consommé par le moteur existant, prouvé sur des pixels.

Reproduire : `npx vitest run tests/eye-lod-cornea-edge.test.ts tests/eye-iris-pass16.test.ts tests/eye-params-consumed.test.ts` · preuves : `npx tsx scripts/artefacts-eyes-pass16.ts` → `artefacts/eyes-pass16/` (+ `rapport.json`).

## 1. LOD automatique (`geometry/eye/lod.ts`)
- `lod.eyePixels: null` n'est plus « pleine précision » mais **automatique** : `shape.width × transform.scale (échelle monde de l'œil posé) × pixelRatio`, borné à [8, 8000]. Un nombre explicite reste prioritaire ; `8000` force le plein détail.
- `renderScene(scene, { pixelRatio })` : nouveau ; `CompileCtx.pixelRatio` → `compileEye(..., { pixelRatio })`. Valeur par défaut 1 (1 unité de scène = 1 px).
- **Un seul calcul, trois consommateurs** : microdétails de la sclère (`microLod`), détail atomique de l'iris (`irisLod`) et `verifyEye` (`withAutoLod`, la même fonction que le rendu).
- Iris : `IrisFrame.pxPerUnit` ; fibres fines tracées à 25–100 % (tirages tous faits, tracé réparti sur les angles) ; un atome plus petit que 0,45 px n'est pas tracé (braises, biseaux de facettes, fentes) ; tables de facettes < 2,5 px, éclats < 3 px et poussière < 0,7 px retirés. `renderIrisDetail(..., null)` = plein détail, identique à l'ancien rendu (testé).
- Mesure (œil de feu avec microdétails, artefact 12) : 470 / 432 / 296 / 258 nœuds SVG pour un œil de 300 / 150 / 70 / 34 px.
- ⚠ **Changement de comportement** : les petits yeux portant `microdetail` ou `iris.detail` sont plus légers qu'avant. Aucune empreinte de visage testée n'a bougé (la seule empreinte en échec, `nose-visibility`, échoue à l'identique sur la branche d'origine).
- Non couvert : le raccourcissement par `headTurn` (la largeur est celle de l'enveloppe de face) ; les cils ne consomment pas le LOD.

## 2. Cornée et réfraction (`schema/eye-cornea.ts`, `geometry/eye/cornea.ts`, `render/eye/cornea.ts`)
Bloc `cornea` opt-in (`null` = rendu historique, identité exacte testée) :
| champ | rôle | consommé par |
|---|---|---|
| `curvature` 0,3–1,1 (déf. 0,76) | iris / rayon de courbure | loi de réfraction |
| `depth` 0,2–1,2 (0,61) | apex → plan de l'iris | loi de réfraction |
| `index` 1,05–2 (1,376) | indice optique | loi de réfraction |
| `refraction` 0–3 (1) | 0 aucune · 1 physique · >1 exagération | loi de réfraction |
| `haze` 0–1 (0,3) | transition cornéosclérale (EYE-03F) | `limbalHaze` (globe-inner) |
- **Loi** : lancer de rayon réel (Snell, cornée sphérique, caméra à l'infini), inversé numériquement et normalisé pour que le limbe reste le bord apparent (`warp(1) = 1`, taille de l'iris des références inchangée). Valeurs humaines : `warp(0,25) = 0,276`, `warp(0,5) = 0,543`, grossissement central ≈ 1,1 (humain ≈ 1,13). Monotone et identité à `refraction = 0` (testés).
- **Application** : `applyCornea`, appelée par `resolveEye`, remplace chaque paramètre radial par `warp(ρ)` : `pupil.size`, `layers[].inner / outer / spotRadius`, `detail.collarette.radius`, `rainbow`, `voids`, `slits`, `arcs.ringRho`, `embers.ringRho`. Rendu et `verifyEye` lisent le même œil.
- **Non réfracté** : reflets (ils sont sur la cornée : physiquement juste), fibres historiques `irisFibers`, répartition statistique des cellules de facettes, `accent.reach`, bague limbique.
- **Preuve en pixels** (œil de test `BASE`, `scripts/lib/verify-eye-cornea-render.ts`) : rayon de pupille mesuré 35,5 / 39,5 / 46,5 px pour `refraction` 0 / 1 / 3, loi 36,3 / 39,8 / 46,9. ⚠ La mesure exige une pupille nettement plus sombre que l'iris voisin : sur l'œil de feu elle donne 0 px, donc non utilisable sur les familles.
- **Vérification** (`verify/eye-cornea.ts`) : géométrie `cornea-warp-monotone`, `cornea-limbus-fixed` ; anatomie `cornea-pupil-magnification` (≤ 1,35, warn) ; style `cornea-visible` (écart ≥ 0,5 % du rayon, sinon paramètre orphelin, warn).
- **Rapport au TODO** : 03D, 03F et OPT-02 traités. 03C (limbe), 03E (reflets, surface) et 03H (occlusion) : rapprochés par le nom de `iris.limbalRing`, `iris.detail.limbal`, `highlights`, `microdetail.tearFilm / occlusion`, **non audités** ligne à ligne. 03G (volume apparent) : non fait.
- Effet de `haze` : mesuré (5 842 px sur l'œil de test) mais discret à l'écran dans les artefacts ; à régler à la main.

## 3. Bords palpébraux irréguliers (EYE-07E, `geometry/eye/edge-irregularity.ts`)
- `microdetail.edge: { irregularity, grain } | null` (opt-in). Le bord est échantillonné (48 points) et déplacé le long de la normale par trois ondes (lente / moyenne / fine), enveloppe nulle aux canthi, déplacement borné par **norme L1** à `EDGE_MAX_DEV = 0,03 × hEff` ; bord supérieur à 0,7 × le bas. Le LOD retire l'onde fine ; les tirages sont fixes (identité stable).
- **Même tracé** pour le clip de l'ouverture (`eye.ts`) et les deux traits de bord libre (`lids-fold.ts`) : pas d'interstice (testé).
- La règle `edge-deviation-bounded` a révélé que ma première normalisation (L2) laissait monter à ×√3 la borne : corrigée avant livraison.
- Vérification : `edge-deviation-bounded`, `edge-opening-simple` (aucun auto-croisement) ; style `edge-flat-clean` (œil `flat` ≤ 0,35, warn).
- Non fait : cils, pli palpébral et caroncule ne suivent pas le tracé perturbé (écart ≤ 3 % de hEff, non évalué visuellement à forte amplitude) ; EYE-07G (plis des canthi).

## 4. Atomes d'iris des références 07 et 10a (tous opt-in, défaut = historique)
| champ | effet |
|---|---|
| `facets.shard` | part des facettes fendue en deux éclats triangulaires de tons distincts (corde limitée à la facette) |
| `facets.dust` | jusqu'à 60 grains en losange turquoise côté lumière |
| `bubbles.sizeSpread` | tailles en loi de puissance (beaucoup de petites, quelques grosses) |
| `bubbles.rim` | force du contour sombre d'une bulle `crisp` |
| `embers.shape: 'lance'` | losange pointu à cœur blanc |
| `embers.scatter` | part des braises éparpillées hors de l'anneau |
- Les éclats tirent leurs choix par **hachage par facette**, pas dans le PRNG partagé : les facettes de base ne bougent pas (testé : tous les éléments de l'image sans éclats sont dans l'image avec).
- Recettes (`eye-iris-families-photo2.ts`) : émeraude `shard 0,3`, `dust 0,5`, 22 bulles de taille 0,088, `sizeSpread 0,5`, `rim 0,65`, `lift 0,93 → 0,4`, `vibrance 0,137 → 0,28` ; feu 30 braises « lance » de taille 0,024, `scatter 0,35`, vide extérieur 0,84 → 1 (force 0,7).
- **Mesures avant → après** (réf.) : feu part sombre 0,316 → 0,360 (0,373) ✅ ; émeraude part sombre 0,104 → 0,080 (0,101) — **recul**, dans la tolérance du test ± 0,04 ; étoiles émeraude 0,339 → 0,343 (0,312) ; luminance émeraude 136,2 → 136,2 (128,8), sat. 0,729 → 0,740 (0,738). Le gain de l'émeraude est visuel (bulles variées, éclats), pas métrique : les recalages ont servi à ne pas dégrader les métriques.
- `rim` 0,65 et non 0,3–0,4 que suggère la réf. 07 : avec un contour plus discret (et plus d'éclats), l'étoile mesurée montait à 0,40–0,44 pour une tolérance de 0,392 et la luminance à 144 pour une tolérance de 138,8 ; `lift` et `vibrance` ont été recalés en conséquence.

## 5. Tests et preuves
- Nouveaux : `tests/eye-lod-cornea-edge.test.ts` (12), `tests/eye-iris-pass16.test.ts` (10) ; 7 entrées `SWEEPS` (`cornea.*`, `microdetail.edge.*` : 194 à 5 842 px changés).
- Exécutés et verts : tous les fichiers `tests/*eye*` ; 30 autres fichiers qui exercent des yeux (≈ 1 410 tests, 29 fichiers verts). 1 échec, **préexistant** : `nose-visibility` « garde-fou du pivot » (même hash qu'avant la passe). **Suite complète (233 fichiers) non exécutée.**
- Artefacts : têtes entières émeraude et feu à lacet 0° / 25° (gros plans ×4), réfraction 0 / 1 / 3, bords 0 / 0,4 / 0,9, LOD à 4 tailles, atomes avant / après. Les yeux de la tête sont rendus avec `archetype: null` : le visage tiré est `feline`, qui impose une pupille en fente par-dessus la famille.

## 6. Reste à faire, par composant
- **LOD** : cils, rotation de tête, regroupement des filtres.
- **Cornée** : 03C / 03E / 03H à auditer ; 03G ; réfraction des fibres historiques et des cellules ; mesure en pixels sur pupille claire.
- **Bords** : cils / pli / caroncule sur le tracé perturbé ; 07G.
- **emerald (07)** : fentes 16 pour 6, première étoile 0,84 R pour 0,58, grain turquoise peu visible, 54 cellules pour 105.
- **fire (10a)** : anneau en halo large avec rayons (le moteur rend un anneau resserré), tirets non mesurés.
- **ice** : fentes 2 pour 4 (limite du détecteur sur fond sombre).
- **Poids SVG** : non mesuré après les nouveaux atomes.

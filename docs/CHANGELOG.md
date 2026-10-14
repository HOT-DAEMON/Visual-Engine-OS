# Journal des modifications — eye-engine

Un journal, pas un résumé marketing : chaque entrée dit ce qui a changé,
dans quel fichier, et avec quels tests à l'appui. Voir `docs/ERRORS.md`
pour le détail des erreurs rencontrées pendant le développement.

## Session 4 — Coordination inter-yeux + styles d'enveloppe

**Périmètre demandé** : ajouter la coordination inter-yeux (pour que les
expressions se lisent sur un visage entier), puis enrichir les formes
d'enveloppe déjà existantes avec d'autres silhouettes anime.

### Ajouté

- `eyebrow.pinch` (schema.ts) : convergence/écartement de la tête du
  sourcil (côté nez), indépendant de `tiltDeg`. Plage [-1, 1], défaut 0
  (aucun effet, rétrocompatible).
- `browGeometry` (eye-geometry.ts) déplace désormais le point de contrôle
  P0 (tête) horizontalement ET verticalement selon `pinch`, avec un signe
  qui s'inverse correctement selon `outerSide` (testé en miroir).
- `applyExpression` (expressions.ts) pilote `pinch` par émotion : colère
  +0.85, angoisse +0.55, tristesse +0.2, mélancolie +0.1, peur -0.4,
  lassitude 0.
- Groupe SVG identifiable `<g id="{eyeId}-brow">` (eye.ts) : point d'ancrage
  stable pour les tests bout-en-bout, sans dupliquer d'id (le contenu
  interne de `compileSurface` reste anonyme).
- `shape.style` (schema.ts) : `'almond' | 'round' | 'sharp' | 'drooping'`.
  Seul le canthus EXTERNE change de formule d'un style à l'autre ; le
  canthus interne (côté nez) reste identique, garantissant une anatomie
  cohérente quel que soit le style (vérifié par test d'égalité stricte).
- `generateRandomEye` tire désormais aussi `shape.style` (5 valeurs
  pondérées, 'almond' deux fois plus fréquent que les autres).
- Nouveaux exemples : `examples/coordination.json` (trois visages :
  colère / neutre / peur), `examples/eye-styles.json` (les 4 styles côte
  à côte). Ajoutés au banc d'essai (`preview/template.html`) sous les
  onglets « Coordination inter-yeux » et « Styles d'enveloppe ».
- `examples/first-eye.json` : cadrage agrandi (hauteur 400→520, position
  de l'œil ajustée) — le sourcil par défaut sortait du cadre depuis son
  introduction (session précédente), jamais remarqué faute de recadrage.
  Corrigé cette session, sans rapport avec le pinch ou les styles.

### Fichiers modifiés

`src/schema.ts`, `src/eye-geometry.ts`, `src/expressions.ts`, `src/eye.ts`,
`src/random-eye.ts`, `preview/template.html`, `scripts/build-preview.ts`,
`scripts/smoke_preview.py`, `tests/engine.test.ts`,
`tests/random-eye.test.ts`, `examples/first-eye.json`.

### Fichiers créés

`tests/brow-pinch.test.ts` (6 tests), `tests/inter-eye-coordination.test.ts`
(6 tests), `tests/eye-shape-style.test.ts` (10 tests), `docs/ROADMAP.md`,
`docs/CHANGELOG.md`, `docs/ERRORS.md`, `examples/coordination.json`,
`examples/eye-styles.json`.

### Tests

152 → 176 tests, tous verts. 5 mutations volontaires injectées pour
valider que les nouveaux tests détectent de vraies régressions (pinch
horizontal neutralisé, styles neutralisés, invariant canthus interne
cassé, ancrage inter-yeux cassé) : les 5 détectées. Détail dans
`docs/ERRORS.md`.

### Non fait dans cette session (délibérément)

- Refonte de l'arborescence du projet (voir `docs/ROADMAP.md`) : le
  découpage en dossiers par domaine et la limite de 100-200 lignes par
  fichier n'ont pas été touchés, pour ne pas mélanger refactor et
  fonctionnalités dans la même session, comme convenu.
- Bibliothèques de motifs (cœurs, étoiles, étincelles) pour l'iris/le
  highlight/la pupille : demandées, pas commencées.

## Session 5 — Refonte d'architecture (Google-like, domaines, ≤200 lignes/fichier)

**Demande** : restructurer tout le projet en dossiers par domaine, éliminer les
fichiers monolithiques, viser 100-200 lignes par fichier, sans casser quoi que ce
soit — travail fait avant d'empiler de nouvelles fonctionnalités, comme convenu.

### Ce qui a été fait

- `src/math.ts`, `prng.ts`, `color.ts`, `svg.ts` → `src/core/`.
- `light.ts`, `gaze3d.ts` → `src/lighting/`.
- `anchors.ts`, `expand.ts` → `src/composition/`.
- `palette.ts`, `random-eye.ts` → `src/generation/`.
- `materials.ts` (293 lignes) → `src/materials/{surface,shading,specular,
  compile-surface,presets}.ts` + barrel.
- `expressions.ts` (162 lignes) → `src/expressions/{deltas,apply}.ts` + barrel.
- `eye-geometry.ts` (416 lignes) → `src/geometry/eye/{primitives,opening,crease,
  lashes,eyebrow,canthi-fold}.ts` + barrel.
- `eye.ts` (523 lignes, le plus gros fichier du projet) → `src/render/eye/
  {helpers,default-skin,globe-inner,lids-fold,eyebrow-render,eye}.ts` + barrel.
  Découpage le plus délicat de la session : `globe-inner.ts` regroupe tout ce qui
  se dessine À L'INTÉRIEUR du clip de l'ouverture (iris, pupille, regard 3D,
  caroncule, ombres, reflets), `lids-fold.ts` tout ce qui est À L'EXTÉRIEUR (pli,
  bords, cils) — frontière choisie parce que c'est la vraie frontière de rendu
  (le clip-path), pas un découpage arbitraire.
- `robot.ts` (264 lignes) → `src/render/robot/{housing,lens,robot}.ts` + barrel.
- `schema.ts` (510 lignes, le deuxième plus gros fichier) → 14 fichiers dans
  `src/schema/` (un par brique : forme, iris/pupille, sourcil, regard/expression,
  cils/paupières, canthi/pli, hôte, robot, panneau, œil, scène) + barrel.
- `object.ts`, `panel.ts`, `host.ts` → `src/render/`.
- Nouveaux barrels `render/index.ts`, `materials/index.ts`, `schema/index.ts`,
  `geometry/eye/index.ts`, `composition/` et `expressions/index.ts` : le reste du
  code importe toujours depuis le dossier, jamais depuis un fichier interne.
- `compile.ts` et `index.ts` (barrel public) simplifiés pour importer depuis les
  nouveaux barrels plutôt que des chemins de fichiers individuels.
- `docs/ARCHITECTURE.md` créé : description de l'arborescence, justification des
  découpages, procédure de vérification.

### Résultat mesuré

- **58 fichiers source**, aucun au-dessus de 200 lignes (le plus gros :
  `render/eye/globe-inner.ts`, 199 lignes).
- **176 tests, tous verts**, sans aucune modification de test (hors mise à jour
  des chemins d'import) — la suite de tests n'a pas eu besoin d'être réécrite pour
  « s'adapter » au refactor, ce qui est le signe que le comportement public n'a pas
  changé.
- **Comparaison octet par octet** des 9 scènes d'exemple (first-eye, robots,
  anatomy, face, hosts, expressions, gallery, coordination, eye-styles) entre
  avant et après la refonte : identiques, à l'exception d'une métadonnée de
  provenance C2PA ajoutée par la plateforme de livraison (étrangère au moteur —
  voir `docs/ERRORS.md` pour le détail de cette vérification).
- `npx tsx scripts/bundle.ts` (esbuild, résolution de modules indépendante de
  `tsc`/`vitest`) reconstruit sans erreur : troisième vérification croisée.

### Non fait dans cette session

- Documentation ligne-à-ligne systématique (commenté par bloc/fonction, comme
  avant).
- Toute nouvelle fonctionnalité (bibliothèques de motifs, cils décoratifs,
  etc.) — délibérément exclu pour ne pas mélanger refactor et fonctionnalités.

## Session 6 — 10 archétypes

**Demande** : enrichir les archétypes (2 aujourd'hui : œil anime et robot) pour en
avoir environ 10.

### Ajouté

- `EyeSpec.archetype` (schema/eye-archetype.ts) : `null | 'realistic' | 'reptile'
  | 'feline' | 'doll' | 'alien' | 'demon'`. Résolu par `archetypes/apply.ts`
  (fonction pure, même mécanique que `expressions/apply.ts`) : remplace clé par
  clé `shape`/`iris`/`pupil`/`highlights`/`canthi`, et en bloc `sclera`/`lashes`/
  `eyebrow`, sans toucher au reste (regard, expression, ancrage…). Appliqué AVANT
  l'expression dans `compileEye`, pour qu'une expression reste combinable avec
  n'importe quel archétype.
- `kind: 'compound_eye'` (œil d'insecte) : dôme hexagonal, chaque facette teintée
  indépendamment (seed déterministe) avec son propre reflet. Géométrie de grille
  hexagonale pure dans `render/compound/hex-grid.ts`, rendu dans
  `render/compound/compound.ts`.
- `kind: 'gem_eye'` (œil de cristal) : réutilise l'enveloppe palpébrale existante
  (`geometry/eye/opening.ts`) mais remplace l'iris par un disque de facettes
  triangulaires façon pierre taillée (motif déterministe, pas de hasard — voir
  `render/gem/facets.ts`).
- `generateRandomEye` tire désormais aussi un archétype (75% de chances de rester
  en composition libre, 25% de piocher l'un des 6 préréglages).
- Nouveaux exemples `examples/archetypes.json` (les 6 préréglages côte à côte),
  `examples/new-kinds.json` (insecte + gemme), ajoutés au banc d'essai.

### Résultat mesuré

- **213 tests, tous verts** (190 avant cette session + 14 pour les préréglages +
  20 pour compound/gem_eye - 11 doublons de comptage de la session précédente
  réconciliés). `compound_eye` et `gem_eye` passent par le MÊME pipeline que les
  autres objets (ancrage sur hôte, id uniques, système de matériaux partagé pour
  le dôme de l'insecte) — vérifié par un test de scène mixte avec les 6 types
  d'objets ensemble.
- Un vrai bug trouvé et corrigé par ce test de scène mixte : collision entre un
  id choisi à la main (`${id}-dome-clip`) et la convention interne de
  `compileSurface` (voir `docs/ERRORS.md`, erreur 7).
- 2 mutations volontaires injectées (archétype ignoré, collision d'id
  réintroduite) : les 2 détectées.

### Non fait dans cette session

- Pas de 11e/12e archétype au-delà des 10 demandés.
- Les préréglages d'archétype ne sont pas exposés dans `generateRandomEye` au
  niveau du CHOIX de famille d'iris (`generateIrisPalette`) — un archétype
  pioché remplace entièrement la palette tirée par ailleurs, ce qui est
  cohérent avec la sémantique « l'archétype impose son identité visuelle » mais
  signifie qu'une partie du travail de `generateIrisPalette` est parfois
  silencieusement écrasée. Documenté ici plutôt que caché.

## Session 7 — Richesse de la pupille

**Demande** : « ajoute plus de vraie richesse aux pupilles du projet eye-engine
sans halluciner ». Reprend un point du tout premier cahier des charges
(contours multiples, remplissage multi-couleur orienté) jamais traité jusqu'ici.

### Ajouté

- `Pupil.fill` (schema/eye-iris-pupil.ts) : remplace `color: Hex` par un
  `ColorSource` complet (uni/linéaire/radial) — EXACTEMENT le même type que
  l'iris et la sclère, aucune nouvelle primitive de couleur créée. Un dégradé
  linéaire avec `angleDeg` donne directement l'effet « niveau de remplissage
  orienté » demandé, sans code supplémentaire.
- `Pupil.outlines` : 0 à 3 contours concentriques (`color`, `width`, `opacity`
  chacun), empilés vers l'extérieur en conservant le rapport largeur/hauteur de
  la pupille (essentiel pour une fente, pas seulement une pupille ronde).
- `Pupil.visible` : vrai booléen (absent auparavant malgré ce que `ROADMAP.md`
  affirmait — voir `docs/ERRORS.md` #9, corrigé cette session).
- Nouveau fichier `render/eye/pupil.ts` (fonction pure `renderPupil`,
  indépendante de `compileEye`, testable isolément) : volontairement SANS
  passer par `compileSurface`, parce qu'une pupille est un trou et non une
  surface éclairée (pas de reflet spéculaire ni de rampe d'environnement —
  les tester aurait été reproduire l'erreur inverse de hallucination : prêter
  à la pupille un comportement physique qu'elle n'a pas).
- `materials/compile-surface.ts` : `gradientDef` exporté (était privé) pour que
  `pupil.ts` réutilise exactement le même constructeur de dégradé que l'iris et
  la sclère, au lieu d'en écrire un second.
- `generateRandomEye` explore les nouveaux axes (type de remplissage, présence
  d'un contour, rare pupille invisible) — toujours de façon plausible, pas
  décorative à outrance (la plupart des pupilles générées restent un simple
  disque sombre, cohérent avec la réalité).
- Nouvel exemple `examples/pupil-richness.json` (5 pupilles : remplissage uni,
  niveau orienté, double contour, fente avec contour dans l'aspect de la fente,
  invisible) ajouté au banc d'essai.

### Résultat mesuré

- 214 → 234 tests, tous verts. 18 nouveaux tests dédiés
  (`tests/pupil-richness.test.ts`) + 1 test de diversité dans
  `random-eye.test.ts`.
- 2 mutations volontaires injectées (`visible` ignoré, rapport d'aspect des
  contours cassé) : les 2 détectées.
- `globe-inner.ts` dépassait 200 lignes après l'ajout inline ; extrait en un
  fichier dédié (`pupil.ts`, 59 lignes) pour revenir exactement à 200 —
  discipline de la session 5 maintenue.
- Vérifié visuellement (5 configurations rendues) : remplissage orienté bien
  visible comme un niveau à deux tons, double contour concentrique net, contour
  qui suit correctement l'aspect d'une pupille en fente plutôt que de rester
  circulaire, pupille invisible qui laisse l'iris plein sans trace résiduelle.

### Non fait dans cette session

- Pas de forme de pupille libre (cœur, étoile…) — seulement remplissage et
  contour enrichis ; la pupille reste une ellipse/fente. Demandé plus tôt dans
  le projet, toujours en attente (`docs/ROADMAP.md`).
- Le remplissage radial n'a pas de décalage de foyer (`fx`/`fy`) — hérité de la
  limite du `ColorSource` partagé par tout le moteur (iris/sclère compris), non
  modifié ici pour ne pas affecter ces autres composants hors du périmètre
  demandé.

## Session 8 — Moteur de cils riche + galerie à 48 avec paires gauche/droite

**Demande** : (1) porter la galerie de 24 à 48 individus tous différents, produire
la paire œil gauche/droit de chacun, alignés selon plusieurs directions de
regard ; (2) un vrai moteur de cils couvrant morphologie/fibres/apparence,
avec randomness contrôlée.

### Moteur de cils

- `schema/eye-lashes.ts` (nouveau, remplace l'ancien `eye-lids-lashes.ts`
  fusionné) : 20 champs par groupe (haut/bas), organisés en MORPHOLOGIE
  (`thickness`, `length`, `curl`, `sweep`, `angleDeg`, `tipSharpness`, `arch.
  {peak,width,strength}`), FIBRES (`lengthVariation`, `thicknessVariation`,
  `orientationVariation`, `curlVariation`, `positionDispersion`), APPARENCE
  (`material`, `opacity`, `colorVariation`, `gloss`).
- Deux simplifications assumées et documentées dans le code : « angle » et
  « inclinaison » fusionnés en un seul champ (`angleDeg` — les dupliquer
  n'ajouterait aucun effet visuel distinct) ; « rugosité » n'est pas séparée de
  « brillance » (`gloss`) — un cil est un trait fin, pas une surface avec une
  rugosité propre.
- `geometry/eye/lashes.ts` réécrit : chaque cil tire 6 valeurs dans un ORDRE
  FIXE (position, longueur, épaisseur, orientation, courbure, couleur), que le
  cil soit ou non retenu ensuite — la randomness reste contrôlée et stable
  seed par seed.
- Nouveau fichier `render/eye/lashes-render.ts` : assemble un groupe de cils
  (remplissage avec variation de luminosité par cil + liseré de brillance
  directionnel optionnel, calculé à partir du bord du cil déjà tourné vers la
  lumière — pas un calcul d'éclairage physique sur une fibre cylindrique,
  documenté comme approximation légère assumée).
- `materials/compile-surface.ts` : `gradientDef` déjà exporté la session
  précédente, réutilisé ici pour rien de neuf — la couleur des cils reste un
  aplat ou hérite de celle de la paupière, par choix (un dégradé par cil
  individuel aurait été un ajout de complexité sans bénéfice visuel net à
  cette échelle).

### Galerie

- `scripts/gallery.ts` : 24 → 48 (8 colonnes × 6 lignes), mêmes garanties de
  distinction déjà testées (`random-eye.test.ts`).
- Nouveau `scripts/gallery-pairs.ts` : pour les 48 mêmes identités, produit la
  paire œil gauche/œil droit (`outerSide` imposé explicitement sur chaque
  copie — un vrai miroir, pas deux tirages indépendants). 96 yeux au total.
- Nouveau `scripts/gaze-sheet.ts` : feuille de regard sur un ÉCHANTILLON de 6
  identités (sur les 48, réparties dans toute la galerie) × paire gauche/
  droite × 5 directions (droit devant, haut, bas, gauche, droite) = 60 yeux.
  **Périmètre assumé et expliqué** : la combinatoire complète (48 × 2 × 6)
  donnerait 576 cases, un fichier ingérable et une image illisible ; 6
  identités suffisent à prouver la mécanique sur un format exploitable.
  « 3/4 » et « vers l'avant » ont été fusionnés avec « droit devant » (même
  position de regard, yaw=pitch=0).

### Résultat mesuré

- 234 → 266 tests, tous verts. 24 tests dédiés au moteur de cils
  (`lash-engine.test.ts`), 7 aux scènes d'assemblage (`gallery-assets.test.ts`).
- 3 mutations volontaires injectées (angleDeg ignoré, lengthVariation ignoré
  deux fois) : la première détectée du premier coup, la deuxième a RÉVÉLÉ un
  vrai trou de test (le test ne vérifiait que l'absence d'effet à 0, jamais la
  présence d'un effet réel à une valeur positive) — corrigé en ajoutant le
  test manquant avant de continuer (voir `docs/ERRORS.md` #10).
- 2 erreurs d'isolement de test trouvées et corrigées en cours de route (la
  courbure et l'éventail par défaut faussaient des comparaisons de longueur
  pure) — détail dans `docs/ERRORS.md` #11.
- Vérifié visuellement : 5 configurations extrêmes du moteur de cils
  (`examples/lash-engine.json`), 48 identités distinctes, 96 yeux en paires
  miroir correctement alignées, décalage de regard net à l'agrandissement
  (confirmé après qu'une première vue d'ensemble à petite échelle ait semblé
  ambiguë — toujours vérifier à l'échelle où l'effet est réellement visible).

### Non fait dans cette session

- Pas de mélange de PLUSIEURS morphologies de cils au sein d'un même groupe
  (tous les cils d'un groupe restent une seule morphologie dispersée
  statistiquement, pas plusieurs familles distinctes superposées).
- La feuille de regard ne couvre que 6 identités sur 48, pas la combinatoire
  complète — périmètre assumé et expliqué ci-dessus.

## Session 9 — Rotation 3D de la tête, 7 nouvelles expressions, galeries complètes

**Demande** : (1) une vraie rotation de tête en 3D (pas le regard déjà existant qui ne fait bouger
que le globe dans son orbite), combinable avec le regard ; (2) les 48 identités, pas 6, pour la
rotation de tête ET pour des expressions supplémentaires (colère, tristesse, étonnement, maussade,
furieux, joyeux, souriant, sanglant, fatigué, stressé…), splittées sur plusieurs galeries plutôt
qu'un seul fichier illisible.

### Rotation 3D de la tête

- Nouveau `src/lighting/head-turn.ts` : `headTurnOf(yaw, pitch, headRadius)` réutilise TEL QUEL
  `projectGaze` de `gaze3d.ts` (même physique de projection orthographique d'un point sur une
  sphère) — pas une formule réinventée. `rotateLightForHeadTurn` applique une vraie rotation 3D
  (matrices standard autour des axes Y puis X) du vecteur de lumière, pour que l'ombrage reste
  physiquement cohérent quand la tête se détourne de la source.
- `schema/eye-head-turn.ts` : `headTurn: {yawDeg: -75..75, pitchDeg: -60..60}` sur `EyeSpec`.
- `render/eye/eye.ts` : enveloppe TOUT le contenu de l'œil (sclère, iris, paupières, cils, sourcil)
  dans un groupe SVG compressé + décalé selon `headTurn`, et fait passer la lumière déjà tournée en
  3D à tout le pipeline d'ombrage existant (highlights compris) — aucune autre fonction de rendu
  n'a eu besoin d'être modifiée.
- **Combinable avec `gaze`** par construction : le regard continue de faire bouger le globe DANS
  l'orbite déjà compressée par la rotation de tête, les deux effets s'empilent proprement.
- **Limite assumée et documentée** : sans hôte/visage, pas de nez pour occulter partiellement l'œil
  à angle marqué — seuls le raccourcissement et la parallaxe sont modélisés.
- Amélioration connexe : `foreshortenTransform` (gaze3d.ts) n'utilisait pas `num()` pour formater
  ses nombres (pleine précision flottante, jusqu'à 16 chiffres) — corrigé, ce qui réduit aussi la
  taille de tous les fichiers générés utilisant le regard 3D, pas seulement la rotation de tête.

### 7 nouvelles expressions (13 au total)

`surprised`, `sulky`, `furious`, `joyful`, `smiling`, `fierce`, `stressed` — chacune un delta de
pose distinct et documenté dans `expressions/deltas.ts`. Deux décisions assumées :
- « fatigué » n'a pas sa propre entrée : il est couvert par `drowsy` (même relâchement de
  paupière) — les dupliquer n'ajouterait rien de distinct.
- « sanglant » est interprété comme `fierce` (regard féroce/perçant), faute de pouvoir confirmer
  le sens voulu dans la liste fournie — réserve explicite dans le code et dans `ROADMAP.md`.

### Galeries complètes (plus de limitation à 6 identités)

- `scripts/gallery-variants.ts` (nouveau, générique) génère :
  - 2 galeries de rotation de tête (`gallery-head-left34`, `gallery-head-right34`) : les 48
    identités × paire gauche/droite, à ±35° — 96 yeux chacune.
  - 13 galeries d'expression (`gallery-expr-<kind>`) : les 48 identités, une expression par
    fichier — 48 yeux chacune, 624 yeux au total.
- Fichiers volumineux (jusqu'à 2,3 Mo) délibérément PAS embarqués dans le banc d'essai interactif
  (qui resterait sinon de plusieurs dizaines de Mo) — livrés comme fichiers séparés. Deux
  démonstrations compactes (`head-turn-demo.json`, `new-expressions.json`) ajoutées au banc d'essai
  à la place, pour une vérification interactive sans faire exploser sa taille.

### Résultat mesuré

- 266 → 303 tests, tous verts. 16 tests dédiés à la rotation de tête
  (`head-turn.test.ts`), 7 aux nouvelles expressions, 24 tests structurels pour les 17 fichiers de
  galerie (existants + nouveaux).
- 4 mutations volontaires injectées (lumière non tournée, foreshortening désactivé) : les 4
  détectées.
- Une mesure pixel précise (comptage de colonnes non-fond) a confirmé que la compression de
  l'enveloppe correspond EXACTEMENT à `cos(yaw)` (ratio mesuré 0,817 contre 0,819 attendu à 35°) —
  après une première impression visuelle erronée (voir `docs/ERRORS.md` #12) qui avait fait croire
  à tort à un défaut de chevauchement puis à une absence de compression.

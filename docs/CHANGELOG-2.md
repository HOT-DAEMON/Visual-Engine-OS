# Journal des modifications — suite (2/3)

Suite de `docs/CHANGELOG.md`.

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

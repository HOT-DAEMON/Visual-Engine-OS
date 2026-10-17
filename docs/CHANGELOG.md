# Journal des modifications — eye-engine

Un journal, pas un résumé marketing : chaque entrée dit ce qui a changé,
dans quel fichier, et avec quels tests à l'appui. Voir `docs/ERRORS.md`
pour le détail des erreurs rencontrées pendant le développement.

> Journal découpé en fichiers de ≤ 200 lignes (discipline de lisibilité) :
> `CHANGELOG-4.md` (le plus récent : session 13, cheveux complets) → `CHANGELOG-3.md` → `CHANGELOG.md` / `CHANGELOG-2.md`.

## Session 7 — Visage complet aléatoire (au-delà d'une paire d'yeux)

Les yeux deviennent les ENFANTS d'un visage : leur place est définie par le visage, jamais par leur forme ou leur taille.

- **Hôte `shape: 'face'`** (`schema/face.ts`, `schema/host.ts`) : crâne/mâchoire, oreilles, nez, bouche, joues, tous en fractions de la largeur/hauteur de l'hôte (mise à l'échelle sans déformation). `face` refusé sur un autre type d'hôte (`schema/scene.ts`).
- **`src/face/`** (géométrie pure) : `outline.ts` (contour en 3 cubiques raccordées, `halfWidthAt`), `landmarks.ts` (repères : ligne des yeux, canthi internes, base du nez, bouche — SOURCE UNIQUE lue par le rendu ET par le placement des yeux), `fit-eye.ts` (ajustement).
- **Ancrage par le canthus interne** : l'ancre est le point anatomique fixe ; le `transform` de l'œil amène son `pi` exactement dessus, l'échelle est bornée par l'orbite (temple, front nu, nez, ligne médiane). Un œil trop grand RÉTRÉCIT, il ne déborde jamais ; les 12 styles d'enveloppe partagent le même canthus.
- **`render/face/`** : `ears.ts`, `nose.ts`, `mouth.ts` (lèvres, intérieur sombre, dents), `face.ts` ; `render/host.ts` y délègue.
- **Génération** : `generation/eye-pool.ts` (les 48 identités des galeries, gauche/droite en vrai miroir, expressions de `gallery-expr-*`), `random-face.ts` (+ helpers : peau procédurale, bouche induite par l'expression). `scripts/gallery-faces.ts` → `examples/gallery-faces.json` (48 visages).
- **Tests** : +156 (358 → 514) — canthus exactement sur le repère APRÈS expansion de scène, œil dans le crâne/sous le front/au-dessus du nez, miroir, indifférence à la forme/grosseur, cohérence expression/bouche. L'empreinte des scènes d'exemple n'a pas bougé.
- **Documentation** : CHANGELOG et ERRORS découpés en suites (> 200 lignes) ; ROADMAP, ARCHITECTURE, README mis à jour.

## Session 6 — Liner ailé, cils travaillés, iris détaillé (+ silhouettes allongées)

Tout est OPT-IN : valeurs par défaut (`null` / `0`) = rendu historique inchangé, garanti par
l'empreinte exacte des scènes d'exemple d'origine (aucune n'a été modifiée ; seul `examples/eye-styles-extra.json`, créé lors de cette série de sessions, a été mis à jour).

- **Silhouettes** : `triangle` prolongé de 34 % de la largeur côté externe (18 % puis +16 %) et
  `diamond_v2` de 32 % (16 % puis +16 %). `diamond` (original) est volontairement INTACT (valeurs
  figées par test).
- **Révision `triangle`** : les courbes sont maintenant un AJUSTEMENT aux moindres carrés (écart moyen
  0,6 px sur 109 px) sur le contour de la fente relevé sur l'œil turquoise de la planche : dessus
  quasi plat, fond LARGE et arrondi (point bas à 41 % depuis l'interne), longue diagonale externe.
  Un test compare la forme générée au tracé relevé (écart moyen < 1,5 % de la largeur). L'ancien
  sommet pointu donnait un effet de « creux ».
- **Révision `chibi`** : œil beaucoup plus haut (×1,5) et prolongé de 22 % côté externe (rapport h/l
  ≈ 0,78), côté externe en arc de disque, coin externe étiré vers le haut-droit.
- `vitest.config.ts` : `testTimeout` à 30 s (voir ERRORS.md n°16 : machine à un seul cœur).
- **Liner ailé** (`lids.liner`, `geometry/eye/liner.ts`, `render/eye/liner.ts`) : forme pleine à
  épaisseur progressive, dégradé `color → tipColor`, aile en cubique orientée par rapport à
  l'horizontale de l'œil (départ tangent à la paupière pour la continuité), brillance, liner
  inférieur. Remplace `lids.wing` quand il est défini.
- **Cils** (`geometry/eye/lashes.ts`, `lash-extras.ts`, `render/eye/lashes-render.ts`) :
  `outerLength`, `outerLift`, `clump`/`clumpSize`, et `upper.flick` (cils cubiques recourbés).
  Les racines se posent sur le bord haut du liner. Les nouveaux tirages utilisent des PRNG dédiés :
  les cils ordinaires ne bougent pas d'un octet.
- **Iris détaillé** (`iris.detail`, `render/eye/iris-detail.ts`, `iris-strands.ts`) : 11 couches,
  de la zone pupillaire aux scintillements — voir ROADMAP.
- `examples/eye-details.json` (6 yeux, inspirés des 4 yeux de la planche de référence),
  `tests/liner-lashes.test.ts` (19 tests), `tests/iris-detail.test.ts` (14 tests).
- `.gitignore` ajouté (`node_modules/`, `out/`).

## Session 5 — Nouveaux styles d'enveloppe (chibi, angular, compressed, rounded_rect, triangle, circle, diamond, diamond_v2)

`shape.style` passe de 4 à 12 valeurs (le défaut `'almond'` et les 3 autres styles sont inchangés) :

- `'chibi'` : grand œil arrondi façon Goku / Anya Forger — ouverture haute (+22 %), courbes
  supérieure et inférieure prononcées, coin externe très légèrement relevé.
- `'angular'` (E2) : contour supérieur presque rectiligne, coin externe effilé, courbures tendues.
- `'compressed'` (E3) : hauteur réduite par la fermeture des paupières (la paupière haute descend
  plus que la basse ne monte), largeur inchangée.
- `'rounded_rect'` : rectangle à angles arrondis (côtés quasi droits, dessus plat) ; le rayon des
  coins suit `canthi.*.roundness`.
- Silhouettes de référence (planche « Almonde / Triangle / Circle / Diamond ») :
  - `'triangle'` : dessus quasi plat, coin externe haut et effilé, coin interne arrondi, sommet du
    bas à ~45 % depuis le canthus interne ; presque tout le volume est sous la ligne des canthi.
    Révision : œil plus haut (×1,15) et prolongé de 18 % côté externe ; le flanc externe est
    CONVEXE (il tombe presque à la verticale du coin externe puis s'incurve vers le sommet).
  - `'circle'` : demi-cercles de Bézier, aucun coin ; impose une hauteur ≥ 0,92 × largeur.
  - `'diamond'` : parallélogramme dont les deux coins AIGUS sont les canthi (interne en bas, externe
    en haut) et dont les coins obtus sont arrondis par la courbe (contrôles collés au coin).
    Conservé tel quel (valeurs figées par test).
  - `'diamond_v2'` : double de `'diamond'` retravaillé d'après des mesures prises sur le croquis :
    +16 % de longueur côté externe (ratio l/h ≈ 1,9), canthi aigus à +0,40 H (interne) et −0,36 H
    (externe) — les extrema ±0,5 H sont portés par les coins obtus —, dessous posé à l'horizontale
    (très légère descente vers l'externe), dessus qui part du coin haut-interne et redescend vers
    le canthus externe, coins obtus poussés de 22 % pour rester proches de l'angle du croquis.
- `examples/eye-styles-extra.json` (`almond` en référence + les nouveaux styles),
  `tests/eye-shape-styles-extra.test.ts`.
- `generateRandomEye` n'a volontairement PAS été modifié : changer sa liste de styles décalerait le
  tirage de toutes les seeds existantes (non-régression des snapshots).

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

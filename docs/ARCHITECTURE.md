# Architecture — eye-engine

Arborescence par domaine, un fichier = une responsabilité. Règle appliquée
cette session : aucun fichier source au-dessus de ~200 lignes (le plus
gros, `render/eye/globe-inner.ts`, fait 199 lignes). Chaque dossier
expose un `index.ts` qui ré-exporte tout ce qu'il publie : le reste du
code importe toujours depuis le dossier (`from '../materials'`), jamais
depuis un fichier interne (`from '../materials/compile-surface'`), sauf
les fichiers à l'intérieur même du dossier qui s'importent entre eux.

## Dossiers

```
src/
  core/            Primitives génériques, zéro connaissance du domaine.
                    math.ts, prng.ts, color.ts, svg.ts (constructeur SVG à liste blanche).

  schema/          Contrat Zod — la frontière entre le JSON (prompt/LLM) et le moteur.
                    Un fichier par brique (eye-shape, eye-iris-pupil, eye-eyebrow,
                    eye-gaze-expression, eye-lids-lashes, eye-canthi-fold, eye.ts qui les
                    assemble, host.ts, robot.ts, panel.ts, scene.ts pour la validation
                    inter-champs). primitives.ts et color-material.ts sont les fondations
                    partagées par tout le reste.

  materials/       Système de matériaux/lumière partagé par TOUS les objets.
                    surface.ts (interfaces Surface/BBox, couleurs dérivées),
                    shading.ts (constantes réglables), specular.ts (reflet + compileGloss),
                    compile-surface.ts (orchestrateur : base, ombrage, métal, reflets,
                    émission), presets.ts (matte/satin/glossy_wet/polished_metal/
                    waxed_metal/emissive).

  lighting/        light.ts (vecteur de lumière, repère local) et gaze3d.ts (rotation
                    sphérique du globe oculaire, raccourcissement/foreshortening).

  geometry/eye/    Géométrie pure de l'œil — fonctions sans SVG, testables isolément.
                    primitives.ts (Vec/Cubic/cubicAt), opening.ts (fente palpébrale,
                    styles almond/round/sharp/drooping), opening-styles.ts (styles ajoutés :
                    chibi/angular/circle/triangle/diamond/diamond_v2/rounded_rect), crease.ts (pli palpébral),
                    lashes.ts, lash-extras.ts (mèches, cils longs externes), liner.ts
                    (liner ailé : contour, aile, profil d'épaisseur),
                    eyebrow.ts (sourcil + poils), canthi-fold.ts (caroncule,
                    pli épicanthique).

  composition/     anchors.ts (similarités 2D, ancres/motifs d'un hôte),
                    expand.ts (résout `place` en exemplaires autonomes, transformation
                    monde = hôte ∘ ancre ∘ objet).

  expressions/      deltas.ts (table des émotions), apply.ts (fonction pure qui
                    recalcule la pose d'un œil pour une émotion donnée).

  face/             Géométrie pure du visage (aucun SVG) : outline.ts (contour crâne/mâchoire,
                    halfWidthAt), landmarks.ts (repères anatomiques — SOURCE UNIQUE lue par le rendu
                    et par le placement des yeux), fit-eye.ts (ajustement d'un œil à l'orbite :
                    ancre = canthus interne, échelle bornée par temple/front/nez/ligne médiane).

  generation/       palette.ts (couleurs d'iris procédurales), random-eye.ts
                    (génération combinatoire d'un œil complet), eye-pool.ts (les 48 identités des
                    galeries, paires gauche/droite), random-face.ts + random-face-helpers.ts
                    (visage complet : peau, proportions, bouche induite par l'expression, yeux posés).

  render/           Un compilateur SVG par archétype d'objet.
    object.ts         objectTransform, interface CompiledObject.
    panel.ts, host.ts
    eye/              helpers.ts (fonctions pures : chemins, irisRadii/Center, etc.),
                      globe-inner.ts (tout ce qui est DANS le clip de l'ouverture :
                      iris, pupille, regard 3D, caroncule, ombres, reflets),
                      iris-detail.ts + iris-strands.ts (iris détaillé : couches, fibres,
                      collerette, flammes — insérés par globe-inner.ts),
                      lids-fold.ts (tout ce qui est HORS clip : pli, bords, cils),
                      liner.ts (dessin du liner ailé, appelé par lids-fold.ts),
                      eyebrow-render.ts, eye.ts (orchestrateur), default-skin.ts.
    face/             face.ts (surface + assemblage), ears.ts, nose.ts, mouth.ts ; appelé par host.ts
                      quand `shape: 'face'`.
    robot/            housing.ts (boîtier + vis), lens.ts (lentille + capteur + verre),
                      robot.ts (orchestrateur).

  compile.ts        Dispatch par type d'objet + assemblage de la scène entière.
  index.ts           Barrel public : c'est la seule API que les tests et les scripts
                      utilisent (`import { compileScene } from '../src'`).
```

## Pourquoi ce découpage

- **globe-inner.ts / lids-fold.ts** (et non une décomposition plus fine par élément
  visuel) : ces deux fichiers regroupent respectivement tout ce qui est à l'intérieur
  et à l'extérieur du clip-path de l'ouverture palpébrale. C'est la frontière la plus
  naturelle du rendu de l'œil — un découpage plus fin aurait multiplié les paramètres
  partagés (lumière locale, couleur de peau, géométrie de l'ouverture) sans gain de
  clarté réel.
- **housing.ts / lens.ts** pour le robot : même logique, deux zones visuelles
  clairement séparées (le boîtier mécanique, la lentille optique).
- **Un fichier par brique de schéma** : chaque fichier correspond à un groupe de
  champs qu'un utilisateur du moteur modifie ensemble (la forme, le sourcil, le
  regard…). `scene.ts` est séparé car c'est le seul endroit avec de la validation
  inter-champs (ancres qui existent, capteur qui tient dans l'ouverture).

## Dépendance intentionnelle : schema/scene.ts → composition/anchors.ts

`scene.ts` importe `resolveAnchors`/`selectAnchors` depuis `composition/anchors.ts`
pour valider qu'un `place.anchors` référence bien des ancres existantes. C'est une
exception consciente à l'idée que « schema ne dépend de rien » : dupliquer cette
logique de résolution dans le schéma aurait un cout de maintenance pire que la
dépendance. `anchors.ts` ne dépend en retour que du TYPE `HostSpec` (import
`type`), jamais d'une valeur — aucune dépendance circulaire à l'exécution.

## Comment vérifier qu'un changement n'a rien cassé

1. `npm run typecheck` — toute référence à un symbole déplacé sans import mis à jour
   échoue immédiatement.
2. `npm test` — 514 tests, dont une empreinte SHA-256 exacte du SVG produit pour la
   scène `first-eye` (`tests/__snapshots__/engine.test.ts.snap`) : le moindre octet
   différent dans le rendu la fait échouer.
3. `npm run bundle` — reconstruit le banc d'essai avec esbuild, qui résout les
   imports indépendamment de `tsc`/`vitest` : une deuxième vérification de la
   cohérence de l'arborescence avec un outil différent.

Cette refonte (découpage de `eye.ts`, `schema.ts`, `eye-geometry.ts`, `materials.ts`,
`robot.ts` — environ 1860 lignes à elles cinq — en 58 fichiers organisés par domaine)
a été vérifiée par ces trois moyens à chaque étape, et par une comparaison octet
par octet des 9 scènes d'exemple avant/après (identiques, à l'exception d'une
métadonnée de provenance C2PA ajoutée par la plateforme de livraison, étrangère au
moteur). Détail session par session dans `docs/CHANGELOG.md`.

## Visage : pourquoi l'ancre est le canthus interne

Un œil n'a pas de « centre » stable : selon le style (chibi, triangle…), sa fente s'étend d'un côté ou de
l'autre de l'origine. Le canthus interne, lui, est le point osseux fixe de l'orbite. Le visage définit sa
position (ligne des yeux × demi-écart inter-canthal) ; `fitEyeToFace` règle le `transform` de l'œil pour que
son `pi` tombe exactement dessus, puis borne l'échelle. Les yeux sont de vrais enfants (`place` sur l'hôte) :
déplacer, tourner ou mettre à l'échelle le visage entraîne les yeux, lumière comprise.

## Découpage de la documentation

Tout fichier de `docs/` est limité à ~200 lignes ; au-delà, une suite numérotée est créée
(`CHANGELOG-2.md`, `ERRORS-2.md`…), la plus récente restant dans le fichier sans numéro.

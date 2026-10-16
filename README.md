# eye-engine — MVP « œil » (SVG 2D)

Un JSON validé entre, un SVG déterministe sort. Objets disponibles : `eye` (avec 6 préréglages d'archétype — realistic/reptile/feline/doll/alien/demon — en plus de l'anime par défaut), `robot_eye`, `compound_eye` (œil composé d'insecte), `gem_eye` (œil de cristal à facettes), `panel` (preuve de généricité) et `host` (surface porteuse d'ancres ; `shape: "face"` = visage complet). 10 archétypes au total — détail dans `docs/ROADMAP.md`.
Le système de matériaux et de lumière est partagé : tous passent par le même code.

## Utilisation

```bash
npm install
npm test                                  # 514 tests
npm run typecheck
npm run render -- examples/showcase.json out 1440   # SVG + PNG (resvg) dans out/
npm run bundle                            # dist/preview.html : banc d'essai autonome
```

Entrée minimale (tout le reste reçoit des valeurs par défaut validées) :

```json
{ "objects": [ { "kind": "eye", "id": "eye-main", "seed": 7 } ] }
```

```ts
import { compileScene } from './src';
const r = compileScene(json);          // { ok: true, svg, scene } | { ok: false, issues: string[] }
```

Poser des yeux sur un hôte :

```json
{
  "objects": [
    { "kind": "host", "id": "head", "material": { "preset": "matte", "color": "#eec9ad" },
      "anchors": [ { "id": "eye-l", "x": -0.4 }, { "id": "eye-r", "x": 0.4 } ] },
    { "kind": "eye", "id": "eyes", "place": { "host": "head", "anchors": ["eye-l", "eye-r"] },
      "shape": { "outerSide": "auto" } }
  ]
}
```

`place.patterns` pose un objet sur tout un motif (`ring` : anneau, `follow: "surface"` oriente
chaque exemplaire selon la normale de l'hôte — utile pour un monstre à plusieurs yeux ; `line` :
alignement). `variation: "vary"` décale la seed de chaque exemplaire pour éviter des yeux identiques.

Générer un œil complet aléatoirement (composition combinatoire — voir « Composition quasi infinie »
plus bas) :

```ts
import { generateRandomEye } from './src';
const eye = generateRandomEye(42);              // toujours le même résultat pour la seed 42
const angry = generateRandomEye(42, { expression: { kind: 'angry', intensity: 1 } });
```

Visage complet aléatoire (crâne, oreilles, nez, bouche + une paire d'yeux des galeries posée comme enfants du
visage, ancrée au canthus interne et ajustée à l'orbite) :

```ts
import { generateRandomFace, compileScene } from './src';
const face = generateRandomFace(42, { identity: 7, transform: { x: 320, y: 300 } });   // 0–47 : identité de galerie
const r = compileScene({ width: 640, height: 600, objects: face.objects });
```

`npx tsx scripts/gallery-faces.ts` produit `examples/gallery-faces.json` (48 visages, une paire de galerie chacun).

Un visage complet a cheveux, cou, pilosité et asymétrie légère (tirés par la seed, ou imposés) :

```ts
generateRandomFace(42, {
  hair: { style: 'long', fringe: 'curtain', color: '#4a2c17' },
  facialHair: { mustache: 'handlebar', beard: 'full' },
  asymmetry: { eyeScale: 0, eyeOpenness: 0, eyeRollDeg: 0, eyeDy: 0, mouthTiltDeg: 0 }, // visage symétrique
});
```

`npx tsx scripts/artefacts-face.ts` régénère les preuves visuelles dans `artefacts/` (voir `artefacts/README.md`).

Regard 3D et expression, sur un œil écrit à la main :

```json
{ "kind": "eye", "id": "e", "gaze": { "yawDeg": 20, "pitchDeg": -10 },
  "expression": { "kind": "sad", "intensity": 0.7 } }
```

## Architecture

Le code est organisé par domaine sous `src/` (core, schema, materials, lighting,
geometry/eye, composition, expressions, generation, render) — aucun fichier
source ne dépasse 200 lignes. Détail complet, justification des découpages et
procédure de vérification dans **`docs/ARCHITECTURE.md`**.

| Dossier/fichier | Rôle |
|---|---|
| `src/schema.ts` | Contrat Zod strict (clé inconnue, couleur mal formée, hors bornes ⇒ rejet). Le prompt/LLM devra produire ce JSON. |
| `src/materials.ts` | Système de matériaux partagé : `compileSurface(id, surface, material, lumière)`. Un objet fournit sa géométrie ; couleur, dégradés, métal, vernis, émission, ombrage viennent d'ici. |
| `src/presets.ts` | `matte`, `satin`, `glossy_wet`, `polished_metal`, `waxed_metal`, `emissive` (valeurs = choix de conception, pas des mesures physiques). |
| `src/light.ts` | Lumière globale (azimut/hauteur) → vecteur ; passage au repère local d'un objet tourné. |
| `src/eye.ts` | Œil anime : sclère, iris, fibres seedées, pupille, reflets, paupières, cils, sourcil, canthi, pli épicanthique. |
| `src/eye-geometry.ts` | Géométrie pure de l'œil (fonctions sans SVG) : fente palpébrale, pli, cils, sourcil, caroncule, pli épicanthique — testable indépendamment du rendu. |
| `src/robot.ts` | Œil de robot : boîtier (anneau métallique + vis), lentille traitée, ouverture, capteur émissif, verre (`compileGloss`). Aucun hasard. |
| `src/panel.ts` | Panneau rectangulaire. |
| `src/host.ts` | Hôte : surface (ellipse ou rectangle arrondi) qui porte des ancres nommées ou générées par motif (`ring`, `line`). |
| `src/anchors.ts` | Similarités 2D (`compose`), génération et sélection des ancres, orientation selon la normale de surface. |
| `src/expand.ts` | Résout `place: {host, anchors/patterns}` en exemplaires autonomes : transformation MONDE = hôte ∘ ancre ∘ transform, résolution de `outerSide: 'auto'` et héritage de `skin`. |
| `src/gaze3d.ts` | Rotation 3D du globe oculaire dans l'orbite (yaw/pitch), projection orthographique physique : déplacement de l'iris + raccourcissement (foreshortening) exact d'un disque vu de biais. |
| `src/expressions.ts` | Recalcule la « pose » d'un œil neutre pour une émotion (colère, tristesse, peur, angoisse, mélancolie, lassitude) : fonction pure, aucun hasard, n'affecte pas les couleurs. |
| `src/palette.ts` | Génère une palette d'iris procédurale (dégradé radial) à partir d'une seed, par famille de couleur plausible (brun, ambre, noisette, vert, gris, bleu). |
| `src/random-eye.ts` | Génère un œil complet et valide en tirant chaque trait indépendamment (forme, canthi, pli, iris, pupille, cils, sourcil, regard, expression) : la preuve que le moteur compose une quasi-infinité d'individus. |
| `src/face/` | Visage : contour, repères anatomiques (source unique), ajustement des yeux à l'orbite. Rendu dans `src/render/face/`. |
| `src/generation/random-face.ts` | Visage complet aléatoire : peau, proportions, bouche cohérente avec l'expression, paire d'yeux de galerie posée sur les ancres. |
| `src/svg.ts` | Constructeur SVG à liste blanche d'éléments/attributs. Aucun script ne peut être émis. |
| `src/compile.ts` | Scène validée → SVG. |

## Garanties vérifiées par les tests

- Déterminisme : même JSON + même seed ⇒ même SVG octet pour octet ; empreinte de référence en snapshot.
- Rejet explicite des entrées invalides ; aucun SVG produit dans ce cas.
- Sécurité : ids/labels hostiles refusés ou échappés ; aucun `<script>`, `foreignObject` ni `on*=`.
- Références SVG (`url(#id)`) toutes résolues, ids uniques, rendu resvg aux dimensions exactes.
- Lumière cohérente : la direction des reflets reste la même dans le monde quelle que soit la rotation de l'œil.
- Généricité : le même preset métal produit la même rampe d'environnement sur un iris, un panneau, un boîtier de robot et un sourcil.
- Rampe d'environnement du métal alignée sur le monde : le ciel reste en haut même si l'objet est pivoté (testé à 0°, 37°, 90°, −120°, 180°).
- Schéma robot : le capteur doit tenir dans l'ouverture (contrainte inter-champs, avec chemin d'erreur précis).
- Ancrage : `place.host` et les noms d'ancres/motifs doivent exister (erreurs précises, y compris quels noms manquent) ; ids finaux (après expansion) tous uniques ; composition des similarités 2D vérifiée algébriquement (identité, translation, rotation, non-commutativité) ; `outerSide: 'auto'` résolu correctement des deux côtés d'un hôte, et replié sur `'right'` hors hôte ; `skin` hérite du matériau de l'hôte sauf s'il est fourni explicitement.
- Anatomie de l'œil : chaque élément (cils, sourcil, pli palpébral, pli épicanthique, caroncule) disparaît proprement quand son paramètre est à zéro/null, et n'apparaît que sinon ; robustesse testée aux bornes hautes et basses combinées.
- Regard 3D (`gaze3d.ts`) : le raccourcissement (foreshortening) décroît strictement et symétriquement avec l'angle, jamais en dessous d'un plancher ; `travel` amplifie le déplacement sans changer le raccourcissement ; vérifié par calcul direct, pas seulement par rendu.
- Expressions (`expressions.ts`) : fonction pure (même entrée ⇒ même sortie, aucune mutation), identité exacte à `neutral`/intensité 0 (même référence), effet linéaire en intensité, jamais hors bornes du schéma, ne touche ni aux couleurs ni à l'iris/sclère/cils/canthi/pli.
- Génération aléatoire (`random-eye.ts`) : 200 seeds consécutives produisent 200 yeux valides et strictement distincts (aucun doublon JSON) ; la forme, la couleur d'iris, le sourcil, la forme de pupille et le pli épicanthique varient *indépendamment* les uns des autres (testé : une même largeur arrondie donne plusieurs couleurs d'iris différentes) — c'est la preuve de la composition combinatoire, pas d'un simple catalogue de « profils » prédéfinis.

## Limites connues

- **Ce n'est pas du PBR.** Seule la position du reflet sur une sphère est exacte (vecteur médian). La rampe d'environnement du métal, la bande de reflet des surfaces planes et le dosage de l'ombrage sont stylisés ; constantes réglables dans `SHADING`.
- Deux archétypes : anime (cils, sourcil, canthi, pli palpébral, pli épicanthique, regard 3D, expressions) et robot (une seule famille : objectif à capteur émissif). Pas encore de réaliste, ni de robot à visière/barre LED. `eye` et `robot_eye` sont deux `kind` distincts ; on les unifiera sous un champ `archetype` quand un troisième existera.
- Le reflet cornéen (highlight) est positionné par la lumière de scène, pas par la rotation du globe : approximation usuelle (la cornée reste quasi sphérique quel que soit le regard), mais un regard extrême devrait légèrement déplacer le reflet vers le bord — non modélisé.
- Les émotions n'agissent que sur UN œil à la fois : pas de coordination entre les deux yeux d'un visage (par exemple, des sourcils qui se rapprochent l'un de l'autre pour la colère) — cela demanderait une couche « visage » qui connaît la position des deux yeux, hors du périmètre actuel.
- Le générateur aléatoire tire des traits indépendamment ; il ne modélise pas de corrélations réelles (par ex. certaines formes d'yeux plus fréquentes avec certaines couleurs) — c'est un choix délibéré pour prouver la composition combinatoire plutôt qu'un générateur démographiquement réaliste.
- Les bords libres des paupières utilisent la couleur de base de leur matériau, sans ombrage (seul le sourcil passe par le système de matériaux complet). Le capteur du robot n'accepte pas de matériau libre : il est émissif par construction (couleur + intensité + taille).
- L'ancrage ne gère que des similarités (position, rotation, échelle uniforme) : pas de cisaillement, pas de courbure le long d'une trajectoire (un œil posé suit la normale locale de l'hôte, pas une déformation de sa géométrie).
- Un seul niveau d'imbrication testé (yeux sur un hôte) ; un hôte posé sur un autre hôte n'est pas exclu par le schéma mais n'a pas été vérifié.
- Le pli épicanthique et le pli palpébral sont des approximations géométriques (arcs de Bézier raccordés en tangente), pas un modèle anatomique.
- Un seul filtre SVG : le flou de l'ombre des paupières de l'œil anime (`feGaussianBlur`). Le robot n'en utilise aucun.
- Pas d'ancrage sur un objet hôte : les objets sont placés par `transform` explicite.
- Persistance en base et branchement prompt → JSON : non implémentés (le JSON + seed sont prêts à être stockés).
- Cible Zod 3 (`.default()` re-validé). Passer à Zod 4 demande de revoir les défauts imbriqués.
- Écart mesuré entre deux moteurs de rendu (Chromium vs resvg, scène `showcase` à 960 px) : écart absolu moyen 0,45/255 ; 1,5 % des pixels à plus de 8/255 (bords, flou). Les tests d'images de référence devront donc comparer avec tolérance, sur un moteur fixé.

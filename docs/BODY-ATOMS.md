# Catalogue des atomes du corps (`src/body/`)

Un **atome** est la plus petite unité nommée : polygone de contrôle fermé (ou polyligne `open`), lissé à l'affichage. Liste complète et à jour :
`artefacts/body-upper-limb/atomes.json` (régénérée par `scripts/artefacts-body.ts`). Corps adulte : **279 atomes** (285 pour une femme adulte : +6 par les seins),
dont 66 existent mais sont cachés de face (`view: 'occluded'`, dessinés seulement en mode `atoms`).

## Hiérarchie de présentation (`level`)
| Niveau | Contenu | Atomes (homme) |
|---|---|---|
| 0 | enveloppes : cou (racine), tronc, bras, avant-bras, paume, 15 phalanges par main | 38 |
| 1 | masses majeures : pectoral, trapèze, droit de l'abdomen, flancs (grand dorsal, oblique externe, dentelé), deltoïde, biceps, triceps, masses fléchisseurs / extenseurs, thénar, hypothénar, seins | 26 |
| 2 | muscles individuels, segments osseux, racine du bras | 104 |
| 3 | repères et micro-détails : clavicules, mamelons, ombilic, intersections, épicondyles, styloïdes, articulations des doigts, ongles, pulpes, plis, tendons | 111 |

Règle verrouillée (`body.level-monotonic`) : un enfant n'est jamais d'un niveau plus grossier que son parent. Types : muscle 112 · repère 57 · peau 39 · ligne 28 · os 21 · graisse 12 · ongle 10.

## Composants et atomes (identifiants ; suffixe `.L` / `.R` sauf indication)
| Composant | Atomes | Détail |
|---|---|---|
| `neck` (1) | `neck` | racine, rendue par le moteur de visage (cachée ici) |
| `torso-shell` (1) | `torso.shell` | enveloppe du tronc, coupe nette à la ligne des hanches |
| `shoulder-girdle` (9) | `shoulder.notch`, `shoulder.clavicle`, `shoulder.acromion`, `shoulder.trapezius`, `neck.scm` | trapèze supérieur suit le bord réel de l'enveloppe ; SCM : 2 chefs |
| `pectorals` (8) | `pec`, `pec.clavicular`, `pec.sternal`, `pec.minor` (caché) | |
| `breasts` (8 / 2) | `breast`, `breast.fold`, `breast.areola`, `breast.nipple` — ou `torso.nipple` seul | adultes à masse non nulle ; sinon repère neutre ; **aucun avant 18 ans** |
| `abdominals` (17) | `torso.rectus`, `abs.r1`…`abs.r4`, `abs.intersection.1-3`, `abs.linea-alba`, `abs.umbilicus`, `torso.inguinal` | 4 rangées × 2 blocs |
| `flank` (16) | `torso.serratus`, `serratus.slip1-4`, `torso.lat`, `torso.oblique.external`, `torso.oblique.internal` (caché) | |
| `skeleton` (11) | `bone.ribcage`, `bone.sternum.{manubrium,body,xiphoid}`, `bone.costal-arch`, `bone.iliac-crest`, `bone.asis` | cachés ou à peine visibles (trait ∝ maigreur) |
| `upper-arm.X` (16) | `arm.upper`, `arm.stump` (racine du bras), `shoulder.joint`, `deltoid` (+ `.anterior`, `.lateral`, `.posterior`), `biceps` (+ `.long-head`, `.short-head`), `brachialis`, `coracobrachialis`, `triceps` (+ `.long-head`, `.lateral-head`, `.medial-head`) | table `ROWS` de `arm.ts` : une ligne = un muscle |
| `forearm.X` (20) | `arm.fore`, `elbow.{epicondyle.lateral,epicondyle.medial,olecranon,cubital-fossa}`, `wrist.{styloid.radial,styloid.ulnar,crease}`, `forearm.flexor-mass`, `forearm.extensor-mass`, `brachioradialis`, `pronator-teres`, `flexor-carpi-radialis`, `palmaris-longus`, `flexor-digitorum-superficialis`, `flexor-carpi-ulnaris`, `extensor-carpi-radialis-{longus,brevis}`, `extensor-digitorum`, `extensor-carpi-ulnaris` | côté radial = côté du pouce (suit la rotation) |
| `hand.X` (71) | `hand.palm`, `hand.thenar` (+ 3 muscles), `hand.hypothenar` (+ 3), `hand.carpal`, `hand.metacarpal.1-5`, `hand.tendon.1-4`, `hand.interosseous.dorsal.1-4`, `hand.crease.{wrist,thenar,head,heart}`, `hand.web.{1-3,thumb}`, par doigt (`thumb`, `index`, `middle`, `ring`, `little`) : 3 segments `finger.<nom>.{prox,mid,dist}` (pouce : `meta`, `prox`, `dist`), 3 `joint`, `nail`, `pad` | |

## Visibilité de face (`view`)
Paume en avant (`pronation ≤ 0`) : visibles = plis, éminences, pulpes, fléchisseurs ; cachés = tendons dorsaux, interosseux, ongles, extenseurs. Dos en avant : l'inverse.
Dos de la main + doigt fléchi au-delà de 95° : le segment passe derrière les articulations (caché). Triceps, deltoïde postérieur, os profonds : toujours cachés de face.

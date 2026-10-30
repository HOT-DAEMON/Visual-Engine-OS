# Bas du corps — bassin, cuisses, genoux, jambes, pieds (`src/body/lower/`)

Suite de `docs/BODY.md` (haut du corps). Vue de face uniquement. Rendu SVG sans filtre. Le bas du corps est l'**enfant du tronc** : aucune coordonnée absolue, tout vient du `BodyFrame`.

## Principe : composants indépendants, combinables
`figure = haut du corps (BodyParams) ⊕ bas du corps (LegParams)`. Les quatre axes (âge, sexe, adiposité, musculature) vivent UNE fois, dans `BodyParams` ; le bas les lit via le cadre (`frame.age`, `dim`, `fat`, `mus`, `vis`). `LegParams` ne porte que ce qui est propre aux jambes. Conséquence : changer l'âge ou le sexe d'un corps change ses jambes sans aucune duplication de paramètre.

| Fichier | Rôle |
|---|---|
| `types.ts` | `LegParams` (écarts de proportions, orteils, pose par jambe) |
| `canon.ts` | proportions par âge (9 âges-clés), en hauteurs de tête |
| `frame.ts` | `LegFrame` : grandeurs en px + Résolveur (corrections consignées) |
| `pelvis.ts` | bassin, moyen/grand fessier, trochanter, triangle fémoral, symphyse, sacrum |
| `leg.ts` | cuisse, genou, jambe : enveloppes, 28 lignes de muscles, repères osseux |
| `foot.ts` | dos du pied, 5 orteils, 14 phalanges, ongles, métatarsiens, tendons |
| `geometry.ts` | assemblage pur, mémoïsé par contenu ; `measures` pour la vérification |
| `contracts.ts` | contrats (needs / reads / provides) des 7 composants |
| `render.ts`, `markup.ts` | rendu des jambes ; `figureMarkup` = bas puis haut |

## Contrats
Chaîne de dépendance : `pelvis → thigh.{L,R} → shin.{L,R} → foot.{L,R}`. Le test d'**influence** (`tests/lower.test.ts`) perturbe chaque paramètre (axes du corps lus ici + chaque feuille de `LegParams`) et exige : (1) qu'il change quelque chose, (2) que seuls changent des composants en aval d'un lecteur déclaré.

## Pose (projection orthographique, plan frontal)
`abduction` (écart, °), `kneeFlex` (flexion vers le spectateur : **raccourcit** la jambe de cos θ, plancher 0,35), `footTurnout`, `toeSpread`, `toeCurl`. Gauche et droite indépendantes.

## Choix délibérés
- **Contour neutre à la fourche** : aucun organe génital n'est modélisé ; un contrôle (`lower.neutral-pelvis`) l'impose. Les références contiennent ce détail ; il est volontairement non reproduit.
- Le pied est vu de face : sa longueur est **en raccourci** (seuls la hauteur cheville→sol, la largeur et les orteils sont lisibles). `limbs.foot` agit sur la longueur des orteils/avant-pied visibles.
- Muscles rognés à l'enveloppe du membre par un `clipPath` (un muscle ne déborde jamais de la silhouette).

## Vérification (`src/verify/lower.ts`, `verifyLegs`)
Trois couches chiffrées. **Géométrique** : finitude, non-dégénérescence, ids uniques, parents, confinement, symétrie, attaches bassin/cuisse/pied, pieds au sol. **Anatomique** : hauteur totale = canon de l'âge ± 0,3 tête, part des jambes par stade, cuisse/jambe, pied/tête, genou < cuisse, cheville < mollet, 5 orteils et 14 phalanges par pied, garde-fou neutre, 4 niveaux. **Style** : sans filtre, budget de traits, poids SVG.

## Mesures (`artefacts/body-lower/rapport.json`, machine de CI, resvg, 1 fil)
Géométrie des jambes à froid ≈ 4,8 ms ; SVG figure complète à froid ≈ 20,5 ms ; **à chaud (cache) ≈ 0,09 ms** ; rastérisation 380 px de la figure sans tête ≈ 53 ms ; SVG ≈ 209 Ko. **Le temps de génération n'a pas été amélioré** par cette tâche : les jambes l'ajoutent (voir `BODY-LOWER-REMAINING.md`). Seul le cache évite le coût à l'identique.

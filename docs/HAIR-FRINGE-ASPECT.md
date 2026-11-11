# Franges : triangles trapus et « plaques aux joues »

Suite de `HAIR-FORM-FRINGE.md`. Preuves : `artefacts/hair-round/franges-*.png`, `queues-*.png`, `detail-plaques.png`.

## Mesure (remplace la métrique abandonnée)
La mesure largeur / longueur globale était dominée par de minuscules mèches. Ici, seules les mèches de FRANGE (`bang`) sont mesurées : rapport = largeur de base `w0` / longueur de la ligne médiane `spine`. Un rapport > 1 est un triangle trapu. Mesure : `fringeAspect(geo)` dans `src/verify/hair-round.ts`.
Avant : 12 % des mèches de frange de `short` / `spiky` / `bun` avaient un rapport > 1, max 6,5. Après : ≈ 3 %, max ≈ 1,3.

## Découpe (`src/face/hair/fringe-split.ts`)
`splitByAspect(centre, width)` : une mèche plus large que `FRINGE_ASPECT_MAX (0,85) × longueur` est remplacée par n ≤ `SPLIT_MAX (4)` mèches voisines, légèrement chevauchées (`OVERLAP 1,2`) et décalées en longueur (`STAGGER 0,9`), de largeur totale conservée. Fonction pure, sans tirage aléatoire. Les pièces d'une même mèche partagent exactement son emprise latérale (translation parallèle, bords extérieurs inchangés) ; l'abscisse de chaque point est relative à la racine, jamais divisée par l'écart vertical. Branchée dans `fringe.ts` (frange classique) ET `fringe2.ts` (modes `blades`, `wispy`, `asym_brow`) — la première version ne touchait que `fringe.ts` et ne corrigeait pas les cas réels, qui venaient de `fringe2`.
Flux aléatoire : la première pièce garde le flux de la coiffure, les suivantes reçoivent un flux propre (`pieceCtx`, issu de la graine) ; la découpe ne décale donc aucun tirage du reste de la coiffure. Sans cela, un visage `short` (graine 52442) voyait son oreille recouverte à 0,132 (limite 0,12, `ear-free-left`).

## Deux régressions trouvées par les tests et corrigées
1. Boucle infinie de `hairGeometry` (moteur classique, `short` + tresses, graine 43) : la première version décalait chaque point par `(y − y_racine) / (y_pointe − y_racine)` ; sur une mèche quasi horizontale la division explosait (x ≈ 10⁶) et la mise en forme ne terminait jamais. Test de non-régression : `splitByAspect : ligne horizontale…`.
2. Oreille recouverte (ci-dessus), couverte par `tests/hair-v2.test.ts` (graine 52442 et « occlusions autorisées »).

## Les plaques aux joues n'étaient pas des cheveux du crâne
Les plaques trapézoïdales des queues de cheval et tresses (`docs/HAIR-EDGE-REMAINING.md` 14, ancienne version) venaient du gabarit de revue : `sideburns` tiré au hasard sur `mutton`. Bissection : ni `backBase`, ni les couches, ni `sides.ts`. Correctif : `NO_FACIAL_HAIR` (`mustache`, `beard`, `sideburns` = `none`) dans `scripts/lib/hair-faces.ts`, utilisé pour les revues de coiffure. Les poils du visage ont leur propre moteur et leur propre revue.

## Contrôles
`fringe-wide-share` (part > 1 ≤ 0,35) et `fringe-aspect-max` (≤ 3,0), tous deux en avertissement. Voir `HAIR-ROUND-VERIFY.md`.

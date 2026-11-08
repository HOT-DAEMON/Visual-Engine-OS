# Forme des cheveux sur le crâne — remplissage de la coque et vérification

Contexte : `HAIR-SKULL.md` (coque, épaisseur), `HAIR-COHERENCE.md` (portée au polygone, attaches, vent). Limites et reste à faire : `HAIR-FORM-REMAINING.md`.
Code : `src/face/hair/coverage.ts`, `src/face/hair/crown-fill.ts`, `src/verify/hair-form.ts`. Preuves : `artefacts/hair-form/`.

## Le défaut constaté
La sous-couche racine est la coque de la chevelure (`boundary/shell.ts`). Les mèches, elles, ne formaient qu'une bande le long de l'implantation et des côtés : le **dessus du dôme était un casque
lisse dont le bord faisait la silhouette** (aucune texture de cheveu sur 0,25 H de montée pour `afro`). Mesure (8 visages par coiffure, part NUE de la moitié extérieure de la coque, avant → après) :

| coiffure | avant moy. | avant max | après moy. | après max |
|---|---:|---:|---:|---:|
| short | 0,60 | 0,83 | 0,41 | 0,47 |
| spiky | 0,47 | 0,74 | 0,42 | 0,59 |
| curly | 0,56 | 0,78 | 0,33 | 0,56 |
| afro | 0,70 | 0,88 | 0,31 | 0,43 |
| bob | 0,76 | 0,98 | 0,53 | 0,64 |
| long | 0,76 | 0,93 | 0,47 | 0,68 |

Les coiffures attachées (`ponytail`, `bun`, `braids`) et la coupe rase (`buzz`) sont **inchangées au bit près** (`artefacts/hair-form/01d`, comparaison des PNG) : leur aplat est leur anatomie.
Ce n'est pas zéro : il reste 30 à 50 % du bord nu pour les coiffures à volume (voir `HAIR-FORM-REMAINING.md` 1).

## La mesure : grille de couverture (`coverage.ts`)
Rastérisation scanline sur une grille de pas 0,012 W, règle **nonzero** (comme le rendu SVG des mèches : une mèche bouclée dont le contour se recoupe reste couverte ; `inPoly` pair-impair y ferait un trou).
Testé : rectangle (60 cellules, une seule fois), accord cellule par cellule avec `inPoly` sur un polygone concave, boucle double (100 cellules couvertes alors que `inPoly` répond faux).
`shellCoverage` (`crown-fill.ts`) donne la part nue de toute la coque et de sa **moitié extérieure** (distance au crâne ≥ 0,5 × l'épaisseur maximale, `RIM_FROM`) : c'est le bord, donc la silhouette. Même fonction pour le moteur et la vérification.

## Le remplissage (`fillShell`)
Pour `short, spiky, curly, afro, bob, long` (table `FILL` : seuils `rim` / `all`, longueur `len`, plafond `max` en MÈCHES) : tant que la part nue dépasse le seuil, on prend la cellule nue la plus
extérieure (départage aléatoire d'une demi-cellule), on y enracine une mèche du style local (`growLock` + `lockFrom` : même champ de direction, même texture, même largeur que les mèches de corps),
en retrait sur la normale, puis on la **rogne au bord de la coque** : elle texture le contour sans le dépasser. Une mèche qui n'ajoute pas ≥ 2 cellules est abandonnée.
- **Graine propre** et exécution **en dernier** : le reste de la chevelure est identique avec ou sans remplissage. Vérifié : 80 visages sur 80 ont le même nombre de formes qu'avant, hors remplissage
  (comparaison avec le code du commit d'origine rendu dans un worktree ; `rapport-verification.md`).
- **Oreille dégagée** : les formes qui entrent dans la zone d'une oreille libre sont écartées. **Éclaircissement** : `bareScalp(...).thin` (zones clairsemées voulues) n'est ni enraciné ni exigé ; la cible est
  relâchée par `fillKeep = 1 − 0,5 × thinning` (source unique). La densité n'y entre pas (essayé : la prendre en compte rendait presque tout le gain, bord nu de l'afro 0,26 → 0,45).
- Les formes portent `fill = indice de la mèche` (`HairLock.fill`) : une mèche tressée est plusieurs formes. Les mesures de dispersion de longueur les excluent (`tests/hair-system.test.ts`).
- Pas de remplissage pour les cheveux simulés (`sim.enabled`) : leur drapé est résolu par leur moteur.

## La couche de vérification (`hair-form.ts`, branchée dans `verifyFace`)
| couche | contrôle | gravité | règle |
|---|---|---|---|
| géométrie | `shell-rim-bare` | avertissement | bord nu ≤ `FILL.rim` relâché + 0,15 |
| géométrie | `shell-rim-bare-hard` | erreur | bord nu ≤ 0,75 relâché (coiffures non pendantes) : en deçà, silhouette = casque lisse |
| géométrie | `fill-within-reach` | erreur | forme bornée ≤ portée de la coiffure (`REACH`) + vent + 0,02 W |
| géométrie | `fringe-reach-bound` | erreur | frange ≤ `REACH.side` + 0,05 W du crâne (max mesuré 0,161 W sur le corpus) |
| anatomie | `fill-clears-free-ear-{left,right}` | erreur | ≤ 3 mèches dans la zone d'une oreille qui doit rester dégagée (max mesuré 2) |
| style | `fill-style-scope` | erreur | nombre de mèches de remplissage ≤ plafond de la coiffure ; 0 pour rase, attachées, simulées |

Chaque contrôle a un **contrôle négatif** qui le fait échouer (`tests/hair-form.test.ts`, 14 tests). Corpus de mesure : 10 coiffures × 8 visages imposés + 120 visages aléatoires (rapport : `artefacts/hair-form/rapport-verification.md`).

## Essais abandonnés (honnêteté du processus)
- **`fill-above-hairline`** (« aucune mèche sous l'implantation ») : écrit, mesuré, retiré. Sa première version ne contrôlait personne (0,000 : population vide, les mèches de corps sont `kind: 'lock'`, pas `undefined`).
  Corrigée, elle échouait à 13 visages sur 80, jusqu'à 1,39 H : des cheveux pendants ou une frange descendent légitimement sous l'implantation. Ce n'est pas une règle anatomique (yeux et sourcils : `guard.ts`).
- **`fill-count-bound`** (budget global de 560 formes) : inventé sur un corpus étroit ; le moteur d'origine produit déjà jusqu'à 1 459 formes (long) sans remplissage. Le budget de rendu relève de `checkContracts`.
- **Plafond de 20 mèches** pour `short` : comptait des formes, pas des mèches ; un visage tressé restait à 0,77 de bord nu (0,36 à 80). Plafonds relevés, comptés en mèches.

## Reproduire
`npx vitest run tests/hair-form.test.ts` · `npx tsx scripts/artefacts-hair-form.ts compose` (voir `artefacts/hair-form/README.md` pour le rendu « avant »).

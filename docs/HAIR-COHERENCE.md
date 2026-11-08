# Cohérence cheveux ↔ tête (suite) — vue d'ensemble

Branche `feat/hair-grammar`. Suite de `HAIR-SKULL.md` / `HAIR-BACK-MASS.md`. Détails : `HAIR-REACH-POLY.md`, `HAIR-TIE.md`, `HAIR-WIND-REACH.md`, `HAIR-VOCAB.md`. Limites : `HAIR-COHERENCE-REMAINING.md`. Preuves : `artefacts/hair-coherence/`.

## Diagnostic de départ (mesuré)
La portée par coiffure (`REACH`) existait, mais **ne bornait que la ligne médiane**. Trois écarts avec le rendu :
1. La largeur du polygone est multipliée après coup (texture `wide`, gain de silhouette) et la ligne médiane est déplacée (ondulation, pointe) APRÈS la borne : une mèche `short` s'éloignait de **0,336 W** du crâne malgré un axe borné à 0,07 W.
2. Les attaches (chignon, queue) étaient placées sur des repères de visage, pas sur le crâne : effet « casque audio », chignon caché derrière la tête, disque géant, bas de queue plat.
3. Le vent déplaçait les mèches sans tenir compte de la portée ; la sous-couche racine pouvait former un dôme sombre sous des cheveux clairs ; des cônes rigides (épis) apparaissaient sur `bob`/`long`.

## Ce qui a été fait (une ligne par sujet)
| Sujet | Où | Doc |
|---|---|---|
| Portée au niveau du POLYGONE (`conformReach`, `cranialLimit`, marqueur `bounded`) | `reach.ts`, `flow.ts` | `HAIR-REACH-POLY.md` |
| Attaches posées sur le crâne (haut de l'oreille, sommet), rayon et éventail bornés | `tie.ts` | `HAIR-TIE.md` |
| Vent couplé à la portée (tolérance proportionnelle à la puissance) | `wind.ts`, `reach.ts` | `HAIR-WIND-REACH.md` |
| Vocabulaire par coiffure (cônes seulement où l'anatomie les admet) | `vocab.ts`, `shapes.ts` | `HAIR-VOCAB.md` |
| Ton de racine plancher `ROOT_MIN_RATIO = 0,42` | `render/face/hair-look.ts` | ci-dessous |
| Masses d'étage de 1–2 mèches plafonnées à la pointe la plus basse | `layers.ts` | `HAIR-SKULL-REMAINING.md` 13 |
| Favori long écarté sur `short` / `spiky` / `afro` (post-tirage, graine inchangée) | `random-hair-v2.ts` | ci-dessous |
| Couche de vérification étendue, 13 contrôles + contrôles négatifs | `verify/hair-coherence.ts` | ci-dessous |

Ton de racine : la sous-couche est `rootColorOf(ra, h)` ; sa luminance ne descend pas sous 0,42 × celle des cheveux (`crown-tone-not-black`).
Favori : tiré puis écarté, pour que le flux pseudo-aléatoire, donc toute la suite de la graine, ne bouge pas.

## Vérification : 3 couches (`src/verify/hair-coherence.ts`, branchée dans `verifyFace`)
| Couche | Contrôle | Seuil |
|---|---|---|
| géométrie | `lock-envelope-bound` : enveloppe du POLYGONE d'une mèche bornée ≤ portée latérale | `REACH.side` + 0,1·puissance du vent + 0,02 |
| géométrie | `lock-envelope-rise` : montée au-dessus du sommet | `REACH.up` + 0,08·puissance + 0,02 |
| géométrie | `envelope-coverage` : aucune mèche libre sans borne (un constructeur oublié se voit ici) | 0 |
| géométrie | `crown-covered` : le dessus du crâne, au-dessus de l'implantation LOCALE, est couvert | ≥ 0,78 |
| anatomie | `tie-on-skull`, `tie-above-ear`, `tie-above-skull-top` | 0,04 W ; −0,009 H ; −0,06 H |
| anatomie | `bun-visible` (≥ 25 % du disque dépasse du crâne), `bun-radius-bound` | rayon ≤ `TIE` ×1,06 |
| anatomie | `tail-spread-bound` (+ levier du vent), `tail-length-bound` | 0,05 W ; 0,02 H sous le cou |
| style | `crown-tone-not-black` ; `style-vocabulary` | ≥ 0,41 ; 0 cône hors vocabulaire |

Corpus des preuves : **368 visages** (200 naturels, 14 par coiffure imposée, 4 par coiffure sous vent fort) : **0 écart** (`artefacts/hair-coherence/rapport-verification.md`).
`tests/hair-coherence.test.ts` : 16 tests, dont des **contrôles négatifs** (géométrie sabotée via `override`, chacun doit être détecté) et des gardes anti-test-vide.

## Ce que le corpus a trouvé APRÈS la première version (corrigé, pas masqué)
- poils fins (`hairline`) tirés d'une mèche non bornée (coiffures attachées) marqués « bornés » à tort : ils ne le sont plus que si leur parent l'est (`layers.ts`) ;
- `tail-spread-bound` ignorait le vent (levier `0,22·flex·|x|·L`, `wind.ts`) : la tolérance l'inclut ;
- `crown-covered` comptait comme « trou » le front d'une implantation en arche : la cellule est sautée sous l'implantation locale.
Seuils posés sur les mesures, jamais appris d'une référence (voir REMAINING).

## Performance (mesurée, bruit ≈ ±15 %)
Géométrie des cheveux, ms / visage, avant → après : `short` 55,6 → ≈ 76 ; `curly` 64,9 → ≈ 72–93 ; `afro` 72,9 → ≈ 95–104 ; `long` ≈ +5–35 % ; `ponytail` ≈ 23. Cause : bissection de `conformReach`. Atténuée par un contour du crâne mis en cache (`WeakMap`) et des acceptations/rejets exacts avant la mesure fine. Le résultat est mémoïsé par contenu (`hairGeometry`). Suite complète : 105 fichiers, 2705 tests verts, `tsc --noEmit` propre.

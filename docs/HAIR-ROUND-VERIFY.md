# Couche de vérification du rendu : géométrie, anatomie, style

Code : `src/verify/hair-round.ts` (`checkHairRound`), branché dans `verifyFace` après `checkHairCoherence`. Tests : `tests/hair-round.test.ts` (10). Corpus : `scripts/hair-corpus.ts`.

## Contrôles et seuils (`ROUND_LIMITS`)
| Couche | Identifiant | Mesure | Limite | Gravité | Portée |
|---|---|---|---:|---|---|
| géométrie | `round-dome-centered` | `lop` : écart des demi-largeurs de la coque | ≤ 0,05 | erreur | afro, curly |
| géométrie | `round-top-centered` | décalage du sommet / W | ≤ 0,10 | erreur | afro, curly |
| anatomie | `round-width-ratio` | largeur masse / largeur tête | ≥ 1,0 | erreur | afro, curly |
| anatomie | `round-width-max` | idem | ≤ 1,8 | erreur | afro, curly |
| anatomie | `round-rise` | élévation du dôme / H | ≤ 0,4 | erreur | afro, curly |
| style | `round-bare-balance` | écart de part nue gauche/droite | ≤ 0,25 | avertissement | afro, curly |
| style | `fringe-wide-share` | part des mèches de frange de rapport > 1 | ≤ 0,35 | avertissement | tout visage avec frange |
| style | `fringe-aspect-max` | rapport max largeur / longueur | ≤ 3,0 | avertissement | idem |

## Calibrage (40 visages, marges)
`lop` max observé 0,026 (limite 0,05) ; `topOff` max 0,068 (0,10) ; `bareGap` p90 0,116 (0,25) ; largeur min 1,083 (1,0), max 1,535 (1,8) ; élévation max 0,274 (0,4) ; rapport de frange max ≈ 1,3 sur short/spiky/bun, 2,91 sur curly (0,35 / 3,0 de limite). Les limites `lop` et `topOff` laissent une marge d'environ 2× sur les valeurs observées après correction et auraient échoué sur l'état d'avant (`lop` p90 0,225) ; les bornes de largeur ont une marge plus faible (min 1,083 pour 1,0).

## Contrôles négatifs (tests)
Base décalée → `round-dome-centered` échoue ; `w0 × 100` → `fringe-aspect-max` échoue  ; `boundGain` est testé à part (borne respectée, identité hors afro / curly). Sans ces tests, un seuil trop lâche passerait inaperçu.

## Revue de corpus
`npx tsx scripts/hair-corpus.ts [N=40] [dossier]` exécute TOUS les contrôles cheveux (Boundary, Shape, Skull, Form, Edge, Coherence, Round, Zones, HeadHair) sur N visages par coiffure et écrit `corpus.json` / `corpus.md`. Dernier passage (code final) : 22 contrôles hors limite sur 618 (coiffure × contrôle) — 1 erreur (bob, graine 9568, `hair-covers-face-skin` 0,035 > 0,02, préexistante) ; le reste en avertissements : `hair-reach-beyond-skull` afro 11/40 (pire 0,651 pour 0,6) et ponytail 1/40 (0,423 pour 0,42), `fringe-wide-share` 0,375 pour 0,35 et `fringe-tip-jag` 0,030 pour 0,03 sur la même graine, `shell-rim-bare` spiky 0,556 pour 0,55. Même mesure sur l'état d'origine : afro `hair-reach-beyond-skull` 13/40 (pire 0,720) et `shell-rim-bare` afro 6 avertissements (pire 0,565) ; ce dernier est tombé à 0. Résultat : `artefacts/hair-round/corpus.md`.

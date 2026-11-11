# Contrôles ajoutés : dôme, sous-couche, balayage du visage

Code : `src/verify/hair-dome.ts` (`checkHairDome`, `DOME_LIMITS`), enregistré dans `src/verify/index.ts` et dans `scripts/hair-corpus.ts`. Tests : `tests/hair-dome.test.ts` (11 tests). Trois couches, comme le reste de `src/verify/`.

| Couche | Id | Mesure | Limite | Gravité | Mesuré (corpus 40) |
|---|---|---|---|---|---|
| géométrie | `hair-no-face-sweep` | arêtes de mèche de dessus plus longues que 0,6 W, entièrement sous la limite des sourcils | 0 | erreur | 0 ; bob 9568 avant : 1 arête de 0,88 W |
| anatomie | `dome-base-hugs-strands` (afro) | part des sommets du bord de coque sans mèche à moins de 0,03 W vers l'intérieur | ≤ 0,30 | erreur | p90 0,10, max 0,14 |
| style | `dome-shoulder-round` (afro) | demi-largeur de la coque au sommet du crâne / demi-largeur max | ≤ 0,81 | erreur | max 0,78 (carré : ≈ 0,85) |

## Pourquoi ces seuils
Fixés SUR la distribution mesurée (40 visages par coiffure), avec une marge au-dessus du pire cas observé après correction, et en dessous de la valeur de l'état carré. Ce ne sont pas des références dessinées : une référence artistique reste à fournir (`HAIR-ROUND-REMAINING.md` 5).

## Nature de la preuve
- Les contrôles `dome-base-hugs-strands` et `dome-shoulder-round` ne s'appliquent qu'aux coiffures de `TUCK` / `SHOULDER` (afro). Pas de contrôle équivalent pour curly, bob, long.
- Rien ne mesure le caractère naturel d'une frange ni d'une lisière : seules les planches l'attestent.

## Corpus
`npx tsx scripts/hair-corpus.ts` : avant 22 / 630 contrôles hors limite, après 2 / 630 (`spiky` `shell-rim-bare` 0,556 / 0,55 ; `ponytail` `hair-reach-beyond-skull` 0,423 / 0,42, tous deux préexistants).

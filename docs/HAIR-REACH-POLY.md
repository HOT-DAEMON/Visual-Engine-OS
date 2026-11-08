# Portée au niveau du polygone (`reach.ts`, `flow.ts`)

Contexte : `HAIR-COHERENCE.md`. Table `REACH[style] = { up, side }` (montée en H au-dessus du sommet, éloignement du contour du crâne en W).

## Principe
`fitReach` borne la ligne médiane. `lockFrom` construit ensuite le polygone (largeur, texture, ondulation) : la borne est donc **réappliquée aux deux niveaux**.
- `LockOpts.reach?: true | 'cranial'` : si présent, `conformReach(ctx, spine, [], mode)` après déplacement/pointe, puis `conformReach(ctx, spine, poly, mode)` après le bord irrégulier.
- `conformReach` : pour chaque sommet hors portée, bissection (7 pas) vers le point le plus proche de la ligne médiane (l'ancre). Identité si tout respecte déjà la portée.
- `reachBudget(style, S, W, H)` : `side · W · 0,985`, `yTop = topY − up · H · 0,985` (`SAFE` = 0,985 : jamais pile sur la limite).
- Marqueur `HairLock.bounded` : la mèche est construite sous borne ; la vérification ne contrôle que celles-là (`lock-envelope-*`) et signale les autres libres (`envelope-coverage`).

## Mode `'cranial'`
Les coiffures PENDANTES (`bob`, `long`, `def.hang`) ont des mèches de corps qui tombent le long du visage et du cou : l'éloignement n'est borné qu'au-dessus de `lm.hair.sideY` (`cranialLimit`). Les autres coiffures ne sont pas exemptées : une mèche de `short` à hauteur de tempe était un fil de 0,07 W hors du crâne.

## Coût du test d'un point (`inReach`)
1. `y < yTop` → hors. 2. mode cranial et sous la tempe → dedans. 3. sous le sommet : écart horizontal `|x| − a(y)` (exact, majore la distance). 4. au-dessus du sommet : distance au point le plus haut. 5. seulement ensuite `distOut` sur le contour échantillonné UNE fois par surface (`WeakMap`, 96 segments denses au sommet).

## Résultat mesuré
`short` : distance du polygone au crâne 0,336 W → 0,069 W (portée 0,07 W). Corpus de 368 visages : enveloppe ≤ portée + tolérance 0,02 (le garde-visage `guard.fit` ré-écarte parfois un sommet de ≤ 0,015 W après la borne ; mesuré 0,075 W pour une portée de 0,06 W).

## Non borné, par conception ou par manque
Mèches de corps des coiffures attachées (convergent vers l'attache), cheveux simulés, mèches `over`. Voir `HAIR-COHERENCE-REMAINING.md`.

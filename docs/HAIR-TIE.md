# Attaches : chignon, queue, tresses (`tie.ts`)

Contexte : `HAIR-COHERENCE.md`. Constantes exportées : `TIE = { bunRadiusSide: 0,14, bunRadiusTop: 0,18, spreadSide: 0,2, spreadTop: 0,28, bunTopBand: 0,09 }`.

## Anatomie visée
Une attache est NOUÉE sur le crâne : sur le contour du crâne (pas à côté), AU-DESSUS du haut de l'oreille (sinon casque audio), jamais au-dessus du sommet de plus de 0,06 H.
- Chignon haut : centre `y = lerp(topY + 0,03 H, topY − 0,05 H, height)`.
- Chignon latéral : `yLow = sideY + 0,03 H`, `yHigh = topY + bunTopBand · H` ; `x = guard.hw(y) + 0,012 W`.
- Queue latérale : `yLow = min(sideY + 0,22 H, earTop − 0,01 H)`, `yHigh = sideY − 0,09 H`.
- Rayon du chignon : `topBun ? 0,09 + 0,09·épaisseur : 0,07 + 0,07·épaisseur` (en W), donc ≤ `bunRadius*`.
- Queue : longueur plafonnée à 0,97 × le disponible (non-haute), pas sous le bas du cou rendu ; éventail latéral limité par `spread*` dans `rest()` (la gravité l'emporte).
- Les mèches portent `part: 'tail' | 'bun' | 'braid'` (lues par la vérification, jamais par le rendu).

## Défauts corrigés (vus sur planche)
chignon invisible de face, disque géant, queue à bas plat (coupée par le plafond), attaches à hauteur d'oreille. Preuve : `artefacts/hair-coherence/02-attaches-chignon-queue.png`.

## Vérification
`tie-on-skull`, `tie-above-ear`, `tie-above-skull-top`, `bun-visible`, `bun-radius-bound`, `tail-spread-bound`, `tail-length-bound` : 0 écart sur le corpus (`rapport-verification.md`).

## Limites
Chignon bas / de nuque : invisible de face par construction (jugé seulement par `bun-visible` quand la coiffure est `bun`). Mèches de corps des coiffures attachées non bornées (elles convergent vers l'attache). Pas de 3D : voir `HAIR-COHERENCE-REMAINING.md`.

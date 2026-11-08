# Vent couplé à la portée (`wind.ts`, `reach.ts`)

Avant : le vent déplaçait la pointe d'une mèche sans se soucier de la portée de la coiffure (`HAIR-SKULL-REMAINING.md` 21, ancien).

## Règle
`applyWind(geo, wind, H, reach?)`, `reach = windReach(style, S, W, H, cranialLimit, puissance)`, `puissance = |(x,y)| · flex`.
- `reach.ok(v)` : le sommet respectait la portée AU REPOS.
- `reach.allowed(p)` : sa position déplacée reste admise, avec `+0,1 W` latéral et `+0,08 H` de montée à pleine puissance (proportionnel à la puissance).
- Un sommet qui respectait la portée et la quitterait est ramené par bissection (6 pas). Un sommet déjà hors portée (queue, tresse, chute) n'est pas contraint : son déplacement reste le levier du modèle (`0,22 · flex · L · u²`).
- Vent nul ou `flex = 0` : même objet, sans copie.

## Vérification
`lock-envelope-bound/rise` incluent la tolérance de vent (`0,1·p`, `0,08·p`). `tail-spread-bound` ajoute le levier : `0,22 · flex · |x| · L / W` (mesuré avant ce correctif : 0,145 W d'éventail sous vent 0,8 / flex 0,9, borne 0,05).
Preuve : `artefacts/hair-coherence/04-vent-borne-par-la-portee.png`.

## Limites
Pas de turbulence, pas de rafale (voir `HAIR-WIND.md`). Vent 2D de face seulement.

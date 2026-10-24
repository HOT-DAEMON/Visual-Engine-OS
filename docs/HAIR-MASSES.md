# Cheveux : masses de région, silhouettes, encre

Passe additionnelle sur `hair.sim`. **Opt-in** : `sim.regions` et `sim.ink` valent `false` par défaut, donc aucun rendu existant ne change.

```ts
generateRandomFace(321, { hair: { style: 'short', sim: { enabled: true, archetype: 'side_sweep', regions: true, ink: true } } });
```

## 1. Masses de région (tempes, pattes, nuque, mèches de joue)
Chaque archétype a un `RegionSpec` (`src/face/hair/sim/profiles.ts`), longueurs en fraction de H.

| Champ | Rôle |
|---|---|
| `temple` | longueur de la tempe sous le point de tempe (0 = tempe nue / rasée) |
| `burn` | patte : prolongement devant l'oreille sous la tempe |
| `nape` | nuque : longueur de la masse arrière sous le niveau de l'oreille |
| `cheek`, `cheekSide` | mèche de joue : longueur et côté(s) |
| `thick` | épaisseur relative des masses de côté |

Construction (`src/face/hair/sim/regions.ts`) : tempe + patte forment UNE bande pleine le long du contour du crâne, de profondeur `depthLimit(y)` ; la mèche de joue est un ruban pointu dont le centre reste dans la profondeur admise ; la nuque est une masse ARRIÈRE.

Longueurs par archétype : `hime` (tempe 0,14 / patte 0,22 / nuque 0,30 / joue 0,28) est la plus longue ; `quiff_undercut`, `bun_undercut` ont tempe, patte et nuque à 0 (rasés) ; `swept_back` est court (0,04 / 0,03 / 0,06).

**Nuque** : tant qu'elle est courte (≤ 0,12 H sous la mâchoire) elle reste CACHÉE par la tête et le cou ; elle ne déborde sur les côtés du cou que pour une coiffure longue. (Premier essai : coins noirs visibles sous la mâchoire sur toutes les coiffures courtes — corrigé.)

## 2. Silhouette par archétype (`SilhouetteSpec`)
| Champ | Effet |
|---|---|
| `top` | hauteur et portée de la couronne ; **masse de volume du dessus** (`volumeMass`) |
| `width` | poussée latérale (`out`) et débord latéral de la masse |
| `sweep` | décalage du sommet de la masse + balayage des mèches de dessus et de frange |
| `shave` | côtés / nuque rasés ; les masses de côté courtes disparaissent, une repousse sombre est dessinée (`geo.shaved`) |

Garde-fou : `top` est plafonné (≤ 1,4) parce que la houppe à 1,6 faisait échouer `hair-sim-gravity` (trop de mèches dressées).

## 3. Rendu « encre » (`sim.ink`)
- noir franc : aplats `#08080c`, sans dégradé (`ink-flat-fill`) ;
- masses pleines : sous-couche, masse de volume, masse arrière, régions ;
- contours noirs épais, redessinés par-dessus la bande blanche ;
- bandes blanches : une bande par mèche (aplat opaque, bords nets, rognée par la mèche) + DEUX arcs continus sur le dessus (`sheen.ts`), déportés du côté du balayage.

## 4. Règles de verrouillage
Voir `docs/HAIR-ZONES-VERIFY.md`.

## 5. Fichiers
`sim/profiles.ts` (tables), `sim/regions.ts` (bandes, nuque, volume), `sim/sheen.ts` (arcs blancs), `sim/drape.ts` (rapprochement progressif du contour), `render/face/hair-lock.ts` (`inkMarkup`), `render/face/hair.ts` (zones rasées, arcs).

Reste à faire : `docs/HAIR-MASSES-REMAINING.md`.

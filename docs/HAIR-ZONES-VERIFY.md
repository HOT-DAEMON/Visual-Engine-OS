# Vérification par zones des cheveux (`src/verify/hair-zones.ts`)

Active seulement si `sim.regions`. Elle remplace la règle large `face-interior-clear` (`geometry.ts`) pour ces cheveux.

## Ce qui est PROTÉGÉ (seuls : yeux, sourcils, nez, bouche)
| Contrôle | Seuil | Remarque |
|---|---|---|
| `zone-protected-eye-left/right` | ≤ 0,02 | empreinte réelle de l'œil ; exempté si l'archétype déclare une mèche `eye` |
| `zone-protected-brows` | ≤ 0,03 | la bande de contour (0,05 W) est ignorée : le sourcil s'arrête avant, la tempe y reste libre |
| `zone-protected-nose`, `-mouth` | ≤ 0,02 | |

## Ce qui est AUTORISÉ, avec une limite par zone
| Zone | Limite | Contrôle |
|---|---|---|
| Tempe | profondeur ≤ 0,11 W | `zone-side-depth` |
| Bande des yeux | profondeur ≤ 0,035 W | idem (raccord lissé : `depthLimit`) |
| Joue | profondeur ≤ 0,10 W, jusqu'à la mâchoire + 0,02 H | idem |
| Oreilles | libres | état annoncé contrôlé par `anatomy.ts` |
| Cou / nuque | calque ARRIÈRE ; débord sous la mâchoire ≤ 0,2 W au-delà de la demi-largeur du cou | `zone-nape-behind`, `zone-nape-spill` |

Longueur : `zone-side-length` compare la fin mesurée de la bande tempe + patte à celle que la coiffure demande (±0,02 H).

## Silhouette (avertissements, couche `style`)
`sil-sweep-*` (sens du balayage), `sil-width`, `sil-width-max`, `sil-shaved-clear` (la zone rasée n'est pas recouverte à plus de 30 %).
Ces seuils sont posés à la main, pas calibrés sur un corpus : ce sont des garde-fous, pas une mesure de ressemblance.

## Rendu encre (`style.ts`)
`ink-flat-fill`, `ink-white-bands`, `ink-outline` remplacent les contrôles cel quand `sim.ink`.

## Limites de cette vérification
- Les boîtes de nez / bouche / sourcils sont rectangulaires (`targetBox`), donc approximatives.
- Aucun contrôle ne compare le rendu à une image de référence : voir `docs/HAIR-REFERENCE-COMPARISON.md`.

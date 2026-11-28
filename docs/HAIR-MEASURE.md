# Mesure des références de coiffure : un seul estimateur pour la référence et le moteur

Outils : `scripts/hair-grammar/render-masks.ts` (rendu moteur : visage seul + visage et cheveux, ancres en pixels) et
`scripts/hair-grammar/measure-cuts.py` (segmentation des références, descripteurs, comparaison). Preuves : `artefacts/hair-engine-pass11/mesures/`.
Reprend le « manque » listé en passe 10 : « aucune mesure numérique des références ».

## Principe
- **Unité H** du moteur. `DEFAULT_HEAD` : yeux y = 0,04, menton y = 0,54, donc (menton − yeux) = 0,50 H et `H_px = 2 × (menton − yeux)` en pixels.
  Origine verticale : ligne des yeux ; origine horizontale : axe du visage `cx`. Toutes les sorties sont sans dimension (indépendantes de la résolution).
- **Même fonction** `descriptors()` pour la référence et pour le moteur. Le masque moteur = différence des deux rendus (visage seul / visage + cheveux),
  donc exactement les cheveux VISIBLES ; le masque d'une référence vient d'une règle colorimétrique (une par image, ci-dessous).
- Ancres des références (ligne des yeux, menton, axe) lues à la main sur planche à grille : incertitude ≈ ±5 px, soit ≈ ±0,02 H à 0,03 H selon l'image.

## Descripteurs (tous en H)
| Nom | Définition |
|---|---|
| `top` / `bottom` | sommet / point le plus bas des cheveux, relativement à la ligne des yeux (haut = positif pour `top`, bas = positif pour `bottom`) |
| `left` / `right` | demi-étendues gauche / droite par rapport à l'axe du visage |
| `area_H2` | surface du masque en H² |
| `levels` | extension gauche/droite et couverture à −0,40 · −0,20 · 0 · +0,12 · +0,25 · +0,50 H |
| `fringe_bottom` | par colonne de l'axe ±0,30 H : plus bas pixel de cheveux CONTIGU depuis le haut du masque (min / médiane / max) |
| `side_drop` | plus bas pixel de cheveux pour |x − cx| > 0,38 H (retombée latérale) |
| `outer` (moteur) | mêmes descripteurs sur la silhouette tête + cheveux : seule grandeur comparable aux références `outer_only` |

## Règles de segmentation (vérifiées sur surcouche : `ref*-overlay.png`)
| Réf. | Coupe lue | Règle | Statut |
|---|---|---|---|
| 06 | carré bouclé | distance Lab au fond (médiane des bords) > 14 ; masque = tête + cheveux | `outer_only` : seules les étendues extérieures valent |
| 32 | pixie | min(R,G,B) > 160 (cheveux presque blancs sur rose saturé), ROI y < 265 | vue 3/4 : ancre `cx` incertaine, `fringe_bottom` inutilisable |
| 47 | hime | L* > 72, a* < 7, b* < 38 (cheveux blanc-jaune) ; bords exclus | ne capte QUE la frange teinte rose ; autres valeurs LUES |

Un premier essai par GrabCut a été abandonné : masques rectangulaires, frange hime confondue avec la peau. Une règle simple et auditable
vaut mieux qu'un modèle opaque dont on ne peut pas corriger l'erreur.

## Résultats (graine 1, lacet 0 ; moteur après réparation)
| Grandeur | Réf. | Moteur | Lecture |
|---|---|---|---|
| Carré : sommet (silhouette, H) | 0,979 | 0,641 | moteur ≈ 35 % trop bas (volume sous-dimensionné) |
| Carré : demi-largeur G / D | 0,975 / 0,972 | 0,645 / 0,677 | idem : ≈ 31 % trop étroit |
| Carré : bas (H) | 0,736 | 0,746 | longueur de retombée correcte |
| Hime : bas de frange (LU) | −0,112 | −0,085 (médiane) | écart 0,03 H, dans l'incertitude de lecture (±10 px ≈ 0,05 H) |
| Hime : sommet (H) | n.d. | 0,550 | pas mesurable (règle ne capte que la frange) |
| Pixie : sommet | 1,058 | 0,652 | réf. plus haute (épi relevé) ; ancre incertaine |

Les chiffres « Réf. » du pixie et de la hime (hors bas de frange) ne servent PAS à étalonner : ils sont donnés pour transparence.

## Limites assumées
- Boîtes d'amorce posées à la main ; accessoires clairs (bijoux, col) exclus par ROI ; proportions de visage de référence ≠ moteur.
- Valeurs lues = `manual` dans le JSON, jamais présentées comme mesurées.
- Référence 04 (chignons) : mesurée en passe 12 (`HAIR-BUNS.md`). Références 28 et 50 : non mesurées (voir `HAIR-PASS12-REMAINING.md`).

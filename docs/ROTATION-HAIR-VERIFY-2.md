# Couche de vérification des cheveux sous pose — ajouts (passe 7)

Code : `src/verify/hair-pose-extra.ts` (nouveau), appelé par `checkHairPose` (`src/verify/hair-pose.ts`) juste avant la sortie anticipée à 0°. Tests avec contrôles négatifs : `tests/hair-pose-extra.test.ts`. Couches : `geometry`, `anatomy`, `style` (type `Check`, gravité `error`/`warn`). Base : `ROTATION-HAIR-VERIFY.md`.

## 1. Règles ajoutées
| Id | Couche | Évalué à | Seuil | Contrôle négatif |
|---|---|---|---|---|
| `pose.hairline-front-peak` | anatomie | tous les lacets, 0° compris | virage de SOMMET de la lisière de face ≤ `HAIRLINE_PEAK_TURN` (0,8 rad) : le rabotage `shavePeaks` devient une garantie testée | pointe de 30 px injectée : vue à 0° et 30° |
| `pose.hairline-corner` | style | lacet ≠ 0° | virage max de la ligne posée, après rééchantillonnage à pas d'arc 0,01 W, ≤ 1,35 × celui de la ligne de face + 0,05 rad | pointe de 3 sommets (14/6/6 px) injectée à 45° |
| `pose.mass-thickness` | anatomie | lacet ≠ 0° | excès d'épaisseur des masses d'étage / masse simulée au-delà de la silhouette, posé − face, ≤ 0,5 + 0,004 W (48 rangées) | masses gonflées de 20 px |

`windowTurn` est INVARIANT à la densité des sommets (test : même arc à 200 ou 800 sommets, écart < 15 % ; le virage par sommet, lui, est divisé par > 3). C'est la raison d'être de la règle (`ROTATION-HAIR-LIMB.md` §3).

## 2. Coiffure rasée (couche anatomie, crâne ↔ cheveux)
`tests/hair-buzz-flank.test.ts` : la coque descend sous le coin de tempe (≥ 0,1 H) et reste au crâne (`skull-shell-bound`, existant dans `src/verify/hair-skull.ts`), sur 6 graines.

## 3. Mesures sur corpus
- Corpus de l'essai : `short` 9000/9002/9004/9005 × ±45°, ±60° : aucune alerte `pose.hairline*`.
- Tests : pose/verify/lisière (85) et le reste des tests `hair-*` / coque / frontière (744, dont `hair-skull` corrigé) verts ; `regress.ts check` : références à 0° inchangées (`hard-13` = « close », rms 0,00, déjà le cas avant).

## 4. Non fait / à faire
- Règle de style « recouvrements de mèches à ±45° » (nombre de mèches `over` empilées, opacité cumulée) : à concevoir avec le correctif des cheveux longs (`ROTATION-HAIR-PASS-7.md` §3). Aucun seuil n'est inventé avant mesure.
- Règle « mèche `over` qui traverse la joue » : critère candidat = part de la surface de la mèche dans le disque visage (hors silhouette frontale) > x % ; à calibrer sur le corpus.
- Règle géométrique sur la coque posée (`base`) : épaisseur de coque ≤ celle de face, comme `mass-thickness`.
- Les rapports `Check` ne sont pas encore agrégés dans une image : `artefacts/` montre les rendus, pas un tableau de règles.

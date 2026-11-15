# EYES-LASHES-VERIFY — couche de vérification des cils

Fichier : `src/verify/eye-lashes.ts`, appelé par `verifyEye` (donc par tout ce qui vérifie un œil : galerie, visage aléatoire). Les cils vérifiés sont **ceux qui sont dessinés** :
`eyeLashSet(eye, g, th)` (`geometry/eye/lashes.ts`) est le point d'entrée commun du rendu (`render/eye/lids-fold.ts`) et de la vérification (mêmes graines, mêmes racines sur le liner).
Métriques exposées : `report.metrics.lashes` (`upperCount`, `lowerCount`, `medianPosition`, `maxLengthOverWidth`, `outwardShare`, `worstRootDist`). Un œil sans cils n'ajoute aucun contrôle.

## Contrôles
| Couche | id | Sévérité | Règle | Source de la borne |
|---|---|---|---|---|
| geometry | `lashes-finite` | error | coordonnées et largeur de base finies | — |
| geometry | `lash-roots-on-lid` | error | racine à ≤ 3,2 épaisseurs de bord du bord palpébral (le liner porte les racines un peu au-dessus) | mesuré : max 2,21 (galerie 100), 1,94 (familles) |
| geometry | `lashes-in-zone` | error | un cil dépasse l'ouverture de ≤ 0,55 × la plus grande dimension | contrat du test pixel « no-paint-outside-zone » |
| geometry | `upper-lash-tips-outside-opening` | warn | aucune pointe de cil du haut dans l'ouverture (ni sur l'iris ni sur la sclère) | — |
| anatomy | `lashes-point-away-from-eye` | error | ≥ 90 % des cils : pointe plus loin du centre de l'ouverture que la racine | principe anatomique ; la pointe d'un œil ne penche pas vers le nez (inclinaison moyenne mesurée sur la galerie ≥ 0,29) |
| anatomy | `lash-max-length` | warn | plus long cil ≤ 0,7 × largeur de l'œil | références : P90 des traits 0,19–0,6 L |
| anatomy | `outer-lashes-lean-outward` | error | cils de la moitié externe : inclinaison moyenne le long du bord, vers l'externe, ≥ 0 | angle de base médian mesuré vers l'externe sur 12 (26°), 15 (19°), 16 (3°), 13 (0,6°) ; **réf. 14 : −10° (cils traînants)**, famille `trainants` conforme (lean mesuré ≥ 0) |
| style | `lash-median-position` / `-max` | warn | position médiane des cils du haut dans [0,3 ; 0,97] | pointes mesurées P10 0,31 – P90 0,9 |
| style | `lash-ink-dark` | warn | cils tracés (matériau opaque ≥ 0,9) : luminance ≤ 0,25 | références en encre sombre |
| style | `lash-tapered` | error | largeur de base ≥ 0,01 | — |

## Preuves
- `tests/eye-lash-verify.test.ts` : aucun contrôle bloquant sur les 100 yeux de galerie et sur 10 familles × 6 yeux ; **7 défauts injectés détectés** (coordonnée NaN, racine flottante, cil hors zone,
  pointe dans l'ouverture, cils retournés vers l'œil, cils externes penchés vers le nez, cils clairs + base nulle) ; présence des 3 couches ; œil sans cils = aucun contrôle.
- `artefacts/eyes-refs3/07-verification-cils.json` : par contrôle, nombre d'yeux vérifiés / échoués (galerie 100 ; familles 10 × 8 yeux).
  État : 0 échec bloquant ; 1 + 3 avertissements `upper-lash-tips-outside-opening` (yeux très inclinés, voir EYES-LASHES.md).
- Premier passage : `lashes-in-zone` a échoué sur 6 combinaisons (ailes de `trainants` et `plume` trop longues) -> ailes raccourcies (0,6 et 0,7) plutôt que la règle desserrée ;
  `lashes-point-away-from-eye` (critère à base de normale) échouait sur un œil triangulaire (canthus pointu, normale instable) -> critère par éloignement du centre.

## Reste à faire
- ⬜ Contrôle **pixel** des cils (encre visible, aucun cil sous la pupille) : `scripts/lib/verify-eye-render.ts` n'a pas de règle cils ; non appelé par `verifyFace`.
- ⬜ Bornes de style issues de 66 yeux seulement ; pas de contrôle de cohérence cils ↔ style cel de la tête.
- ⬜ Pas de contrôle de répartition angulaire des mèches (pas de mesure de référence exploitable).

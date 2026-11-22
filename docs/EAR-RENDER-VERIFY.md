# Vérification du rendu de l'oreille (`src/verify/ear-render.ts`)

`verify/ear.ts` juge la géométrie du modèle ; ce module juge l'**image rendue**. Un modèle correct peut produire une image fausse. Pur : il reçoit deux rasters RGBA (tête avec oreilles, même tête sans) — le rastériseur reste à l'appelant.

| Couche | Contrôle (`ear-render-…`) | Sévérité | Seuil |
|---|---|---|---|
| geometry | `present-L/R` — l'oreille change des pixels | error | ≥ 1 |
| geometry | `connected-L/R` — une seule forme (fragments ≥ 4 % de la plus grande) | error | 0 |
| geometry | `attached-L/R` — part de lignes décollées de la tête | error | ≤ 0,15 |
| geometry | `height-L/R` — hauteur rendue vs modèle | error | écart ≤ 20 % (si `expected` fourni) |
| anatomy | `not-a-stroke-L/R` — largeur/hauteur rendues | error | ≥ 0,17 × (1 − 0,6 × exagération) |
| anatomy | `structure-readable-L/R` — part de pixels avec relief local | warn | ≥ 0,10 |
| anatomy | `bilateral-height`, `bilateral-width` | error | écarts ≤ 30 % / 60 % |
| anatomy | `concha-contrast` (quantile 25 % du cavum vs médiane du pavillon), `concha-share` (`conchaReadability`, vue d'oreille) | error | ≥ 0,08 / ≥ 0,10 |
| style | `silhouette-contrast-L/R` | warn | ≥ 0,12 |
| style | `cel-palette-L/R` (look anime) | warn | ≤ 60 tons |

**Décollement** : à partir du pixel d'oreille le plus proche de la tête, on compte les pixels de fond de la tête sans oreille qui l'en séparent. Tolérance anatomique : 5 % de la hauteur d'oreille sur les trois quarts supérieurs, jusqu'à 30 % sur le dernier quart (la pointe du lobule pend librement).

**Ce qui est testé** (`tests/ear-render-verify.test.ts`) : métriques sur images synthétiques, dont un cas défaillant connu (oreille à 35 px de la tête → détectée) ; 12 têtes × oreilles « natural », aucune erreur. Rapport sur 24 têtes : `artefacts/oreille-passe-4/verification-rendu.json` (0 échec, erreur ou avertissement).

**Limites** : vue de face seulement ; non branché dans `verifyFace` ; `conchaReadability` est testé sur images synthétiques et sur 9 oreilles réelles × 2 vues (contraste mesuré 0,16–0,29 pour un seuil de 0,08 ; part du cavum 0,19–0,24 pour un seuil de 0,10) ; les seuils d'anatomie (0,17 ; 0,10 ; 15 %) sont calibrés sur ce jeu de 24 têtes, pas sur une population mesurée.

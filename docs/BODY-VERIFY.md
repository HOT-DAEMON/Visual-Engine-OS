# Vérification du rendu du corps (`src/verify/body.ts`)

`verifyBody(geo, markup?, skin?)` → `Report` (même type que les autres vérificateurs : `Check { layer, id, severity, ok, value, limit }`). Trois couches, ~30 contrôles par corps.
Les bandes de proportions sont des **conventions d'atelier** (`BODY-CANON.md`), pas des mesures de population : hors bande = défaut de dessin, pas affirmation biologique.

## Couche géométrique (cohérence géométrique)
| Contrôle | Exige |
|---|---|
| `body.finite` | aucun point NaN/∞ |
| `body.nondegenerate` | aucun atome fermé d'aire < 10⁻⁶ h² |
| `body.unique-ids`, `body.parents-exist`, `body.acyclic` | ids uniques, parents existants, profondeur ≤ 20 |
| `body.parts-in-contracts` | chaque atome appartient à un composant du contrat |
| `body.containment` | le barycentre de chaque muscle/masse visible tombe dans un de ses ancêtres (le dessin ne sort pas de son enveloppe) |
| `body.symmetry` | pose symétrique ⇒ gauche/droite miroirs exacts (≤ 10⁻⁶ h) ; non exigé si la pose est asymétrique |
| `body.arm-attached` | le bras recouvre le tronc (≥ 0,05 h) |
| `body.neck-join` | le tronc est plus large que la base du cou |

## Couche anatomique (cohérence anatomique)
| Contrôle | Exige |
|---|---|
| `body.level-monotonic` | hiérarchie de présentation cohérente (enfant jamais plus grossier que parent) |
| `body.shoulder-band(-max)` | largeur d'épaules dans la bande du stade : bébé 1,0–1,8 · enfant 1,2–2,1 · ado 1,5–2,4 · adulte 1,6–2,7 · âgé 1,5–2,6 (en h) |
| `body.prepubertal-neutral` | avant 10 ans, `dim = 0` : le sexe ne change rien |
| `body.male-taper` (avert.) | homme adulte non obèse : hanches ≤ 0,78 × épaules |
| `body.female-hip` (avert.) | femme adulte non obèse : hanches ≥ 0,56 × épaules |
| `body.upper-fore-ratio(-max)` | bras / avant-bras ∈ [1,0 ; 1,6] |
| `body.hand-fore-ratio(-max)` | main / avant-bras ∈ [0,5 ; 0,95] |
| `body.limb-taper`, `-2` | poignet ≤ 0,9 × avant-bras ; avant-bras ≤ bras |
| `body.shoulder-gt-neck` | épaules ≥ 1,9 × demi-cou |
| `body.fingers.L/R` | 5 doigts × 3 segments |
| `body.minor-no-breast` | **0 atome de sein avant 18 ans** |
| `body.level-coverage`, `body.heads-canon` | 4 niveaux peuplés ; nombre de têtes = canon de l'âge |

## Couche de style (style artistique)
`body.no-filter` (aucun `<filter>` : le coût d'un corps est ses chemins) · `body.ink-contrast` (contraste trait / peau ≥ 0,2) · `body.stroke-budget` (≤ 12 épaisseurs, avert.) ·
`body.svg-weight` (≤ 400 Ko, avert.). Le style vérifié est un seul style : cel doux, contour d'encre sombre, lumière unique à gauche.

## Preuves
- `tests/body-verify.test.ts` : 13 archétypes × 8 graines sans erreur ni avertissement ; **chaque couche échoue** quand on la sabote (point NaN, parent fantôme, muscle déplacé de 500 px,
  bébé aux épaules d'adulte, sein injecté à 10 ans, filtre injecté).
- `artefacts/body-upper-limb/verification.json` : 325 corps (13 archétypes × 25 graines), 9 600 contrôles, 0 erreur, 0 avertissement.
- Les balayages ont trouvé de vrais défauts avant correction (`ERRORS-10.md` : parents latéraux inexistants, trapèze hors enveloppe chez les sujets maigres/âgés).
- Limite : ces contrôles prouvent la cohérence interne, pas la qualité artistique ni l'exactitude biologique (voir `BODY-REMAINING.md`).

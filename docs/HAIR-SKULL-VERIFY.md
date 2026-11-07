# Vérification du rendu : cohérence crâne ↔ cheveux (3 couches)

Code : `src/verify/hair-skull.ts` (`checkHairSkull`), branché dans `verifyFace` (`src/verify/index.ts`). Tests : `tests/hair-skull.test.ts`. Rapport mesuré : `artefacts/hair-skull/rapport-verification.md` et `05-rapport-verification.png`. Contexte : `HAIR-SKULL.md`, `HAIR-BACK-MASS.md`. Reste à faire : `HAIR-SKULL-REMAINING.md`.

## Principe
- Le contrôle lit la MÊME `HairGeometry` que le rendu (`hairGeometry(params, lm)`) : il juge ce qui est dessiné, pas une copie.
- Un paramètre `override` permet de lui donner une géométrie à contrôler à la place de celle du visage : c'est ce qui rend possibles les **contrôles négatifs** (convention du dépôt : un défaut injecté doit être vu, sinon le contrôle est vide).
- Chaque contrôle a une couche (`geometry` / `anatomy` / `style`), une gravité (`error` / `warn`) et un message qui dit le défaut en clair. Les seuils sont les LIMITES du moteur (`THICKNESS`, `REACH`, `BACK_MASS`), pas des chiffres posés à côté : changer une loi change le contrôle.

## Géométrie — la forme est un volume lisible autour du crâne
| id | gravité | ce qu'il exige | limite |
|---|---|---|---|
| `skull-shell-bound` | error | distance réelle de la coque au contour du crâne, au-dessus de l'arche de l'oreille | ≤ `maxShell` + 0,5 px |
| `skull-dome-bound` | error | dôme (sommet de la coque au-dessus du crâne) | ≤ `maxShell` + 0,5 px |
| `back-mass-no-lid` | error | pas de couvercle plat : largeur à 6 % sous le haut / maximale | ≤ 0,75 |
| `back-mass-no-bar` | error | pas un rectangle : aire / boîte | ≤ 0,92 |
| `back-mass-closed-bottom` | error | bas fermé : largeur à 3 % au-dessus du bas / maximale | ≤ 0,9 |
| `back-mass-inside-hair` | error | la masse ne dépasse pas l'étendue des mèches de corps | ≤ 0,05 W |

La largeur de la masse est lue par intersection EXACTE des arêtes à la ligne demandée (`rowExtents`) : elle ne dépend pas de l'espacement des sommets. Une première version échantillonnait les sommets et ne voyait pas un rectangle à 4 coins : le contrôle négatif l'a révélé.

## Anatomie — la forme obéit à la tête
| id | gravité | ce qu'il exige | limite |
|---|---|---|---|
| `back-mass-above-skull` | error | aucun trou entre la masse et la tête (demi-largeur ≥ 0,97 `a(y)`, jusqu'à la mâchoire, hors fermeture du bas) | ≤ 0,01 W |
| `free-reach-bound` | warn | aucun cône, ruban libre ou volute ne monte au-dessus de la portée | ≤ `REACH.up` + 0,025 H |
| `body-reach-bound` | warn | aucune mèche de corps dessinée (non simulée, hors coiffures attachées) ne monte au-dessus de la portée | ≤ `REACH.up` + 0,025 H |
| `free-dist-bound` | warn | aucune forme libre ne s'éloigne du crâne (distance réelle) | ≤ max(`up`·H, `side`·W) + 0,03 W |

## Style — la forme est lisible et homogène
| id | gravité | ce qu'il exige | limite |
|---|---|---|---|
| `back-mass-not-black` | warn | masse arrière non plus sombre que 0,5 × la luminance des cheveux (hors mode encre, hors cheveux de luminance < 0,02 où le rapport n'a pas de sens) | ≥ 0,5 |
| `back-mass-tip-visible` | warn | des pointes dépassent sous la masse (pas de bord plat nu) | ≥ 0,02 H |

## Exclusions, dites et justifiées
- **Arche de l'oreille** : la patte qui contourne l'oreille sort du contour du crâne par construction (l'oreille dépasse de la face). `skull-shell-bound` ne porte que sur les points au-dessus de `earTopY − 0,03 H`.
- **Coiffures attachées** (queue, chignon, tresses) : leurs mèches partent de l'attache, qui peut être au-dessus du crâne (queue haute) ; elles sortent de `body-reach-bound`. La longueur de la queue n'est PAS contrôlée (voir REMAINING).
- **Mèches simulées** (`sim === true`) : leur drapé est déjà résolu par le collisionneur ; hors `body-reach-bound`.
- **Chauve** : aucun contrôle.

## Contrôles négatifs (`tests/hair-skull.test.ts`)
Chacun injecte un défaut dans la géométrie et exige que le contrôle correspondant échoue : coque qui s'envole (`skull-shell-bound`) ; couvercle rectangulaire (`back-mass-no-lid`, `-no-bar`, `-closed-bottom`) ; masse rétrécie (`back-mass-above-skull`) ; cône de 0,4 H (`free-reach-bound`) ; mèche de corps recourbée sur le sommet (`body-reach-bound`). `tests/hair-skull.test.ts` couvre aussi les lois (`shellThickness`, `distanceOutsideSkull`, `withinShell`, portée par style, `rowExtents`, fondu, `isBodyLock`) et l'absence d'erreur sur 6 graines × 10 coiffures (axes v2 cohérents).

## Ce que ces contrôles ne disent PAS
« Rapport OK » ≠ beauté. Ils bornent des volumes et des proportions ; ils ne jugent ni l'élégance d'une coupe, ni l'harmonie des couleurs, ni la finesse du bord des mèches. Les seuils (0,75 ; 0,92 ; 0,9 ; 0,5 ; 0,02) sont posés à la main sur le corpus (323 visages) : à recaler sur des références dessinées par un illustrateur. La revue humaine des planches de `artefacts/hair-skull/` reste nécessaire.

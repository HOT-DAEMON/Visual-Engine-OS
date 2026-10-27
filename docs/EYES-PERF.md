# Yeux — temps de génération (EYES-PERF)

Demande : « améliorer drastiquement le temps de génération des images ». Méthode : **mesurer d'abord**, corriger le poste dominant, mesurer l'écart visuel.

## Mesure (1024 × 768, resvg, médiane de 9 ; `artefacts/eyes/perf.json`, `scripts/bench-eyes.ts`)

La compilation SVG d'un œil est négligeable (≈ 5–9 ms). **Tout le coût est la rastérisation.** Profilage par élimination (œil par défaut) :

| Variante | Rastérisation |
|----------|---------------|
| œil complet (avant) | ≈ 504 ms |
| sans le filtre `feGaussianBlur` de l'ombre des paupières | ≈ 142 ms |
| sans cils / sans sourcil / sans fibres d'iris | ≈ 496 / 538 / 500 ms (bruit : aucun effet mesurable) |
| canevas vide (plancher) | ≈ 118 ms |

Un SEUL filtre représente ≈ 360 ms sur 504 ms ; tout le reste (cils, sourcil, fibres, dégradés) ≈ 25 ms au-dessus du plancher.

## Correction (`render/eye/soft-shadow.ts`)

Le flou gaussien est remplacé par un **empilement calculé** reproduisant le profil gaussien (σ = 0,035 · hEff) :
- rampe intérieure : 7 traits centrés sur le contour décalé, clippés à son intérieur, opacités solution de `(1−α_k) = (1−C_k)/(1−C_{k+1})` pour que l'alpha composé suive `α(1−Φ(d/σ))` ;
- rampe extérieure : 8 remplissages « extérieur du polygone dilaté de e_k », alpha cumulé `αΦ(x/σ)` ; continuité en d = 0 (α/2 des deux côtés, testée) ;
- même principe pour les lignes fines (`softLine` : occlusion, ménisque) ; Φ = Abramowitz & Stegun 7.1.26 (erreur < 1,5e-7).
Un premier essai (remplissage plat + rampe intérieure seule) donnait un écart max de 42/255 (discontinuité d'alpha au bord) : refusé, remplacé par la version ci-dessus.

## Résultat (`artefacts/eyes/perf.json`, plancher canevas vide = 107,1 ms)

Les valeurs varient de ±10 % d'une exécution à l'autre (le profilage ci-dessus vient d'une exécution antérieure : 504 ms / plancher 118 ms) ; les rapports restent stables.

| Configuration | Avant | Après | Gain brut | Gain sur le coût utile (hors plancher) | Filtres |
|---|---|---|---|---|---|
| œil par défaut | 498,6 ms | 171,1 ms | × 2,9 | × 6,1 | 1 → 0 |
| + microdétails | 670,7 ms | 212,9 ms | × 3,15 | × 5,3 | 3 → 0 |

Fidélité (mode `fast` vs `reference`, `artefacts/eyes/10-equivalence-fast-vs-reference.png`) : écart moyen **0,027–0,06 / 255**, maximum 7–9, aucun pixel
> 24 ; test automatique `eye-perf.test.ts` (seuils : moyenne < 0,3, aucun pixel > 24). Le coût du SVG croît (30 → 54 Ko) mais la rastérisation est bien moins chère.

## Limites assumées

- Restent en filtre (opt-in, donc absents du défaut) : glow/flou des couches d'iris, douceur/halo des reflets, bord doux de la pupille, effets d'apparence
  (glow, bloom, grain). L'œil « tout combiné » garde ≈ 7 filtres (≈ 280 ms à 1024 × 768). Voir `EYES-REMAINING.md`.
- Mesures dépendantes de la machine ; les tests n'affirment que des ordres de grandeur (entrelacés, seuil lâche).
- Cache de compilation (`compileSceneCached`) non utilisé par `verifyEye` : à brancher si la vérification est appelée en boucle.

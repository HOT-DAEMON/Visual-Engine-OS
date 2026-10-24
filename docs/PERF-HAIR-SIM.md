# Performance — où va le temps d'un visage chevelu

Mesure : `npx tsx scripts/bench-hair-sim.ts` (médiane de 5 passes, visage 600×700, cel 3 bandes, `messy_bangs`).

## Constat (avant → après cette passe)
| Étape | Classique | Simulé |
|---|---|---|
| Géométrie des cheveux | ≈ 30 ms | ≈ 90–115 ms (sans brins fins : ≈ 28 ms) |
| Compilation SVG | ≈ 95 ms | ≈ 205 ms (avant : 243 ms) |
| Rastérisation resvg | ≈ 315–380 ms | ≈ 375–445 ms |

Les cheveux ne pèsent que ≈ 65 ms de la rastérisation : le gros du coût est dans les **filtres du visage** (42 filtres, dont 40 flous).

## Ablation des filtres (gain si on retire le groupe, rastérisation seule)
| Groupe | Gain |
|---|---|
| Bruit de peau (2 `feTurbulence`) | ≈ 130 ms |
| Liseré de silhouette (rim, σ < 1) | ≈ 100 ms → **supprimé** |
| Ombre de contact tête / cheveux | ≈ 23 ms chacune |
| Flou du menton | ≈ 20 ms |

## Fait
- Liseré de silhouette : pas de filtre quand σ < 1 (`RIM_MIN_SIGMA`). Écart mesuré : max 9/255 sur quelques pixels, moyenne 0,01. Référence `hard-05` mise à jour (RMS 2,34).
- Brins fins d'une mèche simulée : aplat (plus de `<linearGradient>` par brin).

## Reste (non fait)
1. Bruit de peau : remplacer les 2 `feTurbulence` par une tuile de bruit pré-calculée (`<pattern>` + PNG en data-URI, générée une fois) — gain attendu ≈ 100–130 ms.
2. Ombres de contact : régions de filtre ajustées à la boîte réelle ; fusion tête + cheveux.
3. Cache de la simulation par (archétype, graine, morphologie).
4. Ombres portées des mèches principales fusionnées en un seul `<path>`.

## Mémoïsation de `hairGeometry` (passe masses de région)
Un rendu appelait `hairGeometry` 3 fois (visibilité des oreilles, composants, cheveux) et la vérification 3 fois de plus, soit ≈ 100 ms de simulation à chaque appel. La fonction est maintenant mémoïsée par contenu `(paramètres du visage, W, H)` (`ContentCache`, 48 entrées, LRU).
Mesure (`scripts/bench-hair-sim.ts`, appels répétés = cache chaud) : compilation SVG d'un visage chevelu simulé ≈ 205 ms → ≈ 84 ms ; géométrie 0 ms au 2ᵉ appel.
Réserves : (1) le banc répète les appels, donc il mesure surtout le cas chaud ; (2) la machine exécutait la suite de tests en parallèle, la rastérisation (665–842 ms) n'est pas comparable à l'ancienne mesure (315–445 ms) ; (3) premier appel à froid inchangé. La rastérisation (filtres de peau) reste le poste dominant et n'est PAS traitée : tuile de bruit pré-calculée, fusion des ombres de contact = encore à faire.
Le rendu encre n'ajoute aucun filtre (aplats, pas de flou).

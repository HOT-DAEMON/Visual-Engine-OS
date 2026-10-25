# Performance du rendu de visage

Mesures reproductibles : `npm run bench` (écrit `artefacts/perf/bench.json`). Machine de mesure : 1 cœur partagé, resvg-js.

## Diagnostic (avant)

Un visage structuré 340×420 prenait **15 à 17 s** de rastérisation ; le calcul géométrique et la génération du SVG ne
pesaient que **~22 ms**. Les filtres SVG représentaient **96 %** du temps de rastérisation (rendu sans attribut `filter` : 0,2 s).
Cause : le coût d'un filtre est proportionnel à l'AIRE de sa région, et `softKit` donnait à chaque flou une région de
2 W × 3 H (toute la tête), même pour un trait de nez couvrant 2 % de la tête.

## Mesure séparée des quatre étapes

| Étape | Comment elle est mesurée | Moyenne (6 visages, à froid) |
|---|---|---|
| Calcul géométrique | `clock.time('geometry')` autour des points d'entrée purs (durée exclusive) | 3,9 ms |
| Génération SVG | `clock.time('svg')` autour de `renderScene` (géométrie imbriquée retirée) | 35,5 ms |
| Rastérisation des formes | rendu du SVG SANS attribut `filter` | 130 ms |
| Filtres | rendu complet − rendu sans filtres | 163 ms |

Avant la correction, la dernière ligne valait plusieurs secondes. Les durées sont **exclusives** : la somme des étapes est
le temps total, sans double compte (`src/perf/clock.ts`, testé).

## Corrections (sans toucher à la géométrie)

1. **Régions de flou serrées** (`src/render/face/soft.ts`). Région = boîte de l'élément (`pathBox`, conservatrice : points de
   contrôle des Bézier, rayon des arcs) + `BLUR_REACH · σ` (3,5 σ) + demi-largeur du trait, arrondie vers l'extérieur sur une
   grille de 6 px. Même procédé pour les ellipses (carré de rayon max(rx, ry)), les parois du nez, le rim, les pores de peau
   (réunion des taches) et les effets de peau (contour de la tête + `effectsReach`).
2. **Mutualisation** : deux éléments de même (σ, région arrondie) partagent UN `<filter>` ; `kit.stats` compte filtres créés / références.
3. **Preuve de non-régression** : rendu pixel à pixel contre l'ancien code, même graine : écart maximal **3/255 sur un seul pixel**,
   moyenne 1,4·10⁻⁵ (`tests/perf-filter-region.test.ts` fixe le critère à ≤ 2/255 sur un trait flou de σ = 0,6 ; 2 ; 5,5).
4. Les 32 références visuelles antérieures restent `exact` (même SVG, au hachage près) après la refonte du résolveur.

Résultat : rastérisation 15–17 s → **0,3 s en régime établi** (0,67 s à froid) ; 100 visages complets (rendu + vérification
+ planches) : **88 s** (`artefacts/campagne-100/rapport.json`), contre ~28 min projetées.

## Caches (tous adressés par le contenu, jamais par identité d'objet)

| Cache | Clé | Portée | Contrat |
|---|---|---|---|
| `faceLandmarks`, `noseGeometry`, `structureGeometry` | sérialisation canonique des arguments | mémoire, LRU 512 | fonction pure ; valeur partagée = immuable |
| `compileSceneCached` | sérialisation canonique de la scène | mémoire, LRU 128 | `compileScene` pure et déterministe |
| `rasterPng` | sha1(SVG + options) | mémoire + disque `.cache/raster/` | SVG identique ⇒ PNG identique ; périmé impossible |

`RASTER_CACHE=0` désactive le cache disque (mesures à froid). `clearCaches()` vide les caches mémoire.

**Ce que les caches rapportent réellement** (mesuré) : la géométrie ne pèse que 3 % du temps, donc son cache économise peu
(24 réussites / 30 appels sur `faceLandmarks`, quelques ms). Le gain vient du cache PNG sur disque (rendu répété d'une
même galerie : 0 rastérisation) et du cache de scène (3,9 ms contre 39 ms).

## Limites et reste à faire

- Pas de cache INTER-visages : deux visages différents ne partagent aucun résultat (les paramètres diffèrent partout).
- Une région de filtre reste rectangulaire : les pores et le grain de peau couvrent encore la boîte de la tête.
- Les filtres restants (grain de peau, pores) coûtent ~180 ms chacun sur un visage ; ils sont légitimes (turbulence plein visage).
- La mutualisation compte ~40 filtres par cellule (contre 26 avant) : plus de filtres mais beaucoup plus petits ; un budget
  d'alerte (160 filtres sur un visage complet, médiane ≈ 100) est vérifié par `checkContracts`.
- Mesure faite sur un seul type de machine : les ratios (×10 à ×50) sont fiables, les valeurs absolues non.

## Mise à jour (suite 8)

- Vérification : `rightSamples` mémoïsé par contour, `halfWidthAt` dichotomique : ≈ 490 → ≈ 280 ms/visage (caches vidés).
- Campagne multi-processus (`JOBS`, `scripts/lib/parallel.ts`) : sortie identique à la série ; gain non mesurable sur la machine de test (1 cœur).
- Profil de rastérisation (visage 340×420) : 95 flous distincts, 2 turbulences (≈ 30 %), formes ≈ 107 ms. Pistes non faites : tuile de turbulence pré-calculée
  (dépend de la graine et de l'échelle), rendu des flous à résolution réduite.

- Suite : voir `PERF-2.md` (polices système, tuile de bruit, chemins chauds, vérification d équivalence).

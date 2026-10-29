# Performance de la grammaire de coiffure — mesures et leviers

Banc : `scripts/hair-grammar/bench-cell.ts` (étapes mesurées **séparément** : construction du SVG, rastérisation `resvg`, encodage PNG, conversion en gris). Médiane de 30 passes après 5 d'échauffement, **machine à 1 cœur, bruit ≈ ±15 %** (des mesures successives ont varié de 10,4 à 12,4 ms sur la même chose). Données : `artefacts/hair-grammar-03/perf/bench-rubans.json` et `bench-bandes.json`. Cellule 03, 144 × 170 px.

**Correction de méthode** : les temps « rastérisation » des docs 01/02 incluaient l'encodage PNG et la conversion en gris. Ici ces étapes sont séparées (à ×4 : 15 ms de rastérisation + 12 ms de PNG + 2 ms de gris).

## Résultats (rendu ×2 = 288 px de large)
| Étape | Rubans (avant) | Bandes précompilées | Variation |
|---|---|---|---|
| Construction du SVG | 5,98 ms | **0,08 ms** | **−99 %** (chemins calculés une fois dans le profil) |
| Taille du SVG | 127 Ko | **60 Ko** | −53 % |
| Rastérisation qualité finale | 10,5 ms | 12,3 ms | **+17 %** (8 couches superposées) |
| Rastérisation brouillon (sans anticrénelage) | 7,1 ms | **5,2 ms** | −27 % |
| Encodage PNG | 3,7 ms | 4,9 ms | +30 % |
| Rendu en cache (2ᵉ appel) | 0,04 ms | **0,02 ms** | coût du hachage de la clé |
| **De bout en bout, final (construction + rastérisation)** | 16,5 ms | **12,4 ms** | **−25 %** |
| **De bout en bout, brouillon** | 13,1 ms | **5,3 ms** | **−60 %** |
Banc spécifique de `shapeRendering` sur le profil de bandes (288 px) : anticrénelage actif 7,3 ms ; désactivé (`shapeRendering: 0`) **2,2 ms = 3,3× plus vite**, contours crénelés. Les deux bancs différent (5,2 contre 2,2 ms) parce que le 2ᵉ mesure `render()` seul, sans l'analyse du SVG ni la conversion.

## Ce qui est vrai, ce qui ne l'est pas
- **« Drastiquement » est vrai pour la construction** (−99 %) et pour le brouillon (−60 % de bout en bout), **faux pour la rastérisation finale**, qui est *plus lente* : `resvg` coûte surtout par pixel recouvert, et huit régions superposées recouvrent environ 2,4 fois la cellule.
- Le coût est linéaire en pixels : ×1 ≈ 6 ms, ×2 ≈ 12 ms, ×4 ≈ 21 ms. Pour un affichage navigateur, **servir le SVG directement évite rastérisation et PNG** (60 Ko, quelques ms côté client).
- Nombre de seuils (balayage de la session, σ 0,7) : 5 niveaux = 43 Ko, flou 0,0117, rastérisation 7,7 ms (×2) / 14,6 ms (×4) au banc ; 7 niveaux = 60 Ko, flou 0,0086, 10,3 / 19,0 ms ; 10 niveaux = 88 Ko, flou 0,0083, 24 ms mesurés par le script d'artefacts (inclut PNG et gris : **non comparable** aux deux autres, non remesuré au banc). **Au-delà de 8 niveaux, le gain de fidélité mesuré est quasi nul (0,0086 → 0,0083) et le coût monte nettement.**

## API
`rasterize(svg, largeur, 'final' | 'draft')` (`src/hair-grammar/render-fast.ts`) : cache de 64 entrées indexé par (SVG, largeur, qualité). `draft` = aperçus et vignettes uniquement ; les artefacts de preuve sont en `final`.

## Leviers non faits
1. Bandes **disjointes** (chaque pixel peint une fois) : ~2× moins de remplissage, mais coutures d'anticrénelage visibles entre bandes voisines — à tester.
2. Résolution adaptative : rendre ×1 puis affiner seulement les zones de traits fins.
3. Pool de workers : sans effet sur cette machine à 1 cœur, à mesurer sur plusieurs cœurs.
4. Clé de cache plus légère (empreinte du profil plutôt que le SVG entier : 0,02 ms ≈ 100 % du coût d'un appel en cache).
5. Œil du moteur (`eye-slot.ts`, cellule 02) : +70 % de rastérisation, non traité ; **non utilisé en 03**.

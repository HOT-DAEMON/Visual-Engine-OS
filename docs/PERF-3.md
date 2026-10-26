# PERF-3 — vitesse du moteur de profil et de la vérification

Mesures sur 1 cœur (bac à sable), médianes de 24 têtes distinctes (`scripts/bench-skull.ts`, `artefacts/skull-profile/bench.json`). Rastérisation
à 640 px de large, polices système désactivées (acquis de PERF-2).

| Étape | Profil (ms) | Visage de face (ms) |
|---|---|---|
| Géométrie (froid) | 4,6 | — |
| Rendu SVG complet (froid, caches vidés) | 16,9 | compilation 111,0 |
| Rendu SVG (chaud, géométrie mémoïsée) | 8,9 | — |
| Rastérisation | 33,2 | 666,5 |
| `verifyProfile` complet | 12,9 | `verifyFace` ≈ 130 (mesure à froid, compilation comprise) |
| **Rendu + rastérisation** | **50,1** | **777,5** |

## Lecture honnête
- Le profil coûte **≈ 15× moins** que le visage de face à rendu final. Ce n'est PAS une accélération à périmètre égal : le profil n'a ni les filtres
  de flou, ni la texture de peau, ni les yeux détaillés de la face. Il est rapide **par construction** : 0 filtre (contrôle `no-filters`), 98 ko de SVG,
  chemins et dégradés seulement, croissants par différence symétrique au lieu de flous.
- Gain à périmètre égal : `verifyFace` relisait `compileScene` sans cache ; il utilise désormais `compileSceneCached` (même contenu → même résultat,
  `src/verify/index.ts`). Pipeline « compilation en cache + vérification » sur 6 visages : **229 ms → 178 ms par visage (−22 %)**, 3 passes chacune
  (219,9–237,3 ms avant ; 170,9–179,2 ms après).
- `geometryDigest` n'a PAS été mémoïsé : les 6 appels portent sur des paramètres différents (variantes), le cache par contenu n'aurait rien évité.

## Décisions de conception pour la vitesse
- Géométrie pure, mémoïsée par contenu (`memoPure`, 256 entrées) : un second rendu du même profil (autre mode, autre coiffure) saute le calcul.
- Une seule chaîne de Bézier pour la peau, réutilisée par le remplissage, l'encre, les croissants (décalés) et l'échantillonnage de vérification.
- Oreille : `look: 'anime'` en profil → plus de filtre d'éclairage de relief (0 filtre ; SVG total du profil 114,7 ko → 100,7 ko, −12 %).
- Aucun bruit, aucun flou : le profil n'utilise pas la tuile de bruit.

## Non fait (voir aussi `PERF-2-REMAINING.md`)
Rastérisation de FACE (flous de structure, déduplication des chemins), campagne multi-cœur non mesurée, pas de cache du SVG du profil (seule la
géométrie est mémoïsée : rendu chaud 8,9 ms), pas de mesure à 2 000 px.

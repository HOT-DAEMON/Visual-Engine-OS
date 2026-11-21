# Yeux — passe 12 : détail atomique de l'iris

Suite de `EYES-PASS-11.md`. Règle respectée : les références **enrichissent le moteur d'iris existant** (`renderIrisDetail`), aucun moteur par référence. Cinq paramètres opt-in ont été ajoutés à `iris.detail` ; leurs valeurs par défaut gardent le rendu historique.

Reproduire : `python3 scripts/eye-refs/extract_iris_atoms.py` (mesures), `npx tsx scripts/eye-refs/calibrate-atoms.ts [famille]` (moteur contre références), `npx tsx scripts/artefacts-eyes-pass12.ts` (preuves visuelles → `artefacts/eyes-pass12/`).

## 1. Mesures (`references/eyes/measures-iris-atoms.json`)
Un seul détecteur (`extract_iris_atoms.py`), appliqué aux références **et** au rendu du moteur (`--png`, via `scripts/lib/eye-iris-atoms.ts`).
- Fentes radiales sombres (réf. 04) : 33 fentes persistantes (même angle sur ≥ 3 des 6 bandes de rayon), largeur moyenne 2,75°, profondeur de luminance ≈ 64.
- Cellules entre arêtes (réf. 07) : 105, aire médiane 0,00101 de l'aire d'iris, CV des aires 1,77 (très inégales).
- Étoiles (réf. 10b) : corps (ouverture morphologique, sinon les rayons fusionnent les composantes : Feret > 1,8 R au premier jet, mesure fausse) ≈ 0,39 R pour les étoiles de l'anneau.
- Anneau de 10b : pic S×V à ρ ≈ 0,707 (le moteur le plaçait à 0,46). Anneau de 10a : large, ρ ≈ 0,34.
- Part sombre par bande radiale, toutes références.

## 2. Paramètres ajoutés (`src/schema/eye-iris-pupil.ts`, rendu : `src/render/eye/iris-atoms.ts`)
| Paramètre | Effet | Prouvé par |
|---|---|---|
| `detail.slits` {count, long, widthDeg, depth, inner, outer, taper} | fuseaux sombres effilés, angles tirés par la graine ; `long` = fentes pleine longueur (la croix de 04) | `tests/eye-iris-pass12` : retirer, `depth 0`, `count`, `widthDeg`, graine |
| `detail.facets.cut` (0–1) | facettes taillées : diagramme de puissance (Laguerre-Voronoï), rayons log-normaux, arêtes franches, biseau côté lumière, tables lumineuses, dispersion | `cut 0` ≡ absence du champ (SVG identique) ; `cut` et `dispersion` changent les pixels |
| `detail.arcs` {ringRho, width, count, duty, color, opacity} | anneau segmenté (10b) | retirer, `count`, `ringRho` |
| `detail.embers` {count, ringRho, spread, size, streak, opacity, color} | braises radiales avec halo (10a) | retirer, `opacity 0` ≡ absent, `count` |
| `detail.voids` [{inner, outer, strength}] ≤ 3 | noir profond dessiné APRÈS fibres et facettes | `strength 0` ≡ absent ; part sombre croît avec `strength` |
Les voids existent parce que les couches de couleur sombres étaient recouvertes par les fibres claires (émeraude : part sombre 0,011 malgré deux couches sombres).

## 3. Réglages de famille (`eye-iris-families-photo2.ts`)
- prism-star : fentes (34 + 6 longues, 3,8°, profondeur 1). emerald : facettes taillées (20 × 4, `cut` 0,8), voids. fire : anneau resserré 0,30–0,46, braises, void interne. ice : anneau cyan 0,40–0,46, arcs à ρ 0,7, 3 voids, fibres presque supprimées.
- Éclats : primaire ×2,2 et secondaire en étoile pour les familles à étoile, centres 0,32–0,40, étoiles de l'anneau de 10b 0,1 → 0,2 sur ρ 0,7 (hexagone écrasé à 0,8 : à 1 l'étoile du haut sortait de l'ouverture, règle `highlights-confined`). `sparkle(…, intensity)` : bloom réduit à 0,3 sur les grands éclats (sinon voile gris).
- Vibrance recalibrée (`calibrate-vibrance.ts`) : prism 0,262, emerald 0,371, fire 0,52, ice 0,379.

## 4. Résultats (moteur / référence)
| Famille | part sombre | pics de saturation | luminance |
|---|---|---|---|
| prism-star / 04 | 0,172 / 0,154 | 0,781 / 0,783 | 112 / 126 |
| emerald-facets / 07 | 0,133 / 0,101 | 0,740 / 0,738 | 108 / 129 |
| fire-halo / 10a | 0,390 / 0,373 | 0,711 / 0,720 | 70 / 89 |
| ice-star / 10b | 0,280 / 0,297 | 0,729 / 0,729 | 81 / 103 |
Fentes prism : 38 de 2,5° (réf. 33 de 2,75°). Cellules emerald : médiane 0,00095 (0,00101), CV 1,95 (1,77), 70 cellules (105).

## 5. Couche de vérification de rendu (`scripts/lib/verify-eye-atoms.ts`, appelée par `verifyEyeRender`)
Ne s'applique qu'aux yeux qui demandent le détail atomique ; contre-exemples testés.
- Géométrie : `slits-radial` (le même angle revient sur ≥ 3 anneaux de 5), `arcs-concentric` (écart robuste du rayon ≤ 0,06, score S×V aux seuls angles où un arc existe).
- Anatomie : `iris-dark-share-plausible` (part sombre ≤ 0,6 ; références 0 à 0,37).
- Style : `atomic-edge-density` (gradient moyen ≥ 12 ; mesuré : 6,3–6,6 sans détail, 21–30 avec).
Galerie 4 (100 yeux) : aucun échec de règle de pixels.

## 6. Tests
`tests/eye-iris-pass12.test.ts` (19 tests, verts). `eye-iris-pass11` : test de l'hexagone mis à jour (0,56 → 0,70, écrasement 0,8). Lots exécutés verts : `eye-iris-*`, `eye-params-consumed`, `eye-gallery-ext/2/4`, `random-*`, `regression-visual`, `gallery-assets`.
**Échec préexistant, non causé par la passe 12** : `eye-gallery-ext3` (empreintes `sha1` figées de `generateRandomFace` pour `gallery` / `extended` / `extended2`) ; mêmes hashes avant et après mes changements, y compris après mise à jour sur `f30ac17`. À ré-épingler par qui a changé la génération de visage.

## 7. Reste à faire → `EYES-REMAINING.md` § Passe 12

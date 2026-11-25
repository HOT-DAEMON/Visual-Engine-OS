# Yeux — passe 17 : le bord suivi par ses voisins, LOD des cils et de la rotation, plis des canthi, cohérence de la paire

Suite de `EYES-PASS-16.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur ; chaque ajout est un atome ou un paramètre consommé par le moteur existant et prouvé sur des pixels.

Reproduire : `npx vitest run tests/eye-pass17.test.ts tests/eye-params-consumed.test.ts tests/verify-eye-pair.test.ts` · preuves : `npx tsx scripts/artefacts-eyes-pass17.ts` → `artefacts/eyes-pass17/` (+ `rapport.json`). Les outils d'images communs sont dans `scripts/lib/artefacts-kit.ts` (le script de la passe 16 les utilise aussi : plus de copie).

## 1. EYE-07E — les voisins du bord libre suivent le tracé perturbé
Problème de la passe 16 : `microdetail.edge` ondulait le clip de l'ouverture et les traits de paupière, mais les cils, le pli, la caroncule et la ligne humide restaient accrochés à la courbe parfaite (racines flottantes jusqu'à ~3 % de h).
- `eyeEdges(eye, g)` (`geometry/eye/edge-irregularity.ts`) : **source unique** des bords de l'œil effectif — rendu (`render/eye/eye.ts`), cils (`eyeLashSet`) et vérification (`verify/eye.ts`, `verify/eye-cornea.ts`) l'appellent ; la formule n'est plus recopiée.
- `edgeFrames(g, e)` : repères (position, tangente, normale) des bords perturbés, même convention de `t` que `upperFrame` / `lowerFrame`, normale toujours du côté de l'enveloppe (testé). `edgePolygon(e)` : contour réel (dégagement des cils). `upperEdgeShift(g, e, t)` : déplacement du bord.
- **Cils** : `eyeLashSet(eye, g, th, edges)` ; racines sur le tracé réel, dégagement contre le contour réel. `edges = null` : résultat identique à avant (comparé en JSON dans les tests).
- **Pli** : `creaseCurve(g, h, edgeShift)` ; les contrôles héritent `CREASE_FOLLOW` = 0,6 du déplacement du bord (le pli tient au tarse par des fibres lâches : il suit l'ondulation lente, pas le festonnage) ; extrémités ancrées aux canthi. La zone d'ombre du pli part du tracé perturbé.
- **Caroncule, ligne humide, liseré du bas, ombre des paupières** (`globe-inner.ts`, paramètre `edges`) : placées sur les bords réellement dessinés.
- Preuve : `artefacts/eyes-pass17/10-bord-suivi.png` (surimpression du tracé rouge, des racines bleues, du pli vert, de la caroncule jaune à 0 / 0,5 / 1).

## 2. EYE-07 — LOD des cils et de la rotation
- **Cils** (`thinLashes`, `lod.ts`) : sous `LASH_MIN_PX` = 0,6 px de largeur médiane, on garde une part k = médiane / seuil (≥ 0,4) répartie régulièrement (Bresenham, aucun tirage) et chaque cil gardé est épaissi de 1/k : la **couverture d'encre est conservée** (testé ± 6 %). Mesuré (artefact 11, 40 cils) : 40 / 27 / 16 cils à 300 / 60 / 30 px, couverture ×1,00 / 1,01 / 1,03. Lu sur l'œil effectif : sans `microdetail`, comportement historique.
- **Rotation de tête** : `eyeTurn(eye)` (`turn3d.ts`) remplace deux copies de la même séquence (rendu, vérification) ; `apparentWidthRatio(g0, turned)` ∈ [0,15 ; 1] multiplie la largeur dérivée du LOD (un nombre explicite reste prioritaire). Mesuré (artefact 12) : 300 / 175 / 45 / 45 px à 0° / 35° / 60° / 75°. Modèle `flat` : ratio 1 (non traité).

## 3. EYE-07G — petits plis des canthi (`microdetail.canthusLines`, opt-in)
Ridules cutanées HORS de l'ouverture : en éventail au coin externe (direction moyenne entre la corde des canthi et la tangente du bord, léger biais vers le bas) et un à deux arcs sous le canthus interne, vers le nez. Pointes effilées remplies (large à la racine, nulles à la pointe).
| champ | rôle | preuve en pixels (`eye-params-consumed`) |
|---|---|---|
| `outer` 0–1 (0,5) | longueur et opacité des ridules externes | 0,05 → 1 |
| `count` 1–6 (3) | nombre de ridules externes | 1 → 6 |
| `spread` 0–1 (0,5) | ouverture de l'éventail (± 40° à 1) | 0 → 1 |
| `inner` 0–1 (0,4) | force des arcs internes (2 arcs au-delà de 0,5) | 0 → 1 |
- Tirages fixes (3 par ride) : `count` ou le LOD n'en déplacent aucune ; `microLod.fine` retire par la fin de liste, 0 sous ~70 px (aucune ride à 20 px, testé).
- **Fini flat** : encre pleine de la couleur de paupière. `flattenEye` supprimait tous les microdétails (la branche flat aurait été du code mort) : il conserve désormais **uniquement** `canthusLines`.
- Vérification (`verify/eye-canthus-lines.ts`) — géométrie : coordonnées finies, aucune ride dans l'ouverture réelle, contour non dégénéré ; anatomie : longueur ≤ 22 % de la largeur, éventail ≤ 70°, externes côté externe / internes côté nez ; style : visibilité à la taille courante (avertissement), fini flat avec `outer` > 0,7 (avertissement).
- Preuve : `13-plis-canthi.png` (absent / moyen / fort / flat). ⚠ Sur une tête entière (yeux de ~35 px), le LOD retire ces ridules : elles ne se lisent qu'en gros plan, d'où leur absence des planches 01-03.

## 4. Paire d'yeux (`verify/eye-pair.ts`, 6 → 9 contrôles)
`eyes-same-finish` (style, erreur : un œil flat et l'autre peint casse le style de la tête), `eyes-micro-presence` et `eyes-micro-strength-match` (anatomie, avertissements : bord irrégulier / plis sur un seul œil, ou force qui diffère de plus de 0,35).

## 5. Mesures et vérification
- Couche `verifyEye` (artefact 14) : « bords 0,9 + plis » 21/21 · 22/22 · 9/9 ; « petit œil 40 px » idem ; émeraude et feu sans échec.
- Poids SVG de l'œil seul à l'échelle 1,9 (`rapport.json`) : bords + plis 291 ko / 1 577 nœuds / 15 filtres / 73 ms estimées ; émeraude 271 ko / 15 filtres / 72 ms ; feu 102 ko / 12 filtres / 56 ms (plafond `svg-cost` 120 ms).  Aucun avertissement `filter-budget` sur ces trois yeux.
- Têtes (graines 11 et 23, lacet 0° et 25°) : aucun échec `verifyEye` sur les 12 yeux. La tête de graine 23 à 25° pèse 16 Mo de SVG : non investigué (les yeux pèsent ~0,3 Mo chacun ; cheveux probables).
- ⚠ **Limite préexistante** : à lacet 60° + azimut 22° (modèle `sphere`), `iris-meets-opening` et `highlights-confined` échouent — vérifié identique sur le code de la passe 16, microdétails absents. Non corrigé ici.
- **Tests** : suite complète fichier par fichier : 46 fichiers yeux / cils / liner et 190 autres verts ; seul échec : `tests/nose-visibility.test.ts` (« garde-fou du pivot »), préexistant — même hash reçu (`e27bacc…`) sur le code de la passe 16.

# Itération 08 — symétrie d'épaule, insertion du pectoral, relief du haut du dos

Branche `feat/hair-grammar`. Trois changements, chacun avec sa preuve visuelle (`artefacts/body-08/`) et ses contrôles à trois couches (géométrie · anatomie · style). Ce qui n'est pas fait est dans `BODY-JUNCTIONS-08-REMAINING.md`.

## 1. `baby` et `junction.geo.shoulder-symmetry` — cause établie
**Constat (mesuré, `scripts` de diagnostic non conservés) :** avec `contrapposto = 0`, la peau et les muscles de `baby` sont exactement symétriques (peau 0,331 / 0,331 h, muscles 0,360 / 0,360 h à 0,3 de la chute). Avec la pose par défaut (`amount 0,3`), la peau vaut 0,295 / 0,360 h et les muscles 0,359 / 0,366 h.

**Cause :** le contrapposto bascule les épaules en sens opposés (≈ 1,65°, soit Δy ≈ ±0,01 h à x ≈ 0,33 h). La pente de la peau du bébé est très raide (≈ 3,6 en x par unité de y), donc ±0,01 h en y fait ±0,035 h en x à hauteur fixe. Le contrôle comparait les deux côtés à des **hauteurs absolues** : il mesurait la pose, pas la forme.

**Correction (`src/verify/junction.ts`, `poseFreeAsymmetry`) :** chaque côté est mesuré à la hauteur `y + s·x·r`, où `r = u.y / u.x` est la pente de l'axe latéral `u` de la section de peau la plus proche (la bascule est lue sur la peau elle-même). Valeurs : `baby` 0,030 h compensé (0,058 h brut), 13 archétypes sur 13 passent.

**Réserves à lire :**
- C'est un changement de **métrique**, pas de géométrie. `baby` passe parce que la mesure est plus juste. La valeur brute reste affichée dans le détail du contrôle.
- Essai écarté : chercher, de chaque côté, la hauteur où la peau atteint le même x. Mal conditionné sur le plateau de la paroi : `muscular` passait de 0,033 à 0,063 h (échec).
- `thin` et `elderFemale` sont un peu moins bons en compensé (0,028 / 0,021 h) qu'en brut (0,017 / 0,010 h), toujours sous 0,05 h.
- Négatif : un trapèze gauche décalé de 0,12 h fait échouer le contrôle. Tests : `tests/body-junction-08.test.ts`.

## 2. Insertion du grand pectoral (`src/body/volume/pec-insertion.ts`)
Jusqu'à l'itération 07 le pectoral s'arrêtait au bord du tronc et le deltoïde restait une masse fuselée sans recouvrement. Un volume `pectoralis.insertion.{L,R}` (couche 5 contre 4 pour le deltoïde, `mass: 'pectoralis'` commune avec le sterno-costal) prolonge la dernière section du chef sterno-costal jusqu'à la face antéro-médiale de l'humérus (≈ 0,165 de la longueur humérale), en tendon plat effilé.

**Itérations visibles :** v1 = bulbe arrondi trop bas et jonction visible ; v2 = extrémité effilée par une section finale (`a = 0,1·rU`), arrivée plus haute, masse commune. Effet : un sillon delto-pectoral sombre apparaît entre le pectoral et le deltoïde.

**Contrôles (`src/verify/junction-pec.ts`, branchés dans `verifyJunctions`) :**
- `junction.geo.pec-insertion-attached` : départ à ≤ 0,012 h du bout du sterno-costal ; arrivée à ≤ 0,9 rayon de l'axe huméral, entre 5 et 30 % de l'humérus.
- `junction.ana.pec-over-deltoid` : couche supérieure, boîtes en recouvrement ≥ 0,2 rayon dans les deux axes, extrémité ≤ 0,35 de la section la plus large.
- `junction.sty.pec-insertion-visible` : retirer UNE insertion change ≥ 40 pixels et ≥ 30/255 (valeurs observées par côté : 51–206 pixels, max 33–92, 11 archétypes). Trois rendus à 460 px (quatre si l'effet est faible).
- **Non applicable, déclaré tel quel** : `baby` et `toddler` (le sterno-costal lui-même change 0 pixel : muscle masqué par le palier de visibilité).
- Premier essai de style écarté : retirer les deux côtés à la fois laissait le côté intact masquer une insertion invisible de l'autre côté (négatif en échec) ; d'où la mesure par côté.
- Négatifs testés : insertion décalée de 0,15 h (géométrie), couche 3 (anatomie), section quasi nulle (style).

## 3. Relief du haut du dos (`src/body/volume/back-relief.ts`)
**Problème :** infra-épineux, grand rond, rhomboïde et trapèze moyen/inférieur se lisaient comme des bâtonnets posés sur une peau lisse ; une loft d'ellipses ne peut pas porter un bord médial, une épine et un angle inférieur continus.

**Principe :** un champ de hauteur h(x, y) sur la peau du tronc, en coordonnées monde **posées** (points via `tr.point`, donc via le contrapposto). Le rendu par pixel (`pixel.ts`) reconstruit le point monde depuis la profondeur (`fromView`, `dirFromView` ajoutés à `camera.ts`), lit la pente du champ et incline la normale ; il ajoute un modelé de ton ±0,7 lié à h. Poids = 0 pour une peau tournée vers l'avant (de face, **aucun pixel ne change**, testé). Silhouette et profondeur ne changent jamais (testé : 0 pixel d'alpha sur 13 archétypes).

**Formes** (cotes de `back.ts` : unité vertébrale u = (T12 − C7)/12, fractions de `x.acr`) : lame (contour réel adouci par Chaikin), épine (crête oblique, s'effilant vers l'acromion), bord médial (gouttière), angle inférieur, infra-épineux, grand rond, deux colonnes d'érecteurs par côté. Amplitude = `H·(base·(1 − 0,65·fat) + mus·vis)` : la même anatomie se lit selon musculature et adiposité.

**Volumes remplacés dans l'IMAGE seulement** (`RELIEF_REPLACES`) : trapèze moyen/inférieur, rhomboïde, infra-épineux, grand rond, épine, érecteurs. Ils restent dans les données (repères, contrats, vérification) ; option `backRelief: false` = ancien rendu.

**Corrections nées des mesures :**
1. Amplitudes initiales ≈ 6 fois trop faibles (0,007 h ≈ 1,6 mm pour une tête de 23 cm) → recalées sur des ordres de grandeur anatomiques (0,02–0,06 h).
2. Les arêtes étaient plus dures qu'avant (saut de luminance max 83–89/255 contre 63–65) : pentes gaussiennes > 50°. Ajout d'un limiteur de pente asymptotique (`RELIEF_SLOPE_MAX = 0,6 ≈ 31°`) → max ≤ 61,7.
3. Contour de lame polygonal anguleux (bord supérieur horizontal) → contour anatomique + Chaikin ; bords adoucis (0,048 h).
4. `baby`/`obese` gardaient un relief net → terme de base atténué par l'adiposité.

**Preuve que les paramètres changent le rendu** (`artefacts/body-08/04-dos-parametres.png`) : part de l'image modifiée, de dos à 460 px : obèse 0,5 % · maigre 1,7 % · adulte femme 5,6 % · adulte homme 7,5 % · très musclé 8,3 % ; hauteur max du champ 0,041 → 0,120 h. Test d'ordre : veryMuscular > adultMale > thin > obese.

**Contrôles (`src/verify/back-relief.ts`, branchés dans `verifyBack`), seuils posés après mesure :**
- Géométrie : `relief-bounds` (formes dans le tronc), `relief-mirror` (énergie G/D 0,9–1,1 ; observé 0,97–0,99).
- Anatomie : `scapula-span` (4,5–6,5 vertèbres ; observé 5,1–5,4), `scapula-medial` (0,20–0,34 de `x.acr` ; observé 0,27), `spine-inclined` (0,5–1,6 vertèbre ; observé 0,86–1,24), `inferior-angle-level` (6,0–9,5 vertèbres sous C7 = T6–T9 ; observé 7,2–9,3).
- Style : `relief-silhouette` (≤ 20 pixels d'alpha ; observé 0), `relief-visible` (≥ 3 % si vis ≥ 0,25, sinon ≥ 0,3 %), `relief-soft` (≤ 66/255), `relief-replaces-sticks`.
- Négatifs testés : formes décalées de 0,5 h, côté droit supprimé, lame écrasée de moitié, bord médial collé à la ligne médiane, volumes remplaçables absents.

## Images (`artefacts/body-08/`)
`01` tête entière + haut du corps de face · `02` épaule · `03` dos avant/après (6 sujets) · `04` paramètres · `05` trois-quarts arrière. « Avant » = dépôt de départ (worktree), « après » = cet arbre, mêmes scripts (`scripts/artefacts-body-08-figure.ts`, `scripts/body-refs/zoom-shot.ts`). Les vues de dos et de trois-quarts arrière montrent le **corps seul** : le moteur de visage est 2D.

## Tests lancés
`tests/body-*`, `tests/neck-*`, `tests/pipeline-body` : 312 tests verts (23 fichiers) ; `lower`, `pipeline-relief`, `relief-lit`, `relief-underview`, `anatomy-contract` : 68 verts. Nouveaux : `body-junction-08.test.ts` (23), `body-back-relief-08.test.ts` (21). **La suite complète du dépôt n'a pas été relancée.**

## Empreintes figées régénérées (`tests/fixtures/figure-golden.json`) — à relire
Après rebase sur l'amont (41 commits, dont le découpage du rendu par pixel en G-buffer/occlusion/ombrage), les 7 cas de `tests/figure-layers.test.ts` échouaient : normal, l'insertion du pectoral et le relief changent volontairement les pixels du corps. **Avant de régénérer, contrôle :** avec l'insertion retirée et `backRelief: false`, les 7 cas redonnent des empreintes **identiques octet pour octet** à l'ancien fichier (SVG, corps, lumière de la tête, ombres). L'écart vient donc entièrement de ces deux fonctions.

Régénération par `npx tsx scripts/figure-golden.ts` (procédure du dépôt, précédent : commit `66f2832`). Résultat : seuls `svg` et `body` changent ; `lit` et `cast` sont inchangés.

**Réserve :** ces empreintes servaient de preuve « couches ≡ ancien rendu monolithique ». Elles sont maintenant une base de non-régression du rendu **avec** les deux fonctions ; l'identité avec l'ancien monolithique reste établie par le contrôle ci-dessus, pas par le fichier. Le portage du relief dans `gbuffer.ts` ajoute `backRelief` et `reliefGain` à la clé de cache (`gbufferKeyOf`), sans quoi un rendu avec et sans relief partageraient le même G-buffer.


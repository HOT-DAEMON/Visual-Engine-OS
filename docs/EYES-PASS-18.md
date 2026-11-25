# Yeux — passe 18 : la rotation de tête mesurée telle qu'elle est dessinée, centre d'iris sous matrice, cause des 16 Mo

Suite de `EYES-PASS-17.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur, aucun nouveau paramètre ; trois fonctions partagées entre le rendu et la vérification, un argument optionnel, zéro duplication.

Reproduire : `npx vitest run tests/eye-pass18.test.ts` · preuves : `npx tsx scripts/artefacts-eyes-pass18.ts` → `artefacts/eyes-pass18/` (+ `rapport.json`).

## 1. Rotation (lacet 60° + azimut 22°) : `iris-meets-opening` et `highlights-confined` échouaient — deux causes, pas une
Le rendu dessine l'iris, ses reflets et leur halo dans le repère de l'iris, puis leur applique la matrice locale de la projection sphérique (`turnT`, `globe-inner.ts`). Constat de la passe 17 : « préexistant, non corrigé ». Mesuré cette fois :

**Cause A — la vérification ne mesurait pas ce que le rendu dessine.** `verifyEye` comparait l'iris et les reflets NON comprimés à l'ouverture comprimée (× 0,15 à 60° / +22°) : rapport iris/ouverture mesuré 3 à 4 alors que le dessin est cohérent. Correction : `applyTurnAbout(p, c, jac)` et `turnedHalfExtents(rx, ry, jac)` (`geometry/eye/turn3d.ts`) = la transformation `turnT` ; `verifyEye` mesure l'anneau d'iris et la boîte des reflets après cette transformation. `isIdentityJac` remplace le test d'identité recopié dans `globe-inner.ts` (une seule définition). À l'identité : résultats identiques à l'octet (de face, aucune règle ne change de verdict : testé).

**Cause B — un vrai défaut de géométrie.** `irisCenter` ajoutait le décalage du regard (`gaze.dx` jusqu'à 29 unités, repère écran de face) au centre de l'ouverture sans lui appliquer la matrice : l'ouverture se comprimait, pas le décalage, et le centre de l'iris sortait de l'ouverture (`iris-center-in-opening`, visible en rouge sur `01-rotation-iris-mesure.png`). Correction : `irisCenter(eye, g, jac)` — troisième argument optionnel (`turned?.jac`), appelé par le rendu et la vérification ; `null` / identité : inchangé. Les deux autres appelants (`anatomy/relations.ts`, `render/head-3d-eyes.ts`) travaillent sur l'œil de face et n'ont pas changé.

Mesures (`02-avant-apres.png`, `rapport.json`, 10 graines × 2 yeux, azimut ±22°, même formule de fraction d'iris avec et sans la matrice) :
| lacet | iris < 0,2 de l'ouverture (avant → après) | fraction minimale | centre hors de l'ouverture (avant → après) |
|---|---|---|---|
| 0° | 0 → 0 | 0,48 → 0,48 | 0 → 0 |
| 30° | 0 → 0 | 0,20 → 0,48 | 0 → 0 |
| 45° | 1 → 0 | 0,04 → 0,44 | 1 → 0 |
| 60° | **9 → 0** (sur 20) | 0,04 → 0,36 | 2 → **1** |
Preuve visuelle : `01-rotation-iris-mesure.png` (lacet 0 / 30 / 60°, ouverture en bleu, iris dessiné en vert, ancien centre rouge, centre corrigé vert).

## 2. Ce qui reste en rotation
- ⬜ **1 cas sur 20 à 60°** (graine 14, œil droit, style almond très haut : h 144 pour une largeur 238, regard baissé de 15°) : le centre corrigé reste hors de l'ouverture. Hypothèse, NON mesurée directement : la sphère de la tête a un rayon de 3 largeurs d'œil, et les courbes de paupière à grand |y| sont cisaillées en x (estimation ≈ 6 unités pour une ouverture large de 34). Test : au plus 1 cas sur 60 (`eye-pass18.test.ts`).
- ⬜ À lacet 70° + azimut +22° (œil à 92° de la caméra) `eye-facing-camera` échoue sur 10 yeux sur 10 : attendu (œil derrière le crâne), les règles de cils qui échouent en même temps (`lashes-point-away-from-eye`, `outer-lashes-lean-outward`) en sont probablement la conséquence (non isolé).
- ⬜ Non traités : le raccourcissement du regard (`gazeT`) reste absent de l'anneau mesuré par `verifyEye` (comme avant) ; l'épaisseur des cils et du liner n'est pas recalculée anisotropiquement (`lash-max-length` avertit, valeurs 0,4 à 1,6 à 60°–75° / +22° dans mes tirages) ; le modèle `flat` n'a pas de LOD de rotation.

## 3. Tête de graine 23 à 25° : 16 Mo de SVG — cause trouvée, non corrigée (hors du moteur d'yeux)
Mesure (`rapport.json`, `weight`) : 3,11 Mo à 0° → **15,81 Mo à 25°** ; la même tête **chauve** pèse 0,75 Mo à 25°. Les yeux n'y sont pour rien : le poids vient des cheveux. Tous les tracés de cheveux posés grossissent de ×5 à ×6 en segments (peinture `url`: 92 → 480 segments par tracé ; masses sans peinture : 852 → 5 040) et le clip du reflet (`f0-hair-gloss-clip`, `render/face/hair-detail.ts`, union des polygones de mèches) passe de 27 332 à 166 528 segments (0,44 → 2,67 Mo).
Origine : `densify` (`face/pose/densify.ts`) insère un point tous les `STRAND_EDGE` = 0,002 W sur chaque mèche posée et tous les 0,006 W sur les masses (`hair-pose.ts`, `hair-pose-strand.ts`), puis tout est reprojeté ; à lacet 0 la géométrie n'est pas densifiée.
Non modifié ici : c'est le moteur de cheveux (autre chantier, tests à empreintes). Piste, non essayée : simplifier chaque tracé reprojeté (Ramer–Douglas–Peucker, tolérance ≈ 0,03 unité, invisible) et ne pas utiliser l'union complète des mèches comme clip d'une simple ellipse de reflet.

## 4. Plis des canthi sur une tête entière (EYE-07G) : ce qui est réellement visible
Les yeux d'une tête font ≈ 40 px à `pixelRatio` 1 : `microLod.fine` = 0, aucune ridule (voulu). Mesuré sur les yeux de la graine 23 : `fine` = 0 à 40 px, 0,34–0,37 à 120 px (`pixelRatio` 3), 1 à 245 px (`pixelRatio` 6). `04-oeil-gauche-tete.png` montre le même œil à 1 et à 6 : vaisseaux et plis sont complets à 6 mais restent DISCRETS (réglages de la planche : `outer` 0,7, `inner` 0,6) ; je ne les présente pas comme saillants. `03-tete-graine-23.png` = tête entière et gros plan ×5 à pixelRatio 1 / 6 (la différence n'y est pas lisible à cet agrandissement).
⚠ `resvg` plante (panique native) sur un `viewBox` recadré qui laisse une région de filtre hors cadre : les gros plans passent par `cropPng` (rendu complet puis découpe).

## 5. Vérification
- Tests : `eye-pass18.test.ts` (6 : helpers à l'identité et compressés, centre sous matrice, contrôle négatif sur l'ancien centre, 60 poses sans `iris-meets-opening` ni `highlights-confined`, résiduel ≤ 1, de face inchangé). Tous les fichiers de tests liés aux yeux exécutés et verts (63 fichiers : galeries 1–4, cils, liner, iris, références, formes, 14 `head-turntable*`). **Non exécutés** : la suite complète du dépôt et `npm run regress`.
- Planche 14 de la passe 17 (verdicts) lue : la ligne « rotation 60° » échouait bien sur `iris-meets-opening` et `highlights-confined` ; têtes de graine 23 de la passe 17 lues : yeux lisibles, œil lointain comprimé à 25°.

# Rotation 2D — étape 2 (silhouette) et étape 4, première tranche (masses de cheveux)

Résultat, mesures, blocage rencontré et restes. Procédure : `ROTATION-STEP-02-SVG-SILHOUETTE.md`, `ROTATION-STEP-04-HAIR-2D.md`.
Preuves : `artefacts/rotation-silhouette-hair/` (`npx tsx scripts/rotation-proof.ts`). Tests : `tests/face-pose-silhouette.test.ts`, `tests/face-pose-hair.test.ts`.

## 0. Correction de cap

La « rotation 3D des cheveux » demandée est la rotation du dessin 2D existant (SVG : masses, mèches, contours) par la pose spatiale de la tête, pas une reconstruction des coiffures en volumes 3D.
Le travail précédent (coque 3D, `src/head-turntable/hair-*`, vérifications de corpus) n'est PAS poussé : il reste en patch local hors dépôt. Aucun fichier de `head-turntable/` n'est modifié ici.
Rien n'appelle `hairVolumeOf()` ; aucun maillage ; la grammaire capillaire (`hairGeometry`) n'est pas recalculée.

## 1. Étape 2 — pose de tête → silhouette SVG du crâne

| Élément | Fait |
|---|---|
| Champ de pose | `FaceParams.headPose.yawDeg` (`src/schema/face-pose.ts`), −75…+75, défaut 0, `strict`. Aucun champ adapté n'existait (la doc d'étape 2 prévoyait de s'arrêter : le choix d'en ajouter un a été fait explicitement). Même convention que `HeadTurn` des yeux : yaw > 0 = visage vers la droite de l'image. Pas de tangage : il n'est pas accepté tant qu'il serait ignoré (étape 5). |
| Pose calculée une fois | `faceParts()` : `posed = posedFace(lm, yaw)` ou `null` à yaw 0. |
| Silhouette | `posedOutline(lm, posed)` (`src/face/pose/silhouette.ts`) : le contour frontal est conservé, sa demi-largeur est multipliée par le facteur de la pose. Morceaux de Hermite avec tangente exacte (6 par cubique) : erreur < 0,5 % de la demi-largeur, raccords C1. À yaw 0 : l'objet `lm.outline` lui-même. |
| Où elle est dessinée | Peau (`compileSkin`, paramètre `outline`), surface hôte (`faceSurface`), trait d'encre (`renderInk`), polygone de rim/ombre de la tête et récepteur d'ombres portées (`faceComponents`). Les zones, régions et repères restent ceux de face. |
| Identité à yaw 0 | `scripts/regress.ts check` : toutes les références `exact`, sauf `hard-13-menton-extreme` : `close` (rms 0, écart max 0) à l'identique sur la base 3d78330, donc antérieur à ce travail. Test : SVG identique à l'octet près avec ou sans `headPose: {yawDeg: 0}`. |

### Blocage rencontré (critère d'arrêt de l'étape 2) et correctif

`Skull.halfAt` (étape 1) n'était pas une silhouette exploitable sous la mâchoire. Mesuré à 40° (`ratio = skullHalf / demi-largeur du contour de face`) :
- saut à `jawY` : 0,777 juste au-dessus, 0,954 juste dessous (ellipsoïde de profondeur nulle à `jawY`, cône de profondeur 0,62·rz dessous) ;
- menton élargi : ratio 1,14 à 1,55 (la profondeur du cône dépasse sa largeur et la section est prise symétrique : la moitié arrière du menton, qui n'existe pas, s'ajoutait) ;
- rendu à 60° : le crâne devient une boule et la mâchoire un plateau décroché (capture de travail, non conservée).
Le test d'étape 1 annonçait « silhouette continue » mais ne vérifiait que `isFinite`.

Correctif minimal, dans `skull.ts` seulement : section elliptique `(hx(y), k·hx(y))`, `hx` = demi-largeur RÉELLE du contour, `k = rz/rx` (= 0,92, déjà dans `Skull`).
`halfAt = hx·√(cos²a + k²sin²a)` : continue, ≤ contour de face (k < 1), uniforme en hauteur. Test : facteur ≤ 1, ≥ cos(yaw), saut entre rangées voisines < 0,01, pour 15…75° et trois visages.

## 2. Étape 4, tranche 1 — les MASSES

Fichier : `src/face/pose/hair-pose.ts` ; appelé par `renderHair(…, posed)` après `hairGeometry`, avant tout chemin SVG.

Projection d'un point de la vue de face (`Skull.projectX(x, y, yaw)`), section de hauteur y = ellipse (hx, k·hx), `s = x/hx` :
- sur le crâne (|s| < 1) : `φ = asin s`, `x' = hx·ρ·sin(φ + ψ·cos φ)` avec `ρ = √(cos²a + k²sin²a)`, `ψ = atan(k·tan a)` plafonné à 0,95 rad. La rotation exacte est `φ + ψ` ; le facteur `cos φ` l'annule aux limbes pour que le bord de la masse reste le bord de la silhouette (pas de jour, pas de repli) ;
- hors du crâne (cheveux qui dépassent) : `x' = ±(hx·ρ + (|x| − hx))` : l'épaisseur de cheveux est conservée à partir de la silhouette ;
- ordonnées inchangées (lacet seul). Les arêtes sont rééchantillonnées à 0,6 % de W (la projection n'est pas affine).
Propriétés testées : identité à 0, miroir exact (`x'(−x, −yaw) = −x'(x, yaw)`), strictement croissante (aucun repli), continue, bord = `halfAt` à ±1, signe du décalage de la face = signe du lacet.

Posé : `base`, `backBase`, `tierMasses`, `simMass`, et les entrées de `front` / `back` / `over` qui ne sont pas une mèche (identité d'objet conservée). 10 coiffures testées à ±30°.
Pas posé (tranche suivante, après validation de cette silhouette comme le veut la doc) : `locks` (mèches, `spine`), `shaved`, `skinShadows`, `bare`, `hairline`, `ties`, bande de racines, dégradé buzz, `boundary`.
À lacet nul : même objet géométrique, SVG identique.

## 3. Mesures (`artefacts/rotation-silhouette-hair/metrics.json`)

| Grandeur | Valeur |
|---|---|
| Facteur de silhouette à ±40° | 0,9678 (yeux et mâchoire : section uniforme) |
| Facteur à 60° / 75° | 0,94 / 0,93 |
| Pente de `projectX` / ρ | 1,35 (10°) · 2,2 (30°) · 3,8 (75°), toujours au limbe lointain |
| Sommets d'une masse `base` à ±40° | 434 → 821 (short), 534 → 1218 (long), 484 → 1444 (afro) |

## 4. Critique et limites (à trancher)

1. **L'effet visible est faible.** À 40° la silhouette ne se rétrécit que de 3 %, car le modèle donne au crâne une profondeur proche de sa largeur (`k = 0,92`). Un vrai crâne est plus profond que large (≈ 1,1 à 1,3) ; `k` est une convention d'étape 1, non mesurée. Tant que les traits internes (yeux, nez, bouche : étape 3) ne tournent pas, l'image reste presque frontale.
2. **Symétrie.** `Skull` est centré sur l'axe du cou : lacet +θ et −θ donnent la même silhouette. L'asymétrie réelle (menton et face qui avancent du côté de la rotation) n'est pas dans les données ; elle n'est pas inventée. Plus petit prérequis : profondeur avant et arrière distinctes dans `Skull` (`rzFront`, `rzBack`).
3. **Données cachées.** Le dessin de face ne contient rien derrière l'horizon. Côté lointain la bande de cheveux écrasée près du limbe est dépliée (étirement 2,2× à 30°, 3,8× à 75°) : acceptable pour une masse unie, à surveiller pour les mèches. Au-delà d'environ ±50° (ψ plafonné) la face avance moins que la rotation exacte. Pour la vue de dos et 360° il faudra des vues clés dessinées, pas un maillage.
4. **Cheveux sous le menton** (longs, bob) : `hx` y est lu au niveau du menton ; la largeur ne suit pas le cou (`neckHalf`, qui existe dans la pose).
5. **Défauts déjà présents à 0°** visibles sur la planche 02 : petit crochet de la base au bout de la lisière près de l'oreille (short, bob, ponytail), base d'afro à bords droits. Non traités ici.

## 5. Restes par composant

| Composant | Reste |
|---|---|
| Mèches (`locks`, `spine`) | Poser avec la même projection ; revoir l'étirement du limbe lointain. À faire après validation des masses. |
| Ombres de mèches, zones rasées, calvitie, racines, buzz | Poser ou recalculer dans le repère posé. |
| Yeux, nez, bouche, oreilles, sourcils | Étape 3 / 5 (la pose existe : `posedFace().nodes`). |
| Tangage et roulis | Étape 5 ; champ `pitchDeg` absent du schéma. |
| Pièces attachées (queue, chignon, tresses) | Profondeur propre requise (ancre sur le crâne + longueur) ; non posées. |
| Régression | `hard-13-menton-extreme` rend `close` (pixels identiques) même sur la base 3d78330 : SVG différent sans effet visible, cause non cherchée. |
| Corpus multi-graines | À étendre aux poses (±15°, ±30°, ±45°) une fois les mèches posées. |

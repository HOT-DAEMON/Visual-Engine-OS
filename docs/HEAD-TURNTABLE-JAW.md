# Tête en rotation — mâchoire, menton, joues

Suite de `HEAD-TURNTABLE-ENGINES.md`. Code : `src/head-turntable/{types,sections,mesh}.ts`, `engines/{jaw-model,rows}.ts`. Contrôles : `verify-contour.ts`, `verify-head.ts` (voir `HEAD-TURNTABLE-VERIFY-HEAD.md`).
Artefacts : `artefacts/head-turntable-v2/` (avant / après, gros plans, contours annotés). Tests : `tests/head-turntable-jaw.test.ts`.

## 1. Ce qui était faux (constat sur `artefacts/head-turntable-engines/`)

La tête est une pile de coupes horizontales. Chaque coupe était une **ellipse** (demi-largeur `a`, avant `zf`, arrière `zb`, centre `(zf + zb) / 2`). Sous la bouche, une coupe n'est pas une ellipse :
c'est le corps de la mandibule, un U (ou un V) dont la plus grande largeur est au bord ARRIÈRE (coin gonial) et qui se resserre jusqu'au menton. L'ellipse met cette largeur au milieu, donc :

- en vue oblique (20° – 70°) le bord avant de la mâchoire dépassait la silhouette mesurée de la planche de **0,09 – 0,10 U** (≈ 9 % de la hauteur de tête) : le « sac qui pend » ;
- le bas du menton restait plat (profondeur 0,04 U à y = 1,05) : une « dent » sous la lèvre à 70° – 90° ;
- l'interpolation entre rangées était un Catmull-Rom à pas supposé régulier alors que la table passe de 0,05 à 0,01 U au menton : tangentes fausses, contour qui ondule ;
- pour une tête quelconque, le plan mandibulaire déduit de l'angle gonial pouvait être presque horizontal (≈ 18°) : arrière de la coupe à −0,26 U jusqu'à y = 0,875 puis remontée brutale (marche).

## 2. Ce qui a été fait

| Élément | Où | Principe |
|---|---|---|
| Coupe généralisée | `Row` (`zw`, `pf`, `qf` optionnels), `sectionPoint`, `surfaceZ`, `halfWidthAtZ` | Moitié avant : `x = a·sin(φ)^(2/qf)`, `z = zw + (zf − zw)·cos(φ)^(2/pf)` ; moitié arrière : demi-ellipse. `(pf, qf)` = (2, 2) ellipse, (1, 2) parabole en U, (1, 1) V, (3, 3) carré arrondi. Sans champs : l'ellipse d'origine, identique. |
| Hermite C¹ à pas non uniforme | `sections.ts` | Tangentes par différences centrées **en y** ; identique à Catmull-Rom quand le pas est régulier. Test : dérivée continue aux nœuds 0,15 / 0,6 / 1,0 / 1,025. |
| Modèle de mâchoire | `engines/jaw-model.ts` | `zw` = point large contre l'arrière, `pf` < 2 (convergence vers le menton, pilotée par `jaw.taper`), `qf` ↑ avec `chin.form` au niveau du menton. Mélange avec l'ellipse des joues sur y ∈ [0,76 ; 0,95]. |
| Bordure de la mandibule | `jawCtx`, `borderZ` | Du gonion 2D (`lm.outline.keys.gonion`, juste derrière le conduit auditif) au menton ; monotone ; au-dessus du gonion elle suit le ramus (−8°). Rend le 3D **cohérent avec le contour 2D** du moteur de visage. |
| Calotte du menton | `closeChin` | Sous y = 1,0 la profondeur se referme en `d₁·√(1 − t)` (centre constant, pente d'entrée ≈ pente du profil, bout vertical) ; la largeur `a` n'est pas touchée (elle reste celle du contour de face). |
| Point large monotone | `engineRows` | Maximum courant de `zw` sur la zone de mâchoire : sinon, avec la caméra en tangage, une oscillation de ±0,2 U décale le contour de ±0,06 U (dents de scie observées sur les graines 6, 9, 11). |
| Nuque → mâchoire | `NAPE_BLEND` = 0,14 U | Têtes issues d'un visage : l'arrière quitte le sillon nucal et rejoint le dessous de la mâchoire progressivement (plus de corniche). |

La **planche garde son plan mandibulaire ajusté** (`mandArc`, `ramusDeg`) : seules la forme des coupes, la calotte et l'interpolation sont nouvelles pour elle. Les têtes issues d'un visage utilisent la bordure dérivée des repères 2D (`mandLandmarks`).

## 3. Mesures (mêmes outils, état commité d'origine dans un worktree propre : `scripts/head-turntable/audit-planche.ts`)

Écart moyen (U) entre la silhouette rendue et la silhouette MESURÉE de la planche (`rotation_head.measures.json`), bande mâchoire t = 0,80 → 1,00, gauche + droite. Signé gauche : négatif = le moteur déborde.

| Lacet | Avant | Après | Signé gauche avant → après | Pic avant → après |
|---|---|---|---|---|
| 0° | 0,0051 | 0,0074 | +0,0015 → −0,0055 | 0,024 → 0,025 |
| 20° | 0,0243 | 0,0231 | −0,0338 → −0,0315 | 0,091 → 0,091 |
| **45°** | 0,0302 | **0,0184** | **−0,0428 → −0,0179** | 0,098 → 0,070 |
| 70° | 0,0352 | 0,0325 | −0,0445 → −0,0383 | 0,228 → 0,207 |
| 90° | 0,0279 | 0,0277 | −0,0063 → −0,0059 | 0,068 → 0,068 |
| 110° | 0,0211 | 0,0219 | −0,0052 → −0,0029 | 0,070 → 0,070 |
| **135°** | 0,0352 | **0,0265** | −0,0241 → +0,0016 | 0,127 → 0,127 |
| 160° | 0,0237 | 0,0215 | −0,0091 → +0,0169 | 0,073 → 0,058 |
| **180°** | 0,0216 | **0,0132** | −0,0216 → −0,0126 | 0,055 → 0,041 |
| **Moyenne** | **0,0249** | **0,0214 (−14 %)** | | |

À lire sans enjolivement :
- les gains sont à 45°, 135° et 180° ; **0° se dégrade légèrement** (+0,002 U, la largeur de face était déjà calée à 0,005) et **160° passe de −0,009 à +0,017** en signé (la mâchoire est maintenant un peu en retrait de la planche) ;
- **70° garde un pic de 0,2 U** au bout du menton : une seule hauteur (t ≈ 0,975) où la mesure de la planche et le moteur ne se rejoignent pas (menton de la planche plus fuyant) ; non corrigé ;
- les métriques de **courbure** du contour (rayon minimal, inflexions, creux : `verify-contour.ts`) ne distinguent presque pas l'avant de l'après sur la planche (le sac est convexe, donc lisse) : c'est l'écart signé à la silhouette mesurée qui le mesure. Elles servent aux têtes variées (dents de scie : 6 inflexions → 0 sur les graines 9 et 11).

## 4. Réglage des constantes (`JAW_SHAPE`) — protocole et limites

Recherche par coordonnée sur 6 paramètres (`y0`, `y1`, `wf0`, `wfSlope`, `pf0`, `pfSlope`) en **calibrant seulement sur 45° et 135°** ; validation sur 20°, 70°, 110°, 160° : calibrage 0,0234 → 0,0215, validation 0,0258 → 0,0235.
L'optimum collait aux bornes (point large tout à l'arrière, côtés quasi droits : `wf0` 0,02, `pf0` 0,8) : valeurs finales moins extrêmes, `wf0` 0,04, `pf0` 0,9, couplées à `jaw.taper` pour que les autres visages varient (pentes `wfSlope` 0,3, `pfSlope` 1,0).
`y0` / `y1` (0,76 / 0,95) et `qfForm` (0,9) ont été choisis **à l'œil** (ondulation à 20°, coin du menton à 45° : voir `artefacts/head-turntable-v2/02-machoire-gros-plans.png`), pas par l'optimiseur.
Réglage sur UNE planche et deux de ses vues : à revalider avec d'autres références mesurées (voir `HEAD-TURNTABLE-REMAINING.md`).

## 5. Reste à faire (mâchoire, menton, joues)

1. Menton de profil à 70° : pic 0,2 U ; menton de la planche plus fuyant que le moteur (`chin.projection` non exploité par le modèle de section).
2. Joues : aucun modelé (pommettes, creux sous la pommette, bajoue) ; la joue est la coupe elliptique mélangée. La référence `01.jpg` montre une joue creuse et une mâchoire en V doux : à injecter via `cheek.*` du moteur de visage.
3. Jonction mâchoire / cou : angle vif à 90° (la planche : transition douce avec ombre) ; cou toujours un cylindre non raccordé (`HEAD-TURNTABLE-REMAINING.md`).
4. Menton fendu (`chin.symphysis = cleft`) : aucune fossette 3D ; `qf` seulement.
5. Ombre portée sous le menton et bandes d'ombre dures sur la joue (la coupe en V crée une arête de normale ; l'ombrage à deux tons la révèle).
6. Paramètres du modèle en bordure de borne, calage sur une seule planche.

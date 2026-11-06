# Tête en rotation — tous les contrôles de vérification (généré)

Suite de `HEAD-TURNTABLE-VERIFY.md`. Généré par `python3 scripts/head-turntable/doc-checks.py` depuis `artefacts/head-turntable-engines/apres/verification/verification_report.json` : ne pas modifier à la main.
Tangage ajusté 17.73° ; résidu de l'ajustement rigide {'eye': 0.0121, 'mouth': 0.0063, 'observations': 26} U ; verdict global : OK.

## Couche 1 — Cohérence géométrique (38 contrôles, dont 12 liés aux moteurs `eng.*`)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `mesh.finite` | Maillages : sommets ou normales non finis (NaN / Infinity) | 0 – 0 | **0** | oui |
| `sil.fit.0` | Silhouette à 0° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.0177** | oui |
| `sil.fit.90` | Silhouette à 90° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.026** | oui |
| `sil.fit.180` | Silhouette à 180° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.0204** | oui |
| `sil.holdout.20` | Silhouette à 20° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0249** | oui |
| `sil.holdout.45` | Silhouette à 45° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0244** | oui |
| `sil.holdout.70` | Silhouette à 70° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0264** | oui |
| `sil.holdout.110` | Silhouette à 110° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0287** | oui |
| `sil.holdout.135` | Silhouette à 135° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0273** | oui |
| `sil.holdout.160` | Silhouette à 160° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0238** | oui |
| `mirror.45` | Symétrie : rendu à +45° = miroir du rendu à −45° (IoU) | 0.985 – 1 | **0.9901** | oui |
| `period.315` | Périodicité : rendu à 315° = rendu à −45° (IoU) | 0.999 – 1 | **1** | oui |
| `eyes.0` | Yeux visibles à 0° (attendu 2) | 2 – 2 | **2** | oui |
| `eyes.90` | Yeux visibles à 90° (attendu 1) | 1 – 1 | **1** | oui |
| `eyes.180` | Yeux visibles à 180° (attendu 0) | 0 – 0 | **0** | oui |
| `iris.0` | Iris proche à 0° : écart de position vs mesure, en U | 0 – 0.05 | **0.0276** | oui |
| `iris.20` | Iris proche à 20° : écart de position vs mesure, en U | 0 – 0.05 | **0.0263** | oui |
| `iris.45` | Iris proche à 45° : écart de position vs mesure, en U | 0 – 0.05 | **0.0321** | oui |
| `iris.70` | Iris proche à 70° : écart de position vs mesure, en U | 0 – 0.05 | **0.0318** | oui |
| `iris.90` | Iris proche à 90° : écart de position vs mesure, en U | 0 – 0.05 | **0.0117** | oui |
| `iris.110` | Iris proche à 110° : écart de position vs mesure, en U | 0 – 0.05 | **0.0347** | oui |
| `mouth.0` | Bouche à 0° : écart de position vs mesure, en U | 0 – 0.08 | **0.047** | oui |
| `mouth.20` | Bouche à 20° : écart de position vs mesure, en U | 0 – 0.08 | **0.0393** | oui |
| `mouth.45` | Bouche à 45° : écart de position vs mesure, en U | 0 – 0.08 | **0.0592** | oui |
| `mouth.70` | Bouche à 70° : écart de position vs mesure, en U | 0 – 0.08 | **0.0418** | oui |
| `nose.protrusion` | Profil 90° : le nez dépasse le front de (U) — la planche : 0,04 | 0.02 – 0.1 | **0.0505** | oui |
| `eng.present` | La tête est dérivée des moteurs existants (1 = oui) | 1 – 1 | **1** | oui |
| `eng.fit.a` | Résidu du calage du contour de face sur la planche (rms, U) | 0 – 0.015 | **0.0067** | oui |
| `eng.fit.zf` | Résidu du calage du profil avant sur la planche (rms, U) | 0 – 0.025 | **0.0166** | oui |
| `eng.fit.zb` | Résidu du calage de l'arrière / dessous de la mâchoire (rms, U) | 0 – 0.045 | **0.0313** | oui |
| `eng.landmarks` | Ligne des yeux de la spec = ligne des yeux du moteur de repères (écart, U) | 0 – 1e-06 | **0** | oui |
| `eng.ear.mirror` | Oreilles gauche / droite symétriques, hors asymétrie naturelle du moteur (écart max, U) | 0 – 0.012 | **0** | oui |
| `eng.ear.root` | L'oreille est attachée au crâne : /x racine − x surface du crâne/ (U) | 0 – 0.02 | **0.0071** | oui |
| `eng.ear.buried` | L'oreille ne s'enfonce pas dans le crâne : enfoncement max du contour (U) | 0 – 0.03 | **0** | oui |
| `eng.neck.hidden` | Haut du cou enfoui dans le crâne : marge de largeur (U, ≥ 0) | 0 – 1 | **0.2077** | oui |
| `eng.neck.zrange` | Face antérieure du cou derrière la face du crâne (z cou − z avant du crâne à y0, U) | -1 – 0 | **-0.3056** | oui |
| `eng.jaw.smooth` | Mâchoire sans angle vif : dérivée seconde max de la demi-largeur (U) | 0 – 0.035 | **0.0132** | oui |
| `eng.nose.knots` | Profil du nez : ordonnées croissantes et largeurs positives (1 = oui) | 1 – 1 | **1** | oui |

## Couche 2 — Cohérence anatomique (28 contrôles, dont 9 liés aux moteurs `eng.*`)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `eye.line` | Ligne des yeux / hauteur de tête (canon 0,50 ; planche stylisée plus bas) | 0.45 – 0.65 | **0.5902** | oui |
| `eye.spacing` | Écart entre les yeux en largeurs d'œil (canon : 1,0 — règle des cinq yeux) | 0.8 – 1.3 | **0.9959** | oui |
| `nose.width` | Largeur du nez / écart entre les yeux (canon réaliste 1,0 ; dessin animé plus étroit) | 0.4 – 1.1 | **0.6102** | oui |
| `mouth.width` | Largeur de bouche / écart des pupilles (canon 0,7 – 1,0) | 0.45 – 1.1 | **0.5895** | oui |
| `thirds.lower` | Tiers : base du nez → menton / sourcil → base du nez (canon 1,0 ; menton court sur la planche) | 0.55 – 1.2 | **0.7779** | oui |
| `mouth.third` | Bouche dans le tiers inférieur : (bouche − base du nez) / (menton − base du nez) (canon 0,33) | 0.2 – 0.5 | **0.2689** | oui |
| `ear.top` | Haut de l'oreille vs sourcil : écart en U (canon : à la hauteur du sourcil) | 0 – 0.12 | **0.0771** | oui |
| `ear.bottom` | Bas de l'oreille vs base du nez : écart en U (canon : à la hauteur de la base du nez) | 0 – 0.1 | **0** | oui |
| `ear.z` | Oreille au milieu de la profondeur du crâne : z de l'attache − centre du crâne (U) | 0 – 0.12 | **0.005** | oui |
| `skull.ratio` | Crâne : longueur (avant-arrière) / largeur (canon 1,1 – 1,4) | 1 – 1.4 | **1.0316** | oui |
| `neck.ratio` | Cou : largeur / largeur du crâne (canon 0,35 – 0,55) | 0.3 – 0.6 | **0.3657** | oui |
| `neck.behind` | Le cou est sous l'arrière du visage : z du cou − z du centre du crâne (U, ≤ 0,02) | -0.2 – 0.02 | **-0.0233** | oui |
| `chin.narrow` | Menton plus étroit que le crâne : demi-largeur du menton / demi-largeur du crâne | 0.1 – 0.6 | **0.3584** | oui |
| `brow.eye` | Sourcil au-dessus de l'œil : écart / hauteur d'œil (canon 1,0 – 1,5) | 0.6 – 1.6 | **1.0977** | oui |
| `eye.on.face` | Œil posé sur la surface du visage : /z œil − z surface/ (U) | 0 – 0.05 | **0.0261** | oui |
| `iris.ratio` | Iris / largeur d'œil (réaliste 0,45 ; planche et animation 0,6 – 0,8) | 0.55 – 0.85 | **0.7353** | oui |
| `eye.aspect` | Hauteur / largeur de l'œil (réaliste 0,35 – 0,45 ; planche ronde) | 0.6 – 1 | **0.8824** | oui (info) |
| `hair.front` | Lisière avant des cheveux au-dessus du sourcil (U de marge, ≥ 0,1) | 0.1 – 0.5 | **0.26** | oui |
| `hair.sideburn` | Pattes : la lisière à 85° descend au haut de l'oreille (écart en U) | 0 – 0.08 | **0.0121** | oui |
| `eng.gonial` | Angle gonial (canon adulte 110° – 140° ; enfant et dessin plus ouverts) | 95 – 145 | **135.5** | oui |
| `eng.mandplane` | Inclinaison du plan mandibulaire sur l'horizontale, ° (canon 15° – 35°) | 12 – 50 | **45.3845** | oui (info) |
| `eng.ear.height` | Hauteur de l'oreille / hauteur de la tête (canon 0,22 – 0,27) | 0.2 – 0.3 | **0.2452** | oui |
| `eng.ear.crus` | Racine de l'hélix sur la ligne des yeux : écart (U) | 0 – 0.03 | **0** | oui |
| `eng.ear.angle` | Angle d'ouverture de l'oreille, ° (canon 21° – 38° ; dessin jusqu'à 45°) | 18 – 45 | **28** | oui |
| `eng.ear.width` | Largeur / hauteur de l'oreille (canon 0,50 – 0,62 ; dessin plus large) | 0.45 – 0.8 | **0.7129** | oui (info) |
| `eng.neck.tilt` | Inclinaison du cou en avant, ° (canon 10° – 30°) | 5 – 32 | **25.7** | oui |
| `eng.nose.proj` | Projection du nez devant le plan du visage (U, canon 0,03 – 0,1) | 0.02 – 0.12 | **0.0974** | oui |
| `eng.lips.order` | Lèvres : sup. au-dessus de la inf. et toutes deux sous le nez (1 = oui) | 1 – 1 | **1** | oui |

## Couche 3 — Style artistique (12 contrôles, dont 3 liés aux moteurs `eng.*`)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `tones.skin` | Peau en aplats : part des pixels à ±16 du ton clair ou ombré (0°) | 0.7 – 1 | **0.9183** | oui |
| `tones.hair` | Cheveux en aplats : part des pixels à ±16 du ton clair ou ombré (135°) | 0.8 – 1 | **0.9193** | oui |
| `pixels.black` | Pixels noirs purs dans la tête (0,0,0 : valeur NaN peinte ; l'encre est #493831) | 0 – 0 | **0** | oui |
| `ink.width` | Épaisseur du contour (U) — planche : ≈ 0,015 | 0.008 – 0.022 | **0.0135** | oui |
| `ink.closure.0` | Contour fermé à 0° (part du bord en encre) | 0.9 – 1 | **0.999** | oui |
| `ink.closure.135` | Contour fermé à 135° (part du bord en encre) | 0.9 – 1 | **1** | oui |
| `ink.specks.0` | Bruit d'encre à 0° (îlots < 6 px, ≤ 6) | 0 – 6 | **1** | oui |
| `ink.specks.45` | Bruit d'encre à 45° (îlots < 6 px, ≤ 6) | 0 – 6 | **0** | oui |
| `iris.highlight` | Reflet blanc dans chaque iris à 0° (attendu 2) | 2 – 2 | **2** | oui |
| `eng.ear.ink` | Part d'encre dans l'oreille de profil (dessin lisible : 0,08 – 0,45) | 0.08 – 0.45 | **0.4171** | oui |
| `eng.ear.noise` | Plages d'encre séparées dans l'oreille de profil (≤ 14 : pas de bruit) | 1 – 14 | **3** | oui |
| `eng.ear.size` | Oreille de profil : hauteur / hauteur de la tête (planche ≈ 0,25) | 0.18 – 0.34 | **0.2692** | oui |


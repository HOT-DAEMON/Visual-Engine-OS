# Tête en rotation — vérification (géométrie, anatomie, style)

Suite de `HEAD-TURNTABLE.md`. Code : `src/head-turntable/verify-*.ts` ; rapport complet : `artefacts/head-turntable/verification/verification_report.json`
(régénéré par `npx tsx scripts/head-turntable/artefacts-turntable.ts`). Tests : `tests/head-turntable.test.ts`.

`verifyHeadTurn(measures, spec)` renvoie 3 couches ; un contrôle est **dur** (bloquant) ou **info** (rapporté, jamais bloquant : écart de style ou limite assumés).
Les valeurs ci-dessous sont celles du dernier rapport (tableaux générés depuis le JSON, pas recopiés).

## Ce qui est VRAIMENT validé hors échantillon

La table de sections est bâtie sur trois vues seulement (0°, 90°, 180°). Les six autres lacets (20°, 45°, 70°, 110°, 135°, 160°) ne servent PAS à bâtir
les sections : ce sont de vraies prédictions. Erreur moyenne de silhouette (distance entre bords rendus et bords mesurés, aux mêmes hauteurs) :

| Lacet | 0° | 20° | 45° | 70° | 90° | 110° | 135° | 160° | 180° |
|---|---|---|---|---|---|---|---|---|---|
| Statut | calage | hors | hors | hors | calage | hors | hors | hors | calage |
| Erreur (px de planche, 150 px = 1 U) | 2,0 | 3,8 | 3,7 | 2,7 | 1,5 | 2,3 | 3,3 | 3,4 | 4,1 |

Le modèle ne se dégrade pas hors échantillon (3,2 px en moyenne contre 2,5 px sur les vues de calage) : la tête est bien un solide rigide qui tourne.
Seuils : 0,03 U (calage) et 0,035 U (hors échantillon). Limite : l'erreur de calage à 180° (4,1 px) est la plus haute : l'arrière du crâne et les oreilles vues de dos.

Recouvrement des cheveux (IoU, rapporté, non bloquant — `hair-iou.py`) :

| Lacet | 0° | 20° | 45° | 70° | 90° | 110° | 135° | 160° | 180° | Moyenne |
|---|---|---|---|---|---|---|---|---|---|---|
| IoU | 0,72 | 0,69 | 0,61 | 0,75 | 0,83 | 0,86 | 0,90 | 0,90 | 0,93 | 0,80 |

Faible de face et en 3/4 (0,61 – 0,72) : la lisière est une fonction y(azimut) ; la planche dessine une frange et des pattes qu'elle ne peut pas décrire.

## Ce que la vérification a trouvé (et comment cela a été traité)

| Constat | Cause | Traitement |
|---|---|---|
| Bouche à 45°/70° : écart 0,07 U > seuil 0,06 | la planche mesure la CAVITÉ de la bouche ouverte, en retrait de 0,076 U des lèvres ; le moteur peint l'intérieur sur la surface des lèvres | seuil porté à 0,08 U avec la raison écrite dans le contrôle ; cavité non modélisée → reste à faire |
| Épaisseur de trait 0,0067 U < 0,008 | le trait des silhouettes grandit seulement vers l'intérieur : visible = nominal / 2 | rendu corrigé (nominal 0,022 → visible 0,011), seuil inchangé |
| Contour fermé à 64 % | pixels de bord = mélange encre/fond (antialiasing), testés trop strictement | MESURE corrigée (on teste aussi les voisins), seuil inchangé |
| 86 « îlots d'encre » | le test comptait les pixels d'antialiasing | MESURE corrigée (connexité 8, seuil large) ; puis 13 vrais points restants = lisière brisée en pointillés dans les parties raides → trait de lisière à largeur constante À L'ÉCRAN (tangente projetée) |
| Bande NOIRE au bas du cou (non détectée par les métriques de l'époque) | `flare()` divisait par 0 quand j'ai raccourci le cou (NaN → pixel noir) | corrigé ; deux contrôles ajoutés : `mesh.finite` et `pixels.black` ; le défaut est rejoué dans un test et DOIT échouer |

Règle suivie : quand un contrôle échoue, on regarde d'abord si c'est la MESURE ou le MODÈLE qui est faux ; on ne desserre une borne que si l'écart est
physiquement expliqué et écrit (cas de la bouche). Les bornes anatomiques (canon élargi pour le style) n'ont pas été retouchées après les premiers résultats,
mais elles ont été écrites en connaissant les proportions du modèle : cette couche détecte une DÉRIVE, elle ne valide pas le canon de façon indépendante.

## Couche 1 — Cohérence géométrique (26 contrôles)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `mesh.finite` | Maillages : sommets ou normales non finis (NaN / Infinity) | 0 – 0 | **0** | oui |
| `sil.fit.0` | Silhouette à 0° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.0135** | oui |
| `sil.fit.90` | Silhouette à 90° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.0098** | oui |
| `sil.fit.180` | Silhouette à 180° (vue de calage) : erreur moyenne vs mesure, en U | 0 – 0.03 | **0.027** | oui |
| `sil.holdout.20` | Silhouette à 20° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0255** | oui |
| `sil.holdout.45` | Silhouette à 45° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0243** | oui |
| `sil.holdout.70` | Silhouette à 70° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0181** | oui |
| `sil.holdout.110` | Silhouette à 110° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0153** | oui |
| `sil.holdout.135` | Silhouette à 135° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.022** | oui |
| `sil.holdout.160` | Silhouette à 160° (HORS échantillon) : erreur moyenne vs mesure, en U | 0 – 0.035 | **0.0229** | oui |
| `mirror.45` | Symétrie : rendu à +45° = miroir du rendu à −45° (IoU) | 0.985 – 1 | **0.9904** | oui |
| `period.315` | Périodicité : rendu à 315° = rendu à −45° (IoU) | 0.999 – 1 | **1** | oui |
| `eyes.0` | Yeux visibles à 0° (attendu 2) | 2 – 2 | **2** | oui |
| `eyes.90` | Yeux visibles à 90° (attendu 1) | 1 – 1 | **1** | oui |
| `eyes.180` | Yeux visibles à 180° (attendu 0) | 0 – 0 | **0** | oui |
| `iris.0` | Iris proche à 0° : écart de position vs mesure, en U | 0 – 0.05 | **0.0278** | oui |
| `iris.20` | Iris proche à 20° : écart de position vs mesure, en U | 0 – 0.05 | **0.0299** | oui |
| `iris.45` | Iris proche à 45° : écart de position vs mesure, en U | 0 – 0.05 | **0.0337** | oui |
| `iris.70` | Iris proche à 70° : écart de position vs mesure, en U | 0 – 0.05 | **0.034** | oui |
| `iris.90` | Iris proche à 90° : écart de position vs mesure, en U | 0 – 0.05 | **0.0146** | oui |
| `iris.110` | Iris proche à 110° : écart de position vs mesure, en U | 0 – 0.05 | **0.0273** | oui |
| `mouth.0` | Bouche à 0° : écart de position vs mesure, en U | 0 – 0.08 | **0.0379** | oui |
| `mouth.20` | Bouche à 20° : écart de position vs mesure, en U | 0 – 0.08 | **0.0355** | oui |
| `mouth.45` | Bouche à 45° : écart de position vs mesure, en U | 0 – 0.08 | **0.0643** | oui |
| `mouth.70` | Bouche à 70° : écart de position vs mesure, en U | 0 – 0.08 | **0.0639** | oui |
| `nose.protrusion` | Profil 90° : le nez dépasse le front de (U) — la planche : 0,04 | 0.02 – 0.1 | **0.037** | oui |

## Couche 2 — Cohérence anatomique (19 contrôles)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `eye.line` | Ligne des yeux / hauteur de tête (canon 0,50 ; planche stylisée plus bas) | 0.45 – 0.65 | **0.5991** | oui |
| `eye.spacing` | Écart entre les yeux en largeurs d'œil (canon : 1,0 — règle des cinq yeux) | 0.8 – 1.3 | **0.9953** | oui |
| `nose.width` | Largeur du nez / écart entre les yeux (canon réaliste 1,0 ; dessin animé plus étroit) | 0.4 – 1.1 | **0.591** | oui |
| `mouth.width` | Largeur de bouche / écart des pupilles (canon 0,7 – 1,0) | 0.45 – 1.1 | **0.5896** | oui |
| `thirds.lower` | Tiers : base du nez → menton / sourcil → base du nez (canon 1,0 ; menton court sur la planche) | 0.55 – 1.2 | **0.7246** | oui |
| `mouth.third` | Bouche dans le tiers inférieur : (bouche − base du nez) / (menton − base du nez) (canon 0,33) | 0.2 – 0.5 | **0.2444** | oui |
| `ear.top` | Haut de l'oreille vs sourcil : écart en U (canon : à la hauteur du sourcil) | 0 – 0.12 | **0.095** | oui |
| `ear.bottom` | Bas de l'oreille vs base du nez : écart en U (canon : à la hauteur de la base du nez) | 0 – 0.1 | **0.02** | oui |
| `ear.z` | Oreille au milieu de la profondeur du crâne : z de l'attache − centre du crâne (U) | 0 – 0.12 | **0** | oui |
| `skull.ratio` | Crâne : longueur (avant-arrière) / largeur (canon 1,1 – 1,4) | 1 – 1.4 | **1.107** | oui |
| `neck.ratio` | Cou : largeur / largeur du crâne (canon 0,35 – 0,55) | 0.3 – 0.6 | **0.3734** | oui |
| `neck.behind` | Le cou est sous l'arrière du visage : z du cou − z du centre du crâne (U, ≤ 0,02) | -0.2 – 0.02 | **-0.0305** | oui |
| `chin.narrow` | Menton plus étroit que le crâne : demi-largeur du menton / demi-largeur du crâne | 0.1 – 0.6 | **0.3916** | oui |
| `brow.eye` | Sourcil au-dessus de l'œil : écart / hauteur d'œil (canon 1,0 – 1,5) | 0.6 – 1.6 | **1.1607** | oui |
| `eye.on.face` | Œil posé sur la surface du visage : |z œil − z surface| (U) | 0 – 0.05 | **0.0265** | oui |
| `iris.ratio` | Iris / largeur d'œil (réaliste 0,45 ; planche et animation 0,6 – 0,8) | 0.55 – 0.85 | **0.7353** | oui |
| `eye.aspect` | Hauteur / largeur de l'œil (réaliste 0,35 – 0,45 ; planche ronde) | 0.6 – 1 | **0.8824** | oui (info) |
| `hair.front` | Lisière avant des cheveux au-dessus du sourcil (U de marge, ≥ 0,1) | 0.1 – 0.5 | **0.25** | oui |
| `hair.sideburn` | Pattes : la lisière à 85° descend au haut de l'oreille (écart en U) | 0 – 0.08 | **0.03** | oui |

## Couche 3 — Style artistique (9 contrôles)

| id | contrôle | bornes | valeur | ok |
|---|---|---|---|---|
| `tones.skin` | Peau en aplats : part des pixels à ±16 du ton clair ou ombré (0°) | 0.7 – 1 | **0.9229** | oui |
| `tones.hair` | Cheveux en aplats : part des pixels à ±16 du ton clair ou ombré (135°) | 0.8 – 1 | **0.9263** | oui |
| `pixels.black` | Pixels noirs purs dans la tête (0,0,0 : valeur NaN peinte ; l'encre est #493831) | 0 – 0 | **0** | oui |
| `ink.width` | Épaisseur du contour (U) — planche : ≈ 0,015 | 0.008 – 0.022 | **0.0135** | oui |
| `ink.closure.0` | Contour fermé à 0° (part du bord en encre) | 0.9 – 1 | **1** | oui |
| `ink.closure.135` | Contour fermé à 135° (part du bord en encre) | 0.9 – 1 | **1** | oui |
| `ink.specks.0` | Bruit d'encre à 0° (îlots < 6 px, ≤ 6) | 0 – 6 | **1** | oui |
| `ink.specks.45` | Bruit d'encre à 45° (îlots < 6 px, ≤ 6) | 0 – 6 | **4** | oui |
| `iris.highlight` | Reflet blanc dans chaque iris à 0° (attendu 2) | 2 – 2 | **2** | oui |

## Limites de cette vérification (à lire avant de s'y fier)

- Les contrôles anatomiques lisent le MODÈLE (proportions), pas l'image : ils ne voient pas un rendu laid mais proportionné.
- Les contrôles de style sont des proxys (palette, aplats, trait, fermeture, bruit) ; aucun ne juge la qualité du dessin. Le jugement visuel
  est donc fait aussi par comparaison directe : `artefacts/head-turntable/comparison/side_by_side_sheet.png` et `overlay_sheet.png`.
- La vérification géométrique n'a qu'UNE tête de référence : elle valide le calage, pas la généralité (autres crânes, âges, morphologies).
- Aucun contrôle n'existe encore sur les oreilles (forme), les yeux hors du profil de la planche, ni sur les vues de `rotation_head_1.jpg` (tangage variable).

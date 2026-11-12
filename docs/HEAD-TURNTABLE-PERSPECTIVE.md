# Tête en rotation — caméra en perspective et recalage à fort tangage

Défaut signalé : la caméra restait **orthographique** alors que `rotation-3d/01`, `02` et `06` montrent un raccourci net en plongée et contre-plongée (le menton, plus proche de la caméra, grossit en contre-plongée ; le front grossit en plongée).

## Ce qui est fait

- `View.persp` (`types.ts`) : distance de la caméra au centre de la tête, en U (hauteurs de tête). **Absent = orthographique, strictement inchangé** (test : mêmes pixels sur la planche). Repères : 3 U ≈ très rapproché (effet marqué), 5 U ≈ portrait, ≥ 12 U ≈ quasi orthographique (60 U : < 1 % de pixels différents).
- `math.ts` `project(c, view)` : chaque point est grossi de D / (D − Δz), Δz = avance sur le centre de la tête (`PERSP_FOCUS_Y` = 0,5 U, milieu sommet → menton, point fixe de l'image). Garde numérique : distance au point ≥ 0,08 D.
- `raster.ts` : interpolation **perspective-correcte** (poids écran corrigés par 1/w) des positions et normales ; chemin orthographique d'origine conservé tel quel.
- Branchement : `head_3d.perspective` (schéma, 2 – 60), `render/head-3d.ts`, `neck-clip.ts` (la ligne de coupe du cou suit la perspective).
- Preuve : `artefacts/face-perimeters-perspective/03-perspective-graine-11.png` et `-42.png` (orthographique en haut, perspective 3,5 U en bas, tangage +35° / 0° / −35°).

## Recalage des yeux et des oreilles à fort tangage — MESURÉ

`scripts/head-turntable/measure-registration.ts` : pour chaque vue (tangage −60° … 60° × lacet 0°, 35°, 70°, graines 3, 11, 42), écart entre le centroïde des pixels réellement peints (région `eye`, région `ear`) et la projection 3D attendue du centre de l'élément. L'écart absolu comprend un **biais systématique** (centre d'oreille attendu ≠ centroïde du pavillon : ≈ 0,07 U dès le tangage 0) ; l'information utile est la **dérive** par rapport au tangage 0 au même lacet :

| Élément | Tangage | Dérive moyenne (U) | Dérive max (U) | Perspective 3,5 U : moy / max |
|---|---|---|---|---|
| œil | −60° | −0,004 | 0,012 | −0,005 / 0,019 |
| œil | −30° | +0,001 | 0,029 | +0,006 / 0,050 |
| œil | +30° | −0,003 | 0,021 | +0,003 / 0,050 |
| œil | +60° | −0,018 | **0,091** | −0,008 / 0,020 |
| oreille | −60° | +0,028 | 0,047 | +0,026 / 0,043 |
| oreille | −30° | +0,007 | 0,019 | +0,017 / 0,039 |
| oreille | +30° | +0,004 | 0,017 | +0,002 / 0,011 |
| oreille | +60° | +0,011 | 0,041 | +0,011 / 0,038 |

Lecture : à ±30° le recalage tient (œil ≤ 0,05 U, oreille ≤ 0,04 U de dérive, soit < 5 % de la hauteur de tête). À ±60° l'oreille dérive jusqu'à 0,047 U et un œil jusqu'à 0,09 U (orthographique, lacet 70° : l'œil proche est raccourci et partiellement masqué, donc son centroïde est biaisé) ; ces valeurs ne sont ni corrigées ni expliquées plus finement. Les éléments masqués (oreille lointaine, œil caché) sont exclus de la mesure (< 40 pixels).

## Reste à faire

- La vérification (`verify-*.ts`) tourne en orthographique : aucun contrôle ne couvre la perspective hors les 4 tests de `tests/head-turntable-perspective.test.ts` et `neck-cut`.
- Perspective non branchée dans le pipeline d'hôte par défaut (opt-in `perspective`) ; aucun réglage de distance par plan de caméra ; pas de perspective en roulis vérifiée séparément.
- La lisière de coiffure (`paint.ts`) et le choix de l'oreille lointaine (`ear-cull.ts`) restent calculés en orthographique.
- Le biais de 0,07 U sur le centroïde de l'oreille n'a pas été investigué (centre attendu ou mesure ?).
- Recalage à ±60° non corrigé (voir ci-dessus) ; mesure sur 3 graines seulement ; l'écart pic du menton à 70° (`HEAD-TURNTABLE-REMAINING.md`) n'est pas traité.

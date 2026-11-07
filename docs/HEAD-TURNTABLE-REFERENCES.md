# Tête en rotation — références et extraction

Suite de `HEAD-TURNTABLE.md`. Ce qui a été extrait de `references/face/`, comment, et avec quelle fiabilité.
Preuves : `artefacts/head-turntable/extraction/` et `artefacts/head-turntable/references/`.

## Inventaire

| Fichier | Contenu | Traitement |
|---|---|---|
| `rotation_head.jpg` (756 × 567) | 9 vues d'une même tête, 0°, 20°, 45°, 70°, 90°, 110°, 135°, 160°, 180° | **mesurée automatiquement** (masques de couleur) → `rotation_head.measures.json` |
| `rotation_head_1.jpg` | 8 vues d'un personnage à coupe au carré (face, profil, 3/4 haut et bas, dos) avec VARIATION DE TANGAGE | **mesurée** (face et profil, `scripts/head-turntable/measure-sheet2.py`) → `rotation_head_1.measures.json` ; autres vues (3/4, tangage variable) non mesurées |
| `01.jpg` (564 × 564) | portrait semi-réaliste, tête inclinée, grands yeux | relevé à la main → `face_refs.measures.json` |
| `02.png` (1920 × 1080) | colère, plan serré, léger lacet, ombre en aile sur les yeux | relevé à la main |
| `05.png` (1920 × 1080) | yeux écarquillés (peur / surprise), face, chapeau | relevé à la main |

## Planche de rotation : méthode (`scripts/head-turntable/measure-rotation.py`)

1. **Localisation** des 9 vues par composantes connexes de la silhouette (bandeau titre exclu).
2. **Masques de couleur** (HSV) : cheveux jaunes, iris bleus, intérieur de bouche rouge, encre sombre. Contrôle visuel : `segmentation_masks.png`.
3. **Origines** : x depuis l'axe du cou de CHAQUE vue (milieu du cou juste sous le menton) ; t depuis le sommet des cheveux ; unité U = H = 150 px.
4. **Profil de silhouette** de chaque vue (41 hauteurs, pas 0,025), limité à la composante connexe de la vue.
5. **Ajustement rigide** (moindres carrés, scipy) : x_img = x cos a − z sin a, t_img = y cos b − z₁ sin b, sur les iris (6 vues) et la bouche (4 vues).

### Pièges rencontrés (corrigés dans le script, à ne pas refaire)

| Piège | Symptôme | Correction |
|---|---|---|
| Hauteur de tête lue sur la vue de FACE | H = 130 px ; ligne des yeux à 0,55 | le « menton » de la face est la ligne du menton, 17 px AU-DESSUS du bas réel de la mâchoire (seule l'ombre le dessine) ; H lu sur le PROFIL : 150 px |
| Marges de vues qui se recouvrent | bord du profil à −0,567 U (faux) | masque propre à chaque vue (composante connexe seule) |
| Axe de rotation pris sur l'ellipse de coupe du cou | nez à −0,553 U au lieu de −0,41 | le cou penche en bas sur la planche ; axe pris 1,03 à 1,11 H sous le sommet |
| Hauteurs d'image supposées invariantes en lacet | traits du visage « dérivent » de 0,10 U | ce n'est PAS du bruit : c'est un tangage de caméra de 17,7° (voir ci-dessous) |

## Résultat clé : la planche est une tête RIGIDE vue en contre-plongée

L'ajustement rigide retrouve **le même tangage par trois voies indépendantes** :

| Voie | Observation | Donne |
|---|---|---|
| Yeux + bouche, 9 vues | 26 observations, résidu 0,012 U (1,8 px) | b = 17,7° |
| Oreille | haut/bas à 0° : t = 0,507 → 0,753 ; à 90° : 0,387 → 0,647 (écart 0,12) | écart = 0,42 × sin b → b ≈ 17° |
| Profondeur de l'œil | z = (x_e cos a − x_img) / sin a, aux 5 lacets ≠ 0 : 0,36 → 0,43 (moy. 0,39) | cohérente : pivot rigide |

Conséquence de modèle : la caméra du moteur a un tangage (`refView(yaw).pitch`), et les hauteurs « vraies » (tête à plat) diffèrent des hauteurs d'image
(`y = t / cos b`, plus un décalage z₁ sin b). Les yeux sont à y = 0,629 U (pas 0,48 comme à 0° sur l'image).

## Valeurs mesurées (extraits)

| Grandeur | Valeur | Remarque |
|---|---|---|
| Largeur du crâne (0°) | 0,76 U | avant-arrière (90°) : 0,93 U ⇒ rapport 1,22 |
| Écart des yeux (x) | ±0,170 U, largeur d'œil 0,17 U | 1 largeur d'œil entre les yeux (règle des cinq yeux) |
| Iris | Ø 0,125 U (iris / œil = 0,735) | style animation |
| Cou | demi-largeur 0,143 U ; dos du cou à z = −0,11 U (profil) | |
| Oreille | y 0,53 → 0,79 U ; ouverture ≈ 50° | haut ≈ sourcil, bas ≈ base du nez |
| Nez (profil 90°) | bout à z = 0,527, front à z = 0,487 : avancée 0,04 U | nez court et peu saillant |

## Autres références (relevé manuel, ±5 px sur 01 ; ±15 px sur 02 et 05) — `face_refs.measures.json`

Les points bruts sont dans `annotate-face-refs.py` ; les rapports sont CALCULÉS. Images annotées : `artefacts/head-turntable/references/annotated_*.png`.

| Grandeur | 01 (semi-réaliste) | 05 (écarquillé) | 02 (colère) | Planche de rotation |
|---|---|---|---|---|
| Écart des iris / largeur d'œil | 1,80 | 1,57 | 1,71 | 2,00 |
| Iris / largeur d'œil | 0,46 | **0,25** | — | 0,735 |
| Hauteur / largeur d'œil | — | **0,58** (œil rond) | — | 0,88 |
| Bout du nez sous les yeux / écart des iris | 0,58 | 0,49 | 0,85 | 0,31 |
| Largeur du nez / écart des iris | 0,40 | — | — | 0,30 |
| Largeur de bouche / écart des iris | 0,58 | — | — | 0,59 |
| Roulis de la ligne des yeux | 5,7° | 0,3° | −2,3° | 0° |
| Inclinaison des sourcils (+ = bout interne plus bas) | +7,8° (bout externe relevé) | caché | **+31° / +29°** (V de colère) | ≈ 0° |
| Rapport des largeurs d'œil proche / lointain | 1,11 | 1,00 | 1,20 | — |

Lecture : la planche (animation) a un nez court et des yeux ronds à grand iris ; 01 est semi-réaliste (iris 0,46, nez plus long) ; 05 montre l'iris
RÉTRÉCI de la peur (0,25) ; 02 donne le froncement (≈ 30°) et une asymétrie d'œil de 1,2 due au lacet. Ces trois profils d'expression ne sont PAS encore
branchés sur le moteur (voir `HEAD-TURNTABLE-REMAINING.md`) ; leurs mesures sont prêtes à devenir des paramètres.

## Planche 2 : `rotation_head_1.jpg` — proportions mesurées (face et profil) → `rotation_head_1.measures.json`

Second personnage (visage rond, coupe au carré). Méthode : segmentation par couleur (peau très pâle : R ≥ 240, R − B ∈ [6, 45] ; cheveux gris ; encre sombre), composante connexe de peau dans une région d'intérêt posée à la main autour de
chaque visage (la peau du cou touche celle du visage par le col), puis lectures ligne par ligne. Unité : fraction de la hauteur de tête H (sommet de la chevelure → bas du menton). Image annotée : `artefacts/head-turntable-v2/06-planche2-mesures.png`.

| Grandeur | Face | Profil |
|---|---|---|
| Hauteur de tête H | 636 px | 602 px |
| Largeur / profondeur de la chevelure sur H | 0,997 | 1,038 |
| Ligne des yeux sur H (depuis le sommet de la chevelure) | **0,623** | — |
| Écart des yeux sur H | 0,330 | — |
| Largeur de PEAU visible aux yeux / à 70 % / 88 % / 96 % de la hauteur du visage | 0,563 / 0,481 / 0,354 / 0,171 | — |
| Largeur du menton (96 %) / largeur aux yeux | **0,304** (mâchoire très convergente) | — |
| Bout du nez sur H | — | 0,769 |
| Saillie du nez sur la ligne du front | — | 0,022 (visage plat) |
| Saillie du menton sur la ligne du front | — | **−0,088** (menton en retrait) |

Limites : les largeurs sont celles de la PEAU VISIBLE (les mèches couvrent les joues : minorants de la vraie largeur) ; régions d'intérêt manuelles ; une seule vue de face et une de profil ; les vues à tangage variable ne sont pas mesurées.
Usage : canon de plausibilité (la borne haute de `head.anat.eyeline`, 0,66, admet 0,62 ; planche 1 : 0,59) et cible pour un futur ajustement de `FaceParams` (`HEAD-TURNTABLE-REMAINING.md`, étape 6). **Aucun paramètre du moteur n'est encore ajusté sur cette planche.**

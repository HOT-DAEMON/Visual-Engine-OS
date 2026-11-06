# Tête en rotation — vérification (géométrie, anatomie, style)

Suite de `HEAD-TURNTABLE.md`. Code : `src/head-turntable/verify-*.ts` ; rapport complet : `artefacts/head-turntable-engines/apres/verification/verification_report.json`
(régénéré par `OUT=artefacts/head-turntable-engines/apres npx tsx scripts/head-turntable/artefacts-turntable.ts`). Tests : `tests/head-turntable.test.ts` et `tests/head-turntable-engines.test.ts`.
TOUS les contrôles (id, bornes, valeur) : `HEAD-TURNTABLE-VERIFY-CHECKS.md` (généré depuis le JSON). Cette page ne garde que la méthode, les constats et les limites.

`verifyHeadTurn(measures, spec)` renvoie 3 couches ; un contrôle est **dur** (bloquant) ou **info** (rapporté, jamais bloquant : écart de style ou limite assumés).
Les valeurs ci-dessous sont celles du dernier rapport (78 contrôles : 38 géométrie, 28 anatomie, 12 style).

## Ce qui est VRAIMENT validé hors échantillon

La table de sections visée par le calage n'utilise que trois vues (0°, 90°, 180°) ; les moteurs sont calés sur elle. Les six autres lacets (20°, 45°, 70°, 110°, 135°, 160°) ne servent PAS
au calage : ce sont de vraies prédictions. Erreur moyenne de silhouette (distance entre bords rendus et bords mesurés, aux mêmes hauteurs) :

| Lacet | 0° | 20° | 45° | 70° | 90° | 110° | 135° | 160° | 180° |
|---|---|---|---|---|---|---|---|---|---|
| Statut | calage | hors | hors | hors | calage | hors | hors | hors | calage |
| Erreur (px de planche, 150 px = 1 U) | 2,7 | 3,7 | 3,7 | 4,0 | 3,9 | 4,3 | 4,1 | 3,6 | 3,1 |

Moyennes : 3,2 px (calage), 3,9 px (hors échantillon). Avant le branchement des moteurs (table ajustée directement sur les silhouettes) : 2,5 px et 3,2 px. **La précision a BAISSÉ de
0,7 px** : les moteurs ont moins de degrés de liberté qu'une table libre de 27 × 3 valeurs. Les seuils (0,03 U calage, 0,035 U hors échantillon) tiennent ; la plus haute erreur est à 110° (4,3 px).
Le modèle ne se dégrade pas franchement hors échantillon (3,9 px contre 3,2 px) : la tête reste un solide rigide qui tourne.

Recouvrement des cheveux (IoU, rapporté, non bloquant — `hair-iou.py`), après recalage de la lisière sur la nouvelle tête (`fit-hairline.ts`) :

| Lacet | 0° | 20° | 45° | 70° | 90° | 110° | 135° | 160° | 180° | Moyenne |
|---|---|---|---|---|---|---|---|---|---|---|
| IoU | 0,71 | 0,70 | 0,55 | 0,64 | 0,75 | 0,82 | 0,87 | 0,90 | 0,93 | 0,76 |

Avant : moyenne 0,80. **Recul de 0,04**, surtout à 45° (0,61 → 0,55) et 70° (0,75 → 0,64) : le crâne dérivé des moteurs n'a pas exactement le contour de l'ancienne table et la lisière est une
fonction y(azimut) qui ne décrit pas la frange. Le recalage n'a regagné que 0,006 : la lisière est à reprendre avec `hair-grammar` (voir `HEAD-TURNTABLE-REMAINING.md`).

## Ce que la vérification a trouvé (et comment cela a été traité)

| Constat | Cause | Traitement |
|---|---|---|
| Bouche à 45°/70° : écart 0,07 U > seuil 0,06 | la planche mesure la CAVITÉ de la bouche ouverte, en retrait de 0,076 U des lèvres ; le moteur peint l'intérieur sur la surface des lèvres | seuil porté à 0,08 U avec la raison écrite dans le contrôle ; cavité non modélisée → reste à faire |
| Épaisseur de trait 0,0067 U < 0,008 | le trait des silhouettes grandit seulement vers l'intérieur : visible = nominal / 2 | rendu corrigé (nominal 0,022 → visible 0,011), seuil inchangé |
| Contour fermé à 64 % | pixels de bord = mélange encre/fond (antialiasing), testés trop strictement | MESURE corrigée (on teste aussi les voisins), seuil inchangé |
| 86 « îlots d'encre » | le test comptait les pixels d'antialiasing | MESURE corrigée (connexité 8, seuil large) ; puis 13 vrais points restants = lisière brisée en pointillés dans les parties raides → trait de lisière à largeur constante À L'ÉCRAN (tangente projetée) |
| Bande NOIRE au bas du cou (non détectée par les métriques de l'époque) | `flare()` divisait par 0 quand j'ai raccourci le cou (NaN → pixel noir) | corrigé ; deux contrôles ajoutés : `mesh.finite` et `pixels.black` ; le défaut est rejoué dans un test et DOIT échouer |

| Oreille gauche inclinée à l'opposé de la droite (`eng.ear.mirror` = 0,067 U) | `placeEarPoint` applique `side × rotationDeg` alors que le plan de l'oreille gauche n'est pas miroité (voir `HEAD-TURNTABLE-ENGINES.md`) | compensé dans le pont ; moteur NON modifié ; contrôle conservé (borne 0,012 U : l'asymétrie naturelle venue de la graine du moteur est tolérée) |
| Silhouette à 90° : 0,0312 U > 0,03 après le premier branchement des moteurs | dessous de mâchoire et nuque (zb pour y de 0,7 à 0,9) pondérés trop bas dans le calage (poids 0,25 « annoté caché » alors que cette zone est visible sur la silhouette) | poids du calage relevés (le dessous de mâchoire est VISIBLE sur la silhouette), cibles du dos du cou prises sur la silhouette mesurée ; borne inchangée |
| Test « oreille flottante » qui ne détectait rien | décaler `zPorion` déplace aussi tout le crâne : le contrôle relatif ne bouge pas | test remplacé par un défaut qui change réellement le rig (ouverture 58° hors canon) ; un contrôle tautologique n'est pas un contrôle |
| Bruit d'encre dans l'oreille de profil (points isolés) | distance d'arête lue sur le texel le plus proche | interpolation bilinéaire de la distance (`inkAt`) ; contrôle `eng.ear.noise` |


Règle suivie : quand un contrôle échoue, on regarde d'abord si c'est la MESURE ou le MODÈLE qui est faux ; on ne desserre une borne que si l'écart est
physiquement expliqué et écrit (cas de la bouche). Les bornes anatomiques (canon élargi pour le style) n'ont pas été retouchées après les premiers résultats,
mais elles ont été écrites en connaissant les proportions du modèle : cette couche détecte une DÉRIVE, elle ne valide pas le canon de façon indépendante.

## Les trois couches (78 contrôles : `HEAD-TURNTABLE-VERIFY-CHECKS.md`)

- **Géométrie** (38) : silhouettes vs mesures (calage / hors échantillon), symétrie, périodicité, yeux, iris, bouche, nez, maillages finis ; **liés aux moteurs `eng.*`** (12) : tête dérivée des moteurs,
  résidus du calage (a, zf, zb), cohérence des repères, oreilles symétriques, attache au crâne, absence d'enfoncement, haut du cou enfoui, mâchoire sans angle vif, profil du nez.
- **Anatomie** (28) : proportions du modèle (cinq yeux, tiers, bouche, oreille, cou…) ; **`eng.*`** (9) : angle gonial, plan mandibulaire, hauteur / largeur / ouverture de l'oreille, racine de l'hélix sur la
  ligne des yeux, inclinaison du cou, projection du nez, ordre des lèvres.
- **Style** (12) : aplats, trait, fermeture du contour, bruit, reflets ; **`eng.*`** (3) : part d'encre, bruit et taille de l'oreille de profil.

Contrôles `info` à connaître (rapportés, jamais bloquants) : `eng.mandplane` = 45,4° (canon 15° – 35° : le plan mandibulaire dérivé est trop raide, voir les paramètres à la borne dans
`HEAD-TURNTABLE-ENGINES-FIT.md`) ; `eng.ear.width` = 0,71 (canon 0,56 : oreille large, résolue sur les largeurs visibles de la planche). `eng.ear.ink` = 0,42 est à 0,03 de sa borne (0,45) :
l'oreille est lourde en encre à 520 px de haut.

## Limites de cette vérification (à lire avant de s'y fier)

- Les contrôles anatomiques lisent le MODÈLE (proportions), pas l'image : ils ne voient pas un rendu laid mais proportionné.
- Les contrôles de style sont des proxys (palette, aplats, trait, fermeture, bruit) ; aucun ne juge la qualité du dessin. Le jugement visuel
  est donc fait aussi par comparaison directe : `artefacts/head-turntable-engines/apres/comparison/side_by_side_sheet.png` et `overlay_sheet.png`.
- La vérification géométrique n'a qu'UNE tête de référence : elle valide le calage, pas la généralité (autres crânes, âges, morphologies).
- Les oreilles ont maintenant des contrôles de placement, de symétrie et de lisibilité (`eng.ear.*`) mais AUCUN contrôle de forme contre une mesure de la planche (pas d'oreille mesurée à 135° – 160°) ; aucun contrôle sur les yeux hors du profil de la planche, ni sur les vues de `rotation_head_1.jpg` (tangage variable).
- Les bornes `eng.*` ont été écrites APRÈS avoir vu les valeurs du modèle ajusté (comme les bornes anatomiques de la première version) : elles détectent une dérive et des défauts injectés, elles ne valident pas le canon de façon indépendante.

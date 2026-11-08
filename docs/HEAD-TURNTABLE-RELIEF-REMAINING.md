# Tête en rotation — reliefs : ce qui est fait et ce qui reste, par composant

Légende : ✅ fait et vérifié · ⚠️ fait avec une limite connue · ⬜ non fait. État au 2026-11-08, branche `feat/hair-grammar`. Preuves : `artefacts/head-turntable-v5/`.

## Extraction des références `references/rotation-3d/` (ce qui a été lu, ce qui a servi)

Protocole du dossier : ignorer couleurs, traits, filigranes, textes ; ne garder que rotation, perspective, caméra, topologie, formes, courbures, dimensions.

| Réf. | Contenu | Utilisé pour |
|---|---|---|
| 01 | grille 5 × 5 lacet × tangage (de −90° à 90° ; contre-plongée → plongée), tête chauve, ombres à deux tons | artefact `05-grille-lacet-tangage-*.png` (même grille rendue à côté de la référence) ; vérifie que la tête tourne en lacet ET en tangage |
| 02 | croquis de construction 5 × 5 : sphère crânienne, plan facial, ellipse de coupe du cou | cadre de lecture du crâne (sphère + plan de face) ; aucune valeur numérique extraite |
| 03 | profil tête renversée : dôme pariétal, oreille à mi-crâne, pente du cou vers les trapèzes, clavicule | évasement cou → épaules ; hauteur de l'oreille |
| 04 | construction de Loomis (sphère, plans, oreille entre sourcil et base du nez) | contrôles `head.anat.ear.top/bottom` existants (déjà en place) ; hauteur de l'oreille |
| 05 | plans du cou sous 15 angles (trapèzes, SCM) | entonnoir du cou vers les trapèzes ; SCM NON modélisés ⬜ |
| 06 | plans de la tête (face, joue, bande crânienne) et bloc de l'oreille | arête de transition face → joue (≈ 50° – 60°) |
| 07 | cou et épaules par l'arrière, crâne sphérique à plan latéral aplati | nuque → trapèzes ; plan latéral du crâne non reproduit ⬜ |
| 08 | contre-plongée forte, bouche ouverte, cou en colonnes | ordre de grandeur du tangage (±35° testé) |

AUCUNE dimension n'a été mesurée sur ces images (styles et proportions différents, perspectives inconnues) : elles ont orienté des CONVENTIONS, pas fourni de mesures. Ce qui n'a pas été fait :
mesure des courbures, des proportions ou de la focale de ces références (⬜) ; leurs ombres n'ont pas servi (le moteur d'ombrage de la tête est à deux tons fixes).

## Par composant

| Composant | État | Fait | Reste à faire |
|---|---|---|---|
| Bosses pariétales | ⚠️ | gaussienne en y et azimut, amplitude ← `vaultPeak` / `vaultHeight`, 12 graines 0,0125 – 0,023 U, 3 contrôles | position et gain = conventions non mesurées ; pas de bosse sur la planche (silhouette mesurée) ; pas de plan latéral aplati du crâne (réf. 07) ; aucun axe `parietal` dans `skull/types.ts` (le relief est dérivé, pas paramétrable) |
| Asymétrie du crâne | ⚠️ | aplatissement occipital, bombement frontal, bosses ± 25 % ; asymétrie dérivée de `face.asymmetry` | corrélation crânio-faciale = hypothèse ; le moteur de crâne n'a pas d'axe d'asymétrie (à ajouter dans le moteur, pas dans le pont) ; asymétrie de la mâchoire et des oreilles non traitée |
| Joues | ⚠️ | pommette, plénitude, creux, masséter, enfants du visage (`cheek.*`) ; contour de face intact | `cheek.lateralWidth` et `elasticity` non lus ; sillon naso-génien et plis péri-buccaux non modelés en 3D ; la réf. `01.jpg` (joue creuse) non injectée ; la planche n'a pas de modelé de joue ; bandes d'ombre dures de la joue (arête de normale du V de mâchoire) non traitées |
| Oreille lointaine | ⚠️ | omise à 8° – 35° et de dos ; contrôle non vacuant | règle par le lacet seul, pas par le tangage ni par la visibilité réelle ; convention de la planche, pas géométrie ; 0 – 580 px d'oreille selon la graine : la règle ne dit pas si une oreille grande dépasse réellement de la joue |
| Menton à 70° | ⚠️ | diagnostic mesuré : décalage vertical de +0,045 U fait passer le max de 0,2075 à 0,0475 U | cause NON prouvée (planche à la main ou rendu trop bas selon la vue) ; forme du menton non modifiée ; `chin.projection` non exploité ; mâchoire de la planche toujours à la borne `mandArc` |
| Jonction cou / épaules | ⚠️ | évasement ← `trapezius`, `c7` ; contrôles de marche et d'évasement | cou toujours coupé par un disque plat ; pas de SCM, de platysma, de clavicule ; `src/neck` et `src/body/volume/neck.ts` non branchés ; `neckScale` (0,77) toujours hors moteur |
| Yeux, sourcils, nez, bouche, peau | ⬜ | inchangés dans ce travail | voir `HEAD-TURNTABLE-REMAINING.md` : `browGeometry`, paupières, globe 3D, nez en boule sur les grands nez, bouche fermée, matériau de peau |
| Cheveux | ⬜ | inchangés | lisière non reliée à `face/hair/boundary` ; IoU 0,55 – 0,64 à 45° – 70° |
| Tangage | ⚠️ | grille ±35° rendue (`05-grille-…`) | à fort tangage le disque de coupe du cou, l'oreille et les yeux ne sont pas recalés ; `REF_PITCH` unique 17,73° |

## Prochaines étapes (par ordre de valeur)

1. Axes `parietal` et `asymmetry` dans le moteur de crâne (`src/skull`), puis retrait de la dérivation locale (`skull-relief.ts` lit alors ces axes).
2. Cou : brancher `src/neck` (SCM, platysma) et la coupe aux épaules (`src/body/volume/neck.ts`) ; supprimer `neckScale`.
3. Joues : `lateralWidth`, `elasticity`, plis naso-géniens ; injecter `01.jpg`.
4. Oreille lointaine : règle par visibilité réelle (fraction du pavillon hors silhouette) plutôt que par le lacet.
5. Menton : seconde planche mesurée (`rotation_head_1.jpg`) pour trancher entre dérive du dessin et défaut de forme.

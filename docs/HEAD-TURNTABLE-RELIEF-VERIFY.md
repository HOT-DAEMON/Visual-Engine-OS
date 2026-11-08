# Tête en rotation — vérification des reliefs (3 couches)

Code : `src/head-turntable/verify-relief.ts`, branché dans `verify-head.ts` (`headGeometry`, `headAnatomy`, `headStyle`). Tests : `tests/head-turntable-relief.test.ts` (10 tests).
Résultat : planche 47 → 52 contrôles, têtes issues d'un visage 60 → 77 ; 13 têtes sans échec bloquant (`artefacts/head-turntable-v5/mesures/verification-apres-13-tetes.json`).
Les bornes sont des conventions d'anatomie artistique écrites AVANT la mesure ; aucune n'a été déplacée pour faire passer un rendu (les seuls réglages faits après coup portent sur les GAINS de relief, trop faibles au premier essai).

## Couche géométrique (têtes issues d'un visage)

| Contrôle | Mesure | Borne |
|---|---|---|
| `head.geo.relief.amplitude` | déplacement radial maximal (crâne + joues), U | ≤ 0,04 |
| `head.geo.relief.continuity` | plus grand saut entre échantillons voisins (0,0125 U, 3°) | ≤ 0,012 (une falaise ferait une arête) |
| `head.geo.relief.face` | déplacement à moins de 4° de la face | ≤ 0,002 (nez, lèvres, profil intacts) |
| `head.geo.cheek.side` | déplacement des joues à 90° | ≤ 0,001 (le contour de face reste celui du moteur de visage) |
| `head.geo.relief.width` | dépassement de la demi-largeur de la section par le maillage | ≤ 1e-9 |

S'y ajoutent les contrôles existants, qui restent verts : `head.geo.front2d` (face 3D vs contour 2D ≤ 0,03), concavité et inflexions de la mâchoire, convexité des coupes du crâne.

## Couche anatomique

| Contrôle | Mesure | Borne (canon) |
|---|---|---|
| `head.anat.parietal.height` | hauteur du maximum du relief du crâne | 0,12 – 0,40 U (tiers supérieur de la voûte, au-dessus de l'oreille) |
| `head.anat.parietal.azimuth` | azimut de ce maximum | 95° – 135° (derrière le conduit auditif) |
| `head.anat.parietal.size` | amplitude | 0,006 – 0,030 U |
| `head.anat.cheek.zygoma` | hauteur du maximum du modelé de joue | entre la ligne des yeux et la bouche (bloquant si le maximum > 0,003) |
| `head.anat.cheek.hollow` | creux sous la pommette | ≥ −0,04 U (pas de poche qui pend) |
| `head.anat.asym.back` | 1 − IoU de la silhouette de dos et de son miroir | < 0,06 (une tête réelle est presque symétrique vue de dos) |
| `head.anat.asym.value` | asymétrie signée dérivée du visage (information) | — |

## Couche de style

| Contrôle | Mesure | Borne |
|---|---|---|
| `head.style.ear.far20` | pixels d'oreille du côté lointain à 20° | = 0 (la planche l'omet) |
| `head.style.ear.near20` | pixels d'oreille du côté proche à 20° | ≥ 150 (elle reste dessinée) |
| `head.style.ear.both0` | la plus petite moitié d'image en oreille à 0° | ≥ 150 (deux oreilles de face) |
| `head.style.neck.flare` | largeur du cou au bas / à mi-cou | 1,08 – 1,9 |
| `head.style.neck.step` | plus grande marche de largeur entre sections (0,02 U) | ≤ 0,03 |

## Ce que les tests prouvent (et ne prouvent pas)

- Le contrôle de l'oreille n'est pas vacuant : le test rastérise la planche SANS omission (829 px lointains à 600 px) puis AVEC (0).
- Un relief asymétrique est dissymétrique, et une asymétrie forcée à 0 donne un relief exactement symétrique (12 chiffres).
- Pariétal : maximum entre 95° et 135° et 0,12 – 0,40 U sur 12 graines.
- **Limites** : les contrôles anatomiques vérifient que le relief est PLACÉ où l'anatomie artistique le met, pas qu'il ressemble à une personne réelle ; aucun relief n'est comparé à une silhouette mesurée de tête avec bosses
  (la planche n'en a pas qui soit séparable) ; le style reste jugé par proxys (contour fermé, inflexions, îlots) et par les artefacts, pas par un goût ; les cinq contrôles de style de la planche passent sans avoir été durcis.

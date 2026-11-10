# Tête 3D ↔ hôte : recouvrement à 0° et yeux de l'hôte

Deux chantiers liés : (1) le contrôle « la tête 3D à 0° recouvre le visage de l'hôte » ; (2) les yeux de l'hôte (forme, taille, regard) repris dans la tête 3D. Preuves : `artefacts/tete-hote-cou-roulis/01-…` et `02-…`.

## Yeux de l'hôte (reprise, pas recréation)

| Fichier | Rôle |
|---|---|
| `src/render/head-3d-eyes.ts` | yeux POSÉS de l'hôte → `HostEyes` (U, repère tête, `x = |x|`) |
| `src/head-turntable/engines/host-eyes.ts` | pose `eyeHost` sur la spec ; `eye` (largeur, hauteurs, rayon d'iris) = moyenne des deux côtés |
| `src/head-turntable/eye-host-tex.ts` | peintre : ouverture réelle, iris recoupé par la paupière, pupille réelle, reflets |
| `src/head-turntable/eye-colors.ts` | teintes fixes partagées avec l'œil de la planche (plus de doublon) |

- **Source unique** : les yeux de la scène, ramenés dans le repère de l'hôte par `toHostFrame` (comme le rendu de face), échelle 1 U = hauteur du visage.
- **Œil EFFECTIF** : `resolveEye` (archétype, expression, étalonnage). La spec brute ne suffit pas : sur la graine 11 elle dit « iris bleu, pupille ronde », le dessin montre « iris vert, pupille en fente ». `irisOf` utilise aussi l'œil résolu.
- **Forme** : polylignes des paupières (`openingPolygon`, 24 points par paupière). **Taille** : celle de l'hôte (avant : œil de la planche mis à l'échelle de l'orbite, 0,19 U contre 0,15 U réels sur la graine 11). **Regard** : décalage réel du centre d'iris dans l'ouverture. **Pupille** : contours réels de `pupilContours` (fente, étoile…), tournés comme l'œil.
- Un seul côté posé (œil absent) : `hostEyesU` renvoie `undefined`, la tête garde les yeux de la planche.
- `head3dSubject(host, o, iris?, eyes?)` : 4ᵉ paramètre optionnel (rétrocompatible) ; `checkHead3d(o, host, eyes)` vérifie la tête qui est rendue.

## Contrôle de recouvrement (`src/head-turntable/verify-host.ts`)

Mesuré sur l'IMAGE à lacet 0, tangage 0 (ids, régions, couleurs), contre `spec.engine.lm.outline` (contour du dessin de face) et `spec.eyeHost`.

| Contrôle | Couche | Borne | Mesuré (8 graines) |
|---|---|---|---|
| `head.host.front.iou` | géométrie | ≥ 0,95 | 0,972 – 0,998 |
| `head.host.front.coverage` | géométrie | ≥ 0,96 | 0,996 – 0,999 |
| `head.host.front.skin` | géométrie | ≥ 0,97 | 0,990 – 1,000 |
| `head.host.eye.{right,left}.outline` | anatomie | moyenne ≤ 0,004 U | 0,0000 |
| `head.host.eye.{right,left}.outline-max` | anatomie | ≤ 0,015 U | 0,0000 |
| `head.host.eye.{right,left}.gaze` | anatomie | ≤ 0,02 U | 0,001 – 0,0148 |

- **IoU / coverage** : largeurs de la TÊTE SEULE (`PART.head`) par rangée, de 0,15 à 1,0 U. Écartées : la bande de l'oreille (le contour de face n'en a pas) et toute rangée dont un bord est fait de CHEVEUX (le contour du visage ne les contient pas).
- **skin** : part du polygone du visage (lisière frontale → menton, 92 % de la demi-largeur) peinte en peau, œil ou bouche : ni cheveux, ni fond, ni trou.
- **outline** : distance de points régulièrement espacés des paupières de l'hôte (hors cil de bout) à l'encre rendue la plus proche. 0,0000 = le tracé passe sous l'encre ; le test de sensibilité décale l'œil de 0,03 U et obtient un refus.
- **gaze** : centre de l'iris visible rendu contre l'attendu (ellipse d'iris de l'hôte ∩ ouverture, moins le trait de paupière et les reflets).

## Défaut trouvé par ce contrôle

Un hôte chauve gardait l'épaisseur de coiffure de la planche (`hairTh = 0,05`) sur le crâne : la tête 3D dépassait le contour du visage de 0,05 U (IoU 0,93). `from-face.ts` met `hairTh = 0` quand la lisière est entièrement sous le sommet ; IoU 0,9975 sur 23 rangées (graine 42).

## Reste à faire

- Sourcils de l'hôte (⬜), paupière supérieure à plusieurs traits, cils individuels, cernes, reflets de l'hôte (le style reprend le trait épais et les 2 reflets de la planche).
- Couleur d'iris : la donnée est reprise, mais le dessin de face la module par son éclairage (graine 42 : olive à l'écran, or dans les données) ; pas de contrôle de teinte.
- Bornes calibrées sur 8 graines ; hôtes à yeux non standards (gemmes, œil unique) non essayés.
- Le contrôle ne compare pas les yeux à d'autres lacets que 0° (le peintre les projette, mais seul le recouvrement de face est prouvé).

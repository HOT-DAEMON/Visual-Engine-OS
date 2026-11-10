# Roulis de la tête 3D

Preuve : `artefacts/tete-hote-cou-roulis/04-roulis.png` (lacet 0 / 45 / 90° × roulis −30 / 0 / +30°).

## Contrat

`head_3d.roll` (°, −40 … 40, défaut 0). **> 0 = la tête s'incline vers la DROITE de l'image** (sens horaire vu de face). Le roulis est une inclinaison latérale autour de l'axe du nez (z de la tête), appliquée AVANT le lacet : de profil, la tête s'incline donc vers ou loin de la caméra. Roulis 0 ou absent : rendu strictement identique à avant (hash sur 12 rendus, test dédié).

## Chaîne cou-tête (`src/head-turntable/roll.ts`, `math.ts`)

- `T` = haut du cou (`neck.y0`, articulation occipitale) ; `B` = base du cou (`neck.y1`, immobile).
- Le **crâne** (tête, oreilles, bosses nez / bouche) suit le roulis total : rotation de `roll − bend` autour de `T`, puis `bend` autour de `B`.
- Le **cou** se plie : angle `bend × w(y)`, `w` = 0 à la base, 1 au sommet (smoothstep). Les épaules restent de niveau.
- `ROLL_BEND = 0,4` : part de la flexion prise par le cou. Amplitude ±40° (flexion latérale cervicale ≈ 45°).
- Les normales tournent comme leur pièce (éclairage cohérent). Les attributs de peinture restent dans le repère tête : la texture ne bouge pas par rapport au crâne.

## Contrôles (`verify-roll.ts`, 2 rendus de plus par tête : lacet 0 roulis +20°, lacet 60 roulis −20°)

| Contrôle | Couche | Borne | Mesuré (8 graines) |
|---|---|---|---|
| `head.roll.eyeline` : rotation de la ligne des yeux dans l'image | géométrie | 20° ± 1,5 | 19,98 – 20,06° |
| `head.roll.rigid` : aire de la tête avec / sans roulis | géométrie | 0,97 – 1,03 | 1,00 |
| `head.roll.joined` : composantes connexes tête + cou, à 0° et 60° | géométrie | = 1 | 1 |
| `head.roll.neck-base` : déplacement de la base du cou (px) | anatomie | ≤ 2 % de la hauteur d'image | 0 |

## Reste à faire

- À fort roulis et fort lacet (≥ 45° et −30°), le haut du cou apparaît derrière la mâchoire comme un fût ouvert : la jonction cou-mâchoire n'a pas de pli de peau ni de recouvrement du SCM.
- `ROLL_BEND` est un réglage anatomique, pas une mesure sur références ; pas de variante par morphologie.
- Le roulis ne tourne pas les cheveux en mèches (la coiffure est une calotte peinte sur le crâne, elle suit le crâne).
- Pas de roulis animé ni d'interpolation de poses ; `REF_PITCH` unique pour la vérification, les contrôles de roulis à lacets 0 et 60° seulement.
- Contrôle de la base du cou à tangage 0 (coupe de chant) : la coupe vue d'en bas n'est pas mesurée.

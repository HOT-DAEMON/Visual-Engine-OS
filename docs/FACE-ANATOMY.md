# Anatomie du visage : nez, menton, mâchoire

Contrats : `src/schema/face-nose.ts`, `src/schema/face-jaw.ts`. Géométrie pure : `src/face/nose/`, `src/face/jaw/`.
Rendu : `src/render/face/nose/`, `src/render/face/jaw.ts`, `src/render/face/neck.ts`. Preuves : `artefacts/face-anatomy/` (01–07).

## Principe : un enfant du visage, pas une primitive posée devant la tête

Rien dans le nez ni dans le menton ne porte de coordonnée. Tout est lu dans `face/landmarks.ts` (ligne des yeux, canthi internes,
base du nez, bouche, orbites, contour) : si l'on déplace la ligne des yeux ou la bouche, le nez et le menton suivent
(`tests/face-nose.test.ts` : « le nez est un ENFANT du visage »). Les grandeurs sont des fractions de `W`, de `H` ou des réels 0–1.
Chaque sous-composant est une fonction pure et déterministe ; le rendu, la vérification et les ombres de contact lisent les MÊMES nombres.

## Nez (`FaceNose`)

Ordre anatomique, chaque étape est un fichier : `frame.ts` (grandeurs communes) → `dorsum.ts` (racine + arête) → `profile.ts` (profil de côté)
→ `tip.ts` → `alae.ts` → `nostrils.ts` → `junctions.ts` → `index.ts` (assemblage).

| Sous-composant | Paramètres | Ce que ça fait (géométrie) |
|---|---|---|
| Racine (nasion) | `root.height`, `root.depth`, `root.width` | Hauteur entre canthi (0) et 0,09 H au-dessus (1), jamais sous la limite des sourcils ; demi-largeur ≤ 85 % de l'écart inter-canthal ; enfoncement naso-frontal (profil). |
| Dorsum | `dorsum.shape` (droit, concave, convexe, asymétrique), `width`, `curvature`, `deviation` | 24 échantillons racine → supra-pointe. Concave/convexe agissent sur le PROFIL (écart en demi-sinusoïde nul aux deux bouts) ; asymétrique ajoute une déviation latérale en S (≤ 3 % W). |
| Pointe | `tip.width`, `roundness`, `projection`, `rotation`, `alarBlend`, `highlight` | Super-ellipse (exposant 1,5 pointue → 2,5 bulbeuse) ; rotation −1…+1 abaisse/relève la pointe ; projection = avancée de profil (45–95 % de la longueur du nez) ; reflet doux ; rupture supra-pointe si `alarBlend` faible. |
| Ailes | `alae.thickness`, `volume`, `flare`, `attachment` | Volume FERMÉ : jonction avec la pointe → crête alaire → attache sur la joue → seuil. Épaisseur du bord (px), dégradé de volume, sillon alaire net ou fondu. |
| Narines | `nostrils.shape`, `tiltDeg`, `asymmetry`, `columella`, `visibility`, + `nostril` (taille) | Goutte orientée : le haut converge vers la ligne médiane ; visibilité dérivée de la rotation de la pointe ; asymétrie ±25 % ; RÉDUITE pour tenir dans le couloir de l'aile (jamais deux points noirs posés). |
| Raccords | `junction.glabella`, `orbital`, `cheek`, `nasolabial` | Courbes nommées : encoche glabelle/front, creux naso-jugal (canthus → crête alaire), sillon alaire, pli naso-génien (aile → commissure, creusé à l'ouverture de la bouche). |

Le nez de profil (`noseProfile`) est une grandeur de référence : la vue de face ne le montre pas, le rendu en tire les ombres, les artefacts
01 et 04 le dessinent dans un encart.

## Menton et mâchoire (`FaceChin`, `FaceJaw`)

Trois grandeurs du menton sont INDÉPENDANTES (vérifié : `tests/face-jaw.test.ts`, artefact 05 avec mesures par cellule) :

- LARGEUR → `chinWidth` (inchangé) : demi-largeur au coin du menton, bornée par la mâchoire.
- HAUTEUR → `chin.height` : distance sillon mentolabial → menton (fraction de H), mesurée DANS la hauteur fixe du visage. Elle déplace le sillon
  et le coin du menton ; elle ne rallonge JAMAIS le visage (`bottomY = H/2 + abaissement`, contrôle `face-length-fixed`). Bornée par la lèvre inférieure
  (`lm.chin.heightPx` mesure la hauteur réelle ; alerte `chin-height-honoured` si elle est écrasée).
- PROJECTION → `chin.projection` : avancée devant le plan du visage. En 2D de face elle se lit dans la lumière (reflet du pogonion, creux du sillon,
  ombre portée sur le cou), jamais dans la longueur ni le contour.

Contour bas (`jaw/contour.ts`) : ramus → coin de mâchoire arrondi (rayon selon l'angle) → corps de la mandibule → symphyse, en cubiques raccordées
en tangente (C1, contrôlé). `jaw.angle` 0 → 95° (anguleux), 1 → 140° (obtus). Symphyses : `round`, `square`, `pointed` (apex en V voulu), `cleft` (fossette rendue).
Le coin du menton reste sous la lèvre inférieure (`mouthFloorY`) : la bouche ne tombe jamais sur la partie étroite du menton.

| Paramètre | Effet |
|---|---|
| `jaw.taper` | Convexité du corps de la mandibule (longueur des poignées, tangentes conservées). |
| `jaw.neckTransition`, `jaw.submental` | Douceur et force de l'ombre portée du menton sur le cou (sous-moteur de contact) ; tension sous-mentonnière. |
| `jaw.mobility` | Part de l'ouverture de la bouche qui abaisse la mandibule (`drop = min(8 % H, 1,1 × openH × mobilité)`). 0 = rigide. |
| `jaw.tissue` | Déformation à l'ouverture : lèvre étirée (−30 % max), sillon aplati, plis naso-géniens creusés (+60 %), joues remontées (1,2 % H). |

## Limites connues

Voir `docs/TODO-FACE.md` (vue de profil réelle, mandibule volumique, os zygomatiques, pommette, philtrum, narines vues de dessous…).

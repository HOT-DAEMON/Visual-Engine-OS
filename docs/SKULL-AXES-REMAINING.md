# Reste à faire — crâne dérivé, profil branché (par composant)

## Angles de rotation intermédiaires (tâche 3 de la consigne) — NON FAITE
Voulue « seulement ensuite » : la dérivation et le branchement des moteurs sont maintenant en place, donc cette étape est débloquée mais n'a pas été commencée. À faire : rotation de la tête entre face (0°) et profil (90°) (30°, 45°, 60°) en réutilisant `derive.ts` (largeur → profondeur), la projection de l'œil (`profileEyeGeometry` : profondeur de lentille fonction de l'angle), les relations parent/enfants/frères sous rotation, et les contrôles croisés à chaque angle.

## Dérivation du crâne
- `BREADTH_SCALE`, la pente de l'indice et les relations front/pommettes/cou sont des CONVENTIONS monotones documentées, pas des régressions mesurées : à calibrer sur des mesures réelles si l'on vise l'anthropométrie.
- `length` borné à [−1, 1] : L/H reste dans 0,74–0,86 ; une plage plus large demande de changer `frame.ts` (et les références visuelles du crâne).
- Le front n'est pas relié à la hauteur de la ligne d'implantation de la face.

## Œil et sourcil de profil
- Pas d'orientation du regard ni de pupille décentrée ; iris vu par la tranche (ellipse) sans relief de cornée.
- Inclinaison de la fente : signe du canthus externe non validé sur tous les archétypes d'enveloppe (robots, formes anguleuses).
- Sourcil : tête coupée net au contour (pas de raccord sur l'arcade) ; pas de sourcils asymétriques ni de couches.
- Œil de robot / yeux multiples / yeux posés sur objets non projetés en profil.

## Cheveux de profil
- Projection PARAMÉTRIQUE de la silhouette uniquement : le moteur complet de la face (mèches simulées Verlet, tiers, occlusions, masses de tempes, 12 coiffures de référence) n'est PAS projeté.
- La queue de cheval de la face part parfois vers le haut (`kind: 'top'`) : le profil la fait toujours retomber ; le contrôle de longueur n'est donc appliqué qu'aux coiffures retombantes (bob, long).
- Bob/long : rideau simple (pas de mèches, pas d'ombres portées sur le cou, oreille recouverte seulement pour `long`).
- `buzz` visuellement proche de `short` (pas de peau visible à travers) ; frange `curtain` approximative ; asymétrie gauche/droite, raie, dégradés d'opacité absents.

## Pilosité de profil
- Polygones lissés mais sans mèches ni direction de poil ; `handlebar` et `mutton` approchés ; zones clairsemées (`patchy`) et transitions de densité non rendues.

## Vérification
- `eye-height-matches-face` lit la même fonction de mesure que le rendu côté face : la référence indépendante (`faceEyeHeightH`) doit être fournie par l'appelant.
- Pas encore de comparaison pixel face/profil (planches de régression visuelle permanentes pour ces nouveaux axes).

## Performance
- Rastérisation à froid ≈ 59 ms/tête (resvg) : non traitée ici. Piste : rasteriser uniquement les calques modifiés, mutualiser les filtres.
- Le rendu SVG du profil (26 ms) n'est pas mis en cache par graine.
- Limite resvg constatée : un filtre entièrement hors d'une zone recadrée fait planter le rastériseur (contournement : rasteriser en grand puis recadrer, cf. `scripts/artefacts-skull-axes.ts`).

# Rotation — cheveux : éléments liés et lisière (étape 5 des tranches C)

Code : `src/face/pose/hair-pose-lines.ts` (`posedHairline`, `posedBoundary`, `posedTies`, `poseLinked`), `densify.ts`, `hair-pose.ts` (`poseHair`).

## Fait
Tout élément lié aux cheveux est reprojeté avec le MÊME `skull.projectX` que les masses et les mèches : implantation (`hairline`), parcours de lisière (`boundary.loop`), calotte (`scalp`), zones rasées (`bare`, `shaved`), ombres portées sur la peau (`skinShadows`), bas de frange (`fringeBottom`), zone d'oreille (`sides.earZone`), liens (`ties`), arrêts du dégradé de coupe rasée.
- Les polylignes sont densifiées (`densifyOpen`) : la projection n'est pas affine, un segment long se déformerait en corde.
- `poseHair(geo, skull, yaw, W)` compose masses + mèches + éléments liés ; à 0° il renvoie le MÊME objet (rendu historique à l'octet près).
- **Invariant de lisière** : une lisière posée est une COURBE, pas le graphe d'une fonction (elle peut reculer en x en suivant un crâne qui s'élargit). Le bon invariant est « pas d'auto-croisement » (`pose.hairline-cross`), pas « monotone en x » (invariant abandonné : fausses alertes).

## Renforcement de la lisière (demande utilisateur)
La lisière est vérifiée à 0° par `checkHairBoundary` (finitude, dans le contour, sans croisement, au-dessus des sourcils, oreille contournée, nuque sous les oreilles, coque hors peau) et, posée, par `checkHairPose` : implantation sur la coque (`pose.hairline-on-skull`), sans croisement, sans saut de bord (`pose.edge-step`). Résultats sur le corpus : 0 erreur ; 70 avertissements `pose.hairline-smooth` (7 poses × 10 coiffures) et 10 `pose.edge-step` : marches verticales de la lisière héritées du tracé de face, non lissées.

## Reste à faire (par composant)
1. **Lissage de la lisière posée** : appliquer un lissage borné (Chaikin à rayon ≤ 0,01 H, ancres de racines fixes) avant rendu pour supprimer les 80 avertissements de style.
2. **Racines et dégradé de coupe rasée** : l'opacité du dégradé aux bords n'est pas recalculée avec n_z ; le « buzz » se lit comme une calotte.
3. **Raie et chauve** : le tracé de la raie est reprojeté mais sa largeur n'est pas raccourcie par la pente locale ; cas `bald` non rendu (aucune géométrie).
4. **Oreille couverte / dégagée** : `earZone` est posée, mais le statut `covered`/`clear` n'est pas recalculé selon la visibilité de l'oreille posée (tranche 7).
5. **Ombres portées** (`skinShadows`) : suivent la coque mais leur flou n'est pas raccourci.

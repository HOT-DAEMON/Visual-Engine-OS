# Garde du visage : côté de la racine

Preuves : `artefacts/hair-dome/details-*.png` (bob 9568, case 1). Contrôle : `hair-no-face-sweep` (`HAIR-DOME-VERIFY.md`).

## Constat
Bob, graine 9568 : `hair-covers-face-skin` 0,035 pour 0,02 (erreur, préexistante, `HAIR-ROUND-REMAINING.md` 9 d'avant). Deux grands polygones de frange, dont la racine est près de l'axe, étaient projetés par la garde du côté du SOMMET le plus proche de l'axe : une moitié de polygone sautait de l'autre côté du visage et dessinait une bande horizontale d'environ 0,88 W à hauteur de la bouche.

## Ce qui a changé
1. `guard.ts` : `Guard.project(v, mode?, side?)` et `Guard.fit(poly, mode?, side?)`. Avec `side`, un sommet dans la zone interdite est repoussé latéralement vers `side · inner` au lieu de `v.x < 0 ? −1 : 1`. La récursion de subdivision des arêtes transmet `side`.
2. `flow.ts` (`lockFrom`) : le côté de la mèche est celui du point de la ligne centrale le PLUS ÉLOIGNÉ de l'axe (|x| max), pris seulement s'il dépasse 0,05 W ; sinon pas de côté (comportement inchangé). Le côté de la racine seul ne suffit pas (racine proche de l'axe : essayé, sans effet).

## Résultats
- Cellules de peau couvertes sur bob 9568 : 0 sur 572 (avant : 0,035 de la surface).
- `hair-no-face-sweep` : 0 arête de balayage sur tout le corpus de 40 × 10 coiffures (avant, bob 9568 : une arête de 0,88 W).
- Tests : `tests/hair-dome.test.ts`.

## Limites
Le côté est déduit de la ligne centrale : une mèche qui croise vraiment l'axe (mèche en S qui passe d'un côté à l'autre) est attribuée au côté de son point le plus éloigné. Pas rencontré sur le corpus ; non testé hors des 40 graines par coiffure.

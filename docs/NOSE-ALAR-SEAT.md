# Nez 3D : ailes posées sur la joue et contrainte de contour (16 nov. 2026)

Suite de `NOSE-PLATE06-GLOBAL.md` (« à 30°, l'aile lointaine du plat-trapèze déborde du contour de la joue »). Restes : `NOSE-REFS-REMAINING.md`.

## 1. Mesure (le défaut n'était pas chiffré)
Deux mesures indépendantes, qui concordent (≤ 0,004 U sur 20 comparaisons ; test : `tests/nose-alar-seat.test.ts`).
- **Par rendus** — `scripts/nose-refs/alar-overflow.ts` : même tête avec le nez et avec le nez réduit à un fil (bosse de demi-largeur 0,0005 U, ailes de rayon ≈ 0) ; débordement = de combien le nez repousse l'étendue horizontale des pixels, rangée par rangée, dans la bande du nez. Lacet > 0 : visage tourné vers la GAUCHE de l'image, côté lointain = gauche.
- **Par calcul** — `src/head-turntable/nose-contour.ts` (`alaOverflow`) : fonction d'appui de l'ellipsoïde d'aile contre celle de la section du crâne, projection `x' = x·cosθ − z·sinθ`. Pure, sans rendu : c'est elle qu'utilise la règle.

Deux erreurs de mon propre travail ont été trouvées en route : un premier masque comptait le recouvrement `bump` sur `head` (valeurs absurdes 0,27–0,37 U) et le côté lointain avait le mauvais signe. Aucune mesure n'a été retenue avant d'être vérifiée sur un cas connu.

## 2. Cause (isolée par ablation)
Rendu « sans ailes » : 0,000 U ; rendu « sans bosse centrale » : inchangé. **Tout le débordement vient des ellipsoïdes d'ailes** (`alaOf`, `src/head-turntable/parts.ts`). Ils étaient centrés à `zf + 0,022·ka`, où `zf` est l'avant de la face **sur l'axe** ; or la joue recule vers les côtés (0,006 U à `alaX` de la planche, 0,037 U à `alaX` 0,136) : une aile large flottait devant la surface. La bosse centrale utilise déjà `surfaceZ` à l'abscisse du point.

## 3. Correctif
1. `alaSeated` : centre posé sur `surfaceZ(section, x)` à l'abscisse de l'aile.
2. `alaPull` : **contrainte** à la manière de `face/nose/constraints.ts` (valeur ramenée à la plus proche admissible, jamais de réglage global). Si l'aile déborde à 30° (`ALA_CONTOUR_YAW`), son centre est rapproché de l'axe (point fixe, 4 itérations : rapprocher l'aile relève la joue sous elle), au plus de (1 − `ALA_PULL_MAX` = 0,4) × `alaX`.
3. `alaOf` = 1 + 2 : source unique du maillage et de l'éclairage du nez (`nose-light.ts`).

Le nez de la planche de référence **n'est pas modifié** (rappel exactement 0, test).

## 4. Résultats (40 graines 500 + 37·k × 4 types de nez, `artefacts/nez-ailes-contour/stats.json`, reproduire : `npx tsx scripts/nose-refs/alar-contour-stats.ts`)
Débordement de l'aile lointaine en U, avant (formule d'origine reconstruite) → après.

| Nez | 30° max | 30° part > 0,01 | 45° max |
|---|---|---|---|
| libre | 0,0108 → 0 | 2,5 % → 0 | 0,058 → 0,045 |
| pyramide | 0,048 → 0 | 15 % → 0 | 0,091 → 0,055 |
| cloche-ailes | 0,046 → 0 | 15 % → 0 | 0,090 → 0,054 |
| plat-trapèze | 0,083 → **0,017** | 70 % → 5 % | 0,126 → 0,068 |

Rappel appliqué : libre 2,5 % des graines (max 0,0055 U) ; pyramide 17,5 % ; cloche-ailes 15 % ; plat-trapèze **72,5 %** (max 0,077 U), dont **4 graines sur 40 saturent** la borne (0,017 U restant).

## 5. Preuves visuelles
- `artefacts/nez-ailes-contour/01-avant-apres-30deg.png` : têtes 3D complètes à 30°, rangée du haut = avant (commit 38f254d), du bas = après ; colonnes : plat-trapèze graines 77, 11, 1203, pyramide graine 77. Mesurés par rendus à 420 px : avant 0,0625 / 0,0375 / 0,0208 / 0,0208 U, après 0 / 0 / 0 / 0. (`resvg` n'a pas de police : aucun libellé dans l'image.)
- `02-zoom-nez-avant-apres.png` : nez ×4 des graines 77 (gauche) et 11 (droite), avant en haut, après en bas. Avant : une boule d'aile dépasse du contour de la joue ; après : contour continu.
- Générés par `scripts/artefacts-nose-alar-seat.ts` (lancé sur l'ancien et le nouveau code), `-compose.ts`, `-zoom.ts`.

## 6. Vérification du rendu (couche géométrique de `head-turntable`, `verify-engines.ts`)
- `eng.nose.alar-contour` (géométrie, bloquante, 0 – 0,02 U) : débordement de l'aile finale à 30°. Garde de la contrainte : sans elle jusqu'à 0,083 (test : l'ancien comportement est détecté, 0,047 U sur la graine 77). La borne 0,02 est posée juste au-dessus du résidu de saturation mesuré (0,017) : elle ne détecte donc pas une saturation légère.
- `eng.nose.alar-pull` (informative, 0 – 0,25 de `alaX`) : signale un nez trop large pour le modèle 3D (test : nez à `alaX` ×1,8 sature et déclenche les deux règles).

## 7. Non fait, constats ouverts
> **Mise à jour (2e passe, 16 nov.)** : le premier point (nez 3D 1,5 × plus large) est TRANCHÉ et corrigé, et le plat-trapèze n'est plus aux limites : voir `NOSE-WIDTH-3D.md`. Les chiffres de §4 décrivent l'état avant ce correctif.
- **Le nez 3D de face est 1,5 × plus large que la silhouette du moteur 2D** (demi-largeur 0,079 contre 0,051 pour la planche ; 0,204 contre 0,134 pour le plat-trapèze graine 77). Cause : l'ellipsoïde est centré SUR la crête `alaX`, que `silhouette` et la règle `nose.width` traitent comme la demi-largeur. Ce rapport (1,50–1,54 sur 5 nez) **n'est pas corrigé** : la planche a peut-être été calée à la main sur ce modèle ; il faut le trancher contre la planche avant de toucher à tous les rendus 3D.
- Le plat-trapèze reste aux limites du modèle 3D (72,5 % rappelés, 4 saturés).
- **45° non traité** : même un nez libre dépasse le contour (45 % des graines > 0,01 U), ce qui est le comportement normal d'un nez en trois-quarts ; aucune borne n'est posée.
- Contrainte calibrée à un seul lacet (30°), côté lointain seulement ; ni tangage ni roulis.
- Profondeur des ailes : non mise à l'échelle différemment de la largeur (essayée : exposant 0 sur la profondeur donne 18 % de débordement résiduel au lieu de 55 %, mais change le relief de tous les nez ; abandonnée).

# Tête en rotation — modèle de coupe du crâne (vue de dessus)

Suite de `HEAD-TURNTABLE.md`, `HEAD-TURNTABLE-VARIETY.md` et `HEAD-TURNTABLE-JAW.md`. Code : `src/head-turntable/engines/skull-model.ts` (modèle), `sections.ts` / `types.ts` (champs `pb`, `qb`),
`verify-skull.ts` (contrôles), `tests/head-turntable-skull.test.ts` (10 tests). Légende : ✅ fait et vérifié · ⚠️ fait avec une limite · ⬜ non fait.

## 1. Le défaut

Au-dessus de la mâchoire, chaque coupe horizontale de la tête était une ELLIPSE centrée sur `(zf + zb) / 2`. Deux crânes de longueur et de largeur différentes avaient donc la même vue de dessus :
même point large au milieu, même occiput en demi-ellipse, même plan facial. Le profil (90°) et la face (0°) varient avec le moteur de crâne et le moteur de visage, mais les vues intermédiaires
(45° – 135°), où l'on lit la forme du crâne, étaient les mêmes pour toutes les têtes : c'est l'impression « même chose dans tous les cas ».

## 2. Ce qui est ajouté

| Élément | Rôle |
|---|---|
| `Row.pb`, `Row.qb` (optionnels) | exposants de la moitié ARRIÈRE (`z = zw − (zw − zb)·|cos φ|^(2/pb)`, `x = a·|sin φ|^(2/qb)`) : > 2 occiput aplati, < 2 occiput pointu. Absents = demi-ellipse : rien ne change pour la planche |
| `skullFields(e, y, a, zf, zb)` | champs `zw`, `pf`, `qf`, `pb`, `qb` d'une rangée y, dérivés des axes du crâne (`vaultPeak`, `occiput`, `frontalBulge`, `zygoma`) et de l'indice local `ci = 2a / (zf − zb)` |
| `skullWeight(y)` | 0 au vertex (calotte elliptique), 1 sur la voûte et le visage, 0 avant la mâchoire (`JAW_SHAPE.y0` = 0,76) : aucune marche avec le modèle de mâchoire |
| `hasSkullModel(e)` | vrai pour les têtes issues d'un visage (`mandLandmarks`) ; la PLANCHE garde ses ellipses (identique au pixel, test `la planche garde ses ellipses`) |

## 3. Conventions (bornées, non mesurées sur une personne)

- **Occiput** : `pb = 2 + 0,5·aplat − 0,5·(occiput − 0,5)`, `qb = 2 + 0,35·aplat` ; `aplat` = (ci − 1,1) / 0,12 borné à ±1 ; `pb` borné à [1,5 ; 2,8], `qb` à [1,8 ; 2,5]. Une tête large et courte a l'occiput plat, un chignon l'affine.
- **Point large** : à 0,5 de la profondeur depuis l'arrière, avancé par `vaultPeak`, reculé par `occiput`, borné [0,40 ; 0,60] ; sur le plan du visage il se ramène vers le porion (la largeur maximale est à l'oreille).
- **Avant** : voûte et front = `frontalBulge` (front plein → coupe plus carrée) ; plan du visage = `zygoma` (pommettes saillantes → plan facial plat aux angles). `pf`, `qf` bornés à [1,6 ; 2,7].
- Ces constantes (`SKULL_SHAPE`) sont des CONVENTIONS de proportion, pas des moyennes anthropométriques : voir §6.

## 4. Ce qui ne bouge pas (prouvé par `head.geo.skull.anchors`, écart ≤ 1e-6 U)

x = 0 donne toujours `zf` et `zb` : le profil à 90° reste celui du moteur de crâne. z = `zw` donne toujours x = `a` : la silhouette de face à 0° reste le contour du moteur de visage.
Seules changent les vues intermédiaires.

## 5. Mesure de l'effet (6 graines, recouvrement XOR / union des silhouettes, moyenne sur les 15 paires, tête seule)

Voir `artefacts/head-turntable-v3/metrics.json` : la diversité des silhouettes entre graines augmente de +7 % à 45° et à 135° ; elle est inchangée à 0° (attendu : la face est celle du moteur de visage) et
à peine modifiée à 90° (+2 %) et 180° (+2 %). **Le gain visible est MODESTE.** Il ne remplace pas une vraie variété de crânes : la longueur de tête reste bornée par la dérivation partagée
(`skull/derive.ts` : `CI_FREE` = 0,025, `LENGTH_SPAN` = 0,06 ; longueurs obtenues 0,757 – 0,85 H sur 12 graines), que ce travail n'a pas touchée (contrat testé par `tests/skull-axes.test.ts`, utilisé par le profil).

## 6. Vérification (couches géométrie, anatomie, style)

| Contrôle | Couche | Dur / info | Ce qu'il détecte |
|---|---|---|---|
| `head.geo.skull.convex` | géométrie | dur | sommets non convexes d'une coupe de la voûte (0 attendu) |
| `head.geo.skull.exp.min` / `.max` | géométrie | dur | exposants hors [1,45 ; 2,85] (tolérance 0,05 : dépassement de l'interpolation de Hermite) |
| `head.geo.skull.anchors` | géométrie | dur | la forme a déplacé le profil ou la largeur |
| `head.geo.skull.{45,135}.concavity` | géométrie | dur | creux de la voûte dans le rendu (≤ 0,02 U) |
| `head.anat.skull.widest` / `.max` | anatomie | dur | point large hors [0,38 ; 0,62] de la profondeur depuis l'arrière |
| `head.style.skull.{45,135,180}.inflections` | style | info | ondulation du contour de la voûte |

Limites honnêtes : les bornes de `widest` et des exposants sont des conventions écrites après avoir vu les valeurs de 12 graines ; `convex` et `anchors` sont des invariants de construction (pas de
seuil choisi). Le style est jugé par un proxy (lisibilité du contour), pas par le goût. Aucune graine n'est comparée à un crâne réel mesuré.

## 7. Reste à faire (crâne)

1. ⬜ Étendre la longueur de tête (dolicho- / brachycéphale marqués) : exige de modifier `skull/derive.ts` (`CI_FREE`, `LENGTH_SPAN`) ET `skull/frame.ts`, donc le moteur de profil et ses tests ; non fait ici pour ne pas casser le contrat partagé.
2. ⬜ Bosses pariétales et méplat temporal : la coupe est une superellipse, pas un crâne ; pas de crête sagittale, pas de plan occipital marqué.
3. ⬜ Variation gauche / droite (asymétrie crânienne) : toutes les coupes sont symétriques.
4. ⬜ Calibrer `SKULL_SHAPE` sur des vues de dessus mesurées (la planche n'en contient pas ; `rotation_head_1.jpg` donne face et profil seulement).
5. ⚠️ Le crâne de la PLANCHE garde ses ellipses : ses vues à 45° – 135° ne profitent pas du modèle (elles sont calées sur les silhouettes mesurées, voir `HEAD-TURNTABLE-ENGINES-FIT.md`).

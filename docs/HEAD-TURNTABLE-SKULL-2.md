# Tête en rotation — forme crânienne (dolicho- / brachycéphale)

Suite de `HEAD-TURNTABLE-SKULL.md` (§7, point 1). Code : `src/head-turntable/engines/skull-model.ts` (`CRANIAL`, `cranialLength`, `cranialBackShift`), `engines/rows.ts`, `engines/from-face.ts`,
`verify-head.ts`, `verify-skull.ts`. Tests : `tests/head-turntable-cranial.test.ts` (7), `head-turntable-jaw.test.ts` et `head-turntable-skull.test.ts` (adaptés). Preuves : `artefacts/head-turntable-v4/`.
Légende : ✅ fait et vérifié · ⚠️ fait avec une limite · ⬜ non fait.

## 1. Le grief et la cause

« Le moteur de crâne ne génère pas réellement des formes de crâne visuellement différentes, en accord avec les visages du moteur de visage. »
Le moteur de crâne DÉRIVE la longueur de tête du visage (`skull/derive.ts` : largeur d'hôte → indice céphalique → `Derivation.lengthH`), mais l'axe `length` la borne à ±6 % (0,74 – 0,86 H).
Sur 12 graines, la longueur 3D ne variait que de 0,757 à 0,850 : l'écart-type était faible, les têtes tournaient sur un volume presque commun (profil à 90° quasi identique).

## 2. Ce qui est fait (✅)

La longueur utilisée en 3D n'est plus la longueur bornée mais `L = LENGTH_REF + gain·(lengthH − LENGTH_REF)`, bornée à `[0,72 ; 0,92]` (`CRANIAL.gain` = 2, `lMin`, `lMax`).
`LENGTH_REF` (0,80) vient de `skull/derive.ts` : pas de seconde constante. `lengthH` est la valeur NON bornée de la dérivation, transmise par `fitFromProfile` (champ `cranialL`).

| Décision | Raison |
|---|---|
| tout l'écart est porté par l'ARRIÈRE du crâne (`cranialBackShift`, pondéré par `skullWeight(y)`) | un crâne long ou court l'est surtout à l'occiput ; le front, le plan du visage, le porion (oreille) et la largeur de face ne bougent pas |
| poids `skullWeight` : 0 au vertex, 1 sur la voûte, 0 avant la mâchoire | aucune marche avec la calotte ni avec le modèle de mâchoire |
| la planche n'a pas de `cranialL` : décalage nul | la planche reste identique (test « la planche ne bouge pas ») |
| l'aplatissement de l'occiput (`pb`, `qb`) lit la profondeur AVANT amplification | sinon une tête large ET allongée perd son occiput plat (étendue de `pb` tombée de > 0,4 à 0,28 pendant la mise au point) |

Résultat mesuré (graines 1 à 6, `artefacts/head-turntable-v4/diversite.json`) : longueurs 3D 0,729 – 0,896 H (0,757 – 0,847 avant) ; diversité des silhouettes (XOR / union) **+26 % à 90°**,
+3 % à 45°, +6 % à 135°, 0 % à 0° et à 180° (la largeur n'est pas touchée : attendu). Sur 12 graines l'étendue de la longueur 3D dépasse 0,14 U (0,093 avant).

## 3. Vérification (trois couches)

| Contrôle | Couche | Dur / info | Ce qu'il détecte |
|---|---|---|---|
| `head.anat.skull.length` (modifié) | anatomie | dur | la profondeur 3D s'écarte de la longueur de forme `cranialLength(lengthH)` de plus de 0,02 U |
| `head.anat.skull.cephalic3d` (nouveau) | anatomie | info | indice céphalique 3D (largeur du contour / longueur 3D) hors de 0,70 – 0,98 |
| `head.geo.skull.*` (inchangés) | géométrie | dur | convexité, exposants, ancrages avant / arrière / largeur : toujours verts après décalage |

Tests ajoutés : `cranialLength` croissante et bornée ; décalage nul pour la planche ; `a`, `zf` et la mâchoire identiques à la même tête sans amplification ; le plus long s'allonge, le plus court se raccourcit ;
étendue de longueur ≥ 0,14 U et profondeur = longueur de forme à ≤ 0,02 U ; contrôle d'indice céphalique présent et fini. Tests adaptés : couplage crâne ↔ visage (cible = `cranialLength`,
étendue 0,08 → 0,12 ; le cas « crâne figé » retire aussi `cranialL`) et filtre des échecs bloquants du modèle de crâne (les contrôles `info` en sont exclus).

**Je change un invariant existant** : « profondeur 3D = `lengthH` à 0,02 U » devient « = `cranialLength(lengthH)` à 0,02 U ». Ce n'est pas un contournement : l'amplification est voulue, et l'invariant garde son sens
(la profondeur suit le moteur de crâne, de façon monotone). Mais la valeur absolue n'est plus celle du moteur.

## 4. Constat nouveau, non corrigé (⚠️)

L'indice céphalique 3D des têtes issues d'un visage est de **1,05 à 1,13** (mesuré sur 12 graines : la largeur du contour de face dépasse la longueur), contre 0,975 pour la planche mesurée et 0,70 – 0,90 chez l'humain.
La tête 3D est donc plus large que longue, quelle que soit la graine : l'amplification ne le corrige pas (elle fait varier la longueur, pas son rapport à la largeur). Cause probable : le contour 2D du moteur
de visage inclut joues et cheveux, alors que la dérivation suppose une largeur de crâne de 0,8 × W. Le contrôle `head.anat.skull.cephalic3d` le rend visible (information, pas bloquant : je n'ai pas
d'ajustement validé à proposer). Pistes : borner la largeur du crâne (pas celle de la joue) séparément de `a`, ou calibrer la profondeur moyenne sur le rapport mesuré de la planche.

## 5. Limites et reste à faire (crâne)

1. ⚠️ `CRANIAL.gain`, `lMin`, `lMax` sont des CONVENTIONS de proportion, pas des moyennes anthropométriques mesurées ; aucune graine n'est comparée à un crâne réel.
2. ⚠️ Le gain visible est net de profil (90°) mais modeste en 3/4 (+3 % à 45°) : la vue de dessus reste une superellipse.
3. ⬜ Bosses pariétales, méplat temporal, crête sagittale, plan occipital marqué : non faits (la largeur `a` est ancrée sur le contour de face, la toucher casse le contrôle d'ancrage à 0°).
4. ⬜ Asymétrie crânienne gauche / droite : toutes les coupes sont symétriques.
5. ⬜ Hauteur de voûte (`vaultHeight`) : visible au profil seulement par le profil du moteur ; pas d'amplification équivalente.
6. ⬜ Indice céphalique 3D trop élevé (§4).
7. ⬜ `skull/derive.ts` n'est PAS modifié (contrat partagé par le moteur de profil et ses tests) ; l'amplification vit dans `head-turntable`. Si le moteur de profil doit lui aussi varier, c'est là qu'il faudra étendre `LENGTH_SPAN` / `CI_FREE`.

## 6. Reproduire

    npx tsx scripts/head-turntable/artefacts-gallery.ts <avant> 1,2,3,4,5,6 420     # dans l'arbre d'origine (commit 841008c)
    npx tsx scripts/head-turntable/artefacts-gallery.ts <apres> 1,2,3,4,5,6 420     # dans l'arbre modifié
    python3 scripts/head-turntable/compose-cranial.py <avant> <apres> artefacts/head-turntable-v4
    npx vitest run tests/head-turntable-cranial.test.ts tests/head-turntable-skull.test.ts tests/head-turntable-jaw.test.ts

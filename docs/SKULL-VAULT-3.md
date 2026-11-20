# Voûte crânienne — passe 3

Suite de `SKULL-VAULT.md` et `SKULL-VAULT-2.md`. Ce qui reste à faire est dans `SKULL-VAULT-REMAINING.md`, la validation chiffrée dans `SKULL-VAULT-VALIDATION-3.md`, les preuves visuelles dans `artefacts/skull-vault-3/`.
Principe inchangé : **un seul moteur** (`src/skull`, `engines/vault-relief.ts`, `engines/skull-relief.ts`), enrichi ; aucun nouveau moteur, aucun modèle par référence. Une valeur exposée qui ne change aucun pixel n'est pas une mesure.

## 1. Quatre mesures ajoutées (toutes à 0 par défaut, en fin de `VaultParams`)

Ajoutées **après** `asymParietalHeight` : aucun tirage aléatoire existant ne se décale (test `skull-vault-3.test.ts`).

| Mesure | Plage | Effet | Où | Lue par |
|---|---|---|---|---|
| `asymParietalAzimuth` | [−1, 1] | l'éminence pariétale +x recule (+) ou avance (−) de ±14°, l'autre à l'opposé | `skull-relief.ts` (`parietalAzimuthOf`) | relief 3D, ancre de visibilité (`anchorOf`) |
| `asymFrontalEminence` | [−1, 1] | bosse +x plus marquée (+) ou plus plate (−) : amplitude × (1 ± 0,6 v) | `vault-relief.ts` | relief 3D |
| `asymMastoidDirection` | [−1, 1] | l'axe du processus +x tourné vers l'avant (+) ou l'arrière (−) : ± 0,8 de `mastoidDirection` | `vault-relief.ts` | relief 3D |
| `nuchalGroove` | [−1, 1] | sillon sous la ligne nuchale : −1 plan comblé (bourrelet), +1 sillon marqué (0,022 U au plus) | `vault-relief.ts`, `vault-shapes.ts` (`grooveShape`) | relief 3D **et** profil 2D (`skull/vault.ts`, `grooveX`) |

- Une asymétrie ne se lit que sur une structure qui existe (`frontalEminence` ≠ 0, `parietalBulge` > −1, `mastoid` ≠ 0) : la preuve utilise ces bases (`SHAPE_BASE` de `vault-proof.ts`).
- `parietalAzimuth` + asymétrie d'azimut sont **bornés ensemble** dans [−1, 1] : relevé par les tirages aléatoires (sinon l'éminence sortait de sa zone anatomique, contrôle `vault.anat.parietal.back`).
- Le sillon est **compensé du poids du crâne** (`min(3, 1/w)`, effet final ≤ 1) : sans cela le poids qui s'éteint vers la nuque remontait le creux au-dessus de la ligne nuchale.
- Registre : `asymParietalAzimuth` → `parietal-bone` ; `asymFrontalEminence` → `frontal-eminence` ; `asymMastoidDirection` → `mastoid-process` ; `nuchalGroove` → `nuchal-line`.
- Corrélation ajoutée : `occipitalBun → nuchalGroove` (+0,4), posée a priori comme les autres (non calibrée, voir `SKULL-VAULT-REMAINING.md`).

## 2. Défauts trouvés (et corrigés) par la passe 3

1. **Queue de la mastoïde conique** : le cône `exp(−½ r^1,1)` laissait ≈ 2 mm de relief (0,0094 U) à 60° du processus, c'est-à-dire sur la tempe. La queue est maintenant fondue entre 2 σ et 4 σ **pour les pentes coniques seulement** (`MASTOID_SHAPE.tail0/tail1`) : nominal et plateau (p ≥ 1) sont **identiques à l'octet** (test). Trouvé par l'audit de consommation (§3), pas par les tests existants.
2. **`mastoidSlope` n'est plus prouvé sur le nominal** : sa visibilité venait en partie de cette queue. Il est prouvé sur un grand processus (`mastoidSize: 1`) ; les seuils de perception n'ont pas bougé.
3. **Bande de la mastoïde sous-déclarée** : le registre annonçait y 0,45–0,7, azimut 100–135° ; la mesure donne y 0,40–0,75, azimut 60–178° (taille ×1,5, direction ±35° comprises). Le registre est corrigé sur la mesure.
4. **Garde-fous du sillon** : sous un cuir chevelu mince et un os apparent la transmission atteint ×1,6 ; deux contraintes strictes plafonnent le sillon (`groove-tissue` : effet transmis ≤ celui d'une transmission 1 ; `groove-line` : ×(1 − 0,8 × `nuchalLine`), car un sillon profond sous une ligne forte fait une marche : 0,5 laissait un saut de 0,0144 U avec tous les extrêmes anciens).

## 3. Audit de consommation (`vault-audit.ts`)

Pour chaque cas de preuve (52 : tous les paramètres de voûte et les paramètres existants prouvés avec leur base), on compare la tête minimale et la tête maximale (mêmes graine, caméra, lumière) :
- **relief** : maillage hauteur (0,01 U) × azimut (2°), seuil 0,0005 U ≈ 0,12 mm ;
- **coupes** : largeur, profondeur avant / arrière, exposants (seuil 0,0005 U ; exposants 0,01) ;
- la zone MESURÉE est comparée à la bande DÉCLARÉE au registre (marge 0,07 U, 14°) : `fuite` = part de l'écart hors bande.

Résultat (`artefacts/skull-vault-3/audit-consommation.png`, `verification/audit-consommation.json`) : **52 / 52 consommés**, fuite maximale **3,3 %** (`occipitalBun`), test < 6 %. Une première version de l'audit ignorait les exposants de coupe et déclarait à tort `frontalBreadth`, `temporalFlat`, `planeTransition` non consommés : corrigé avant tout autre usage.
Limite : l'audit lit la géométrie ; la preuve en pixels reste `vault-proof.ts`. `zygoma` et `maxilla` (moteur de joue et de mâchoire) n'ont aucune structure au registre.

## 4. Table des plafonds de relief selon les tissus (`vault-ceiling.ts`)

Mesurée sur le relief réel (même fonction que le maillage), bornes de la vérification : amplitude ≤ 0,06 U, saut ≤ 0,014 U.
- **Chaque relief seul** (14 reliefs) tient dans les 9 cellules (`scalp` 0,05 / 0,5 / 0,95 × `boneShow` −1 / 0 / 1) : plafond 100 %.
- **Tous les reliefs ensemble** : 100 % partout sauf cuir chevelu mince + os nominal ou apparent (**90 %**) et cuir chevelu moyen + os apparent (**94 %**) pour « tous à +1 » ; 97 % pour « tous à −1 ». Image : `artefacts/skull-vault-3/plafonds-tissus.png`.
- C'est la limite physique réelle : chaque relief seul tient, leur superposition sous une peau fine non. Avant la passe 3 le cas était déjà au bord (0,0139 U) ; le sillon l'a dégradé, les contraintes du §2.4 l'ont ramené à 90 %.

## 5. Accord contour 2D ↔ silhouette 3D (`verify-vault-3.ts`)

Le contour postérieur du profil 2D (`src/skull`) et la silhouette 3D de profil sont comparés de t = 0,1 à 0,55 U depuis le sommet, à un décalage constant près (repère t = 0,3). Mesuré : **≤ 0,012 U sur 12 têtes nominales** (borne stricte testée 0,018). Certains extrêmes **divergent** : `occipitalSlope` 0,046, `occipitalBun` 0,033, `vaultHeight` = 0 : 0,076 U. Ils sont rapportés (contrôle d'information, borne 0,1), pas corrigés : les deux moteurs ne lisent pas ces mesures à l'identique (`artefacts/skull-vault-3/accord-2d-3d.png`).

## 6. Essai abandonné : la carène sagittale

Resserrement radial des flancs pariétaux (−0,035 U, bande y 0,14 ± 0,085, ∝ sin² de l'azimut) : à +1 il ne donne que des épaulements sur la silhouette de face et un dessus à peine modifié ; aucun faîte. Le relief étant radial et horizontal, il n'a pas de prise sur le sommet. Retiré du code (aucun paramètre `keel`, testé). Il faudrait un déplacement vertical.

## 7. Vérification de rendu (voir `SKULL-VAULT-VALIDATION-3.md`)

Géométrie : symétrie du relief pariétal, accord 2D ↔ 3D. Anatomie : le sillon est sous la ligne nuchale (ordre mesuré, même poids de crâne), la mastoïde ne déborde pas sur le front et l'avant de la tempe (< 0,008 U à moins de 40°). Style : le sillon passe par les contrôles de contour et de courbure existants.

## 8. Fichiers

Code : `skull/vault-params.ts`, `vault-shapes.ts`, `vault-mastoid.ts`, `vault-registry*.ts`, `vault-constraints.ts`, `vault-correlations.ts`, `skull/vault.ts` ; `engines/vault-relief.ts`, `engines/skull-relief.ts` ; `head-turntable/vault-visibility.ts`, `vault-proof.ts`, `verify-vault.ts`, `verify-vault-2.ts` (symétrie étendue), nouveaux `verify-vault-3.ts`, `vault-audit.ts`, `vault-ceiling.ts`.
Tests : `tests/skull-vault-3.test.ts`. Artefacts : `scripts/head-turntable/artefacts-vault-3.ts` puis `compose-vault-3.py` (dossier `artefacts/skull-vault-3/`). `artefacts/skull-vault/verification/proofs.json` et `.csv` contiennent désormais les 4 mesures et `mastoidSlope` mis à jour (52 preuves) ; l'image de synthèse de la passe 1 n'a pas été refaite.

# Membre supérieur — ce qui reste après l'itération 04 (par composant)

> **Mise à jour itération 05** : « le tronc s'arrête à la crête, sans jambes » est levé, l'épaule est raccordée à la pente du trapèze et le rendu ne laisse plus transparaître le fond : voir `BODY-JUNCTIONS-05.md` et `BODY-JUNCTIONS-05-REMAINING.md`.

**Bilan honnête** : le résultat n'est pas « parfait sur tous les axes ». Chiffres = écarts mesurés ; ce qui n'a pas été mesuré est dit tel quel. Les points des itérations précédentes non repris ici restent ouverts (`BODY-UPPER-LIMB-03-REMAINING.md`, `-02-REMAINING.md`).

> **Mise à jour itération 06 (éclairage)** : « aucune mesure de couleur ou d'ombrage par pixel » est partiellement levé : le rendu par pixel utilise désormais un modèle de lumière unique avec ombres portées entre volumes ; voir `LIGHT-VISIBLE-06.md`. Le haut du dos reste à reprendre.

## Rendu du haut du dos et de l'omoplate
- **Le rendu visuel n'est pas convaincant.** Comparer `artefacts/upper-limb-04/04-dos-omoplate-avant-apres.png` : après, le haut du dos est plus chargé et plus désordonné qu'avant. Le moteur ne sait dessiner que des volumes à sections elliptiques : infra-épineux, grand rond et épine se lisent comme des bâtonnets posés sur la peau, pas comme une masse continue avec un relief d'omoplate. Les écorchés de référence ne sont pas atteints.
- **Piste non faite** : un champ de relief (hauteur) appliqué à la surface du tronc, avec ombrage par normales, pour obtenir bord médial, épine, fosse infra-épineuse et angle inférieur en continu ; l'enveloppe actuelle est une loft d'ellipses et ne peut pas le porter.
- La lame est cachée par défaut (`hidden`) ; elle n'a donc pas d'apparence validée visuellement (`showHidden` la montre comme une plaque lisse).
- Trapèze moyen/inférieur, grand dorsal, érecteurs, fessiers : non repris sur les nouvelles cotes (ils gardent leurs angles ψ de l'itération précédente).
- Pas de scapula ailée / mobile : la lame ne suit pas la pose du bras (abduction, élévation).

## Mesures
- **Profil** : une seule référence (ref-04, un homme). Dans la zone mesurée, écarts restants par bande : bande cou 0,06 : dos −0,09 h ; bande 0,94 (navel → crête) : dos +0,13 h, avant −0,11 h. Les zones tête et jambes ne sont pas comparées (le moteur n'a pas de jambes dans ce rendu).
- **Bras** : l'écart bleu restant dans l'overlay (bras du moteur derrière le tronc) vient de la pose des bras, pas du tronc ; non traité.
- **Vue de dos** : seule la largeur d'épaules (0,5 h sous le cou) est comparable (+2 %). Aux lignes 1,0–2,5 h le moteur est de 11–17 % plus large : ce sont les bras (pose, balancement) et non le tronc ; non isolé faute de segmentation tronc/bras dans ref-01. Ligne 3,0 h : bras et mains seulement (40 %), sans valeur.
- **ref-01 est un mannequin stylisé** (bras détachés, fessiers très marqués) et féminin ; pas de comparaison de forme du dos (IoU) faite avec le moteur : proportions trop différentes pour qu'un IoU soit interprétable. La structure visible du dos de ref-01 (trapèze inférieur en pointe, masses sur l'omoplate) n'a pas été mesurée en pixels.
- `ref-01` de face et de profil : masques extraits, non exploités. `ref-03`, `ref-05-mains` : toujours aucune mesure.
- Convention : hauteur de tête de ref-01 = 100 px (les trois vues donnent 100 / 94 / 106 selon la ligne de cou choisie).
- Aucune mesure de couleur ou d'ombrage par pixel.

## Colonne et tronc
- La verticalité est mesurée sur l'axe osseux et la ligne avant ; le dos de ref-04 est masqué par le bras, donc **sa pente de dos (17° mesurée) n'a pas servi de cible**.
- `pelvisShift` (0,3) et `FILL` (0,35) sont calés sur une seule silhouette ; l'IoU est plat autour de ces valeurs.
- Abdomen sans modèle de muscle de flanc ; le tronc s'arrête toujours à la crête (≈ 1,93 h sous le cou), sans jambes.
- Féminin : ligne avant à 5,1° (buste) ; enfant : 3,3° ; non comparés à une référence.

## Vérification
- `verifyBack` contrôle la structure (positions relatives, hauteur en vertèbres, verticalité), pas l'apparence : un rendu laid mais bien placé passe. Aucun contrôle de fidélité de ton ou de style à la référence.
- La vérification de profil reste sur une référence ; rien pour le trois-quarts ; la vue de dos n'est contrôlée que par la largeur d'épaules.

## Mains, clavicule, coude
Inchangés (voir REMAINING 02 et 03). Comparaison à `ref-05-mains` toujours non faite.

## Prochaine étape la plus rentable
Champ de relief sur la peau du tronc pour le haut du dos (voir plus haut), puis segmentation tronc/bras de `ref-01` pour mesurer le dos hors bras ; ensuite les mains contre `ref-05-mains`.

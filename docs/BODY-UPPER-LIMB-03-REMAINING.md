# Membre supérieur — ce qui reste après l'itération 03 (par composant)

**Bilan honnête** : le résultat n'est PAS « parfait sur tous les axes ». Les chiffres ci-dessous sont les écarts mesurés ; ce qui n'a pas été mesuré est dit tel quel. Les points des itérations précédentes non repris ici restent ouverts (`BODY-UPPER-LIMB-02-REMAINING.md`).

## Fidélité à `ref-02` / `ref-04`
- **Profil** : erreur de profondeur 12,8 %, IoU 0,799. L'overlay (`artefacts/upper-limb-03/04`) montre deux écarts de FORME non traités : le haut du dos de la référence (omoplate, bras) déborde vers l'arrière là où le moteur est plus plat, et le moteur projette trop le haut du thorax alors que le ventre de la référence reste plus avancé. Le tronc du moteur est penché autrement que la colonne presque droite de `ref-04`.
- **Coin du deltoïde (face)** : à x = 1,23 h la paroi est encore à 0,58 h sous le cou contre 0,79 h (le mur de la référence est presque vertical, celui du moteur arrondi). Largeur d'épaules 0,91 × la référence en pose calibrée de ref-02 (1,01 × pour ref-04).
- Les IoU de face stagnent (0,790 / 0,798) : l'écart restant vient des avant-bras/mains et de la largeur de tronc, pas du coin d'épaule ; non analysé en détail.
- Alignement du profil : recalage en translation par maximisation de l'IoU = convention du script, pas une propriété de la référence.
- `ref-01`, `ref-05-mains`, `ref-03` : toujours aucune mesure en pixels. Aucune mesure de couleur ou d'ombrage par pixel.

## Géométrie
- Abdomen : profondeur approchée (1,03 / 1,10 h contre 1,18 / 1,11 h) sans modèle de muscle propre au flanc ni de creux latéral.
- Le tronc s'arrête à ≈ 1,93 h sous le cou (hanches), la référence continue : le bas du profil n'est pas comparable.
- Clavicule, trapèze en 6 parties, coude, fuseaux, tendons et veines rectilignes : inchangés (voir REMAINING 02).

## Mains et doigts
- Comparaison à `ref-05-mains` non faite ; pas de plis, d'articulations DIP, de tendons fléchisseurs, d'ongles texturés.

## Vérification
- Profil : une seule référence (bandes larges) ; seule la vue de profil est contrôlée pour la profondeur, rien pour le trois-quarts ni le dos ; borne basse abdomen/thorax estimée.
- Épaule : contrôles de face uniquement (inchangé). Style : aucun contrôle de fidélité de ton à la référence.

## Prochaine étape la plus rentable
Modéliser le haut du dos et l'omoplate (débord arrière de `ref-04`) et redresser la colonne du tronc, puis mesurer la vue de DOS ; ensuite, comparer les mains à `ref-05-mains`.

# Ce qui reste après l'itération 07 (par composant)

Bilan honnête : deux changements gardés, tous deux modestes (`BODY-JUNCTIONS-07.md`). La tâche demandée (membre supérieur + raccords, « chef-d'œuvre ») n'est pas terminée. Les restes de `BODY-UPPER-LIMB-04-REMAINING.md` et `BODY-JUNCTIONS-05-REMAINING.md` non repris ici restent ouverts.

## Épaule ↔ bras
- Deltoïde toujours une masse fuselée à bord interne vertical ; le grand pectoral ne le recouvre pas (pas de sillon delto-pectoral). Essai de coupole élargie : raté (bosse). Piste non faite : volume d'insertion du pectoral du bord du tronc à l'humérus, couche au-dessus du deltoïde.
- Le coin d'épaule est descendu, pas supprimé ; la peau interpole par lissage avec plateau à chaque clé, donc une paroi quasi verticale subsiste. Piste : profil C² ou arc d'ellipse.
- `obese` : rotation maximale du contour 27° → 53° après l'arrondi. Cause non étudiée.
- Pointe de clavicule encore visible au gros plan (veryMuscular). Trapèze : fin toujours en plaque.
- Serratus en tiges, aisselle sans forme, bras trop près du corps vs ref-02, adultMale trop étroit vs ref-04 : non touchés.
## Aine, hanche, fessier
- Le fondu ne change que 0,3–0,9 % des pixels ; l'arête bassin/cuisse reste lisible. Non fait : congé de géométrie (enveloppe à l'intersection), rayon de fondu non ajusté par région.
- `hanche-dos` : regardé, non analysé ni mesuré à part.
## Dos et omoplate — non traité
- Aucune ligne du dos n'a été touchée. Piste (non essayée) : champ de hauteur (bord médial, épine, fosse infra-épineuse, angle inférieur) appliqué dans le rendu par pixel : reconstruire le point monde du pixel à partir de la profondeur, perturber la normale par le gradient du champ, borné au dos du tronc. L'enveloppe (loft d'ellipses) ne peut pas porter ce relief.
## Mains — non traité
- ref-05 non quantifiée ; aucune modification.
## Archétype `baby`
- Échoue toujours `junction.geo.shoulder-symmetry` (0,058 h > 0,05 h, seuil non retouché). Diagnostic obtenu : les muscles sont symétriques (étendue 0,359 / 0,366 h à 0,3 de la chute) mais la peau du tronc non (0,295 / 0,360 h) ; les stations ont cx = 0 mais l'axe de section est incliné de ≈ 1,65° ; cause non établie.
## Vérification
- Aucun contrôle ne mesure le coin d'épaule : la métrique d'angle géométrique du profil (largeur des stations) a augmenté (adultMale 72° → 86°) alors que l'image est meilleure, et la rotation du contour ne discrimine pas ; non retenues comme contrôles.
- Le contrôle de style est un proxy et ne s'exécute que de face à 460 px ; rien de 3/4 ou de dos. Aucune comparaison de perception (personne, référence) de l'effet du fondu.
- Les images montrent le corps seul (pas la tête) ; la suite complète du dépôt n'a pas été relancée.

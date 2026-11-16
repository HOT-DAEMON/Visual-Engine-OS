# Vue de dessous dans `head_3d` : 2e essai (retiré)

Suite de `NOSE-BASE-MASS.md` §5. Le maillage `head_3d` (`src/head-turntable/`) modélise le nez par une bosse de profil (`bumpMesh`) et deux ellipsoïdes d'ailes ; la vue de dessous éclairée (`src/relief/underview.ts`) utilise `baseMass` (lobule + ailes + columelle fusionnés, narines en fentes).

## Ce qui a été essayé
Un maillage `nose-base3d.ts` construit sur le MÊME `baseMass` (un relief, deux consommateurs, pas de géométrie dupliquée), accroché à `buildParts` :
- nœuds (x, w) tous les 2 px hôte, triangles seulement si les 4 coins sont dans l'empreinte ;
- x → U par `fx`, y → U par `fy`, profondeur w → `z` du profil de peau au sous-nez + w × (projection de la pointe du profil de crâne ÷ projection de la pointe du moteur de visage) ;
- normales analytiques du champ y(x, z) : n = (−∂y/∂x, 1, −∂y/∂z), pour que la paroi d'une narine garde sa vraie normale.

## Mesures (graine 11, lumière trois-quarts droite, gros plan, yaw 0 ; avant = sans le maillage)
| tangage | −40° | −25° | 0° | 25° | 40° |
|---|---|---|---|---|---|
| pixels changés (seuil 12/765) | 0,09 % | 0,15 % | 0,27 % | 0,24 % | 0,22 % |

Images : `artefacts/nez-head3d-base-essai/01-avant-apres-tangages-m40-m25-0-25.png`.

## Constat
- Les fentes de narines apparaissent bien à −40° et 0°, mais la base ne change que 0,1 à 0,3 % de l'image à tous les tangages testés : pas de saut visuel.
- À 0° et +25° le nez se couvre d'éclats de tons (le rendu est à aplats) et une ombre portée en coin traverse la joue : plus laid qu'avant, pas mieux.
- Hypothèse testée : le plan du bord du relief coïncide avec la ligne de profil que la bosse suit déjà (z-fighting). Enfouissement de 0,003 U : 0,26 % de pixels changés au lieu de 0,27 %, éclats inchangés (`02-avant-apres-enfouissement-0003U.png`). Hypothèse non confirmée.

## Décision
Maillage retiré (aucun code mort, aucune preuve visuelle). `head.roll.joined` n'a pas été relancé : le code n'est plus dans l'arbre.

## Reste (non fait)
La base devrait être le dessous du nez lui-même : retirer de la bosse sa face inférieure (sous la pointe) et laisser `baseMass` la porter, au lieu d'un patch posé sur une surface qui existe déjà. Limites de cet essai : une graine, une lumière, un seul réglage de burial.

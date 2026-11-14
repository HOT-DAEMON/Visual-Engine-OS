# Volume de cheveux 3D : ce qui reste (par composant)

## Fait dans cette passe
Volume 3D pour les 10 coiffures non chauves, rotation = celle du crâne, coque + rideau + chignon/queue/tresses, mèches sans couture, lisière portée par la rotation, couche de vérification (30 cas = 10 coiffures × 3 graines : résultat dans la section « État » ci-dessous), planches `artefacts/hair-volume/`.

## Non fait ou limité — à traiter ensuite
**Coque**
- `spiky` : la coque est mince et lisse ; pas de vraies pointes 3D (pointes seulement dans la silhouette 2D). À faire : cônes sur la coque aux sommets de `geo.locks` de type `spike`.
- Petites encoches latérales à hauteur d'oreille sur le rideau (vue de dos) : la coque pendante naît à `y0 − 0,06` et croît sur 0,12 U ; à lisser.
- Le bord de la lisière est coupé par `clip` par pixel : pas de frange de mèches individuelles qui dépassent.

**Rideau (bob, long)**
- `long` reste un peu « cape » vue de face (ailes sombres rasantes). À faire : mèches individuelles qui se séparent et ondulent ; interaction avec les épaules (le cou en cloche s'arrête à `y1`).
- La hauteur de l'ourlet vient de la silhouette 2D ; aucune simulation de gravité/vent en 3D (voir `HAIR-WIND.md`).

**Pièces**
- Queue : un éventail simple (tube effilé), lisible mais petit vu de face. Tresses : tubes à section ronde, côtes en texture seulement (pas d'entrelacs en relief). Chignon : ellipsoïde sans spirale en relief.

**Mèches**
- Pas de reflets anisotropes (type Kajiya-Kay) : brillance uniforme. Pas d'ombres propres des mèches.

**Moteur 2D (consignes de départ non traitées dans cette passe)**
- Afros inclinés à gauche/droite dans le dessin 2D, croissant noir hors des mèches, surface plate non couverte par les mèches, dessus trop uniforme (« mécanique »), frange « rideau » hors limite, blocs sombres au bas des ailes de la lisière : le volume 3D les contourne (afro centré par moyenne gauche/droite, coque pleine) mais **le moteur 2D (`src/face/hair/*`) n'a pas été modifié**. Voir `HAIR-FORM-REMAINING.md`, `HAIR-COHERENCE-REMAINING.md`, `HAIR-SKULL-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`.

**Intégration**
- Le volume n'est branché que sur le chemin « hôte » (`headSpecFromHost`). `headSpecFromFace` (planche de variété) n'a pas de volume.
- `lisiere.track` à 0,7 : les ratés viennent de points de lisière recouverts par la masse à plus de 6 px ; une lisière à épaisseur nulle exacte ferait 0,9 mais ressemblerait à un autocollant.
- Bornes de style calibrées sur 3 graines seulement ; élargir à 300 visages comme `HAIR-GRAMMAR-STATS.md`.

## Tests
`tests/hair-volume.test.ts` : volume non nul pour les 10 coiffures, `null` pour `bald`, hard checks de la couche cheveux.

## Constats de la revue visuelle des planches (`artefacts/hair-volume/01-…`)
- `buzz`, `short`, `spiky` se ressemblent beaucoup de face (même implantation haute et plate héritée de la lisière hôte) : la différence de coiffure vient surtout du moteur 2D, pas du volume. À faire : lisière frontale propre à chaque coiffure.
- Vue de face, l'implantation est très haute et rectiligne sur la graine 9000 (front dégagé) : c'est la lisière 2D (`HAIR-BOUNDARY-REMAINING.md`), le volume la respecte.
- `long`, de face : les ailes tombent en cape sombre et rasante sous le menton. `braids` de face : les tresses sont des pavés plats collés aux tempes. `ponytail` de face : la queue n'est qu'un petit pan visible à gauche.
- L'afro (avant/après) est rond, centré, sans croissant ; la texture de petites boucles est lisible mais uniforme (pas de mèches de grosseurs variées).

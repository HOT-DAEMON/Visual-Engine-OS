# SUITE DU DOCUMENT DE RENFORCEMENT DU MOTEUR DES YEUX

## 2.5. Groupe EYE-05 — Pupille : géométrie, forme et comportement
La pupille est une structure géométrique dont la forme et la taille doivent être dissociées de la couleur de l'iris.
### EYE-05A	Contour pupillaire
Voici les controles a exposé et a traité: Forme, netteté, régularité
### EYE-05B	Échelle pupillaire
Voici les controles a exposé et a traité: Taille relative et variation
### EYE-05C	Forme de pupille
Voici les controles a exposé et a traité: Circulaire, fente verticale, horizontale, forme geométriques, etc.
### EYE-05D	Orientation
Voici les controles a exposé et a traité: Angle de rotation et alignement
### EYE-05E	Centre pupillaire
Voici les controles a exposé et a traité: Position relative à l'iris
### EYE-05F	Bord de transition
Voici les controles a exposé et a traité: Netteté, dégradé, coloration
### EYE-05G	Réponse lumineuse
Voici les controles a exposé et a traité: Dilatation ou contraction simulée
### EYE-05H	Pupilles multiples
Voici les controles a exposé et a traité: Nombre, disposition, tailles
### EYE-05I	Forme artistique
Voici les controles a exposé et a traité: Étoile, losange, motif fractal, forme libre
### EYE-05J	Déformation locale
Voici les controles a exposé et a traité: Écrasement, asymétrie, irrégularité
Une pupille en étoile ne doit pas être codée comme une exception dans le moteur principal. Elle doit être un profil géométrique compatible avec le même contrat que les pupilles classiques.
## 2.6. Groupe EYE-06 — Cils : un générateur de structures fines
Pour les cils, je reprendrais une approche similaire à celle de ton moteur capillaire : une collection de primitives orientées, avec des courbes, des profils, des racines et des pointes.
### EYE-06A	Racines des cils
Voici les controles a exposé et a traité: Position, espacement, orientation
### EYE-06B	Courbe individuelle
Voici les controles a exposé et a traité: Courbure, longueur, direction
### EYE-06C	Épaisseur
Voici les controles a exposé et a traité: Épaisseur à la racine et à la pointe
### EYE-06D	Densité
Voici les controles a exposé et a traité: Nombre, espacement, regroupement
### EYE-06E	Pointe
Voici les controles a exposé et a traité: Netteté, finesse, forme
### EYE-06F	Cils supérieurs
Voici les controles a exposé et a traité:Distribution, longueur, éventail
## EYE-06G	Cils inférieurs
Voici les controles a exposé et a traité: Densité, longueur, orientation
### EYE-06H	Faisceaux
Voici les controles a exposé et a traité: Regroupement de plusieurs cils
### EYE-06I	Asymétrie
Voici les controles a exposé et a traité: Variations individuelles
### EYE-06J	Style graphique
Voici les controles a exposé et a traité: Cils en traits, en volumes ou en rubans, plumes, filaments, plumes, brins d'herbe..
En revanche, il faut distinguer la géométrie de la pupille et son comportement physiologique. Une pupille circulaire peut se dilater ; une fente verticale peut varier en largeur ; une pupille fantastique peut suivre une animation entièrement artistique.

Le moteur doit permettre ces comportements sans supposer que toutes les espèces réagissent de la même façon.
Un système purement aléatoire ne produira pas nécessairement de beaux cils. Il faut une grammaire de distribution : orientation générale, variations locales, densité variable, regroupements et exceptions.
En style anime, les cils peuvent devenir des masses graphiques triangulaires. En rendu réaliste, ils deviennent des courbes fines, avec des épaisseurs et des ombres. Dans un style fantastique, ils peuvent former des structures décoratives plus complexes.
Le même système doit pouvoir choisir entre ces représentations selon le style et la résolution de l'image.
## 2.7. Groupe EYE-07 — Microdétails de la sclère et des tissus
Cette couche est essentielle pour distinguer un œil réaliste d'un œil qui paraît simplement lisse et brillant.
Tu prévoierais :
### - EYE-07A — Vaisseaux de la sclère : ramification, épaisseur, densité, teinte et visibilité.
### - EYE-07B — Variation chromatique : zones légèrement plus chaudes, froides ou rosées.
### - EYE-07C — Surface lacrymale : humidité, film spéculaire et transitions.
### - EYE-07D — Microrelief cutané : pores, petites rides et variations de normales.
### - EYE-07E — Irrégularités des bords : transitions non parfaitement uniformes.
### - EYE-07F — Petites imperfections : marques et variations locales facultatives.
### - EYE-07G — Détails des canthi : petits plis et zones de contact.
### - EYE-07H — Occlusion locale : ombres entre les cils, les paupières et le globe.
Chaque microdétail doit disposer d'une échelle de visibilité. Il est inutile de générer des centaines de vaisseaux si l'œil ne mesure que quelques dizaines de pixels dans l'image finale.Il faut donc un système de niveaux de détail qui puisse réduire ou désactiver les microstructures sans changer l'identité fondamentale de l'œil.

## 3. Optique : le domaine qui peut faire la différence
C'est une dimension que tu traiteras séparément des matériaux ordinaires.
Un œil peut avoir une géométrie excellente et sembler faux si ses reflets ne correspondent pas à sa surface, si la cornée n'a aucune profondeur ou si la lumière paraît peinte sur l'iris.Tu séparera quatre mécanismes.
### OPT-01 — Réflexion
Reflets de la source lumineuse, de l'environnement et des objets environnants. La forme du reflet doit dépendre de la géométrie et de la source, sauf lorsqu'un reflet graphique est volontairement ajouté.
### OPT-02 — Réfraction et profondeur
La cornée est une surface transparente qui modifie le trajet de la lumière. Sa courbure et son indice de réfraction contribuent à la perception de l'iris derrière elle.
### OPT-03 — Diffusion sous-surface
La lumière pénètre dans certains tissus, se disperse et ressort. Ce phénomène contribue à leur aspect organique, notamment dans les zones fines.
### OPT-04 — Effets optiques artistiques
Reflets en forme d'étoile, anneaux lumineux, scintillements, éclats dessinés, halos ou effets de magie. Ils peuvent être indépendants de l'éclairage physique.

Il faut notamment distinguer un reflet issu du moteur de rendu d'un highlight dessiné par le moteur artistique.

En 3D, le reflet physique devrait suivre la caméra, les sources lumineuses et la surface. En 2D, un highlight peut être une forme vectorielle indépendante, positionnée relativement à l'iris. Les deux approches sont légitimes, mais elles ne doivent pas être confondues dans le contrat.

### 3.1. Le système de highlights
Chaque highlight devrait posséder ses propres paramètres :
- position relative au globe ou à l'iris ;
- largeur et hauteur ;
- rotation ;
- forme : ellipse, cercle, étoile, losange, forme libre ;
- couleur ;
- opacité ;
- flou et douceur des bords ;
- intensité lumineuse ;
- reflet principal ou secondaire ;
- attachement à la caméra, à la source lumineuse ou à la composition artistique.
Le moteur pourrait alors produire un œil photoréaliste avec un reflet de fenêtre, un œil anime avec deux grands reflets graphiques ou un œil fantastique avec plusieurs anneaux lumineux.

Une règle d'occlusion doit toutefois garantir que les highlights ne traversent pas arbitrairement les paupières ou ne flottent pas hors du globe.
## 4. Matériaux : l'œil ne doit pas être un bloc de plastique brillant
Tu créera un système de matériaux indépendant de la morphologie.
Matériau	
Sclère:	Paramètres essentiels (Couleur, rugosité, microrelief, vascularisation)
Iris:	Paramètres essentiels (Pigmentation, relief, rugosité, motifs, profondeur apparente)
Pupille:	Paramètres essentiels (Absorption visuelle, contour, opacité ou modèle optique)
Cornée:	Paramètres essentiels (Transparence, réfraction, réflexion, courbure)
Paupières:	Paramètres essentiels (Couleur, rugosité, diffusion sous-surface, microrelief)
Bord lacrymal:	Paramètres essentiels (Humidité apparente, brillance, reflets)
Cils:	Paramètres essentiels (Couleur, absorption, épaisseur, translucidité éventuelle)
Extensions fantastiques:	Paramètres essentiels (Émission, transmission, iridescence, motifs de surface)

Ces matériaux ne doivent pas être limités à la peau humaine.
Une créature pourrait posséder une sclère sombre, un iris minéral, une pupille lumineuse et une cornée translucide. Une autre pourrait posséder un œil entièrement artificiel, avec des surfaces métalliques et une lentille optique.La condition est que le moteur autorise ces combinaisons sans casser les interfaces géométriques.

### 4.1. Un modèle de surface réutilisable
Pour chaque couche, je prévoirais un contrat de matériau commun :
- couleur de base et variations ;
- rugosité ;
- réflexion ;
- transmission ;
- émission ;
- relief ;
- microtexture ;
- comportement de diffusion ;
- masques ;
- paramètres spécifiques au backend.
Tous ces champs ne seront pas exploités par chaque matériau. Une sclère n'a pas besoin d'émettre de la lumière, par exemple. Le contrat peut partager les champs communs tout en autorisant des extensions typées.
L'indépendance ne signifie pas que chaque matériau peut être appliqué n'importe où sans validation. Elle signifie que son implémentation peut évoluer sans réécrire la géométrie, tandis que le moteur vérifie les combinaisons autorisées.

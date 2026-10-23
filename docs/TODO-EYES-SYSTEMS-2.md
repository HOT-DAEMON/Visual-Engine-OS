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

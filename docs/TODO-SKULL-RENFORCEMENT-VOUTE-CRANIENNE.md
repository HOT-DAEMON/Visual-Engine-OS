# RENFORCEMENT DU MOTEUR DU CRANE
Ce document existe pour renforcer le moteur de crane deja en place..Il vient completer les lacunes qui existent..Il sert surtout a aider le moteur pour qu'il produire une richesse immense de veritable variété de crane..
Le crane est un enfant de la tête et est lié au visage...
# IMPORTANT 
Le crâne ne doit pas être représenté comme une simple ellipse dont on modifie la largeur et la hauteur.

Il faut que le moteur soit capable de distinguer tres clairement plusieurs familles de structures.
# A. La voûte crânienne (Tous les Éléments que le moteur doit savoir produire)
 1. Os frontal:	Front vertical, incliné, bombé, fuyant, aplati
 2: Os pariétaux:Bombements supérieurs et latéraux, largeur, aplatissement
 3: Os temporaux	Creux temporaux, largeur latérale, relief
 4: Os occipital	Occiput arrondi, plat, saillant, incliné
 5: Région mastoïdienne:	Relief derrière l'oreille
 6: Région sphéno-temporale	Transitions entre les plans latéraux et frontaux
 7: Vertex	Sommet du crâne, hauteur et position
 8: Glabelle	Relief entre les arcades sourcilières
# IMPORTANT 
Il faut que tous les valeurs des element de cette voutes cranienne soit visuelement présent et testé dans leur extremes en incrementant ou en decrementant leur valeur pour prouver leur efficité..Par defaut tous les elements sont visible...Les artefacts produient doivent être visuellement suivre la sophistication du code..On ne veut pas d'element orphelin ou non testé..Tous doit être testé a l'extreme sans compromis...
Chaque element doit connaitre son parent direct, son parent lointain, son voisin supérieur, son voisin inférieur, son voisin medial, son voisin latéral, son voisin posterieur, ses tissus, sa profondeur, sa position exacte dans le repère de la tête(Des coordonnées locales et globales), sa visibilité par rapport a la camera, son occlusion par les composants voisins.- chaque structure possède un identifiant anatomique, un registre, des paramètres et des relations ;
- chaque structure déclare son influence sur la géométrie externe ;
- les structures visibles partagent une surface continue lorsque l'anatomie l'exige ;
- les matériaux et textures sont hérités ou spécialisés selon les besoins du rendu ;
- les sutures et couches internes sont des données anatomiques, pas obligatoirement des objets visibles.
Ce système doit également distinguer les contraintes strictes des préférences morphologiques. Une relation anatomique ne doit pas empêcher une caricature volontaire.

le moteur doit pouvoir produire les mêmes structures sous plusieurs angles sans reconstruire artificiellement..

Un manque important : les familles de crânes.

Le document HEAD-TURNTABLE-REMAINING.md reconnaît notamment que l'axe de longueur ne permet pas encore de produire une véritable diversité dolichocéphale et brachycéphale.

Il faut donc prévoir :
- Dolichocéphalie : crâne relativement long.
- Brachycéphalie : crâne relativement large.
- Mésocéphalie : proportions intermédiaires.
- Crâne haut ou bas.
- Occiput aplati ou proéminent.
- Front large ou étroit.
- Bombements pariétaux variables.
- Asymétrie droite/gauche.
- Plans latéraux plus ou moins aplatis.
Attention : ces familles doivent être des combinaisons de mesures indépendantes et non des modèles rigides prédéfinis.
B. Les structures osseuses de transition
Il manque également une représentation suffisamment riche des zones où les os se rencontrent :
- Suture coronale.
- Suture sagittale.
- Suture lambdoïde.
- Suture squameuse.
- Région ptérion.
- Région astérion.
- Crêtes temporales.
- Ligne nuchale.
- Protubérance occipitale externe.
Ces structures ne doivent pas toutes être visibles dans le rendu final. Elles doivent néanmoins pouvoir exister dans le modèle anatomique, notamment pour les vues de profil, de trois quarts et arrière.

# TRES IMPORTANT
1. Morphologie combinatoire
Ne pas se limiter à des familles prédéfinies de visages.
Le moteur doit pouvoir combiner indépendamment :
- Les proportions.
- Les volumes.
- Les courbures.
- Les asymétries.
- Les reliefs.
- Les tissus.
- Les déformations.
Avec des contraintes qui empêchent les combinaisons incohérentes sans supprimer les possibilités artistiques.
2. Morphologie corrélée
Certaines caractéristiques doivent pouvoir être liées.
Par exemple, un visage avec une mandibule très développée peut avoir un masséter plus prononcé, sans que ce soit obligatoire.
Il faut donc des corrélations probabilistes facultatives, et non des règles absolues.
#1. La largeur de la boîte crânienne doit être indépendante de la largeur du visage.

C'est directement lié au problème identifié en V4. La largeur des joues, des pommettes et des cheveux ne doit pas être confondue avec la largeur osseuse du crâne.

2. La hauteur doit être une vraie dimension géométrique.

Le paramètre vaultHeight ne doit pas simplement modifier la position horizontale de quelques points du profil. Il doit réellement contrôler la hauteur de la voûte et ses transitions, avec une incidence mesurable dans les vues concernées.

3. L'asymétrie crânienne doit avoir ses propres paramètres.

L'asymétrie des yeux, de la bouche et de la mandibule peut être corrélée à celle du crâne, mais ne doit pas la déterminer automatiquement. Le moteur doit pouvoir produire un crâne asymétrique avec un visage symétrique, et inversement.

4. Les plans latéraux doivent être explicitement modélisés.

Il manque notamment une maîtrise indépendante de :
- l'aplatissement temporal ;
- la convexité pariétale latérale ;
- la largeur au niveau des régions temporales ;
- la transition entre les plans frontal, temporal et pariétal ;
- la forme de la région mastoïdienne.
5. Les tissus doivent être distingués de l'os.

Le contour visible du crâne sous la peau, le relief osseux, le périoste, les tissus sous-cutanés et le cuir chevelu ne sont pas la même chose. Cette séparation sera importante pour que ton moteur d'apparence puisse produire des résultats différents selon le style, le degré de réalisme et la lumière.

6. Il faut une validation visuelle automatique des paramètres.

Pour chaque paramètre, Claude doit générer une planche comparative avec valeur minimale, nominale et maximale, en conservant exactement la même graine, la même caméra, le même éclairage et le même rendu. Ensuite, une deuxième planche doit tester les interactions entre paramètres.

La preuve doit montrer une différence perceptible, et non simplement une valeur différente dans le JSON.

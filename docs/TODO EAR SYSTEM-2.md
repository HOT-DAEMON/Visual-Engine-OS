> Suite de `docs/TODO EAR SYSTEM.md` (sections 1 à 2.3). Texte repris tel quel.

## 3. Le contour de l'oreille n'est pas une simple ligne
il faut séparer le contour extérieur en segments contrôlables.
ID	Segment	Paramètres principaux
EAR-C01	Pôle supérieur	hauteur, rondeur, inclinaison
EAR-C02	Bord postérieur	courbure, convexité, épaisseur
EAR-C03	Bord inférieur	raccord avec le lobule
EAR-C04	Bord antérieur	rapprochement du visage, relief
EAR-C05	Zone du tragus	projection et encoche
EAR-C06	Jonction oreille-joue	attache, ombre, transition
EAR-C07	Jonction oreille-crâne	angle, profondeur, surface masquée
La silhouette dépend également de la caméra. Une oreille de face peut sembler étroite, alors que la même oreille, vue de trois-quarts, révèle une conque profonde et un rebord projeté.
Il faut donc éviter de confondre la forme réelle de l'oreille avec sa projection sur l'image.
## 4. Les couches de surface : ce qui donne l'impression de détail
Une oreille peut posséder une bonne géométrie générale et rester artificielle si toutes ses surfaces ont la même matière.Tu separera les couches suivantes:
### SURF-01 — Surface cutanée
Couleur de base, rugosité, microrelief, diffusion sous-surface et variation chromatique.
### SURF-02 — Reliefs cartilagineux
Crêtes de l'hélix et de l'anthélix, saillies du tragus, variations de courbure et raccords.
### SURF-03 — Cavités
Scapha, fosse triangulaire, conque et entrée du conduit auditif, avec leurs propres profondeurs.
### SURF-04 — Réponse lumineuse
Ombres de contact, occlusion ambiante, reflets, diffusion et transmission légère de la lumière dans les parties fines.
### SURF-05 — Détails secondaires
Petites irrégularités, plis cutanés, pores, variations de couleur et petites asymétries.
Attention : chaque couche ne doit pas forcément être une géométrie indépendante. Certains détails seront mieux représentés par le maillage, d'autres par des normales, des textures ou des effets d'éclairage. Le choix dépend de leur taille à l'écran et du style de rendu.
## 5. Les microdétails et variations anatomiques
Pour atteindre un rendu très détaillé, je prévoirais également les variations suivantes.
- Relief de l'hélix : épaisseur variable le long de la courbe, bord plus ou moins arrondi, légère irrégularité.
- Transition hélix–lobule : fusion progressive ou séparation visuelle plus marquée.
- Relief de l'anthélix : deux branches plus ou moins prononcées.
- Conque : cavité plus ou moins profonde, fond plus ou moins visible.
- Tragus : saillie plus ou moins grande, parfois partiellement masquée par l'angle de vue.
- Antitragus : volume et orientation indépendants.
- Lobule : attache, pendance, volume et déformation.
- Asymétrie bilatérale : différences contrôlées entre oreille gauche et oreille droite.
- Pigmentation : rougeur du bord, variations de teinte et zones plus sombres.
- Vascularisation apparente : optionnelle, selon le réalisme recherché.
- Petits plis de compression : près des attaches et des zones de contact.
- Pilosité locale : facultative, notamment autour de l'entrée du conduit.
Ces détails ne doivent pas tous être activés par défaut. Il faut un niveau de détail qui puisse évoluer entre une oreille stylisée, une oreille semi-réaliste et une oreille réaliste.
## 6. Oreille, tête, cheveux et bijoux : les interactions
Une oreille détaillée doit fonctionner avec le reste du personnage.
### 6.1. Attache à la tête
L'oreille doit avoir une position et une orientation relatives au crâne, définies par :
- hauteur sur le crâne ;
- distance par rapport aux yeux ;
- distance par rapport à la joue ;
- angle d'ouverture ;
- projection latérale ;
- inclinaison avant-arrière ;
- rotation locale ;
- taille relative.
Il est préférable de dériver sa position de repères anatomiques stables plutôt que de placer chaque oreille manuellement dans l'espace.
### 6.2. Occultation par les cheveux
Les cheveux peuvent cacher le haut de l'hélix, le bord postérieur ou toute l'oreille. Ils peuvent également passer derrière l'oreille ou devant elle.

Il faut distinguer :
- oreille entièrement visible ;
- oreille partiellement masquée ;
- oreille sous les cheveux ;
- mèches passant derrière l'oreille ;
- mèches ramenées derrière le pavillon ;
- cheveux recouvrant le piercing.
Le moteur ne doit pas supprimer la géométrie de l'oreille lorsqu'elle est masquée. Il doit simplement gérer correctement la visibilité.

### 6.3. Piercings et bijoux
Les bijoux nécessitent des points d'attache dédiés :
- ear_lobe_piercing ;
- helix_piercing ;
- tragus_piercing ;
- conch_piercing ;
- industrial_piercing.
Chaque point d'attache doit posséder une position, une orientation, des contraintes de collision et une compatibilité avec les différentes formes d'oreilles.
Les longues boucles visibles sur certaines références ajoutent une autre contrainte : elles peuvent pendre, tourner et entrer en collision avec le cou ou les cheveux.
## 7.1. Les paramètres ne sont pas tous indépendants
Il faut notamment respecter les dépendances anatomiques :
- augmenter la profondeur de la conque doit préserver une épaisseur suffisante de la paroi ;
- élargir le lobule ne doit pas créer une cassure avec le cartilage ;
- modifier l'angle de l'oreille doit déplacer les points d'attache des bijoux ;
- changer l'échelle de l'oreille doit conserver les proportions relatives des structures, sauf si une variation morphologique spécifique est demandée ;
- modifier la forme de l'anthélix doit recalculer les espaces qui l'entourent.
C'est la différence entre un ensemble de curseurs et un véritable système paramétrique contraint.

## 8 Grammaire multidirectiPonnelle 
Deux oreilles ayant le même niveau de réalisme global peuvent être très différentes.
### 8.1 Parametre artistique : Exagération
Conséquence geometrique possible : Agrandissement sélectif du lobule, des pointes ou des crêtes

### 8.2 Parametre artistique : Fidélité anatomique
Conséquence geometrique possible : Préservation des rapports anatomiques et des raccords
### 8.3 : Parametre artistique: Angularité
Conséquence géométrique possible : Modification des profils de courbure et des terminaisons
### 8.4 : Parametre artistique : Douceur
Conséquence géométrique possible : Arrondissement des arêtes et lissage des transitions
### 8.5: Parametre artistique: Asymétrie
Conséquence géometrique possible : Variation contrôlée entre les deux oreilles et au sein d'une même oreille
### 8.6: Parametre artistique : Densité des détails
Activation des microreliefs selon l'échelle de rendu.
La fidélité anatomique et l'exagération ne sont pas strictement opposées. Une oreille peut avoir une anatomie localement crédible, une conque bien construite et une peau réaliste, tout en possédant des proportions caricaturales.
C'est précisément cette combinaison que le moteur doit savoir exprimer.

## 9 : Comment représenter les espèces et les hybrides inédits
Il faut éviter de coder une règle telle que « les oreilles d'elfe sont toujours longues et pointues ». C'est un préréglage artistique, pas une loi du moteur.
À la place, chaque profil d'espèce devrait définir :
- les structures obligatoires, optionnelles et interdites ;
- les plages de dimensions et de proportions ;
- les relations entre les structures ;
- les familles de matériaux compatibles ;
- les déformations autorisées ;
- les extensions spécifiques ;
- les règles de symétrie ou d'asymétrie.
### 9.1 : Exemple de matrice de conception sur lequel se baser pour definir les éventuelles futurs especes:
#### Famille Humain:
Structure de référence: Pavillon auriculaire humain
Transformations caractéristiques: Variations anatomiques naturelles
#### Famille Félin:
Structure de référence: Oreille à pavillon triangulaire
Transformations caractéristiques: Pôle haut, base large, cavité orientée
#### Famille Canidé
Structure de référence: Oreille dressée ou tombante
Transformations caractéristiques: Flexion, inclinaison, variation du cartilage
#### Famille Équidé
Structure de référence: Oreille allongée et mobile
Transformations caractéristiques: Rotation, mobilité, extrémité affinée
#### Famille Élfique
Structure de référence: Base organique modifiée
Transformations caractéristiques: Pointe étirée, torsion, crêtes accentuées
#### Famille Draconique
Structure de référence: Structures organiques étendues
Transformations caractéristiques: Crêtes secondaires, écailles, membranes
#### Famille Extraterrestre
Structure de référence: Morphologie libre sous contraintes
Transformations caractéristiques: Structures inédites, asymétrie, bioluminescence

Ces familles sont des préréglages de départ, pas des modèles définitifs. Il faudra aussi autoriser les variations internes : un chat ne possède pas toujours la même forme d'oreille qu'un autre chat.

Pour produire une espèce jamais prévue, le moteur doit pouvoir combiner les primitives morphologiques existantes, puis autoriser de nouvelles primitives lorsqu'aucune combinaison ne satisfait le résultat demandé. Sinon, sa prétendue universalité restera limitée à son catalogue initial.
## 10. La géométrie doit être contrainte, pas simplement assemblée
C'est la partie qui distinguera un véritable moteur d'un système qui empile des formes.
Imaginons une oreille dont la conque est très profonde. Si le moteur creuse simplement la surface, il peut traverser la paroi postérieure. Si le lobule est élargi, il peut produire une jonction cassée. Si l'hélix devient très épais, il peut masquer entièrement la scapha.
Le moteur doit donc posséder un système de contraintes.
### 10.1 Exemples de contraintes géométriques
Épaisseur minimale: La profondeur d'une cavité doit rester compatible avec l'épaisseur de la paroi.
Continuité des surfaces: Les structures qui fusionnent doivent avoir des raccords acceptables, sans fissures ni intersections accidentelles.
Préservation des cavités: Une cavité doit être une vraie dépression géométrique, ou une approximation graphique explicitement choisie, et non un simple cercle sombre posé sur une surface plate.
Déformations cohérentes: Une modification de l'hélix doit recalculer les régions voisines sans écraser arbitrairement les autres structures.
Compatibilité avec la tête: L'oreille doit conserver son attache au crâne, même lorsque ses proportions changent fortement.

Il faudra distinguer les contraintes strictes, les préférences anatomiques et les objectifs artistiques. Une oreille de monstre peut volontairement enfreindre certaines proportions humaines, mais elle ne devrait pas produire accidentellement des surfaces cassées.

# TRES IMPORTANT 
Les tests visuels doivent être tres rigoureux sur tous les parametres sans exception de tous les axes et leurs micro parametre
### A. Face
Silhouette, symétrie et lisibilité des cavités.
### B. Trois-quarts
Profondeur, projection et épaisseur des rebords.
### C. Profil
Attache au crâne, projection latérale et contour.
### D. Gros plan éclairé
Reliefs, creux, transitions et ombres de contact.
Le même modèle doit être utilisé dans les quatre vues. Sinon, on  risques d'obtenir quatre illustrations convaincantes mais quatre géométries incompatibles.

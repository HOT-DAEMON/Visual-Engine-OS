# RENFORCEMENT DU MOTEUR D'APPARENCE QUI EXISTE DEJA
# IMPORTANT
Il faut disséquer chaque phrases ou fonctionnalité demandé pour les traiter avec la plus grande rigeur possible..
Dans src/lighting/rig.ts, tu as notamment :- softness();- rigOf();- falloff();- intensityFor();- kelvinRgb();- applyTemperature(); le moteur prends donc déjà en compte la taille apparente de la source, sa distance et sa température de couleur.Mais il y a une limite : le modèle de distance reste une approximation. Il ne calcule pas réellement la distribution spatiale d'une source lumineuse ni son atténuation physique sur chaque surface.
Il faut vérifier si la remarque est pertinente, puis implémenter réellement la distribution spatiale d'une source lumineuse ni son atténuation physique sur chaque surface
# PROBLEMES ARCHITECTURAL IMPORTANT
Le modèle possèdes plusieurs systèmes lumineux, mais pas encore un éclairage universel.Actuellement, il faut que le moteur d'apparence puisse distinguer concretement et clairement :- Le rig lumineux général;- L'ombrage des matériaux.- L'éclairage spécialisé du visage;- Le rendu par pixel de la tête;- Le rendu lumineux du corps.- Les effets d'apparence.
Ces systèmes partagent certaines données, mais cela ne signifie pas qu'ils partagent tous les mêmes calculs ni les mêmes capacités.
Par exemple : compileSurface() applique un ombrage générique à une surface sphérique ou plane.headLit() construit un champ de relief anatomique et calcule des ombres portées.compileSkin() utilise un moteur spécialisé pour la peau.

Ces approches ont chacune leur intérêt. Le problème apparaît lorsqu'elles doivent travailler ensemble.

Imagine une scène avec :- Un personnage;- Une lumière principale orange;- Une lumière secondaire bleue;- Une fenêtre derrière lui;- Une épée métallique;- Des cheveux noirs;- Une fumée translucide;- Une explosion.
On dois pouvoir demander au moteur de calculer les interactions lumineuses de ces éléments sans devoir écrire un traitement particulier pour chaque combinaison.
Ce qui manque est un Lighting Core commun, avec des interfaces spécialisées pour chaque famille de matériaux et de géométries.

# La gestion des sources lumineuses est encore trop limitée
Le schéma LightSpec de src/schema/light-transform.ts représente essentiellement une source principale.Il ne définit pas encore un véritable système de scène lumineuse multipoints.
Le moteur doit pouvoir être capable de prévoir les types suivants :
## 1.Une vrai Key Light
Lumière principale : détermine la lecture générale des volumes et la direction dominante des ombres.
Ceci doit être véritablement consommé par tous les composants du moteur
## 2. Fill Light
Lumière de remplissage : révèle les détails dans les ombres sans supprimer le contraste.
Ceci doit être véritablement consommé par tous les composants du moteur..
## 3. Back Light / Rim Light
Lumière arrière : détache le personnage de son environnement.
Ceci doit être véritablement consommé par tous les composants du moteur..
## 4. Practical Lights
Sources présentes dans la scène : torches, fenêtres, lampes, écrans, flammes, explosions.
Ceci doit être véritablement consommé par tous les composants du moteur..
## 5. Bounce Light
Lumière réfléchie par l'environnement et renvoyée sur les personnages et les objets.
Ceci doit être véritablement consommé par tous les composants du moteur..

Il faudrait aussi prévoir :- Directional Light;- Point Light;- Spot Light;- Area Light;- Ambient Light;- Emissive Light;- Volumetric Light;- Environment Light.- Projected Light.

Chaque source devrait avoir son propre identifiant, son volume d'influence, sa couleur, son intensité, sa position, son orientation, ses paramètres d'ombre et son comportement temporel.
## Attention : une lumière émissive dessinée sur un objet n'est pas automatiquement une source qui éclaire les objets voisins. Cette distinction doit être explicite dans l'architecture.
Les tests doivent prouver visuellement le fonctionnement de tous ses fonctionnalités, et presenté les variations a l'extreme...Puis challenger les angles les plus sous-estimé pour prouver l'efficacité du moteur..

## Il manque une véritable gestion des interactions entre sources
Une surface doit pouvoir recevoir plusieurs contributions simultanément.
Par exemple : L_{{final}} = L_{{direct}}+ L_{{indirect}}+ L_{{émission}}+ L_{{atmosphère}}
Cette expression est une représentation conceptuelle : le calcul réel doit tenir compte des matériaux, des occlusions, des réponses spectrales approximées et du domaine colorimétrique.
Le moteur devrait notamment pouvoir produire :- Une joue éclairée en orange par une explosion;- Une ombre bleue provenant de l'environnement;- Un reflet blanc provenant d'une fenêtre;- Une lumière rouge provenant d'une enseigne;- Une ombre de la frange sur le front;- Une ombre du nez sur la joue;- Un rebond lumineux provenant du vêtement.
Et tout cela sans que les contributions se détruisent mutuellement.
Il faut donc une véritable stratégie de composition des lumières, avec gestion des priorités artistiques et des limites d'énergie.
## Les ombres portées ne sont pas encore universelles
Le fichier src/relief/cast.ts utilise une technique intéressante : le screen-space ray marching.
Le principe est le suivant :
1. On prend un pixel de la surface.
2. On avance dans la direction de la lumière.
3. On examine les profondeurs rencontrées.
4. Si un obstacle intercepte le rayon, le pixel reçoit une ombre.
5. On calcule une pénombre qui augmente avec la distance.
C'est une bonne base pour le visage.
Mais regarde les limites :
Le calcul se fait sur un champ de profondeur 2D;Les ombres sont limitées à une distance reach;Les sources lumineuses ne sont pas échantillonnées individuellement pour calculer leur pénombre;Le calcul ne couvre pas automatiquement tous les objets de la scène;Les surfaces qui sortent du champ de profondeur ne peuvent pas jouer correctement leur rôle d'occulteur;Les ombres de géométries complexes nécessitent un système de profondeur plus général.
Il y a également un détail technique à corriger : CastOpts expose steps, mais castShadow() ne l'utilise pas actuellement. Le nombre d'échantillons est déterminé par la construction du tableau ts, puis steps est explicitement ignoré.
Ce n'est pas nécessairement une erreur visuelle, mais c'est une incohérence entre le contrat et l'implémentation.
## Il faut plutôt faire évoluer ray marching vers une veritable architecture sophistiquée d'ombres à plusieurs niveaux :
### Système de Contact shadows	
Utilisation : Petits contacts entre composants
### Systeme de Screen-space shadows	
Utilisation: Ombres locales rapides
### Systeme de Geometry shadows	
Utilisation: Ombres provenant de géométries 3D
### Systeme de Cast shadows	
Utilisation: Ombres portées directionnelles
### Systeme de Soft shadows	
Utilisation : Pénombres calculées à partir de sources étendues
### Systeme de Self-shadowing
Utilisation: Ombres entre les parties d'un même objet
### Systeme de Volumetric shadows	
Utilisation : Ombres dans la fumée, la poussière et les volumes
# IMPORTANT 
Il faut pouvoir combiner ces méthodes selon la qualité demandée et la complexité de la scène.
# Le moteur ne traite pas encore correctement les ombres des cheveux
C'est un point particulièrement important pour ton projet.
Dans src/render/face/hair.ts, On a déjà :- Des mèches séparées;- Des couches arrière et avant; - Des couches passant devant les yeux;- Des reflets;- Des effets d'apparence;- Des ombres des mèches sur la peau.
C'est très bien.
Mais l'ombre des cheveux sur la peau est actuellement construite à partir de silhouettes skinShadows, avec un décalage bas-droite et un flou.
Ce n'est pas encore une véritable projection de l'ombre selon la géométrie, la direction de la lumière et la distance entre les mèches et le visage.
Il faudrait que chaque mèche puisse fournir :- Sa géométrie;- Sa profondeur;- Son orientation;- Sa normale approximative;- Son épaisseur;- Sa transparence;- Sa distance par rapport à la peau;- Son appartenance à une masse capillaire;- Sa capacité à bloquer, transmettre ou diffuser la lumière.
Ensuite, il faut calculer : Mèche → ombre sur front → ombre sur paupière → ombre sur iris → ombre sur joue → interaction avec les autres mèches.

Il faut également prévoir l'opération inverse :La lumière qui traverse une chevelure partiellement transparente doit pouvoir atteindre certaines parties du visage.
Ce n'est pas une simple question esthétique. C'est une question de relations spatiales entre composants atomiques.
# Les yeux ne possèdent pas encore leur propre modèle optique complet
La documentation docs/LIGHT-VISIBLE-06-REMAINING.md reconnaît explicitement cette limite.
L'orbite est représentée dans le champ de relief, mais pas le globe oculaire comme véritable surface indépendante.
Les yeux reçoivent le multiplicateur lumineux général du visage, mais il manque notamment :
- L'ombre portée de la paupière supérieure sur le globe.
- La courbure indépendante de la cornée.
- La réfraction de la lumière à travers la cornée.
- Les reflets d'environnement.
- La réflexion de la source lumineuse sur la cornée.
- La diffusion et la profondeur de l'iris.
- Les interactions entre les multiples iris que tu souhaites pouvoir placer dans une même enveloppe palpébrale.
- La transparence et l'humidité de la surface oculaire.
Je recommande un modèle lumineux oculaire indépendant, mais connecté au Lighting Core.

Un œil doit être capable de recevoir une lumière générale, une lumière spécifique de cornée, un reflet de fenêtre, une ombre de paupière et une émission propre à l'iris.
# Le problème de l'intégration : ce que les fichiers révèlent
J'ai consulté docs/PIPELINE-RELIEF.md et docs/LIGHT-VISIBLE-06-REMAINING.md.Et je tiens à souligner que ta documentation technique est assez honnête sur les limites rencontrées.Elle révèle plusieurs problèmes qui ne sont pas de simples fonctionnalités manquantes.
# Le relief de la tête est déjà branché, mais pas universellement
Le type head_lit permet de brancher le moteur de relief sur un hôte de type face.Dans src/render/head-lit.ts, l'éclairage est placé dans le champ top du rendu.
Cela permet de poser la couche lumineuse après les autres composants du visage.Mais cette méthode possède une faiblesse :
La couche d'éclairage est appliquée à tout ce qui se trouve dessous dans le SVG, pas uniquement aux pixels appartenant à la tête.Si un autre objet chevauche le visage, il peut lui aussi être affecté.
Il manque donc un système universel de masques d'appartenance, de profondeur et de composition.
Il faudrait que chaque pixel sache :- À quel objet il appartient;- À quel composant anatomique il appartient;- Quelle est sa profondeur;- Quelle surface le masque.
- Quelle lumière il reçoit;- Quelle ombre il projette;- Quelle matière il représente.
Ce serait l'équivalent d'un G-buffer adapté à ton moteur artistique.
# La lumière du corps et celle de la tête ne sont pas encore parfaitement unifiées
Tu as déjà construit litFigure() dans src/relief/figure.ts.Cette fonction permet de faire travailler la tête et le corps avec le même LightModel.C'est une excellente direction.
Mais la documentation révèle encore :
- La projection de l'ombre de la tête sur la poitrine reste insuffisante.
- La tête ne projette son ombre que sur une partie du cou dans les configurations testées.
- Le raccord entre tête, cou et corps n'est pas complètement vérifié.
- La tête tournée ne reçoit pas encore systématiquement le même traitement que le corps dans toutes les configurations.
Il faut donc dépasser le simple partage d'une direction lumineuse.Il faut un espace spatial commun pour la tête, le cou, le torse, les épaules, les bras, les mains et les jambes.Une ombre doit pouvoir traverser plusieurs composants et continuer à respecter les distances, les occlusions et les orientations.
# Un véritable système de sources lumineuses multidimensionnel
Le moteur doit pouvoir gérer simultanément plusieurs sources.
Chaque source devrait être un objet indépendant possédant un contrat commun :
## Exemple de contrat architectural proposé 
interface LightSource {
  id: string;
  type:
    | "directional"
    | "point"
    | "spot"
    | "area"
    | "environment"
    | "emissive"
    | "volumetric"
    | "projected";
  transform: {
    position: Vec3;rotation: Quaternion;scale: Vec3;
  };
  color: Color;intensity: number;temperatureK?: number;attenuation: AttenuationModel;shadow: ShadowSettings;influence: InfluenceSettings;
  animation?: LightAnimation;
}
Il faut ensuite prévoir les comportements particuliers de chaque source.
Par exemple :
- Une flamme vacille.
- Une explosion éclaire brutalement puis décroît.
- Un éclair illumine brièvement tout un environnement.
- Une lampe torche suit une trajectoire.
- Une lumière magique pulse selon un rythme.
- Une fenêtre projette un rectangle lumineux sur le sol.
- Une source volumétrique crée des faisceaux visibles dans la poussière.

# Une véritable bibliothèque de comportements d'ombre
Il faut que le moteur puisse aller plus loin que les simples ombres portées.Il faut dissequer chaque famille et les traiter a fond et avec la plus grande attention..Les tests doivent montré visuellement tout ses familles 
Il faut prévoir au minimum :
## Famille d'Ombre propre
Comportement a prévoir (Suit la courbure et l'orientation de la surface)
## Famille d'Ombre portée
Comportement a prévoir (Projection d'un composant sur un autre)
## Famille d'Ombre de contact
Comportement à prévoir (Assombrissement au voisinage d'un contact)
## Famille d'Auto-ombrage
Comportement à prévoir(Une partie d'un objet ombre une autre partie)
## Famille d'Ombre ambiante
Comportement à prévoir (Occlusion des lumières indirectes)
## Famille d'Ombre douce
Comportement à prévoir (Pénombre graduelle)
## Famille d'Ombre dure
Comportement à prévoir (Bord net et contrôlé)
## Famille d'Ombre translucide
Comportement à prévoir (Lumière partiellement transmise)
## Famille d'Ombre coloré
Comportement à prévoir (Ombre influencée par la lumière et le matériau)
## Famille d'Ombre volumétrique
Comportement à prévoir (Faisceau ou volume traversé par une lumière)
## Famille d'Ombre animée
Comportement à prévoir (Évolution temporelle cohérente)
## Famille d'Ombre stylisée
Comportement à prévoir (Forme dessinée ou sculptée par la direction artistique)
Mais il faut aussi prévoir les caractéristiques géométriques des ombres :- Longueur;- Largeur;- Orientation;- Déformation;- Étirement perspectif;- Intensité;- Opacité;- Netteté;- Pénombre;- Contour;- Couleur;- Multiplicité;- Découpage;- Projection sur des surfaces irrégulières.

Une ombre peut même être volontairement déformée pour renforcer la composition dramatique d'une scène.
Le moteur doit donc proposer deux niveaux :
Ombre calculée : résultat de la géométrie et de la lumière.
Ombre artistique : résultat modifiable par la direction artistique, avec des contraintes de cohérence.
Il ne faut pas confondre les deux.
## Un système de normales et de relief beaucoup plus général
Le ReliefField possède déjà :- depth;- nx;- ny;- nz;- region
C'est une base très intéressante.
Mais il faut transformer ce concept en représentation commune à tous les composants atomiques du projet.
Chaque surface devrait pouvoir fournir :
- Position 3D (Utilisé:Localisation)
- Profondeur (Utilité:Occlusion)
- Normale (Utilité: Orientation lumineuse)
- Tangente(Utilité: Orientation des détails)
- Bitangente (Utilité:Repère de surface)
- Courbure (Utilité: Réponse aux variations lumineuses)
- Épaisseur (UTilité:Transmission et pénétration)
- Matériau(Utilité: Réponse optique)
- Masque (Utilité: Délimitation)
- Identifiant anatomique (Utilité: 	Relations entre composants)
- Parent/enfants (Utilité: Relations structurelles)
- Visibilité caméra (Utilité: Calculs spécifiques au cadrage)
Il faut surtout que les normales soient disponibles à plusieurs niveaux :
- Normale globale de la forme.
- Normale locale de chaque région.
- Normale des détails.
- Normale de la déformation.
- Normale de la surface après animation.
Cela permettrait d'éclairer une épaule, une oreille, un nez, une paupière, une mèche ou un muscle avec le même système fondamental.
## Un système de matériaux optiques spécialisé
Ton moteur possède déjà MaterialDescriptor, roughness, metallic, clearcoat, opacity et plusieurs effets.

Mais il faut enrichir considérablement la réponse optique des matériaux.


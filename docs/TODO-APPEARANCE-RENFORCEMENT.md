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

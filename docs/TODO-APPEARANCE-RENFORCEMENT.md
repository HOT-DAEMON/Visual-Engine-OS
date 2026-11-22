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
Le calcul se fait sur un champ de profondeur 2D.
Les ombres sont limitées à une distance reach.
Les sources lumineuses ne sont pas échantillonnées individuellement pour calculer leur pénombre.
Le calcul ne couvre pas automatiquement tous les objets de la scène.
Les surfaces qui sortent du champ de profondeur ne peuvent pas jouer correctement leur rôle d'occulteur.
Les ombres de géométries complexes nécessitent un système de profondeur plus général.

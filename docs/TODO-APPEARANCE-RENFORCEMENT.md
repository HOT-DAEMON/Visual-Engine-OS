# RENFORCEMENT DU MOTEUR D'APPARENCE QUI EXISTE DEJA
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

Il faudrait aussi prévoir :- Directional Light;- Point Light;- Spot Light;- Area Light;- Ambient Light;- Emissive Light;- Volumetric Light;- Environment Light.
- Projected Light.

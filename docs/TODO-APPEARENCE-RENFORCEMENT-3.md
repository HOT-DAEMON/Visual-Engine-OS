il y a une limite importante : le glow est construit à partir de l'alpha de l'objet, pas de sa géométrie lumineuse réelle.
Conséquences :
- une chevelure entière peut recevoir un halo uniforme ;
- une petite pierre lumineuse et une grande surface émissive peuvent recevoir le même type de traitement ;
- le halo ne connaît pas la puissance lumineuse réelle de l'objet ;
- il ne tient pas compte de la distance entre l'objet et les surfaces voisines ;
- il ne projette pas de lumière colorée sur les objets environnants.
Il s'agit donc d'un effet graphique de contour, pas encore d'une propagation lumineuse.
# Bloom :
## Premier problème : le bloom dépend du contenu RGB de l'objet, mais le projet ne possède pas encore un vrai buffer HDR de luminance.
Dans un moteur de rendu avancé, le bloom est généralement extrait d'une image contenant une plage dynamique étendue. Les valeurs lumineuses peuvent dépasser le blanc conventionnel avant le tone mapping.Ici, le calcul travaille sur les valeurs de couleur SVG et leur luminance. Il ne dispose donc pas d'une véritable plage HDR permettant de différencier proprement une surface simplement blanche d'une source extrêmement intense.

## Deuxième problème : l'intensité n'agit pas comme un simple multiplicateur direct.
L'intensité intervient dans le gain de la matrice. Cela signifie que le bloom commence déjà avec un gain de 3 dès qu'il dépasse le seuil d'activation.
Ce comportement mérite un réglage et une validation visuelle. Il n'est pas évident qu'il fournisse une progression intuitive entre 0,05, 0,3 et 1.

# . Le véritable problème : où ces effets sont-ils branchés ?
C'est probablement ici que se trouve une partie de ton problème.
Composant	Glow / Bloom	Intégration observée
Composant	:Cheveux		Glow / Bloom: Oui	Intégration observée:Filtre appliqué au groupe frontal
Composant	: Peau de la tête Glow / Bloom:	Oui	Intégration observée: Filtre appliqué aux couches de peau
Composant	: Peau du cou	Glow / Bloom: Oui	Intégration observée: Même moteur partagé
Composant	: Iris	Glow / Bloom: Oui	Intégration observée: Filtre appliqué au disque de l'iris
Composant	: Couches internes de l'iris Glow / Bloom:	Oui	Intégration observée : Glow local par couche
Composant	: Pilosité faciale Glow / Bloom:	Pas de filtre général identifié - Intégration observée:	Apparence résolue, mais pas de compileEffects() dans le fichier examiné
Composant	: Corps Glow / Bloom:	Pas de branchement général identifié-Intégration observée:	Reçoit essentiellement base et ombre
Composant	: Matériaux génériques Glow / Bloom:	Émission uniquement	- Intégration observée : Pas de glow/bloom général dans MaterialDescriptor

# Les cheveux : un branchement incomplet
Dans src/render/face/hair.ts, le moteur appelle : const fx = compileEffects(...);
Puis applique le filtre au groupe body de la chevelure.Mais ce groupe ne représente pas tous les calques de cheveux.
Le rendu distingue :
- back : masses et mèches arrière ;- front : coque, racines et mèches frontales ;- over : mèches passant devant les yeux.
Le filtre est appliqué au groupe body contenu dans front.
Les calques back et over ne reçoivent donc pas ce filtre.
Cela peut produire une incohérence : une chevelure peut avoir une aura sur sa masse frontale, mais pas sur les mèches qui passent devant les yeux ou sur certaines parties arrière.
C'est une vraie limite d'intégration, pas une simple question de réglage.
# La marge du halo des cheveux
Autre différence technique :
- la peau utilise effectsReach() pour calculer une boîte suffisamment large ;
- l'œil utilise également effectsReach() ;
- les cheveux utilisent une marge fixe : lm.W * 0.3.
Or effectsReach() estime le débordement en fonction du rayon et de l'intensité du glow/bloom.
Le rayon peut demander jusqu'à environ 56 unités de débordement à l'échelle utilisée par le compilateur. Une marge fixe peut donc être insuffisante selon la taille de la tête et les paramètres.
Le risque : un halo coupé par les limites du filtre.

Correction recommandée : utiliser effectsReach() pour calculer la boîte des cheveux, puis faire en sorte que tous les calques concernés partagent le même traitement.
## 3.3 Les yeux : un bon exemple d'effet local
Le fichier src/render/eye/globe-inner.ts applique les effets sur le disque de l'iris.
C'est une bonne décision : le bloom de l'iris ne doit pas nécessairement affecter la sclère, les paupières ou tout le visage.
Mais le schéma EyeSpec définit appearance à null par défaut.
Donc, même si le moteur sait produire le filtre, un œil qui ne reçoit pas explicitement cette apparence ne déclenche pas le système.
Le projet possède par ailleurs deux autres phénomènes :
- eye.iris.glow : transillumination de l'iris selon la direction de la lumière ;
- IrisLayer.glow : flou lumineux propre à une couche de couleur de l'iris.
Ces effets sont utiles, mais leurs comportements ne sont pas encore pilotés par une grammaire lumineuse commune.
## Émission : une distinction importante
J'ai examiné deux implémentations différentes.
### A. Émission de l'apparence
Dans src/appearance/effects.ts, l'émission est construite comme un voile coloré limité à l'alpha de l'objet.Elle colore donc la surface, mais ne produit pas nécessairement un halo extérieur.
### B. Émission du matériau
Dans src/materials/compile-surface.ts, l'émission possède deux couches :
1. une ellipse avec un dégradé radial derrière la surface ;
2. une teinte émissive appliquée sur la surface.
Le préréglage emissive dans src/materials/presets.ts active cette fonctionnalité avec une intensité de 0,8.
C'est une meilleure base pour produire un objet qui semble rayonner.
Mais il manque encore :
- la propagation de cette lumière sur les objets proches ;
- l'occlusion du rayonnement par les objets intermédiaires ;
- les rebonds colorés ;
- les interactions entre plusieurs sources émissives ;
- la variation de l'effet selon la distance.
Le halo radial actuel est une approximation graphique, pas un véritable champ lumineux.
# Ce que le moteur doit réellement posséder
Je ne recommande pas de simplement augmenter les intensités. Ce serait une correction superficielle.Il faut construire un véritable Light Effects Engine, complémentaire du Lighting Core.
Voici les capacités que je considère nécessaires.
## 6.1 Une grammaire des halos
### Famille	Silhouette glow	
Description :Aura diffuse autour de la forme
### Famille	Inner glow	
Description Lumière diffuse à l'intérieur de la forme
### Famille	Outer glow	
Description Diffusion extérieure
### Famille	Rim glow	
Description Liseré lumineux diffus
### Famille	Core glow	
Description Cœur lumineux intense
### Famille	Radial halo	
Description Halo concentrique
### Famille	Directional halo	
Description Halo étiré dans une direction
### Famille	Volumetric glow	
Description Lumière diffusée dans l'atmosphère
### Famille	Energy aura
Description Aura animée et irrégulière
### Famille	Pulsating glow	
Description Halo qui respire ou pulse
# TRES IMPORTANT 
Il faut aussi permettre de combiner ces familles.
Par exemple Un cristal pourrait avoir un cœur lumineux intense, un halo radial bleu, un contour cyan et des particules lumineuses.
Ou par exemple Un personnage pourrait avoir une aura rouge très douce autour de son corps, avec un rim light plus intense sur les cheveux.
Ce ne sont pas les mêmes traitements.
## 6.2 Bloom à plusieurs échelles
Un seul flou gaussien ne suffit pas.
Je recommande plusieurs couches :
1. Bloom fin : diffusion autour des petites zones brillantes.
2. Bloom moyen : diffusion des grandes zones lumineuses.
3. Bloom large : halo atmosphérique autour des sources puissantes.
4. Halation : diffusion colorée proche des zones très lumineuses.
5. Streaks : rayures lumineuses horizontales ou directionnelles, contrôlées artistiquement.
Le moteur doit pouvoir régler indépendamment les rayons, les intensités, les couleurs, les seuils et les formes de diffusion.
## Le rayonnement doit interagir avec les matériaux
C'est probablement la capacité la plus importante qui manque.
Aujourd'hui, un objet peut avoir un halo sans que les objets autour de lui reçoivent réellement sa lumière.
Le moteur doit pouvoir calculer :
- la lumière colorée projetée sur la peau ;
- les reflets lumineux sur les cheveux ;
- les surfaces éclairées par une épée énergétique ;
- la lumière d'un cristal sur les doigts qui le tiennent ;
- le rayonnement d'une explosion sur les murs ;
- les reflets sur les yeux ;
- les ombres produites par les objets qui bloquent cette lumière.
Il faut donc distinguer trois résultats :
- Rayonnement visible : ce que la caméra voit comme halo.
- Contribution lumineuse : ce que la source ajoute aux autres surfaces.
- Effet atmosphérique : ce que le rayonnement produit dans l'air, la fumée ou les particules.
Un objet peut avoir un glow très visible sans éclairer son environnement. Inversement, une source peut éclairer un environnement sans présenter un énorme halo.
Ces trois phénomènes doivent être indépendants.
## Un moteur de diffusion atmosphérique
Il faudra prévoir :
- rayons lumineux volumétriques ;
- diffusion dans le brouillard ;
- absorption de la lumière ;
- poussière et particules éclairées ;
- fumée traversée par un faisceau ;
- halos dans les nuages ;
- faisceaux découpés par les obstacles ;
- traînées lumineuses ;
- lumière qui se disperse dans les explosions.
Cette couche ne doit pas être confondue avec un simple flou appliqué à une silhouette.

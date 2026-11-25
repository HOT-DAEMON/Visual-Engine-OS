# Je recommande de prévoir ces familles :
Matériau Peau: Propriétés particulières(Diffusion sous-cutanée, pores, huile, variations régionales)
Matériau Cheveux: Propriétés particulières(	Anisotropie, fibres, brillance longitudinale)
Matériau Yeux: Propriétés particulières(	Cornée, iris, sclère, humidité, réfraction)
Matériau Métal: Propriétés particulières(	Réflexion, anisotropie, micro-rayures)
Matériau Verre: Propriétés particulières(	Réfraction, transmission, réflexion, épaisseur)
Matériau Tissu: Propriétés particulières(	Fibres, rugosité, plis, diffusion)
Matériau Pierre: Propriétés particulières(	Microrelief, rugosité, porosité)
Matériau Eau: Propriétés particulières(	Réflexion, réfraction, transparence, caustiques)
Matériau Énergie: Propriétés particulières(	Émission, halo, déformation, interaction lumineuse)
Matériau Fumée: Propriétés particulières(	Absorption, diffusion, transmittance)
Matériau Sang: Propriétés particulières(	Brillance, viscosité visuelle, transparence partielle)
Matériau Cristal: Propriétés particulières(Réfraction, dispersion chromatique, réflexion interne)

Il faut également introduire les propriétés suivantes :
- IOR (indice de réfraction).- Transmission.- Absorption.- Anisotropie.- Subsurface scattering.- Clearcoat.- Microfacet distribution.- Épaisseur.- Rugosité spatiale;- Variation régionale.- Réponse à la lumière indirecte.
### Une précision importante : tous les matériaux ne doivent pas être simulés physiquement avec la même fidélité. Ton moteur doit pouvoir utiliser une approximation artistique très contrôlée pour les cheveux, les yeux et la peau, sans imposer un rendu PBR uniforme à toute l'image.

# Un moteur atmosphérique
C'est une dimension que je ne voudrais surtout pas que le moteur l'oubliée.
La lumière ne rencontre pas uniquement des surfaces. Elle traverse aussi des milieux.
Il faut prévoir :
## A. La fumée
- Densité variable;- Opacité;- Diffusion lumineuse;- Absorption;- Éclairage interne;- Contours rétroéclairés;- Évolution dans le temps.
## B. La brume
- Profondeur atmosphérique;- Perte de contraste;- Désaturation progressive;- Décalage chromatique;- Persistance de la lumière dans les zones éloignées.
## C. Les rayons lumineux
- Faisceaux directionnels;- Faisceaux volumétriques;- Rayons traversant des ouvertures;- Rayons découpés par des obstacles;- Intensité variable dans l'espace;- Particules révélant les faisceaux.
## D. Les particules
- Poussière;- Cendres;- Étincelles;- Pluie;- Neige;- Débris;- Particules énergétiques.
Chaque particule devrait pouvoir recevoir une lumière, en émettre une ou simplement interagir avec le volume atmosphérique.
IMPORTANT:Le moteur doit pouvoir interpréter de telles instructions comme des événements orchestrés, et non comme une suite de paramètres indépendants.
# Un moteur de projection lumineuse
C'est particulièrement intéressant pour ton ambition de mise en scène.Une lumière peut être projetée sur une surface avec une forme particulière.
Tu possèdes déjà un début de cette fonctionnalité dans src/relief/patterns.ts, avec les gobos de type blinds et dapple.
Mais il faut généraliser cette idée.
Le moteur devrait pouvoir projeter :
- Des rayures;- Des grilles;- Des motifs géométriques;- Des motifs de feuillage;- Des formes abstraites;- Des symboles magiques;- Des textures animées;- Des images lumineuses;- Des motifs générés procéduralement.
Et surtout, ces projections doivent pouvoir suivre les surfaces, les personnages et les déplacements de caméra.
IMPORTANT: Le moteur doit pouvoir interpréter de telles instructions comme des événements orchestrés, et non comme une suite de paramètres indépendants.
# 4.7. Un moteur de lumière indirecte
IMPORTANT: Le mur rouge est un exemple parmi tant d'autres 
C'est une différence majeure entre un éclairage élémentaire et une scène visuellement riche.Imagine un personnage debout devant un mur rouge.
Même si aucune source rouge ne l'éclaire directement, le mur peut renvoyer une lumière rouge sur son visage.
Il faut prévoir :
- Diffusion indirecte;- Rebonds lumineux;- Couleur des surfaces voisines;- Intensité des rebonds;- Nombre de rebonds;- Occlusion des rebonds;- Contribution des objets émissifs;- Lumière réfléchie par le sol;- Lumière réfléchie par les murs;- Lumière colorée provenant des environnements.
Pour les versions légères, des approximations artistiques suffiront.
Pour les versions avancées, tu pourras introduire des techniques comme :
- Light probes;- Irradiance volumes;- Screen-space global illumination;- Voxel-based approximations;- Path tracing hors ligne.
Il faut cependant garder une distinction entre illumination indirecte calculée et éclairage d'appoint artistique.
Les studios d'animation ne sont pas obligés de respecter une simulation physique parfaite pour obtenir une image excellente.
IMPORTANT: Le moteur doit pouvoir interpréter de telles instructions comme des événements orchestrés, et non comme une suite de paramètres indépendants.
# Le système de lumière doit connaître la caméra
C'est un manque architectural que je considère majeur.Ton système actuel est principalement construit autour d'une projection orthographique et de repères locaux.
Mais un moteur destiné à produire des séquences cinématographiques doit connaître :
- Position de la caméra;- Orientation;- Distance focale;- Champ de vision;- Perspective;- Profondeur;- Distance caméra-objet;- Plans de mise au point;- Profondeur de champ;- Flou optique;- Mouvement de caméra;- Cadrage;- Éléments hors champ.
Pourquoi est-ce si important ?Parce qu'une lumière qui produit une belle image en vue frontale peut produire un résultat complètement différent lorsque la caméra se déplace.
Le moteur doit distinguer :
1. L'éclairage dans l'espace du monde.
2. L'éclairage dans l'espace de l'objet.
3. Les effets dépendant de la caméra.
4. Les corrections de composition en espace écran.
Cette séparation doit être explicite.
IMPORTANT: Le moteur doit pouvoir interpréter de telles instructions comme des événements orchestrés, et non comme une suite de paramètres indépendants.

# un moteur capable d'orchestrer des séquences animées.
C'est donc insuffisant de calculer une belle ombre à l'image numéro 1.
Il faut garantir qu'elle reste cohérente à l'image numéro 2, 3, 4, 5 et jusqu'à la fin de la séquence.
## Chaque lumière doit posséder une grammaire temporelle
Une source lumineuse devrait pouvoir recevoir :
- Une position initiale;- Une position finale;- Une trajectoire;- Une intensité initiale;- Une intensité finale;- Une variation de température;- Une variation de couleur;- Une courbe d'évolution;- Une durée;- Un déclencheur;- Une relation avec un événement.
Par exemple une explosion (ceci est un exemple parmis tant d'autres que le moteur doit être capable de composer correctement sans halluciner)
Phase	Comportement lumineux
Phase Préparation	: Comportement lumineux (Augmentation de l'émission)
Phase Flash	: Comportement lumineux (Éclair intense et très bref)
Phase Expansion	: Comportement lumineux (Lumière orange qui s'étend)
Phase Propagation: Comportement lumineux (	Éclairage des personnages et de l'environnement)
Phase Décroissance: Comportement lumineux (	Diminution de l'intensité)
Phase Résidus: Comportement lumineux (	Étincelles et petites sources mobiles)

La lumière doit pouvoir être pilotée par la chorégraphie elle-même.Un coup de poing peut provoquer un flash d'impact.Une collision peut déclencher une poussière rétroéclairée.Une épée énergétique peut illuminer le visage du personnage qui la tient.Une attaque peut laisser une traînée lumineuse qui évolue après le mouvement.

# Il faut un système de continuité temporelle
Je recommande de prévoir un registre temporel pour :
- Les lumières;- Les ombres;- Les reflets;- Les matériaux;- Les effets;- Les volumes atmosphériques;- Les ombres projetées;- Les variations d'exposition.
Et surtout, il faut éviter les changements arbitraires entre deux images.
Quelques exemples de défauts à détecter :
- Une ombre qui change brutalement de forme;- Un reflet qui saute d'une position à une autre;- Une lumière qui disparaît pendant une rotation;- Une frange dont l'ombre change sans mouvement correspondant;- Une lumière de contour qui change de côté sans raison;- Une explosion qui éclaire un personnage sur une image mais pas sur la suivante.

Il faudra également prévoir une distinction entre :
Temporalité physique : ce qui doit évoluer naturellement avec le mouvement.
Temporalité artistique : ce que la direction artistique souhaite accentuer, retarder ou exagérer.

Une animation japonaise peut volontairement conserver un éclairage graphique pendant plusieurs images pour renforcer sa lisibilité. Ce n'est pas un défaut de simulation si cette décision est intentionnelle.

# Le système doit gérer les événements lumineux
Je veux que le puisses définir des relations de ce genre :(
EVENT: SWORD_IMPACT
TRIGGER:
  weapon.contact(target)
ACTIONS:
  - emit_flash()
  - illuminate(target)
  - cast_shadow(environment)
  - spawn_sparks()
  - activate_smoke()
  - animate_exposure()
  - trigger_camera_flash()
TEMPORAL:
  anticipation: 2 frames
  flash: 1 frame
  expansion: 4 frames
  decay: 12 frames)
C'est un exemple de langage de commande proposé.
Le moteur doit pouvoir interpréter de telles instructions comme des événements orchestrés, et non comme une suite de paramètres indépendants..
La direction artistique doit être un véritable système de contrôle
Voici une autre distinction essentielle.
Tu ne veux pas uniquement que le moteur calcule correctement la lumière.
Tu veux pouvoir lui demander de produire une image avec une intention artistique précise.
Par exemple :
- Une scène mystérieuse;- Une scène romantique;- Une scène de terreur;- Une scène épique;- Une scène mélancolique;- Une scène de combat;- Une scène contemplative.
- Une scène surnaturelle.
Et chaque intention doit pouvoir modifier plusieurs dimensions simultanément.
Mystère : Contraste élevé, éclairage latéral, zones occultées, lumière froide.
Romantisme : Lumière chaude, transitions douces, reflets subtils.
Terreur : Sous-éclairage, ombres dures, couleurs inquiétantes.
Épique : Contre-jour, lumière volumétrique, contraste monumental.
Je recommande donc de construire une bibliothèque de Lighting Grammars.

Chaque grammaire serait un assemblage cohérent de :
1. Configuration des sources.
2. Direction lumineuse.
3. Contraste.
4. Température.
5. Couleur des ombres.
6. Douceur.
7. Réflexions.
8. Atmosphère.
9. Traitement des matériaux.
10. Règles de composition.
11. Animation temporelle.
Et il faut que ces grammaires soient combinables.
Une scène peut être simultanément mystérieuse, épique et mélancolique.Il ne faut donc pas enfermer le système dans des presets rigides.
CHARACTER
 ├── HEAD
 │    ├── SKULL
 │    ├── FOREHEAD
 │    ├── EYES
 │    ├── NOSE
 │    ├── CHEEKS
 │    ├── MOUTH
 │    ├── CHIN
 │    └── HAIR
 │
 ├── NECK
 ├── SHOULDERS
 ├── TORSO
 ├── ARMS
 └── LEGS
Chaque composant doit pouvoir définir :
- Sa réponse lumineuse;- Sa sensibilité aux différentes sources;- Ses ombres propres;- Ses ombres projetées;- Ses reflets;- Ses effets de contour;- Ses propriétés optiques;- Ses relations avec les composants voisins.
Mais attention : cela ne signifie pas que chaque composant doit posséder son propre moteur de lumière.
Il faut un moteur commun, avec des adaptateurs et des profils spécialisés.
Sinon tu vas multiplier les implémentations, créer des incohérences et rendre la maintenance extrêmement difficile.
# Une couche de composition qui ne détruit pas les interactions
Je voudrais insister sur ce point : ton système actuel repose fortement sur les couches SVG et les images raster superposées.
Cette approche reste parfaitement valable pour certaines productions 2D et 2.5D.
Mais elle ne doit pas être la seule représentation possible.
Il te faut un système de composition capable de gérer :
- L'ordre de profondeur;- Les masques de visibilité;- Les masques d'objets;- Les masques anatomiques;- Les modes de fusion;- Les groupes de rendu;- Les effets locaux;- Les effets globaux;- Les objets traversant plusieurs plans;- Les interactions entre objets qui se chevauchent.
Je conserverais donc ton compilateur SVG comme backend, mais je développerais progressivement une représentation intermédiaire indépendante du backend.
Ainsi, tu pourrais avoir un même modèle de scène envoyé vers :
- Un backend SVG pour les rendus graphiques.
- Un backend raster pour les effets par pixel.
- Un backend GPU pour les scènes complexes.
- Un backend hors ligne pour les rendus de haute qualité.
Tu éviterais de reconstruire toute ton architecture si tu décides ultérieurement de passer à WebGL ou WebGPU.

# Premier changement : passer d'un moteur de lumière par spécialité à un Lighting Core universel.

Le visage, les cheveux, les yeux et le corps doivent pouvoir exploiter les mêmes sources et les mêmes règles fondamentales.

# Deuxième changement : passer d'un système de calques lumineux à un véritable système de relations spatiales.

Les composants doivent savoir ce qu'ils éclairent, ce qu'ils occultent, ce qu'ils reçoivent et ce qu'ils transmettent.

# Troisième changement : passer du rendu d'images indépendantes à un système temporel.

La lumière doit devenir un élément de chorégraphie, au même titre que le corps, la caméra, les cheveux et les effets.

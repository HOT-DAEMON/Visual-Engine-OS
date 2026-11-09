> Début (sections 1 à 3 : décomposition atomique, grammaire géométrique, morphologies) : `docs/TODO-NECK-SYSTEMS.md`. Texte repris tel quel, coupé à la section 4 (règle des 200 lignes).

# 4. Le cou doit être un système de mouvement et de déformation
Un cou statique peut sembler correct, mais se dégrader dès que la tête tourne, s'incline ou s'enfonce dans les épaules. Il faut donc construire un moteur de déformation indépendant du générateur de forme.
## Les mouvements à prendre en charge
### NECK-M01: Flexion / extension
Incliner la tête vers l'avant ou l'arrière ; déformer la face antérieure et la nuque de façon coordonnée.
### NECK-M02 : Inclinaison latérale
Rapprocher une oreille de l'épaule, avec compression d'un côté et étirement de l'autre.
### NECK-M03 : Rotation
Tourner la tête par rapport au thorax, avec redistribution des volumes et glissement des tissus.
### NECK-M04 : Translation
Avancer, reculer ou décaler la tête sans exiger une rotation équivalente.
### NECK-M05: Compression axiale
Raccourcir visuellement le cou, notamment quand la tête descend vers les épaules.
### NECK-M06 : Étirement
Allonger le cou, avec contrôle de la variation de section et des limites de déformation.
### NECK-M07 : Courbure distribuée
Répartir un mouvement sur plusieurs segments plutôt que de créer une seule articulation rigide.
### NECK-M08: Torsion
Faire tourner progressivement les sections du cou le long de son axe.
### NECK-M09 : Mouvement secondaire
Ajouter une inertie contrôlée aux tissus mous, fanons, plumes, fourrure, bijoux ou appendices.
### NECK-M10 : Déformation de contact
Gérer la compression avec le menton, le thorax, les épaules, un vêtement ou un équipement.
# Le bon mécanisme dépend de la morphologie
Un cou humain réaliste ne se déforme pas comme un cou de serpent. Pour le premier, on peut utiliser une chaîne articulée, une enveloppe déformable et des contrôleurs de volumes musculaires. Pour le second, une chaîne de segments ou une courbe centrale avec des sections transversales distribuées est souvent plus adaptée.

Le moteur devrait donc proposer plusieurs stratégies de déformation :
- chaîne de segments articulés ;
- squelette avec enveloppes pondérées ;
- courbe centrale avec sections transversales ;
- déformation par cage ou réseau de contrôle ;
- champs de déformation locaux ;
- combinaison de plusieurs stratégies.
Les stratégies peuvent coexister. Un cou de dragon peut utiliser une chaîne articulée pour le mouvement général, des déformations locales pour les muscles et des règles de réorientation pour ses plaques.

Les contraintes doivent empêcher les inversions de surface, les étirements incontrôlés et les intersections indésirables. Pour les styles fantastiques, ces phénomènes peuvent parfois être autorisés délibérément, mais uniquement comme des choix explicites.
## 5. Le cou participe à l'expression du personnage
C'est un volet qu'il ne faut pas négliger. L'expression ne réside pas uniquement dans le visage : la position de la tête, la tension du cou et la relation avec les épaules modifient considérablement la lecture d'une pose.
Le moteur devrait pouvoir produire des configurations comme :
- Peur ou vigilance : cou rétracté, tête légèrement avancée ou reculée, tension variable selon la pose.
- Fierté ou autorité : tête élevée, axe cervical redressé, posture contrôlée.
- Honte ou abattement : tête abaissée, flexion cervicale, épaules éventuellement remontées.
- Défi : cou tendu, tête projetée ou inclinée, asymétrie posturale.
- Fatigue : tête qui s'affaisse, contrôle postural réduit, inclinaison persistante.
- Curiosité : inclinaison latérale, rotation de la tête et ajustement de la ligne de regard.
- Colère : tension posturale possible, avec variations importantes selon le personnage et le style.
- Détente : posture plus relâchée, mouvements moins rigides.
Ces configurations ne sont pas des vérités psychologiques universelles. Ce sont des conventions expressives que l'artiste doit pouvoir modifier.

## Le moteur doit séparer trois systèmes :
### 1. HeadPoseController : orientation et position de la tête.
### 2. NeckDeformationController : adaptation géométrique du cou à cette pose.
### 3. BodyLanguageController : coordination avec les épaules, le thorax, le regard et le reste du corps.
Cette séparation évite, par exemple, qu'un profil de colère impose systématiquement la même inclinaison du cou à tous les personnages.
## 6. Les déformations caricaturales du cou
C'est ici que ton moteur peut gagner une grande richesse artistique. La caricature ne consiste pas simplement à augmenter la longueur ou la largeur : elle modifie les proportions et les relations entre les volumes.
### Exagération de longueur
Allongement marqué, courbure accentuée et variation contrôlée de la section.
### Exagération de largeur
Cou massif, trapèzes exagérés et transition presque fusionnée avec le torse.
### Compression extrême
Réduction de hauteur, plis accentués et contact entre la tête et les épaules.
### Déformation fantastique
Torsion, courbure et géométrie non conventionnelle, avec des limites adaptées au style.
### Les opérateurs à prévoir
#### Opérateur length_warp
Fonction: Allonger ou raccourcir une région du cou
#### Opérateur width_profile_warp
Fonction: Modifier la largeur selon la hauteur
#### Opérateur depth_profile_warp
Fonction: Modifier indépendamment la profondeur
#### Opérateur centerline_bend
Fonction: Courber l'axe général
#### Opérateur local_bulge
Fonction : Créer une bosse ou un volume local
#### Opérateur local_compression
Fonction: Comprimer une région
#### Opérateur asymmetric_deformation
Fonction: Déformer différemment les deux côtés
#### Opérateur muscle_exaggeration
Fonction:Accentuer les masses musculaires
#### fold_amplification
Fonction: Accentuer les plis sous compression
#### Opérateur silhouette_simplification
Fonction: Réduire les détails pour clarifier la forme
#### Opérateur topology_extension
Fonction: Ajouter des segments, des plaques ou des appendices
#### surface_ripple
Fonction: Ajouter des ondulations ou irrégularités contrôlées

Chaque opérateur doit préciser son domaine d'application, ses limites, ses interactions avec les autres et son ordre d'exécution.
Une transformation de longueur doit pouvoir laisser les détails locaux relativement stables, tandis qu'une compression doit pouvoir déclencher un autre comportement : plis, déplacement des volumes mous ou changement des raccords.
C'est particulièrement important pour la cohérence : la géométrie doit pouvoir réagir à la déformation, plutôt que de se contenter de subir une transformation globale.

# 7. Matériaux, peau et extensions de surface
Le cou est également une excellente épreuve pour l'indépendance entre géométrie et matériaux.
Le même volume pourrait recevoir une peau humaine, des écailles de reptile, une carapace, des plumes, de la fourrure, des plaques métalliques ou une matière fantastique translucide.
Le moteur doit séparer  les couches suivantes :
- Matériau de base : couleur, rugosité, réflexion, transmission, propriétés optiques.
- Microtexture : grain de peau, pores, écailles, reliefs, fibres ou motifs.
- Détails géométriques : rides, plis, crêtes, plaques, épines.
- Distribution : position, orientation, densité, taille, chevauchement et variation.
- Réponse à la déformation : étirement, compression, glissement et changement d'orientation.
- Réponse à l'éclairage : ombres, reflets, relief apparent et transparence éventuelle.
Pour un cou écailleux, par exemple, les écailles ne doivent pas être distribuées comme des points aléatoires dans l'espace. Elles doivent suivre une surface, une direction dominante, des rangées ou un motif défini, tout en adaptant leur taille à la courbure.

Le système de distribution doit permettre plusieurs règles : rangées, spirales, pavages, densité variable, regroupements organiques et placements pilotés par des masques.
Les accessoires doivent rester indépendants du cou. Un collier, une armure cervicale, un foulard ou une crinière peut être attaché à la surface ou à des points d'ancrage, avec ses propres contraintes de collision et de mouvement.
# 8. Le contrat de données du cou
Pour rendre cette architecture exploitable, je définirais des objets de données distincts plutôt qu'une seule classe contenant tous les paramètres.
## NeckComposition
Décrit le cou complet, ses composants, ses parents, ses points d'ancrage et ses relations spatiales.
## NeckMorphology
Définit les dimensions, la section, la courbure, les proportions, l'asymétrie et les limites morphologiques.
## NeckRig
Définit les articulations, les axes, les limites de mouvement et la stratégie de déformation.
## NeckDeformationStack
Définit les opérateurs, leur ordre, leurs intensités, leurs zones d'influence et les contraintes applicables.
## NeckSurfaceProfile
Définit les matériaux, les textures, les motifs, les détails de surface et leur réaction aux déformations.
## NeckAttachmentGraph
Gère les relations avec la tête, le thorax, les épaules, les accessoires et les éléments additionnels.
Cette séparation doit permettre de changer le style sans détruire la morphologie, de changer la pose sans redéfinir tous les muscles, et de remplacer la stratégie de déformation sans réécrire les matériaux.

# 10. Les tests qui permettront de valider le moteur
Le moteur ne validerais pas le système uniquement sur la qualité d'un rendu fixe. 
Voici une liste de tests non exhaustif suivantes.
## Test sur le Changement de longueur
Critère de réussite : Le cou s'allonge sans détruire les ancrages ni la continuité de surface.
## Test sur le Changement de largeur
Critère de réussite : La largeur évolue indépendamment de la profondeur, sauf contrainte explicite.
## Test sur la Rotation de la tête
Critère de réussite: Le cou suit la pose sans rupture visible ni déformation incontrôlée.
## Test sur la Compression extrême
Critère de réussite : Les plis et les volumes réagissent selon la stratégie définie.
## Test sur Transition cou-torse
Critère de réussite: Aucun raccord involontaire ni séparation visible de l'enveloppe.
## Test sur Passage au style caricatural
Critère de réussite : Les proportions changent sans perdre les priorités de silhouette définies.
## Test sur le Remplacement du matériau
Critère de réussite : La géométrie et le rig restent inchangés.
## Test sur la Distribution des écailles
Critère de réussite : Les motifs suivent la surface et réagissent aux déformations.
## Test sur Ajout d'accessoires
Critère de réussite : Les objets attachés suivent les ancrages et respectent les règles de collision.
## Reproductibilité
Critère de réussite : Une même configuration et une même graine produisent le même résultat.
## Cou humain vers cou fantastique
Critère de réussite : Les composants incompatibles sont remplacés ou désactivés explicitement, sans corruption silencieuse du graphe.
## Rendu 2D et 3D
Critère de réussite : Les deux backends respectent les paramètres et les relations du contrat commun.

Il faut aussi tester les cas limites : cou extrêmement court, cou très fin, courbure maximale, raccord presque entièrement comprimé, asymétrie extrême, accessoires qui se croisent et changements de pose successifs.

Certains critères, comme la continuité des ancrages ou l'absence d'inversion géométrique, peuvent être automatisés. D'autres, comme la beauté de la silhouette ou la crédibilité d'une déformation caricaturale, nécessitent une évaluation visuelle.
## 

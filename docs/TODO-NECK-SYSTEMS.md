> **Statut** : implémenté en grande partie — voir `NECK-ENGINE.md` (architecture), `NECK-PROOF.md` (preuve par paramètre) et `NECK-REMAINING.md` (ce qui n'est PAS fait). Ce fichier reste la spécification d'origine, non modifiée.

# Renforcement du moteur des yeux
Le moteur doit être traité comme une veritable chef d'oeuvre d'ingénierie avec la plus grande attention possible.
L'objectif est de créer un véritable système de génération de cou capable de fusionner la précision anatomique, l'exagération caricaturale, la stylisation artistique et l'imagination fantastique, sans perdre la cohérence des volumes, des matières et de l'éclairage par rapport au reste du corps.
# TRES IMPORTANT
L'objectif de ce document n'est pas de detruire le systeme qui est en place mais de l'améliorer drastiquement et de réellement maitriser tous les composants du moteur pour être prêt a répondre a toute éventuellalité a n'importe quel moment et surtout avec une grande précision chirurgical.
Chaque instructions, phrases ou parametre géometrique, anatomique et artistique doit être prit avec toute la plus grande rigeur possible et le plus serieux afin d'atteindre une qualité visuellement artistique mais surtout industrielle..Le moteur doit être traiter pour être facilement maintenable et avec la plus grande précision possible..La qualité visuellement artistique est de grande rigeur..
le cou relie la tête au thorax, porte des structures anatomiques distinctes, transmet les mouvements et participe fortement à la silhouette, à l'expression corporelle et au style artistique.
Le moteur doit pouvoir produire un cou humain réaliste, un cou caricatural très long ou presque inexistant, un cou massif de taureau, un cou élégant de cygne, un cou reptilien, un cou de dragon couvert d'écailles, ou une structure fantastique qui ne correspond à aucune anatomie terrestre connue.
# OBJECTIF
La bonne approche consiste à ne pas considérer le cou comme un simple cylindre entre la tête et le torse.
Il faut le construire comme un système paramétrique de structures anatomiques, de volumes, de surfaces, d'articulations, de déformations et de relations spatiales, capable de fonctionner en 2D comme en 3D.Il doit être capable de gérer clairement l'occlusion du cou, les masques aussi.
## Cou humain anatomique
Le moteur du cou doit être capable de produire Des volumes et des structures différenciés : muscles sternocléidomastoïdiens, trapèzes, région hyoïdienne, larynx, trachée, reliefs de la clavicule et tissus superficiels. Leur visibilité dépend de la morphologie, de la posture et de la corpulence. La rotation 3d du cou doit être branché avec le moteur de rotation de la tête pour garder une cohérance visuelle impéccable
## Cou caricatural
Le moteur de cou doit produire des proportions qui peuvent être exagérées, les volumes simplifiés, les angles amplifiés et les raccords stylisés. La silhouette et la lisibilité priment sur la reproduction exacte de l'anatomie humaine.
## Cou animal et de créature fantastique
Un cou peut devenir serpentin, segmenté, cuirassé, doté de crêtes, de nageoires, de plaques, de membranes ou d'appendices. Ces éléments doivent pouvoir être ajoutés sans réécrire le moteur de base.
## IMPORTANT
le moteur du cou doit être capable de distinguer tres clairement sept systèmes principaux : l'ossature et les articulations, les volumes musculaires, les tissus et organes représentables, la géométrie extérieure, les déformations, les matériaux et les extensions propres aux espèces.
# 1. Décomposer le cou jusqu'au niveau atomique
Le terme « atomique » signifie ici que chaque composant possède une responsabilité précise, des paramètres propres et des relations explicites avec les autres. Il ne signifie pas qu'il faut créer un objet logiciel pour chaque fibre anatomique imaginable.
## A. Structure de support et articulation
### NECK-01 — Support axial
- Vertèbres cervicales et courbure générale de la colonne.
- Région C1–C2 et relation avec la tête.
- Courbure cervicale, inclinaison, torsion et compression.
- Support de la tête et transmission des mouvements vers le thorax.
Dans le moteur générique, cette structure peut être remplacée par une chaîne articulée, une colonne souple ou un assemblage fantastique.
### NECK-02 — Articulations et points d'ancrage
- Jonction tête-cou.
- Jonction cou-thorax.
- Relations avec les épaules et la ceinture scapulaire.
- Axes de rotation, limites de mouvement et zones de transition.
- Repères anatomiques servant à attacher les volumes et la peau.
Ces repères forment le squelette de référence du système, même si la forme extérieure est fortement stylisée.
## B. Muscles et volumes externes
### NECK-03 — Sternocléidomastoïdiens
Deux volumes allongés, avec leurs ancrages, leurs directions, leur courbure, leur épaisseur et leur visibilité. Le moteur doit pouvoir les rendre très subtils, fortement marqués ou volontairement stylisés.
### NECK-04 — Trapèzes et transition postérieure
Forme du raccord entre la nuque, les épaules et le dos ; largeur, pente, masse musculaire, relief et continuité de surface.
### NECK-05 — Région antérieure et tissus superficiels
Platysma, groupes musculaires infra-hyoïdiens, région hyoïdienne et contours antérieurs. Ces éléments influencent notamment la déglutition, la tension visible et les plis de la peau.
## C. Reliefs anatomiques et organes représentables
Le moteur doit aussi pouvoir représenter les reliefs qui se trouvent sous la peau ou qui contribuent à la silhouette.
### Voici les parametres important a absolument implémenté 
### NECK-06A	Larynx et relief thyroïdien
Parametres important à avoir (Position, volume, projection, visibilité, forme stylisée)
### Trachée
Parametres important que le sous composant doit avoir (Axe, diamètre, continuité, relief des anneaux si visibles)
### NECK-06C	Région hyoïdienne
Parametres important que le sous composant doit avoir (Position, mobilité liée à la région de la gorge)
### NECK-06D	Reliefs vasculaires visibles
Parametre important (le Tracé, la profondeur apparente, la visibilité selon la morphologie)
### NECK-06E	Reliefs osseux de la base du cou
Parametre important (Clavicules, fosse sus-sternale, raccords thoraciques)
### NECK-06F	Tissus adipeux et plis
Parametre important (Distribution, épaisseur, compression et chevauchement)
### NECK-06G	Peau et enveloppe externe
Parametre important (Continuité, épaisseur apparente, plis, étirement et glissement)

Tous ces éléments ne doivent pas être obligatoirement visibles. Une morphologie douce, un cou très musclé, une créature à peau épaisse et un cou stylisé minimaliste exigent des configurations différentes.

Le principe essentiel : la structure anatomique, le volume extérieur et les détails de surface restent distincts, mais leurs relations sont contrôlées.
# 2. Construire une véritable grammaire géométrique du cou
Les composants anatomiques ne suffisent pas. Le moteur doit pouvoir générer des formes très différentes à partir de paramètres généraux, puis raffiner la géométrie.
## Le moteur du cou doit séparer la géométrie en quatre niveaux.
### GEO-01 — Volume primaire
Le volume général reliant la tête au torse : hauteur, largeur, profondeur, courbure, inclinaison, taper (réduction progressive de section), torsion et décentrage.
Il peut être cylindrique, conique, trapézoïdal, en sablier, serpentin ou construit à partir d'une succession de volumes.
### GEO-02 — Volumes secondaires
Muscles, tendons visibles, masses graisseuses, reliefs osseux et transitions avec la mâchoire, la nuque, les épaules et le thorax.
Chaque volume possède ses ancrages, sa forme, son épaisseur et son influence sur la surface externe.
### GEO-03 — Reliefs tertiaires
Plis, creux, sillons, bosses, rides, irrégularités et transitions de surface. Ils peuvent être géométriques, sculptés par des champs de déplacement ou représentés par des textures.
### GEO-04 — Éléments additionnels
Écailles, plaques, crêtes, épines, plumes, fourrure, fanons, membranes, bijoux, colliers, collerettes et autres extensions.
Ces éléments sont des composants attachables, distribués selon une grammaire propre à chaque type de structure.
## Les paramètres fondamentaux
Le moteur doit créer plusieurs familles de paramètres plutôt qu'une longue liste de curseurs sans organisation
### Famille Dimensions 
Exemples de parametres a avoir (liste a completer et maitriser): length, width, depth, base_width, top_width
### Famille Profil
Exemples de parametres a avoir (liste a completer et maitriser): taper, flare, waist, curvature, cross_section_shape
### Famille Orientation
Exemples de parametres a avoir  (liste a completer et maitriser): pitch, yaw, roll, axis_offset
### Famille Asymétrie
Exemples de parametre a avoir (Liste a completer et maitriser): left_right_bias, front_back_bias, local_variation
### Famille Musculature
Exemples de parametre a avoir (Liste a completer et a maitriser): muscle_volume, muscle_separation, tendon_visibility
### Famille Graisse et plis
Exemples de parametre a avoir (Liste a completer et a maitriser ): soft_tissue_volume, fold_depth, fold_distribution
### Famille Surface	
Exemples de parametre a avoir (Liste a completer et a maitriser): roughness, microrelief, wrinkle_scale, skin_tension
### Famille Stylisation
Exemples de parametre a avoir (Liste a completer et a maitrsier): exaggeration, simplification, angularity, silhouette_priority

Ces paramètres doivent être indépendants lorsque cela a du sens, mais pas nécessairement libres sans limites. Une valeur de largeur peut être modifiée sans imposer une variation identique de profondeur ; en revanche, certaines transitions anatomiques devront suivre des règles de cohérence.
# 3. Générer des morphologies très différentes sans créer un modèle par forme
Voici une partie du catalogue morphologique que je prévoirais. Il s'agit de familles paramétriques combinables, pas d'une liste fermée.
## Cou long et fin (Plusieurs variantes)
Faible largeur, grande hauteur relative, transitions délicates et muscles peu apparents.
## Cou massif et musclé (Plusieurs variantes)
Largeur importante, trapèzes volumineux, muscles visibles et raccords thoraciques imposants.
## Cou très court (Plusieurs variantes)
Transition comprimée, hauteur réduite et interactions fortes entre tête, mâchoire et épaules.
## Cou allongé et serpentin (Plusieurs variantes)
Courbure importante, chaîne articulée, variation de section et mouvement distribué sur plusieurs segments.
## Cou cuirassé
Surface sous-jacente recouverte de plaques orientées selon la courbure et les mouvements.
## Cou aviaire
Silhouette élégante ou compacte, articulation adaptée, distribution de plumes et transitions spécifiques.
## TRES IMPORTANT
Un profil ne doit pas dicter tous les paramètres. Un cou long peut aussi être massif, musclé, couvert d'écailles ou caricatural. Il faut donc distinguer :
- la morphologie de base : longueur, section, courbure et raccords ;
- la structure anatomique : organisation des composants internes et externes ;
- la couche d'espèce : capacités et contraintes biologiques ou imaginaires ;
- le style : réalisme, caricature, anime, sculpture, peinture, etc. ;
- les modificateurs : âge apparent, posture, masse corporelle, tension et déformations locales.
C'est leur combinaison qui crée la diversité, plutôt que des dizaines de modèles rigides.*

> Suite (sections 4 à 10 : mouvement, expression, déformations caricaturales, matériaux, contrat de données, tests) : `docs/TODO-NECK-SYSTEMS-2.md`.

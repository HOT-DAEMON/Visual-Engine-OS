# Renforcement du moteur des yeux
Le moteur doit être traité comme une veritable chef d'oeuvre d'ingénierie avec la plus grande attention possible
L'objectif est de créer un véritable système de génération occulaire capable de fusionner la précision anatomique, l'exagération caricaturale, la stylisation artistique et l'imagination fantastique, sans perdre la cohérence des volumes, des matières et de l'éclairage.
L'objectif n'est pas de créer une collection de 100 modèles de yeux dessinés à l'avance. C'est de construire une grammaire visuelle qui permette de produire des yeux inédites par composition de structures, de règles anatomiques, de transformations géométriques et de décisions artistiques. Elle doit être étudiée comme un assemblage de surfaces, de cavités, de replis, de transitions cutanées, de variations d'épaisseur, de visibilité et d'occlusions par les cheveux, ou autres objet.
# TRES IMPORTANT
L'objectif de ce document n'est pas de detruire le systeme qui est en place mais de l'améliorer drastiquement et de réellement maitriser tous les composants du moteur pour être prêt a répondre a toute éventuellalité a n'importe quel moment et surtout avec une grande précision chirurgical.Chaque instructions, phrases ou parametre géometrique, anatomique et artistique doit être prit avec toute la plus grande rigeur possible et le plus serieux afin d'atteindre une qualité visuellement artistique mais surtout industrielle..Le moteur doit être traiter pour être facilement maintenable et avec la plus grande précision possible..La qualité visuellement artistique est de grande rigeur!
# Les 9 domaines du système occulaire
Vérifier rigoureusement que les composants ou micro composant de ses domaines sont bien défini ou explorer completement avant d'ajouter, de mettre a jour ou d'améliorer le moteur par leur ajouts.Cette regle est la même pour tous les taches qui seront ajouté dans ce document
## 01 — Enveloppe palpébrale
Forme de l'ouverture, paupières supérieure et inférieure, plis, canthi, épaisseur des bords, occlusion et raccord avec le visage.Ajouter de la brillance et de l'humidité naturel a la sclere des yeux (le blanc de l'oeil
## 02 — Globe oculaire et surface
Globe, sclère, limbe, cornée, courbure, volume apparent, projection et visibilité à travers l'ouverture palpébrale.
## 03 — Iris
Anneaux, fibres radiales, cryptes, collarette, stries, pigmentation, dégradés et motifs structurés.
## 04 — Pupille et réponse lumineuse
Forme, taille, contour, dilatation, contraction et comportement selon l'espèce ou le style.
## 05 — Optique et reflets
Cornée, réfraction, réflexion, profondeur apparente, transparence, transmission et reflets spéculaires.
## 06 — Cils et bord palpébral
Racines, densité, longueur, courbure, direction, regroupements, épaisseur et stylisation.
## 07 — Microanatomie
Vaisseaux de la sclère, caroncule lacrymale, petits plis, textures, variations pigmentaires et détails de surface.
## 08 — Expression et mouvement
Regard, rotation, clignement, plissement, tension des paupières, asymétrie expressive et coordination avec les sourcils.
## 09 — Extensions artistiques et non humaines
Iris fractal, pupilles multiples, anneaux lumineux, structures cristallines, membranes, motifs magiques et caractéristiques d'espèces inédites.
# IMPORTANT
Il faut toutefois distinguer ce qui est réellement anatomique de ce qui est un effet artistique. Par exemple, un reflet blanc sur la cornée est une conséquence de l'éclairage et de l'environnement, tandis qu'un anneau lumineux interne peut être une propriété fictive de l'œil.
Cette distinction empêchera le moteur de mélanger arbitrairement les causes physiques et les effets visuels.

# DECOMPOSITION ANATOMIQUE REELLEMENT MAITRISABLE
Grace a cette décomposition atomique, le moteur pour maitriser le passage de oeil caricatural a oeil veritablement réaliste extremement détaillé..
La décomposition doit aller plus loin que « paupière, iris, pupille ». Chaque structure doit pouvoir être subdivisée lorsque cela apporte un contrôle artistique ou géométrique réel..
## Niveau 0 — Œil complet : composant réutilisable dans un visage.
## Niveau 1 — Sous-systèmes : enveloppe, globe, iris, optique, cils, expression.
## Niveau 2 — Structures anatomiques : hélix absent ici, mais limbe, collarette, canthi, plis, etc.
## Niveau 3 — Primitives de construction : courbes, surfaces, anneaux, champs de déformation, masques et motifs.
## Niveau 4 — Paramètres de rendu : couleur, rugosité, émission, transparence, contour, contraste et intensité lumineuse.

Il ne faut pas nécessairement créer un fichier ou un objet pour chaque atome. L'atomicité signifie que chaque unité possède un rôle identifiable et un contrôle explicite, pas que l'architecture doit contenir des milliers de classes.

## 2.1. Groupe EYE-01 — Enveloppe palpébrale et silhouette
### EYE-01A	Ouverture palpébrale
Voici les controles a exposé (Largeur, hauteur, inclinaison, courbure, asymétrie)
### EYE-01B	Paupière supérieure
Voici les controles a exposé et a traité : Visibilité,Épaisseur, descente, bombement, tension, courbure
### Paupière inférieure
Voici les controles a exposé et a traité : Visibilité, Épaisseur, courbure, tension, gonflement
### Bord palpébral supérieur
Voici les controles a exposé et a traité : Visibilité, Profil, épaisseur, continuité, netteté
### Bord palpébral inférieur
Voici les controles a exposé et a traité: Visibilité, Profil, épaisseur, contraste, transition
### Pli palpébral supérieur
Voici les controles a exposé et a traité: Visibilité, Profondeur, hauteur, longueur, continuité
### Pli inférieur
Voici les controles a exposé et a traité: Visibilité, courbure, douceur, segmentation
### Enveloppe cutanée périoculaire
Voici les controles a exposé et a traité : Visibilité, Volume, transitions, plis, raccords
### Épicanthus
Voici les controles a exposé et a traité : Présence, extension, courbure, recouvrement
### Tension des paupières
Voici les controles a exposé et a traité : Contraction, relâchement, compression
### Sillons et plis secondaires
Voici les controles a exposé et a traité : Profondeur, densité, longueur, irrégularité
# IMPORTANT
Ces parametres serviront également pour le volet expression des emotions sur le visage pour facilement les montré sans halluciné
L'ouverture palpébrale doit être définie par des courbes paramétriques plutôt que par une simple image de référence figée.
Je recommande de commencer avec quatre repères principaux : canthus interne, canthus externe, point supérieur de la paupière et point inférieur. Des points de contrôle supplémentaires permettent ensuite de modifier la courbure sans déformer toute la silhouette.

Une ouverture peut alors devenir :
- très étroite et anguleuse ;
- large et arrondie ;
- inclinée vers le haut ;
- inclinée vers le bas ;
- presque rectangulaire dans un style graphique ;
- hexagone rectangulaire tres stylisé.
- irrégulière pour une créature fantastique.

La règle fondamentale : la silhouette doit être pilotée par un système de courbes, et non par une collection de contours prédessinés.
## 2.2. Groupe EYE-02 — Canthi, raccords et structures périphériques
Les canthi sont les zones où les paupières supérieure et inférieure se rejoignent.
### EYE-02A	Canthus interne
Voici les parametres a exposé et a traité :Visibilité,Position, angle, profondeur, forme
### EYE-02B	Canthus externe
Voici les parametres a exposé et a traité:Visibilité, Position, orientation, tension
### EYE-02C Caroncule lacrymale
Voici les parametres a exposé et a traité: Visibilité,Volume, visibilité, coloration, relief
### EYE-02D Plica semilunaris
Voici les parametres a exposé et a traité:Visibilité, Présence, courbure, extension
### EYE-02E	Raccord paupière-joue
Voici les parametres a exposé et a traité : Visibilité,Transition, volume, pli, ombre
### EYE-02F	Raccord paupière-sourcil
Voici les parametres a exposé et a traité: Visibilité, Distance, volume, séparation
### EYE-02G	Bord lacrymal
Voici les parametres a exposé et a traité: Visibilité, Relief, humidité apparente, reflets

Ces structures sont particulièrement importantes pour le réalisme rapproché. Une ouverture oculaire convaincante peut devenir artificielle si ses extrémités se terminent en pointes géométriques sans raccord anatomique.

Pour une stylisation caricaturale, on pourra volontairement simplifier la caroncule ou accentuer les canthi. Mais cette simplification doit être un choix de style explicite, pas une conséquence accidentelle d'un maillage insuffisant.

## 2.3. Groupe EYE-03 — Globe oculaire et sclère
Le globe oculaire doit être une structure volumétrique, distincte de son ouverture visible.
### EYE-03A	Globe
Voici les controles a exposé et a traité: Rayon, rapports d'axes, orientation
### EYE-03B	Sclère
Voici les controles a exposé et a traité: Teinte, rugosité, relief, vascularisation
### EYE-03C	Limbe
Voici les controles a exposé et a traité: Largeur, contraste, netteté, transition
### EYE-03D	Cornée
Voici les controles a exposé et a traité: Courbure, épaisseur, indice optique
### EYE-03E	Surface antérieure
Voici les controles a exposé et a traité: Brillance, reflets, état de surface
### EYE-03F	Zone de transition cornéosclérale
Voici les controles a exposé et a traité: Continuité, relief, variation optique,
### EYE-03G	Volume apparent
Voici les controles a exposé et a traité: Projection, profondeur, position relative
### EYE-03H	Occlusion par les paupières
Voici les controles a exposé et a traité: Masque, profondeur, intersection contrôlée

Il faut absolument éviter de confondre trois choses :
1. La forme du globe.
2. La portion du globe visible à travers les paupières.
3. La projection de cette portion sur l'image.
Un œil peut paraître très allongé simplement parce que son ouverture est étroite. Cela ne signifie pas que le globe doit lui-même devenir un ellipsoïde extrêmement allongé.

Le moteur doit donc conserver une séparation entre le volume oculaire et le masque palpébral.

## 2.4. Groupe EYE-04 — Iris : une architecture interne complète
C'est probablement l'une des parties où le moteur peut gagner le plus en richesse visuelle.
L'iris ne devrait jamais être modélisé comme un disque uniformément coloré. Il faut le traiter comme un système de motifs superposés, avec une structure radiale et des variations locales.
### EYE-04A	Région pupillaire
Transition entre la pupille et l'iris
### EYE-04B	Collarette
Anneau de transition interne
### EYE-04C	Fibres radiales
Stries orientées du centre vers la périphérie
### EYE-04D	Cryptes et lacunes
Variations locales de densité et de relief
### EYE-04E	Anneaux concentriques
Structure circulaire et variations pigmentaires
### EYE-04F	Région périphérique
Densité, teinte et contraste proches du limbe
### EYE-04G	Anneau limbique
Bord externe plus ou moins prononcé
### EYE-04H	Pigmentation primaire
Couleur dominante et distribution
### EYE-04I	Pigmentation secondaire
Zones de couleurs supplémentaires
### EYE-04J	Stries et taches
Motifs irréguliers et détails locaux
### EYE-04K	Relief stromal
Microrelief et variations de normales
### EYE-04L	Asymétrie du ou des motif(s)
Irrégularité contrôlée et identité unique
### EYE-04M	Masques de couleur
Zones de remplissage partiel et transitions
### EYE-04N	Fibres secondaires
Ramifications et stries fines
### EYE-04O	Variations de densité
Concentration, espacement et intensité des motifs

Le point déterminant : la couleur n'est pas un seul paramètre
Tu dois pouvoir définir, par exemple :
- un iris bleu avec un anneau doré autour de la pupille ;
- un iris vert avec des fibres brunes ;
- un iris gris avec une zone turquoise dans la moitié supérieure ;
- un iris rouge dont les fibres sont presque noires ;
- un iris fantastique avec plusieurs anneaux lumineux.

Chaque couche de couleur doit pouvoir posséder sa propre géométrie de masque, son gradient, son opacité, son orientation et son comportement optique.
Une structure de données de couleur devrait donc pouvoir exprimer :
- couleur de base ;
- couleurs additionnelles ;
- gradient radial ;
- gradient angulaire ;
- remplissage supérieur, inférieur, gauche, droite ou central ;
- zones localisées ;
- opacités  et transitions ;
- Dégradées d'opacité;
- Glow, bloom, halo;
- superposition et mode de mélange.
Un gradient angulaire permet notamment de produire un iris dont le bleu se trouve dans la partie supérieure et le doré dans la partie inférieure, sans peindre manuellement une texture complète.

Les motifs doivent être générés à partir d'une graine aléatoire reproductible. Deux yeux peuvent partager une palette et une morphologie sans avoir des fibres strictement identiques.
- superposition et mode de mélange.
Suite du document dans TODO-EYES-SYSTEMS-2.md

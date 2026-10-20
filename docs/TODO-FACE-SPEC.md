# Cahier des charges — nez, mâchoire, menton, tissus mous, bouche, joues, cou, déformations, stylisation (copie fidèle)

Texte copié tel quel de la demande du 2026-10-20 (aucune reformulation). L'état d'avancement de chaque exigence est dans `docs/TODO-FACE.md` (tâches T1…T16)
et dans `docs/FACE-STRUCTURE-STATUS.md` (fait / reste à faire, par composant).

## A. Nez

Le nez doit être construit comme un volume continu composé de régions anatomiques distinctes, et non comme une arête lumineuse, une pointe et deux narines réunies.
Il faut distinguer au minimum :
- La racine du nez, entre les yeux,
- Le dorsum, ou arête nasale,
- Les parois latérales du nez,
- La pointe nasale,
- Les dômes des cartilages alaires,
- Les ailes du nez,
- Les sillons alaires,
- La base du nez,
- Les narines, avec leur ouverture et leurs bords,
- La columelle, entre les deux narines,
- Les transitions vers les joues,
- Les transitions vers le philtrum et la lèvre supérieure.

La correction n'est pas simplement d'augmenter sa taille. Il faut dissocier la longueur, la largeur, la projection, la hauteur de la racine, la forme de la pointe,
l'ouverture des narines et la largeur de la base, tout en conservant des contraintes anatomiques.

## B. Mâchoire

Au niveau de la mâchoire, il manque une distinction claire entre :
- le corps horizontal de la mandibule ;
- l'angle mandibulaire ;
- la branche montante ;
- la transition vers les régions préauriculaires ;
- le bord inférieur de la mâchoire ;
- la projection du menton ;
- le volume des joues qui recouvre la structure osseuse.

Un visage peut avoir une mâchoire large, étroite, carrée ou effilée. Mais cette variation doit modifier les plans, les ombres et la silhouette de manière cohérente.

## C. Mandibule

Le moteur doit permettre : modifier la largeur, la hauteur, l'angle, la courbure du corps mandibulaire, la profondeur et la forme générale de cette structure
sans déformer automatiquement tout le crâne.

## D. Menton

Le moteur doit contrôler séparément :
- largeur de la région mentonnière ;
- hauteur du menton ;
- projection vers l'avant ;
- rondeur, aplatissement ou forme carrée ;
- largeur et profondeur de la symphyse ;
- présence d'une fossette ou d'un sillon mentonnier ;
- transition supérieure vers le sillon labio-mentonnier ;
- raccord latéral avec les parties antérieures des joues ;
- transition inférieure vers la région sous-mentonnière.

## E. Tissus mous

Les tissus mous : ce qui donne l'impression de chair. Ils décrivent la silhouette visible des tissus qui recouvrent les structures profondes.
Dans ton moteur, il faut distinguer :
- le volume des joues ;
- le relief du muscle masséter, situé sur les côtés de la mandibule ;
- les tissus sous-mentonniers ;
- les tissus entourant les lèvres ;
- les transitions vers les régions préauriculaires et le cou.

Une mâchoire large peut provenir d'une mandibule large, de masséters développés, de tissus adipeux plus abondants ou d'une combinaison de ces éléments.
Il faut donc éviter un unique paramètre « largeur de mâchoire ». Ce paramètre devrait être décomposé en largeur osseuse, volume musculaire,
épaisseur des tissus mous et silhouette extérieure.

## F. Bouche

La bouche — une structure indépendante qui doit s'adapter au visage. Géométrie + articulation.
La bouche est large et asymétrique. La ligne qui la dessine remonte d'un côté et suit une courbe irrégulière. L'ouverture visible est stylisée,
et les limites des lèvres sont intégrées au dessin de la joue et du menton.
Les éléments à individualiser sont :
- lèvre supérieure et lèvre inférieure ;
- arc de Cupidon et tubercule médian ;
- commissure droite et commissure gauche ;
- ouverture buccale et cavité intérieure ;
- dents supérieures et inférieures ;
- gencives et langue, si visibles ;
- volume des lèvres ;
- largeur de la bouche ;
- courbure de la ligne de fermeture ;
- asymétrie de l'expression ;
- plis et déformations des tissus autour des commissures.

La bouche doit pouvoir être large sur une mâchoire carrée, étroite sur un menton proéminent ou adaptée à une caricature extrême.

## G. Joues, sillons, cou

Le moteur doit contrôler la projection des pommettes, le volume des joues, la largeur des régions latérales, le creux sous les pommettes et la transition vers les masséters.
Il faut également prévoir les sillons nasogéniens, les plis autour de la bouche et les déformations des joues pendant les expressions.
Ces détails ne doivent pas être de simples lignes collées sur la peau : ils doivent pouvoir correspondre à une déformation des tissus.
Le moteur doit gérer l'angle cervico-mentonnier, la largeur du cou, l'épaisseur des tissus sous la mandibule, la transition vers les muscles du cou
et la déformation pendant l'ouverture de la bouche ou l'inclinaison de la tête.
Un menton très projeté ne doit pas automatiquement agrandir le cou. La relation entre ces deux régions doit être contrôlée par des paramètres distincts.

## H. Déformation, raccords, stylisation

- Déformation : étirement, compression, glissement des tissus, plis, maintien du volume.
- Raccords : continuité des surfaces, transition menton–joues, mandibule–cou, lèvres–peau.
- Stylisation : exagération des proportions, angularité, simplification des volumes, asymétrie contrôlée.

Mais il manque encore une catégorie essentielle : les dépendances entre paramètres.
Par exemple, lorsque la projection du menton augmente, le moteur doit recalculer les raccords avec les joues et la région sous-mentonnière.
Il ne doit pas nécessairement allonger la mandibule entière.
Lorsque la bouche s'ouvre, la mandibule pivote et peut se translater. Les dents inférieures suivent cette transformation, tandis que les tissus mous se déforment.
La lèvre inférieure ne doit pas simplement descendre verticalement indépendamment de la mâchoire.

## I. Trois types de déformation

Le moteur doit aussi séparer trois types de déformation.
- A. Déformation morphologique : elle modifie la forme de base : mâchoire carrée, menton large, menton fuyant, mandibule étroite, menton proéminent, etc. Elle intervient lors de la génération du personnage.
- B. Déformation articulatoire : elle modifie la position de la mandibule pendant l'ouverture, la fermeture, la mastication ou certaines poses. Elle nécessite une articulation, des transformations cohérentes et des déformations des tissus associés.
- C. Déformation expressive : elle modifie les lèvres, les joues, le menton et les plis lors d'un sourire, d'une grimace, d'une colère ou d'une expression caricaturale. Elle doit pouvoir se combiner avec la morphologie et l'articulation sans les écraser.

Ces trois catégories doivent pouvoir se combiner. Un personnage à la mâchoire massive doit pouvoir sourire, parler ou grimacer sans perdre sa morphologie caractéristique.

## J. Profil de stylisation

Le système doit disposer d'un profil de stylisation qui peut amplifier certains traits sans détruire les relations essentielles entre les composants.
Je prévoirais des contrôles tels que :
- exagération de la projection du menton ;
- exagération de la largeur mandibulaire ;
- angularité du contour ;
- contraste entre la largeur de la mâchoire et celle du cou ;
- taille relative de la bouche ;
- asymétrie des commissures ;
- simplification des transitions de surface ;
- intensité des contours dessinés ;
- niveau de détail anatomique conservé malgré l'exagération.

Ce profil ne doit pas être confondu avec le matériau ou l'éclairage. Une même géométrie caricaturale peut recevoir un rendu en encrage noir et blanc,
un rendu 3D réaliste ou un rendu anime, sans que son anatomie soit reconstruite à chaque fois.

## K. Consignes de réalisation

- Définir les contrats de composants développés ; code à jour (technologies et techniques actuelles), documenté ligne par ligne.
- Une fois terminé : dossier `artefacts` avec les preuves visuelles (images).
- Actualiser les fichiers de docs ou en créer des suites quand leurs lignes dépassent 200 lignes.
- Morceler chaque phrase des consignes et la traiter avec le plus grand soin.
- Documenter toutes les tâches non faites ou restant à faire, pour chaque composant demandé.
- Liberté artistique ; cohérence, sans bricolage ni hallucination.
- Ajouter une couche de vérification de rendu : cohérence géométrique, cohérence anatomique, style artistique.

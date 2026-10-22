# A faire par composant (moteur de l'oreille)
Le moteur doit être traité comme une veritable chef d'oeuvre d'ingénierie avec la plus grande attention possible
L'objectif est de créer un véritable système de génération auriculaire capable de fusionner la précision anatomique, l'exagération caricaturale, la stylisation artistique et l'imagination fantastique, sans perdre la cohérence des volumes, des matières et de l'éclairage.
L'objectif n'est pas de créer une collection de 100 modèles d'oreilles dessinés à l'avance. C'est de construire une grammaire visuelle qui permette de produire des oreilles inédites par composition de structures, de règles anatomiques, de transformations géométriques et de décisions artistiques.Elle doit être étudiée comme un assemblage de surfaces, de cavités, de replis, de transitions cutanées, de variations d'épaisseur, de bijoux et d'occlusions par les cheveux.
# TRES IMPORTANT
l'oreille doit être traitée comme un sous-système anatomique de premier ordre, avec ses propres repères, sa géométrie, ses contraintes, ses matériaux et ses tests. Mais la véritable qualité ne viendra pas du nombre de paramètres : elle viendra de la façon dont ces paramètres reconstruisent une anatomie cohérente sous différents angles de caméra et différents éclairages.
## 1. Le principe fondamental : l'oreille comme sculpture paramétrique
Le moteur devrait pouvoir les générer avec le même socle structurel, sans imposer la même anatomie à toutes.Il y a six dimensions d'exploration du moteur 

### 1.1 Anatomie
Les structures qui constituent l'oreille : hélix, anthélix, conque, tragus, antitragus, lobule, conduit auditif et leurs transitions.
### 1.2 Géométrie
Les courbes, surfaces, volumes, épaisseurs, creux, pointes, torsions, déformations et raccords entre les structures.
### 1.3 Matériaux
Peau, cartilage translucide, peau écailleuse, membrane, céramique, cristal ou matières fantastiques hybrides.
### 1.4 Éclairage et rendu
Diffusion sous-surface, ombres de contact, reflets, translucidité, contours lumineux et lisibilité des cavités.
### 1.5 Grammaire artistique
Exagération, simplification, asymétrie, contours graphiques, transitions douces ou anguleuses, proportions expressives.
### 1.6 Identité et espèce
Humain, animal, elfe, dragon, alien ou espèce originale définie par une nouvelle combinaison de structures et de contraintes.

    Le point décisif : ces six dimensions doivent communiquer entre elles, mais ne doivent pas être fusionnées dans un unique modèle monolithique.
    Par exemple, modifier le style d'une oreille humaine en style anime ne devrait pas nécessiter de reconstruire toute sa géométrie. Et transformer une oreille  d'elfe en oreille de créature reptilienne ne devrait pas obliger le moteur à réécrire le système de matériaux.

## Priorité d'implémentation
1. Construire la silhouette externe et l'attache au crâne.
2. Ajouter l'hélix, l'anthélix, la scapha et la conque.
3. Construire les branches de l'anthélix, le tragus, l'antitragus et le lobule.
4. Vérifier l'épaisseur, les transitions et les ombres.
5. Ajouter les variations morphologiques et l'asymétrie.
6. Ajouter les points d'attache des bijoux et les règles d'occultation des cheveux.
7. Valider les quatre vues avant de générer des centaines de variantes.
## Implémenter une Grammaire morphologique universelle
Tu ne construirais pas une branche « oreille humaine », une branche « oreille animale » et une branche « oreille fantastique » totalement séparées.
Tu construira un Ear Morphology Engine, capable de combiner plusieurs familles de formes au sein d'un même graphe anatomique.
## Ear Morphology Engine (Système central de génération auriculaire

### A. Morphologie
Silhouette, courbes, volumes, creux, lobule, pointes.
### B. Anatomie
Structures, relations, attaches, continuité et épaisseur.
### C. Style
Réalisme,anime
### Graphe de géométrie contraint
Fusion des structures · résolution des contraintes · génération des surfaces..
Le système doit distinguer trois notions souvent confondues :
- La structure : quelles parties existent et comment elles se raccordent.
- La morphologie : quelle forme ces parties prennent.
- Le style : comment cette forme est interprétée visuellement.
Une oreille caricaturale peut conserver la structure générale d'une oreille humaine tout en possédant un lobule gigantesque, un hélix épais et une conque simplifiée. Une oreille fantastique peut remplacer certaines structures, en ajouter d'autres ou modifier leurs relations.

C'est ce modèle qui rend la combinaison extensible.
## Anatomie atomique de l'oreille externe

### EAR-01 — Hélix (helix)

Le rebord externe qui dessine une grande partie du contour de l'oreille. Il commence près de la région supérieure, se courbe autour du bord et descend vers la partie inférieure.
Paramètres a prendre en compte : hauteur, largeur, courbure, épaisseur du rebord, projection, torsion, continuité et asymétrie.
### EAR-02 — Anthélix (antihelix)
Le relief interne qui se trouve à l'intérieur de l'hélix. Il remonte et se divise généralement en deux branches dans sa partie supérieure.
Paramètres a prendre en compte: hauteur, épaisseur, relief, courbure, position, séparation des branches et profondeur des sillons voisins.
### EAR-03 — Scapha (scapha)
La dépression allongée comprise entre l'hélix et l'anthélix. Elle crée un intervalle qui sépare visuellement les deux reliefs.
Paramètres : largeur, profondeur, longueur, courbure, dégradé d'ombre et continuité du creux.
### EAR-04 — Fosse triangulaire (triangular fossa)
Petite dépression située entre les deux branches supérieures de l'anthélix. Sa forme dépend de la séparation et de l'orientation de ces branches.
Paramètres a prendre en compte : ouverture, profondeur, largeur, orientation, courbure des bords et forme de la base.
### EAR-05 — Conque (concha)
La grande cavité centrale qui conduit visuellement vers l'entrée du conduit auditif. Elle possède une partie supérieure, la cymba conchae, et une partie inférieure plus large, le cavum conchae.
Paramètres a prendre en compte : profondeur, largeur, volume, inclinaison, forme des parois, transition entre les deux parties et ombrage interne.

### EAR-06 — Tragus, antitragus et incisure intertragique

Le tragus est la petite saillie située en avant de l'entrée du conduit. L'antitragus lui fait face depuis la partie inférieure de l'oreille. Entre eux se trouve l'incisure intertragique.
Paramètres a prendre en compte : taille, épaisseur, projection, orientation, forme de la pointe, profondeur de l'incisure et séparation des deux reliefs.
### EAR-07 — Lobule (lobule)
La partie inférieure charnue, généralement dépourvue de cartilage. Elle peut être attachée à la joue ou plus libre et pendante.
Paramètres a prendre en compte : longueur, largeur, épaisseur, volume, attache, pendance, asymétrie et déformation sous le poids d'un bijou.

### EAR-08 — Extensions morphologiques
parametre a prendre en compte : - terminal_tip;- secondary_ridge;- branching_ridge;- membrane_panel;- ornamental_growth; - bioluminescent_channel
Fonction : ajouter des caractéristiques animales ou fantastiques sans réécrire le noyau.

#### 2.1. Les branches de l'anthélix
L'anthélix n'est pas un simple trait en forme de Y.
Il faut distinguer :
- EAR-02A — Branche supérieure : relief dirigé vers la partie haute de l'oreille.
- EAR-02B — Branche inférieure : relief orienté vers la région antérieure.
- EAR-02C — Corps de l'anthélix : partie commune aux deux branches.
- EAR-02D — Jonction des branches : transition volumétrique qui évite un raccord artificiel.
- EAR-02E — Sillons périphériques : creux qui séparent l'anthélix de l'hélix et de la conque.
Les deux branches ne doivent pas nécessairement être symétriques. Leur angle de séparation, leur longueur et leur relief modifient fortement l'identité visuelle de l'oreille.
#### 2.2. Les deux parties de la conque
La conque mérite une géométrie distincte de celle des replis qui l'entourent.
- EAR-05A — Cymba conchae : cavité supérieure, plus étroite.
- EAR-05B — Cavum conchae : cavité inférieure, plus large.
- EAR-05C — Paroi antérieure : transition vers le tragus et la région du conduit.
- EAR-05D — Paroi postérieure : raccord avec les reliefs de l'anthélix.
- EAR-05E — Fond de cavité : zone d'ombrage qui donne de la profondeur.
- EAR-05F — Ouverture du conduit auditif : entrée sombre, dont la géométrie doit être distincte de la simple coloration de la conque.
La cavité ne doit pas être modélisée comme un cercle noir peint sur une surface plate. En 3D, son bord doit masquer une partie du fond, et l'éclairage doit renforcer la perception de profondeur.

### 2.3. Le crus de l'hélix
La racine de l'hélix, appelée crus of helix, est le relief qui part de l'hélix et traverse la conque, séparant partiellement ses régions supérieure et inférieure.
Elle nécessite ses propres paramètres :
- point d'origine ;
- direction ;
- largeur ;
- hauteur ;
- épaisseur ;
- raccord avec l'hélix ;
- intersection visuelle avec la conque.
C'est une structure souvent omise dans les modèles simplifiés, alors qu'elle contribue à la complexité de la cavité auriculaire.
### Une règle importante
Une structure atomique doit être définie par son rôle, ses interfaces et ses contraintes, pas seulement par son nom.

Par exemple, secondary_ridge pourrait être :
- une crête cartilagineuse chez une créature organique ;
- une arête osseuse chez un monstre ;
- un relief décoratif sur une oreille stylisée ;
- une nervure lumineuse dans une oreille extraterrestre.
Le moteur réutilise le mécanisme de construction de la crête, mais adapte son matériau, son raccord et ses contraintes.

> Suite : `docs/TODO EAR SYSTEM-2.md` (sections 3 à 10, découpage sans modification du texte).

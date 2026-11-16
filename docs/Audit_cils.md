# Les limites de l'extraction
Il y a cependant plusieurs problèmes.
## Premier problème : la couverture des références.
Le script spécialisé utilise seulement les planches 12, 13, 14, 15 et 16. Les références 01 à 11 et 17 ne participent donc pas à cette extraction des cils.
Cela ne signifie pas qu'elles ne sont pas exploitées par les autres scripts d'analyse des yeux. Mais leur contribution au moteur de cils n'est pas établie par ce pipeline.
## Deuxième problème : la segmentation est heuristique.

Le script utilise notamment :- un seuil de luminance ;- des opérations morphologiques ;- des composantes connexes ;- des dimensions minimales ;- des distances à la masse principale ;- une squelettisation ;- des chemins reconstruits sur les squelettes.
Ces méthodes sont pertinentes pour une première extraction, mais elles ne garantissent pas que chaque élément détecté soit réellement un cil.
Par exemple, une masse noire peut correspondre à :
- un cil ;- une partie du liner ;- un pli de paupière ;- une jonction de plusieurs traits ;- une zone d'encre fusionnée.
Le code peut donc extraire une géométrie plausible sans que son interprétation anatomique soit correcte.

### Troisième problème : certaines décisions sont codées à la main.
Les cellules des planches 14 et 15 sont définies par des coordonnées fixes. L'orientation de certaines références est également corrigée par des ancres visuelles explicites.C'est acceptable pour constituer un corpus contrôlé, mais il faut enregistrer ces corrections comme des annotations humaines, et non comme des mesures automatiques.
Verdict sur l'extraction : bonne base de vision par ordinateur classique, mais il manque une couche de confiance par observation. Chaque cil devrait pouvoir être marqué comme fiable, ambigu, fusionné ou rejeté, avec une image superposant la détection à la référence originale.

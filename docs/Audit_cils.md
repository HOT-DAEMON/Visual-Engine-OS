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
# 3. Audit des données : un problème concret de synchronisation
J'ai comparé les deux fichiers :
- references/eyes/measures-lashes.json
- references/eyes/lash-families.json
Le script cluster_lashes.py conserve tous les yeux ayant au moins deux traits supérieurs. En appliquant cette règle aux mesures actuellement présentes, on obtient 49 yeux éligibles.Pourtant, lash-families.json ne contient que 27 lignes.
Il contient aussi l'identifiant 12-11, qui n'existe pas dans le fichier de mesures actuel. Et il omet de nombreuses observations qui, selon la règle du script actuel, devraient être éligibles.Cela indique que le fichier de clustering est une sortie ancienne ou désynchronisée par rapport au corpus de mesures actuellement enregistré.Conséquence : les familles statistiques présentes dans ce JSON ne doivent pas être considérées comme une synthèse fiable des mesures actuelles.
Ce n'est pas une simple imperfection statistique. C'est un problème de traçabilité des données.
Il faut impérativement pouvoir garantir : {hash des mesures utilisées} = {hash des mesures actuelles}
Et enregistrer dans chaque sortie :- la version de l'extracteur ;- la version du schéma ;- la date de génération ;- les identifiants inclus ;- les identifiants exclus et leurs motifs ;- les paramètres du clustering.
Sans cela, on peut modifier l'extracteur, oublier de régénérer le clustering, puis continuer à construire des familles sur un ancien corpus sans s'en rendre compte.
# 4. Audit du clustering : il ne découvre pas encore les familles artistiques
Fichier : scripts/eye-refs/cluster_lashes.py
Le clustering utilise sept variables :
1. nombre de cils ;
2. longueur moyenne ;
3. longueur maximale ;
4. angle moyen de balayage ;
5. courbure moyenne ;
6. proportion de touffes ;
7. rapport de longueur externe/interne.
Il applique une normalisation centrée-réduite, puis un K-means avec quatre groupes et cinquante initialisations.
C'est une méthode statistique raisonnable pour commencer à explorer un corpus.
Mais elle a des limites importantes.
## 4.1 Les variables calculées mais non exploitées
Le script calcule également :- lean ;- baseWidth.
Or ces deux variables ne font pas partie du tableau utilisé pour le clustering.
C'est dommage : l'orientation vers l'extérieur et la largeur des racines peuvent différencier deux familles visuellement très différentes.
## 4.2 Les groupes sont trop petits pour devenir des catégories artistiques
Dans le JSON actuellement présent, les quatre groupes contiennent respectivement 3, 16, 1 et 7 yeux.
Un groupe constitué d'un seul œil ne constitue pas une famille artistique suffisamment établie. Il peut représenter une singularité, une erreur d'extraction ou un style rare.
De plus, les groupes sont des regroupements numériques, pas des concepts artistiques.
Le moteur devrait pouvoir distinguer des propriétés telles que :
- densité ;- éventail ;- direction ;- courbure ;- racine commune ;- séparation des pointes ;- continuité du liner ;- asymétrie ;- répartition spatiale.
Un K-means ne sait pas, à lui seul, que deux dessins très différents peuvent appartenir à une même grammaire de touffes, ni qu'un même style peut exister sous plusieurs densités.
Ma recommandation : conserver le clustering comme outil exploratoire, mais ne jamais le considérer comme l'autorité qui définit les familles du moteur.
## 5. Audit des dix familles : la partie la plus intéressante du système
Fichier : src/generation/eye-lash-families.ts
### 5.1 Les familles ne sont pas automatiquement issues des clusters
C'est un point à bien comprendre.
Le JSON statistique possède quatre clusters. Le TypeScript possède dix familles artistiques.
Il n'existe pas de transformation automatique qui convertit les quatre clusters en dix familles.
Les dix familles sont définies manuellement à partir des références, avec des valeurs identifiées comme :
- M : mesurées ;
- I : interprétées ;
- C : converties.
Cette séparation est saine. Un système artistique ne devrait pas être obligé de suivre les catégories d'un algorithme statistique.
Mais il manque une chose : une traçabilité précise entre chaque paramètre et les observations qui le justifient.
Par exemple, pour plume, le code mentionne les références 13-03, 13-06, 13-07 et 13-10.
Or 13-03 est exclue du clustering actuel, car elle ne remplit pas le critère des deux traits supérieurs. Cela ne signifie pas que la référence est inutilisable : elle peut être utile pour une mesure de pointes ou une interprétation visuelle. Il faut simplement distinguer les sources d'une famille des observations effectivement retenues par le clustering.
## 5.2 Une incohérence dans les sources
J'ai aussi vérifié les identifiants cités par les familles.
Sur les 41 identifiants distincts mentionnés dans les sources TypeScript, un identifiant, 12-11, n'existe pas dans le corpus actuel measures-lashes.json.
Il faut donc corriger cette provenance ou rétablir la mesure manquante. Il ne faut pas laisser un identifiant de référence fantôme dans les métadonnées.
## 5.3 Les familles sont encore des presets, pas des grammaires
Une famille comme plume fixe notamment :
- count ;- length ;- thickness ;- curl ;- sweep ;- tipSharpness ;- bendDeg ;- rootFuse ;- span ;- arch ;- outerLength ;- outerLift ;- flick.
C'est déjà beaucoup plus expressif qu'un simple preset de nombre et longueur.
Mais le preset reste une configuration globale. Il ne décrit pas encore comment construire la composition interne des cils.
Par exemple, une véritable grammaire de touffes devrait pouvoir exprimer :
- nombre de groupes ;- nombre de pointes par groupe ;- position de chaque groupe ;- largeur de la racine commune ;- séparation des pointes ;- ordre de superposition ;- longueur relative de chaque pointe ;- courbure propre à chaque branche ;- densité locale ;- espace négatif entre les groupes ;- transition entre les groupes et le liner.
Autrement dit, clump: 0.7 ne devrait pas être la seule représentation d'une touffe.
Il faudrait distinguer la structure d'un groupe de cils de la simple probabilité que plusieurs cils se rapprochent.

## 6.1 Le problème de fusion des paramètres
J'ai repéré une incohérence dans applyLashFamily().

Le commentaire annonce que les couleurs et matériaux existants sont conservés. Pourtant, l'ordre de fusion fait l'inverse :INK écrase les valeurs existantes de matériau, opacité, brillance et variation de couleur, sauf si la famille les redéfinit ensuite.
Le problème concerne également les cils inférieurs, avec une opacité forcée à 0.9 avant les paramètres spécifiques de la famille.
Il faut choisir clairement le contrat :
- soit les familles imposent toujours leur propre encre ;
- soit elles conservent l'apparence existante par défaut ;
- soit elles proposent un mode d'application explicite.
Je recommande le troisième choix : séparer la configuration structurelle des cils de leur apparence matérielle.
Une famille devrait pouvoir être appliquée sans détruire arbitrairement la couleur, le matériau ou l'opacité définis ailleurs.
## 6.2 Une famille identique sur les deux yeux
Actuellement, random-face.ts applique la même famille aux deux yeux.
Les tests le confirment explicitement.
Cela garantit une cohérence de paire, mais limite les compositions asymétriques.
Il faudrait progressivement introduire :
- une famille dominante ;
- une famille secondaire ;
- une variation locale par œil ;
- une asymétrie contrôlée ;
- une symétrie stricte lorsqu'elle est demandée.
Attention : il ne s'agit pas de rendre les deux yeux aléatoires indépendamment. Cela risquerait de produire des visages incohérents. Il faut un système d'asymétrie sous contraintes.
## 6.3 Le générateur d'œil indépendant
random-eye.ts possède son propre système de variation des cils : quantité, longueur, courbure, balayage, dispersion, orientation, épaisseur, etc.

Mais il ne semble pas exploiter directement les dix familles de références.

La logique des familles est actuellement surtout portée par random-face.ts.

Il faudra décider si les familles doivent devenir accessibles au niveau d'un œil isolé, et pas uniquement lors de la génération d'un visage.

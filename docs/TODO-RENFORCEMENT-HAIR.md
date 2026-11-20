> Audit ligne par ligne de ce TODO, avec l'état de chaque item et le reste à faire : voir `TODO-RENFORCEMENT-HAIR-STATUS.md`.

# Résoudre Le problème majeur : 
les deux moteurs capillaires sont-ils raccordés..: les deux systèmes coexistent, mais leur intégration dans une chaîne de génération unique n'est pas établie.Il faudrait un contrat d'interopérabilité explicite entre les deux systèmes.

# 3.1 Grammaire de composition capillaire
Ce qui existe déja :- masses dominantes ;- familles de mèches ;- couches arrière, avant et supérieures ;- sous-couches ;- distribution spatiale des mèches ;- raie et implantation ;- volumes et asymétries.
# Le Moteur doit implémenter ce qui manque apres avoir vérifier ou confirmer ce qui existe deja et comment ca existe...
Il manque notamment : Une véritable Hiérarchie des masses dominantes (Les tests doivent prouver visuellement cette fonctionnalité), Une Direction principale de lecture complete(Les tests doivent prouver visuellement cette fonctionnalité), Une véritable Équilibre des volumes gauche/droite , Une véritable Gestion des espaces négatifs demontrable visuellement et correctement bien concu, Mettre en place de vrai Points focaux de la coiffure visible et présenté bien implémenté, implémenté des lignes de force complete de la silhouette, implémenter un systeme de Distribution intentionnelle complète de densité des cheveux bien sophistiqué et demontrable visuellement, implémenter un vrai system de Relations entre groupes de mèches qui fait vraiment ses preuves et qui est consommé de le moteur capillaire..
# Il existe des règles de génération, mais elles ne constituent pas encore une véritable direction de composition.

Par exemple, une coiffure peut posséder 16 grosses mèches et 20 mèches secondaires sans que leur organisation produise nécessairement une silhouette artistiquement intéressante.
Il faut distinguer le nombre de mèches de leur fonction dans la composition.

# 3.2 Grammaire de courbes et de transitions
## Premièrement : une ondulation sinusoïdale ne suffit pas pour reproduire toutes les courbes artistiques.
Il faut pouvoir permettre au moteur de composer une mèche avec plusieurs comportements successifs :- racine presque droite ;- courbure progressive ;- inflexion ;
- compression ;- ondulation ;- torsion ;- accélération ;- retournement de pointe.
## IMPORTANT
Il faut que les test puissent démontrer visuellement chacune de ses fonctionnalités 1 par 1 et leur combinaison sans prétendre quoi que se soit..Il faut s'assurer que s'ils ne sont pas encore implémenté, il soit véritablement implémenter avec toute la rigeur possible
## Deuxièmement : la transition entre deux masses doit être contrôlée.
Une mèche qui sort d'une masse volumineuse ne doit pas simplement commencer à côté de celle-ci. Elle doit pouvoir sembler émerger de son volume, en conservant une continuité de forme et de direction.
## Troisièmement : il manque une grammaire suffisamment expressive des profils de largeur locaux.
Le moteur possède déjà une variation de largeur et un effilement. Mais il faut également contrôler les renflements, les étranglements, les sections aplaties, les torsions de ruban et les changements brusques ou progressifs de volume.
Mon verdict : le moteur possède les primitives nécessaires pour commencer, mais pas encore toute la grammaire des courbes que nous recherchions.
# 3.3 Grammaire de chevauchement
Une véritable grammaire de chevauchement doit comprendre :
1. Quelle mèche passe devant quelle autre.
2. À quel endroit commence le chevauchement.
3. À quel endroit il se termine.
4. Quelle portion de la mèche reste visible.
5. Où se forme une ombre de contact.
6. Où une sous-couche doit réapparaître.
7. Comment gérer deux mèches qui se croisent.
8. Comment résoudre les intersections sans détruire la silhouette.
Une organisation en trois couches ne résout pas toutes ces situations.
Par exemple, deux mèches peuvent être alternativement devant et derrière l'une l'autre sur leur longueur. Leur classement global dans front ne permet pas à lui seul de représenter cette relation.
Il faut passer d'une logique de calques à une logique de relations spatiales et d'occlusion locale.
# 3.4 Grammaire de finition picturale
Le nouveau src/hair-grammar/paint.ts utilise encore une palette assez simplifiée :
- trois niveaux de remplissage ;
- un croissant d'ombre ;
- des traits de brins fins ;
- une couleur d'encre commune.
Il ne bénéficie pas automatiquement de toute la richesse de hair-lock.ts.
C'est une autre raison pour laquelle les deux moteurs ne doivent pas rester indépendants.
## 4.3 Ce que tu corrigera dans le moteur d'apparence branché au moteur capillaire
Même si le système est bien développé, il ne faut pas le considérer comme terminé.
## Premier problème : la lumière et la forme ne sont pas encore suffisamment liées.
Le rendu d'une mèche utilise une direction de lumière, un dégradé et des ombres. Mais une finition picturale avancée doit également comprendre la courbure locale, l'orientation de la surface et la torsion du ruban.Une mèche torsadée ne devrait pas recevoir le même motif de reflet qu'une mèche plate.
## Deuxième problème : les reflets ne sont pas tous suffisamment localisés.
hairGloss() produit notamment une ellipse lumineuse globale, limitée par la silhouette des cheveux.C'est utile pour un effet général, mais ce n'est pas l'équivalent d'un système de reflets suivant précisément les courbes de chaque mèche.Le rendu individuel de lockMarkup() est plus intéressant à cet égard, mais il faut encore renforcer la cohérence entre la géométrie locale et les reflets.
## Troisième problème : la finition dépend encore fortement du SVG.
Les filtres SVG sont utiles, mais leur empilement ne remplace pas un modèle de matière et d'éclairage suffisamment expressif.
Je recommande donc de conserver le moteur transversal, mais de lui ajouter une interface de rendu orientée géométrie locale.

Par exemple :- normale locale ;- courbure ;- orientation de la mèche ;- torsion ;- largeur locale ; profondeur ;- exposition à la lumière ;- occlusion locale.
Ces informations doivent être fournies par la géométrie, pas inventées par le moteur d'apparence.
# A. Hair Reference Analysis Engine
Il existe déjà une capacité d'analyse par synthèse dans src/hair-grammar/autofit.ts.
C'est important : le moteur peut générer une coiffure, la rasteriser, comparer le résultat à une référence et ajuster progressivement les paramètres des mèches.
Il utilise notamment :- rappel de l'encre ;- précision de l'encre ;- IoU de silhouette ;- différence de tonalité ;- perturbation locale des paramètres ;- ajout et suppression structurels de mèches.C'est une véritable base d'optimisation.
Mais ce n'est pas encore l'analyse de référence que nous avions imaginée.
Il manque une extraction structurée des observations artistiques :
- silhouette globale ;- masses dominantes ;- directions de lecture ;- zones de densité ;- familles de courbes ;- types de pointes ;- organisation des franges ;
- relations d'occlusion ;- texture picturale ;- asymétries intentionnelles.
Autrement dit, le système sait déjà chercher à rapprocher un rendu d'une image, mais il ne transforme pas encore systématiquement cette image en une connaissance artistique réutilisable.
# B. Hair Style Grammar Engine
C'est le nouveau src/hair-grammar/grammar.ts.
Je considère que c'est l'une des meilleures fondations de ton architecture.Il permet de décrire différentes familles de coiffures avec un générateur commun plutôt que d'écrire une fonction spécifique pour chaque coiffure.Mais il manque encore une couche supérieure : la grammaire de composition.
# C. Shape & Flow Engine
C'est également une bonne fondation.Le couple lock.ts / blade.ts sépare correctement le parcours tridimensionnel de la mèche et sa représentation en lame.
Cependant, il faut éviter que toutes les mèches soient réduites à des lames relativement similaires. Il faudra permettre des structures ramifiées, des mèches qui se séparent, se rejoignent, s'enroulent ou se croisent, ainsi que des transitions entre différentes sections.
# D. Hair Composition & Occlusion Engine
Le moteur principal dispose déjà d'une partie importante de ces fonctionnalités.
Mais il lui manque le graphe de relations entre les différentes mèches et masses.
# E. Hair Appearance Engine
Il existe déjà dans le système transversal.Je ne recommande absolument pas de créer un deuxième moteur d'apparence capillaire indépendant.
Il faut étendre le moteur commun et lui faire recevoir les informations géométriques nécessaires.
# F. Style & Art Direction Engine
Il existe des paramètres de silhouette, de texture, de volume, de frange, de raie et de style.
Mais je ne vois pas encore une couche suffisamment complète permettant de traduire une intention artistique en une série cohérente de décisions.
Par exemple, « cheveux gonflés et aériens » devrait entraîner simultanément :
- une augmentation de certaines masses ;- une élévation des racines ;- une modification de la distribution des mèches ;- des variations de densité ;- une augmentation de certains espaces négatifs ;- des pointes plus libres ;- des reflets adaptés à la forme.
Une commande de haut niveau devrait coordonner ces décisions.
# G. Variation & Controlled Randomness Engine
Le générateur déterministe existe.Mais la variation devrait être conditionnée par la composition.Il ne faut pas simplement générer une autre graine pour obtenir une autre coiffure.
Il faut pouvoir demander :- même silhouette, autres mèches ;- mêmes masses, autres pointes ;- même composition, autre texture ;- même coiffure, asymétrie différente ;- même style, volume différent.Cela exige des niveaux de variation indépendants.
# H. Visual Quality & Repair Engine
C'est ici que je trouve une différence importante entre ce qui existe et ce qui était prévu.
Le moteur possèdes des fonctions de vérification géométrique, anatomique et stylistique dans verify.ts, ainsi que des mesures de comparaison aux références.
Le moteur  possèdes également autofit.ts et iso-verify.ts.
Mais je ne peux pas confirmer l'existence d'un cycle autonome complet qui :
1. détecte un défaut ;
2. identifie le composant responsable ;
3. choisit une correction locale ;
4. reconstruit la géométrie ;
5. vérifie l'amélioration ;
6. conserve ou annule la modification.
L'ajustement par synthèse est une première forme de réparation paramétrique, mais il ne faut pas lui attribuer automatiquement toutes les capacités de ce cycle.

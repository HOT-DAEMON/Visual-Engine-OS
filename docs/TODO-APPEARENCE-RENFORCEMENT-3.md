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

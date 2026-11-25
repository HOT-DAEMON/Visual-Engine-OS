il y a une limite importante : le glow est construit à partir de l'alpha de l'objet, pas de sa géométrie lumineuse réelle.

Conséquences :
- une chevelure entière peut recevoir un halo uniforme ;
- une petite pierre lumineuse et une grande surface émissive peuvent recevoir le même type de traitement ;
- le halo ne connaît pas la puissance lumineuse réelle de l'objet ;
- il ne tient pas compte de la distance entre l'objet et les surfaces voisines ;
- il ne projette pas de lumière colorée sur les objets environnants.
Il s'agit donc d'un effet graphique de contour, pas encore d'une propagation lumineuse.

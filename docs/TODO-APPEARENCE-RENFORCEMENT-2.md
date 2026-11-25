# Je recommande de prévoir ces familles :
Matériau	Propriétés particulières
Matériau Peau: Propriétés particulières(Diffusion sous-cutanée, pores, huile, variations régionales)
Matériau Cheveux: Propriétés particulières(	Anisotropie, fibres, brillance longitudinale)
Matériau Yeux: Propriétés particulières(	Cornée, iris, sclère, humidité, réfraction)
Matériau Métal: Propriétés particulières(	Réflexion, anisotropie, micro-rayures)
Matériau Verre: Propriétés particulières(	Réfraction, transmission, réflexion, épaisseur)
Matériau Tissu: Propriétés particulières(	Fibres, rugosité, plis, diffusion)
Matériau Pierre: Propriétés particulières(	Microrelief, rugosité, porosité)
Matériau Eau: Propriétés particulières(	Réflexion, réfraction, transparence, caustiques)
Matériau Énergie: Propriétés particulières(	Émission, halo, déformation, interaction lumineuse)
Matériau Fumée: Propriétés particulières(	Absorption, diffusion, transmittance)
Matériau Sang: Propriétés particulières(	Brillance, viscosité visuelle, transparence partielle)
Matériau Cristal: Propriétés particulières(Réfraction, dispersion chromatique, réflexion interne)

Il faut également introduire les propriétés suivantes :
- IOR (indice de réfraction).- Transmission.- Absorption.- Anisotropie.- Subsurface scattering.- Clearcoat.- Microfacet distribution.- Épaisseur.- Rugosité spatiale;- Variation régionale.- Réponse à la lumière indirecte.
# Une précision importante : tous les matériaux ne doivent pas être simulés physiquement avec la même fidélité. Ton moteur doit pouvoir utiliser une approximation artistique très contrôlée pour les cheveux, les yeux et la peau, sans imposer un rendu PBR uniforme à toute l'image.

# Un moteur atmosphérique
C'est une dimension que je ne voudrais surtout pas que le moteur l'oubliée.
La lumière ne rencontre pas uniquement des surfaces. Elle traverse aussi des milieux.
Il faut prévoir :
## A. La fumée
- Densité variable;- Opacité;- Diffusion lumineuse;- Absorption;- Éclairage interne;- Contours rétroéclairés;- Évolution dans le temps.
## B. La brume
- Profondeur atmosphérique;- Perte de contraste;- Désaturation progressive;- Décalage chromatique;- Persistance de la lumière dans les zones éloignées.
## C. Les rayons lumineux
- Faisceaux directionnels;- Faisceaux volumétriques;- Rayons traversant des ouvertures;- Rayons découpés par des obstacles;- Intensité variable dans l'espace;- Particules révélant les faisceaux.
## D. Les particules
- Poussière;- Cendres;- Étincelles;- Pluie;- Neige;- Débris;- Particules énergétiques.
Chaque particule devrait pouvoir recevoir une lumière, en émettre une ou simplement interagir avec le volume atmosphérique.

# 4.6. Un moteur de projection lumineuse
C'est particulièrement intéressant pour ton ambition de mise en scène.Une lumière peut être projetée sur une surface avec une forme particulière.

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
- IOR (indice de réfraction).- Transmission.- Absorption.- Anisotropie.- Subsurface scattering.- Clearcoat.- Microfacet distribution.- Épaisseur.- Rugosité spatiale.
- Variation régionale.- Réponse à la lumière indirecte.
Une précision importante : tous les matériaux ne doivent pas être simulés physiquement avec la même fidélité. Ton moteur doit pouvoir utiliser une approximation artistique très contrôlée pour les cheveux, les yeux et la peau, sans imposer un rendu PBR uniforme à toute l'image.

# Un moteur atmosphérique
C'est une dimension que je ne voudrais surtout pas que le moteur l'oubliée.
La lumière ne rencontre pas uniquement des surfaces. Elle traverse aussi des milieux.

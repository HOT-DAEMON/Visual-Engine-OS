# Erreurs rencontrées — suite 8 (moteur de crâne en profil)

1. **Dichotomie du gonion à l'envers + condyle trop en arrière.** Premier résultat : angle 54° au lieu de 117,5°. L'angle croît avec l'abscisse du gonion (pas l'inverse)
   et le condyle doit être devant le conduit auditif. Corrigé : bornes [-0,2 H ; +0,12 H], condyle à +0,015 H ; écart final < 10⁻¹¹ °.
2. **Teinte d'ombre utilisée telle quelle.** `ra.shadow` (#ce2423) est une teinte de calcul saturée : en aplat elle rendait le cou rouge. Corrigé : `tone = mix(base, shadow, 0,2)`.
3. **Défaut trouvé par la vérification : os hors de la peau (5 repères).** Le sens os → peau était toujours « vers l'arrière » : faux pour la voûte (l'os est SOUS la peau)
   et l'occiput (en AVANT). Corrigé : sens explicite `x− / x+ / y+ / y−` par repère.
4. **Défaut trouvé par la vérification : auto-intersection du contour.** Avec un cou court, le cartilage thyroïde (+0,075 H) dépassait la base : ordre vertical non
   monotone. Corrigé : points en fractions de la longueur disponible + cou visible ≥ 0,18 H (consigné). Un test (`neck.length` minimal) le couvre ; sa première
   version oubliait l'affaissement sous le menton (écart 1,5 px), corrigée.
5. **Mélange en lumière linéaire sous-estimé.** `mix(…, noir, 0,78)` donnait un gris moyen (#615b55), contraste d'encre 3,6 sur peau claire. Corrigé : 0,94 (0,985 sur peau foncée).
6. **Critère de contraste impossible sur peau foncée.** Maximum atteignable ≈ 3 avec un trait noir : exigence ramenée à min(4 ; 80 % du maximum).
7. **Croissants d'ombre décalés au bas du cou.** La coupe était prolongée en déplaçant les deux points de base, ce qui changeait la direction du dernier segment :
   bande claire parasite. Corrigé : deux points AJOUTÉS sous la coupe, les points d'origine ne bougent pas.
8. **Cadrage de la comparaison face/profil faux (3 essais).** Le SVG de face est centré sur (0,0) et sa hauteur d'hôte n'est pas celle des repères (facteur
   `S·hostH / hauteur réelle`). Les lignes guides n'étaient pas sur les yeux avant correction ; elles le sont maintenant.
9. **Attribut SVG refusé** (`stroke-dasharray`) : liste blanche étendue (attribut inerte). `fill` en double dans les étiquettes : corrigé dans le script.
10. **Mandibule en « haricot »** au premier rendu d'anatomie (arcade alvéolaire démesurée) et vertèbres en « sucettes » : redessinées ; la mandibule reste approximative (REMAINING).

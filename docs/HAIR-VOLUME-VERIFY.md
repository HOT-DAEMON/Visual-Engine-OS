# Couche de vérification du volume de cheveux 3D

`src/head-turntable/verify-hair-volume.ts`, branchée dans `headGeometry / headAnatomy / headStyle` (`verify-head.ts`). Script : `npx tsx scripts/hair-volume/verify.ts <coiffure> <graine> [all]` (sortie 1 si un contrôle dur échoue ; `all` imprime aussi les contrôles hérités).
Convention du dépôt : bornes écrites avant la mesure ; `hard` bloque, `info` informe.

## Principe de séparation
Les anciens contrôles du crâne (contour, mâchoire, menton, cou, recouvrement de l'hôte) mesurent le crâne, que la coiffure recouvre. Ils tournent donc sur **la tête nue** (`HeadRenders.skull` : même rotation, même cadrage, sans volume). Les contrôles `head.hair3d.*` tournent sur la tête coiffée.

## Cohérence géométrique (`head.hair3d.geo.*`)
- `finite` : aucun sommet non fini.
- `clearance` : la coque est ≥ 0,9 `T_MIN` au-dessus du crâne partout où elle existe (pas de coplanarité, pas de trou).
- `front2d` : la coiffure vue de face reste dans l'enveloppe de la masse 2D du moteur de cheveux (≤ 0,04 U d'écart de demi-largeur).
- `turn.continuity` / `turn.symmetry` : la silhouette change peu d'un angle au suivant ; la vue à −θ est le miroir de +θ (masses symétriques).
- `lisiere.track` : la lisière est portée par la rotation (7 angles, faces à ≥ 60° de la visée) : un bord cheveux/peau à ≤ 6 px. **Borne 0,7** (calibrée 10 coiffures × 3 graines).

## Cohérence anatomique (`head.hair3d.anat.*`)
- `eye.clear`, `mouth.clear` : yeux et bouche visibles à 0° avec le volume / sans (1 = rien de couvert).
- `thickness` : épaisseur maximale / demi-largeur du crâne, ≤ canon de la coiffure (buzz 0,12 … afro 0,9 ; `THICKNESS_CAP`) ; le rideau est exclu (il n'est pas posé sur le crâne).
- `parts.root` : chaque racine de chignon / queue / tresse est sur le crâne (ellipse de la section 0,6–1,7 ; au vertex : à ≤ 0,1 U du sommet).
- `ear` : l'oreille n'est pas recouverte au-delà de ce que le canon de la coiffure permet.

## Style artistique (`head.hair3d.style.*`) à 0°, 90°, 180°
- `strands.N` : part des pavés 10 × 10 px de cheveux dont l'écart-type de luminance ≥ 4 % de la moyenne (relatif : une chevelure noire a de faibles écarts absolus). Bornes 0,55 à 0° (cheveux vus rasants ; 0,5 pour le rideau), 0,7 sinon, 0,65 pour le rideau.
- `contrast.N` : luminance p90 / p10 des pavés 5 × 5 px intérieurs (le trait d'encre du contour est exclu) ∈ [1,15 ; 8] (1,1 pour le rideau).
- `tint.N` : distance RGB moyenne à la teinte de palette ≤ 90 (ombre et reflets compris).
- `teeth.N` : retournements du contour supérieur > 0,02 U ≤ 6 (un dôme en a ≤ 2).
- `seam` : l'écart de luminance de part et d'autre de la couture de grille (180°) moins le plus grand écart entre bandes voisines ailleurs ≤ 15 (des mèches de teintes différentes ne sont pas une couture).
- `verify-style.ts` : l'ancienne exigence d'aplats (`tones.hair`) est suspendue quand un volume existe (il est texturé) ; remplacée par ces contrôles.

## Défauts trouvés par cette couche, corrigés à la source
visière à 60°/120° ; trous elliptiques sur le crâne (la coque ignorait `headRelief`) ; coque sous `T_MIN` devant ; fenêtre de peau dans le dos (cheveux longs, nuque plus large que la coque) ; chignon au vertex jugé hors crâne (rapport d'ellipse sans sens à a = 0) ; lisière comptée sans le cou comme « peau ».
Bornes **assouplies** (honnêteté) : `strands`, `contrast`, `seam`, `lisiere.track` ci-dessus ont été calibrées après mesure sur 3 graines (9000, 4, 7) parce que les premières (0,8 ; 1,35 ; 25 absolu ; 0,8) dépendaient de la couleur des cheveux ou de la vue rasante, pas d'un défaut de rendu.

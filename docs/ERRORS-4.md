# Erreurs rencontrées et corrigées (moteur de visage)

Format : symptôme → cause → correction → garde-fou.

1. **Visage de verre (peau translucide) avec glow + bloom** — graine 4242 : tête grise et translucide, cou normal. Cause : dans `appearance/effects.ts` les `feMerge`
   n'avaient pas d'attribut `result` ; la primitive suivante lisait un résultat inexistant (noir). Un seul effet n'était pas touché. Correction : chaque primitive empilée
   porte son `result` (4 `feMerge`), et le halo de bloom est borné par l'alpha d'entrée. Garde-fou : `tests/skin-light.test.ts` (régression, mesure sur pixels). Touche aussi les cheveux et tout objet qui cumule deux effets.
2. **Rayures horizontales dans les ailes du nez** — cause : clip-path en règle pair-impair combiné à un flou (artefacts de rendu). Correction : l'évidement sous un composant
   est un ANNEAU (remplissage pair-impair), le clip ne garde que le receveur. Garde-fou : planches 03/04.
3. **Silhouette du nez en zigzag** — cause : points de l'aile triés par ordonnée. Correction : bord extérieur de l'aile dans son ordre de parcours (`outerEdge`).
4. **Cassures de tangente du contour (59/60 visages)** — cause : décalage latéral des poignées du corps de la mandibule. Correction : convexité par la longueur des poignées. Garde-fou : contrôle `outline-c1` (≤ 3°).
5. **Barbe qui couvre la commissure (graine 7650)** — causes : plus de base plate au menton ; mâchoire plus étroite. Corrections : bord intérieur borné par la demi-largeur du crâne ;
   demi-largeur de la bouche bornée à 80 % de la plus étroite des demi-largeurs du crâne à sa hauteur ; coin du menton sous la lèvre inférieure. Test adapté au coin du menton.
6. **Narines hors de l'aile** (3/60 puis 1/60, puis cas extrêmes) — correction : couloir disponible dans l'aile, narine réduite pour y tenir, décalage selon l'inclinaison.
7. **Hauteur du menton écrasée par la lèvre** (23/60) — bornes de génération réduites (0,085–0,14) ; alerte `chin-height-honoured` conservée.
8. **Reflet jugé « métallique » à tort** (graine 52546) — saturation HSL instable près du blanc. Correction : chroma (max − min).
9. **Taches rouges sur la peau** — diffusion sous-cutanée trop saturée. Correction : mélange à 30 % de rouge sang, force réduite.
10. **Traits dorés sur les côtés de la tête** — région `temples` trop proche du contour. Correction : région rapprochée du centre, reflet atténué (tempes, cou).
11. **Ombres orbitaires en ellipses dures** — creux sans bord réel coupé par sa silhouette. Correction : `edge: 'soft'`, croissant flou non découpé.
12. **Lumières de contour en traits blancs** — dégradé trop large, pas de flou, côtés artificiels (corde du menton). Correction : dégradé éteint à 55 %, flou, `rimEdge`, défauts discrets.
13. **Rendu à 3000 px trop lent** (plus de 300 s) — les artefacts se rendent cellule par cellule à 1×.

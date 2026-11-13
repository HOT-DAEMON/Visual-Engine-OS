# ERRORS-10 — moteur de corps (feat/hair-grammar)

Format : symptôme → cause → correction → garde-fou.

1. **Branche créée par erreur** (`feat/body-upper-limb`) alors que la consigne était de pousser sur `feat/hair-grammar`. Cause : branche de travail créée par réflexe avant relecture de la consigne. Supprimée localement avant tout commit ; garde-fou : `git branch --show-current` avant chaque commit.
2. **Torse en « jupe » évasée en bas.** Cause : spline de Catmull-Rom fermée, deux coins très éloignés sans point intermédiaire → dépassement. Correction : points intermédiaires sur le bord bas + coupe par `clip-path` à la ligne des hanches (bord sans contour).
3. **Détails du tronc (dentelés) peints PAR-DESSUS les bras.** Cause : tri global par `z` après les peaux. Correction : couches tronc → bras → avant-bras → main, chacune peint sa peau PUIS ses détails.
4. **18 parents d'atomes inexistants** (`torso.shell.L`) trouvés par `body.parents-exist`. Cause : `pair()` suffixait tout parent par le côté. Correction : parents non latéraux (`torso.shell`, `neck`) reconnus ; test `parents-exist`.
5. **Niveau du cou à 3 sous un tronc à 0** (`body.level-monotonic`) et pouce de niveau 0 sous le thénar de niveau 1. Correction : racine au niveau 0 ; le pouce naît de la paume.
6. **Trapèze hors de l'enveloppe chez les sujets maigres/âgés** (14/60 graines), trouvé seulement par un balayage de 780 corps (les 3 premières graines passaient). Cause : polygone du trapèze indépendant du bord réel. Correction : il suit `halfAt`.
7. **Abdominaux visibles chez le nourrisson.** Cause : plancher d'opacité de 0,3 sur le relief. Correction : visibilité strictement nulle quand la définition est nulle ; muscles non émis sous 0,06.
8. **Planches : bras rognés par la cellule voisine.** Cause : cellules non rognées, toile trop étroite. Correction : `<svg>` imbriqué par cellule, largeur et échelle par planche.
9. **3 avertissements `male-taper` sur des hommes obèses** (hanches/épaules 0,78–0,786 > 0,78). Cause : le « V » masculin ne vaut pas à forte adiposité. Correction : contrôle borné à adiposité < 0,6 (comme la bande féminine) — correction de la RÈGLE, documentée, pas du seuil.
10. **Script de refactor Python lancé avec une chaîne introuvable** : plusieurs fichiers modifiés, `render.ts` resté ancien. Garde-fou : préparer toutes les chaînes avant la première écriture, retaper les fichiers entiers si l'état est incertain.
11. **Grand dorsal sorti de l'enveloppe du bébé** (graines 2, 3). Correction : bornes `u ≤ 0,93`.
12. **Segmentation automatique de la sclère par couleur (réf. 10)** : contour absurde (peau claire et reflets inclus, sclère ombrée exclue). Correction : ancres de paupières posées à la main + accrochage sur le gradient ; la segmentation couleur est abandonnée.
13. **Iris ajusté par ellipse (`fitEllipse`) débordant des paupières** (réf. 04). Cause : points du limbe pris dans les cils. Correction : cercle moindres carrés robuste, rayon borné à ±12 % de l'estimation, rejet itératif.
14. **Tracé de la réf. 08 (chibi) faux** (iris et marges décalés) : écarté des mesures plutôt que forcé ; consigné dans `EYES-REMAINING.md`.
15. **Sourcil « non consommé » dans le banc de paramètres** : il est dessiné ≈ 220 px au-dessus du centre de l'œil, donc hors cadre. Correction : image plus haute (le moteur était correct).
16. **Calibrage du rayon d'iris annulé par l'archétype `alien`** (preset à rayon 0,62 absolu) → iris deux fois plus haut que l'ouverture sur l'œil 16 (`iris-meets-opening`). Correction : archétype écarté pour la galerie étendue, rayon calculé sur l'ouverture résolue.
17. **Contrôles pixel trop stricts** : sclère exigée ≥ 110 alors que les références ont un 5ᵉ centile de 60–73 ; fond gris confondu avec la sclère grise (faux « trous »). Corrections : seuil 60 (mesuré), fond magenta.
18. **`hair-boundary` : délai de 30 s dépassé** pendant que des rendus d'yeux tournaient en parallèle ; la tranche relancée sans autre charge est la référence.

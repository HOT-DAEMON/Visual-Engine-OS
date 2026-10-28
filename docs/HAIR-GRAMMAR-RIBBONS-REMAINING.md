# Rubans de trait — reste à faire (par composant)

## Extraction (`analyze-01.py`)
1. **Largeur** : plafond 3,4 px qui écrase les vraies masses noires (racines, mèches à droite) ; piste : largeur = intégrale de la noirceur, pas seuil binaire ; rubans « pleins » à part.
2. **Jonctions** : les rubans s'arrêtent aux jonctions du squelette, petits trous possibles ; piste : prolonger de la demi-largeur.
3. **Ton** : 2 niveaux plats, contours en lambeaux ; l'original a des dégradés doux et des reflets blancs. Pistes : 3 niveaux + dégradé racine → pointe ; polygones lissés par courbes.
4. **Classement hair/face** par boîtes grossières ; quelques traits de visage/cheveux ambigus (nez, paupière sous la frange).

## Rendu
5. **Épaisseur de trait** irrégulière ; pas de pointe effilée garantie aux deux bouts.
6. **Occultation** mèche/visage : tout est à plat ; pas d'ordre de dessin par mèche.
7. **Iris, cils, oreille** de la cellule : non reproduits (moteur d'yeux non branché).

## Grammaire (objectif d'origine)
8. **Génération** : apprendre, à partir des rubans extraits, des statistiques (longueur/largeur, courbure, cap relatif à un champ d'écoulement, retroussés) pour tirer d'autres coiffures — non fait.
9. **Lien avec la tête 3D** (`head.ts`, mèche de `lock.ts`) : les rubans sont en repère de tête 2D/3/4, pas posés sur la coque ; rotation de vue impossible à partir de ces données.
10. **11 autres coiffures** : `analyze-01.py` est écrit pour une cellule ; repères et boîtes à paramétrer.
11. **Intégration** au moteur de visage de face et test de régression visuelle : non faits.

## Vérification
12. Seuils anatomiques calés sur la référence elle-même (la vérification protège d'une dérive, ne prouve pas la ressemblance). Pas de test sur d'autres cellules.

## Sécurité
13. Le jeton GitHub collé dans la conversation (ghp_…) doit être **révoqué** et remplacé ; ne jamais le committer (il ne l'est pas).

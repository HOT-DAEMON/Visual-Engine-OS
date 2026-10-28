# Cellule 02 et grammaire — reste à faire (par composant)

## Fidélité visuelle de la cellule 02
1. **Corps de mèche** : gris foncés rayés de clair dans la référence ; rendu = noir + fentes blanches. Piste : bandes de ton de **sombre** (gris 40–110) mesurées à l'intérieur des masses, pas seulement sur le papier.
2. **Reflets blancs du balayage** : à modéliser comme des rubans clairs (primitive « reflet ») qui suivent le champ d'écoulement, au lieu de bandes de ton lissées.
3. **Mâchoire / cou** : trait encore plus épais que la référence par endroits (masses solides fusionnées avec l'ombre du cou). Piste : classer `face` avant l'extraction des masses.
4. **Touffe de la tempe gauche** et **retroussés derrière l'oreille** : forme correcte, micro-détails (4–6 mèches fines) simplifiés.
5. **Œil (défaut visible au zoom `04-…`)** : la paupière, les cils et l'iris fusionnent en une tache noire sans iris ni reflet ; l'œil de la référence est gris détaillé. Cause : seuil d'encre unique + largeur plafonnée. À remplacer par le moteur d'yeux branché sur la position de l'iris (u,v = 0,0). **Oreille** : tracée comme encre du visage, pas par le moteur d'oreille.
5b. **Mèches de la frange (zoom `04-…`)** : bords plus lourds et plus anguleux que la référence, dont les mèches sont des dégradés gris → blanc vers la pointe ; piste : dégradé le long du ruban (racine sombre → pointe claire) au lieu de noir plein + papier.
6. **Zone « visage »** : polygone dessiné à la main (`cells/02-side_sweep.json`) ; quelques bouts de frange près de l'œil peuvent être classés « visage ».

## Grammaire (objectif d'origine) — non fait
7. **Génération** : aucune coiffure n'est encore *produite* à partir de paramètres. Il manque : statistiques de rubans par cellule (longueur, largeur, courbure, cap relatif à un champ d'écoulement, retroussés), champ d'écoulement depuis la raie, tirage. Les cellules 01 et 02 donnent les deux premiers jeux de statistiques, comparables (même unité H).
8. **Autres cellules** (03 à 12) : la chaîne générique existe, il reste à écrire leur configuration (repères, zones) et à les vérifier une à une.
9. **Rotation de vue** : rubans en repère de tête 2D 3/4, non posés sur la coque 3D (`head.ts`, `lock.ts`).

## Performance — non faite cette session
10. Aucun gain de temps de génération n'a été obtenu ici ; les 8 niveaux de ton coûtent +30 % de rastérisation par rapport à 5. Pistes : fusionner les bandes de ton voisines (écart < 3/255), simplification adaptative des contours, rendu en résolution adaptative, mise en cache du SVG par profil.

## Vérification
11. Bornes de la cellule 02 calées sur la référence elle-même (garde-fous de dérive). Le test pixel fixe un plancher (IoU ≥ 0,95) mais ne juge pas l'élégance ; comparaison visuelle humaine toujours nécessaire.

## Sécurité
12. Le jeton GitHub collé dans la conversation doit être **révoqué** puis remplacé : il a été exposé en clair. Il n'est écrit dans aucun fichier.

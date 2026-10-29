# Cellule 02 et grammaire — reste à faire (par composant)

## Fidélité visuelle de la cellule 02
1. **Corps de mèche** : gris foncés rayés de clair dans la référence ; rendu = noir + fentes blanches, malgré le dégradé de pointe. Essai « seuil d'encre 75 + bandes sombres » **échoué** (IoU 0,59). Piste : gris mesuré en *travers* de la mèche (pas seulement sur la ligne médiane), ou rubans de stries claires superposés.
2. **Reflets blancs du balayage** : à modéliser comme des rubans clairs (primitive « reflet ») qui suivent le champ d'écoulement, au lieu de bandes de ton lissées.
3. **Mâchoire / cou** : trait encore plus épais que la référence par endroits (masses solides fusionnées avec l'ombre du cou). Piste : classer `face` avant l'extraction des masses.
4. **Touffe de la tempe gauche** et **retroussés derrière l'oreille** : forme correcte, micro-détails (4–6 mèches fines) simplifiés.
5. **Œil — branché** (`eye-slot.ts`), reste : iris trop grand et trop clair, paupière moins fermée et cils plus réguliers que la référence ; réglage à la main (`eye_slot.engine`), aucun ajustement automatique à la référence. Le contour de joue tracé traverse le coin interne de l'œil (comme la référence, mais à vérifier). **Oreille** : tracée comme encre du visage, pas par le moteur d'oreille.
5b. **Mèches de la frange (zoom `04-…`)** : dégradé racine → pointe en place (rubans à gris > 90), effet subtil ; les bords restent plus lourds et anguleux que la référence. Le dégradé augmente l'écart perceptuel mesuré (voir `HAIR-GRAMMAR-02.md`) : choix visuel à valider.
6. **Zone « visage »** : polygone dessiné à la main (`cells/02-side_sweep.json`) ; quelques bouts de frange près de l'œil peuvent être classés « visage ».

## Grammaire (objectif d'origine) — non fait
7. **Génération** : aucune coiffure n'est encore *produite* à partir de paramètres. Il manque : statistiques de rubans par cellule (longueur, largeur, courbure, cap relatif à un champ d'écoulement, retroussés), champ d'écoulement depuis la raie, tirage. Les cellules 01 et 02 donnent les deux premiers jeux de statistiques, comparables (même unité H).
8. **Autres cellules** (03 à 12) : la chaîne générique existe, il reste à écrire leur configuration (repères, zones) et à les vérifier une à une.
9. **Rotation de vue** : rubans en repère de tête 2D 3/4, non posés sur la coque 3D (`head.ts`, `lock.ts`).

## Performance — non faite cette session
10. **Le temps a empiré** : rastérisation 7,1 ms (5 niveaux) → 9,4 (8 niveaux) → 15,9 ms avec l'œil et les dégradés. Seul gain : fragment d'œil en cache (construction 12,4 → 4,9 ms). Pistes : fusionner les bandes de ton voisines (écart < 3/255), simplification adaptative des contours, rendu en résolution adaptative, mise en cache du SVG par profil, **œil simplifié à 24 px** (désactiver fibres/micro-détails du moteur à cette taille : non fait, le coût vient surtout de ≈ 50 Ko de SVG d'œil), dégradés d'un seul remplissage partagé par classe de gris.

## Vérification
11. Bornes de la cellule 02 calées sur la référence elle-même (garde-fous de dérive). Le test pixel fixe un plancher (IoU ≥ 0,95) mais ne juge pas l'élégance ; comparaison visuelle humaine toujours nécessaire.

## Sécurité
12. Le jeton GitHub collé dans la conversation doit être **révoqué** puis remplacé : il a été exposé en clair. Il n'est écrit dans aucun fichier.

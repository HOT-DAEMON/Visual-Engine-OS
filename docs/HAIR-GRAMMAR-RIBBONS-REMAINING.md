# Rubans de trait — reste à faire (par composant)
État après la v2 (voir `HAIR-GRAMMAR-RIBBONS-V2.md`). Items 1-3 et 5 de la v1 : **traités en partie** (précisions ci-dessous).

## Extraction (`analyze-01b.py`)
1. **Traits très fins manquants** (rouge dans `03-…`) : sommet du crâne, filets < 0,7 px ; rappel 0,989 mais pas 1. Piste : seuil d'encre adaptatif local / 2e passe sur les résidus.
2. **Plages de gris foncé** (côté droit) : la bande 5 (gris 130) donne des taches ; la référence y a des hachures. Piste : rendre ces zones en rubans parallèles (hachures) plutôt qu'en aplat.
3. **Contour de mâchoire/visage trop épais** (côté gauche) : effet de la limite de masse ; piste : classer `face` avant extraction et appliquer un plafond propre au visage.
4. **Bords rectilignes des tons** près du visage : viennent des boîtes `FACE_BOXES` (découpe à la main). Piste : masque de visage issu des rubans `face` fermés.
5. **Classement hair/face** toujours par boîtes grossières (nez, paupière sous la frange ambigus).
6. **Reflets blancs** nets de l'original : non modélisés (uniquement bandes claires lissées).

## Rendu
7. **Occultation** mèche/visage : tout reste à plat ; pas d'ordre de dessin par mèche.
8. **Iris, cils, oreille** : l'œil est une approximation d'encre, le moteur d'yeux n'est pas branché.
9. **Rastérisation** ≈ 8 ms (312 px) : dominée par la surface remplie ; piste : fusionner les bandes de ton quasi identiques, rendu à résolution adaptative.

## Grammaire (objectif d'origine)
10. **Génération** : apprendre des statistiques de rubans (longueur/largeur, courbure, cap relatif à un champ d'écoulement, retroussés) pour tirer d'autres coiffures — **non fait**.
11. **Lien avec la tête 3D** (`head.ts`, `lock.ts`) : rubans en repère de tête 2D 3/4, pas posés sur la coque ; rotation de vue impossible.
12. **Autres coiffures** : `analyze-01b.py` est écrit pour la cellule 01 (repères, boîtes, origine) ; **02-side_sweep non commencée**, volontairement : la 01 n'est pas à la qualité visée. `analyze-01.py` (v1) est obsolète (ancien format `poly`).
13. **Intégration** au moteur de visage de face et test de régression visuelle : non faits.

## Vérification
14. Seuils calés sur la référence elle-même ; aucun test sur d'autres cellules. Pas de test pixel (rendu vs image) dans la suite : les métriques sont dans les artefacts, pas des garde-fous automatiques.

## Sécurité
15. Le jeton GitHub collé dans la conversation (`ghp_…`) doit être **révoqué** puis remplacé (il a été exposé en clair) ; il n'est écrit dans aucun fichier ni dépôt.

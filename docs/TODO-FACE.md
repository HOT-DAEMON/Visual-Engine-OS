# Reste à faire par composant (moteur de visage)

État au moment de la livraison de `feat/face-anatomy`. « Fait » = implémenté, testé, visible dans `artefacts/face-anatomy/`.
Rien ci-dessous n'est simulé : ce qui n'est pas fait est écrit comme tel.

## Nez
- Fait : racine, dorsum (4 profils), pointe, ailes, narines, raccords front/orbites/joues/nasolabial, profil de côté (grandeur de référence).
- À faire : **vue 3/4 et profil rendus** (le profil n'est qu'une courbe de référence + encart) ; narines vues de dessous ; cartilage alaire (dépression supra-alaire) ;
  asymétrie des ailes (gauche ≠ droite) ; bosse osseuse rendue en volume (aujourd'hui : reflet + parois) ; philtrum comme composant à part (région `upperLip` seulement).
- Limite visible : sur peau foncée le nez de face reste peu contrasté (modelé doux) ; les ailes ont une silhouette « en coin » un peu régulière.

## Menton et mâchoire
- Fait : hauteur / projection / largeur indépendantes et mesurées, angle, taper, 4 symphyses, abaissement, déformation des tissus, transition cou.
- À faire : mandibule VOLUMIQUE (ramus et masséter ombrés) ; bord inférieur de la mandibule ; muscles du cou (platysma) à l'ouverture ; pli mentonnier (double menton
  rendu comme pli, pas seulement comme ombre) ; menton asymétrique ; projection visible autrement que par la lumière (nécessite la vue 3/4).
- Limite : une mâchoire étroite + grand `taper` donne un bas de visage « en entonnoir » (artefacts 05/06) ; les bornes de génération l'évitent en partie.

## Peau
- Fait : rugosité par région, reflet diélectrique large, diffusion sous-cutanée retenue, terminateur doux, zones, grain, pores, mode `cel`.
- À faire : cartes de rugosité continues (au lieu d'ellipses par région) ; rides et plis d'expression ; rougeur (`blush`) pilotée par le matériau ; cicatrices/taches ;
  peau du cou/épaules avec son propre terminateur ; réfraction réelle (aujourd'hui l'axe existe mais la peau reste opaque).

## Éclairage
- Fait : direction, taille de source, température, dureté, distance (dégradé), influence par matériau, zones front/nez/joues/épaules.
- À faire : plusieurs sources (key + fill + back) ; lumière de remplissage colorée ; ombres propres (self-shadow) du nez sur la joue calculées depuis le profil ;
  **épaules : aucune géométrie** (l'évasement du cou tient lieu), la zone « épaules » est un placeholder lumineux.

## Ombres de contact
- Fait : arbre, nez, ailes, orbites, oreilles, mâchoire→cou, bouche→menton, cheveux→front ; plafond et plancher contrôlés.
- À faire : yeux comme composants (paupières → globe) ; sourcils ; cheveux → oreilles/cou ; ombres entre mèches ; contact des lunettes/bijoux (composants futurs).

## Lumières de contour
- Fait : réglage séparé couleur/intensité/largeur/côté/influence, propagation parent/enfants/frères (un saut), 8 composants.
- À faire : yeux et cheveux (ont déjà leurs moteurs, non branchés sur ce contrat) ; contour par mèche ; rim dépendant de l'angle de vue (Fresnel directionnel).

## Vérification
- Fait : 3 couches chiffrées sur 120 visages (0 échec, 3 alertes documentées) ; contrôles négatifs (le contrôle DÉTECTE bien l'erreur).
- À faire : vérification d'IMAGE (luminance mesurée par région sur le rendu) au-delà du test côté clair/sombre ; comparaison perceptuelle entre styles ; seuils calibrés
  sur de vrais visages ; contrôle de « fausse symétrie » des narines.

## Génération
- Fait : tous les nouveaux axes tirés sur un flux de hasard dérivé (les visages existants gardent leurs proportions, yeux et cheveux).
- À faire : corrélations anatomiques (nez large ↔ ailes épaisses, menton fendu ↔ mâchoire carrée) ; archétypes (enfant, vieillard) ; `randomLight` branché dans les scènes de galerie.

## Tâches ajoutées le 2026-10-20 (cahier des charges : `docs/TODO-FACE-SPEC.md`, copie fidèle)

Statut de chaque tâche tenu à jour dans `docs/FACE-STRUCTURE-STATUS.md` (fait / partiel / reste à faire, par composant).

- T1 Nez = volume continu à régions distinctes (racine, dorsum, parois latérales, pointe, dômes alaires, ailes, sillons alaires, base, narines + bords, columelle, transitions joues / philtrum / lèvre).
- T2 Nez : longueur, largeur, projection, hauteur de racine, forme de pointe, ouverture des narines, largeur de base DISSOCIÉES, avec contraintes anatomiques.
- T3 Mâchoire : corps, angle, branche montante, transition préauriculaire, bord inférieur, projection du menton, volume des joues recouvrant l'os.
- T4 Mandibule : largeur, hauteur, angle, courbure du corps, profondeur, forme, sans déformer le crâne.
- T5 Menton : largeur, hauteur, projection, rondeur/aplatissement/carré, symphyse (largeur, profondeur), fossette/sillon, transitions (labio-mentonnière, joues, sous-mentonnière).
- T6 Tissus mous : joues, masséter, sous-menton, péri-labial, transitions préauriculaire / cou ; largeur de mâchoire DÉCOMPOSÉE (os, muscle, graisse, silhouette).
- T7 Bouche indépendante : lèvres, arc de Cupidon + tubercule, commissures G/D, cavité, dents, gencives, langue, volume, largeur, courbure, asymétrie, plis.
- T8 Joues : pommettes, volume, largeur latérale, creux sous-malaire, masséters ; sillons nasogéniens et plis péri-buccaux comme déformation de tissu.
- T9 Cou : angle cervico-mentonnier, largeur, épaisseur sous-mandibulaire, muscles, déformation (bouche ouverte, inclinaison) ; menton ≠ cou (paramètres distincts).
- T10 Dépendances entre paramètres (projection du menton → raccords joues / sous-menton, sans allonger la mandibule ; ouverture → pivot + translation de la mandibule).
- T11 Articulation : lèvre inférieure et dents inférieures suivent la mandibule, tissus mous déformés.
- T12 Trois déformations (morphologique, articulatoire, expressive) combinables sans s'écraser.
- T13 Profil de stylisation (9 contrôles) distinct du matériau et de l'éclairage ; même géométrie en encrage N&B, réaliste, anime.
- T14 Couche de vérification de rendu : cohérence géométrique, anatomique, style artistique (y compris mesures sur l'IMAGE rendue).
- T15 Artefacts (images de preuve) dans `artefacts/face-structure/`.
- T16 Docs : fichiers ≤ 200 lignes, suites créées, reste-à-faire documenté par composant.

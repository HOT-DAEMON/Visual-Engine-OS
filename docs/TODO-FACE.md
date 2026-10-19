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

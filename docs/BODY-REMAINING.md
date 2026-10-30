# Reste à faire — moteur de corps (par composant)

Ce qui est demandé et **n'est pas fait ou est approximatif**. Rien ici n'est caché dans le code : tout ce qui suit est une limite connue.

## Global
- **Vue de face uniquement** : pas de dos (les muscles du dos existent comme atomes cachés mais n'ont aucune vue), pas de profil, pas de 3/4, pas de rotation 3D du corps.
- **Pas de jambes ni de bassin** au-delà de la coupe nette à la ligne des hanches ; le bas du tronc n'est pas fermé anatomiquement.
- **Pas d'âge dans le moteur de visage** : sur les planches, un bébé porte le MÊME visage adulte (seule la taille du corps, en têtes, change). Une tête de bébé/enfant/vieux exige un axe `age` du visage.
- **Style unique** : cel doux, lumière fixe venant de la gauche (dégradé horizontal par couche). Pas de matériau de peau du moteur (`SKIN-LIGHT.md`), pas d'éclairage partagé avec le visage, pas de rendu « écorché » coloré.
- **Pas de vêtements, pilosité corporelle, cicatrices, tatouages, veines.**
- **Les bandes de proportions sont des conventions d'atelier**, non validées contre des données anthropométriques ; aucun test pixel de régression pour le corps (seuls la géométrie, le SVG et des invariants sont verrouillés).
- **« Moignon »** interprété comme racine du bras ; si un membre amputé était visé, rien n'existe (demande à préciser).

## Cou et jonction avec la tête
- Le cou reste dessiné par le moteur de visage ; le corps ne fait que s'y raccorder par un fondu (`front`) peint après le visage : il recouvre la base du cou et masque, à cet endroit, des cheveux longs tombant sur les épaules.
- Absents : scalènes, platysma, os hyoïde, pomme d'Adam de face, veines jugulaires ; trapèze supérieur seul (pas de trapèze moyen/inférieur, invisibles de face).

## Épaules et tronc
- Clavicule = ligne en S simple ; pas de scapula (invisible de face), pas d'élévation/protraction de l'épaule (plan frontal seulement ; abduction ≤ 85°).
- Ventre arrondi du nourrisson et de l'obèse : seule la **largeur** est modélisée (pas de profil de ventre, pas de plis/bracelets de graisse).
- Seins : volume, ptôse, espacement, projection, pli, aréole, mamelon pour l'adulte. **Volontairement absents avant 18 ans** (garde-fou) : le développement mammaire de l'adolescente n'est pas représenté.
- Pas de relief de la cage thoracique chez le maigre au-delà d'un trait léger ; pas d'intercostaux, pas de veines abdominales.

## Bras
- **Flexion du coude = raccourcissement** de l'avant-bras (projection orthographique du plan frontal) : à 75° l'avant-bras est très court et son extrémité trapue ; pas d'ordre de profondeur ni de recouvrement correct du bras par l'avant-bras.
- Pas de torsion de l'humérus, pas de flexion latérale du coude, pas de coude hyper-étendu.
- Triceps, deltoïde postérieur, supinateur, muscles profonds : atomes cachés (pas de vue dorsale).

## Main et doigts
- Les doigts fléchis se raccourcissent par cos(flexion cumulée) sans **détection de collision** : ils peuvent se chevaucher ; le poing vu de paume est une approximation.
- Pouce : rotation dans le plan (pas de vraie opposition 3D) ; pas de plis de flexion des doigts vus de dos, ongles simples (ellipses), pas de lunules ; pas de lumbricaux ni de tendons fléchisseurs.
- Mains gauche/droite : mêmes proportions (la variation indépendante des deux mains n'existe que par la pose et `fingers[5]`, commun aux deux).
- Pas de main pathologique ou très âgée spécifique (arthrose, veines) au-delà du canon de l'âge.

## Performance
- Visage ≈ 130 ms non traité (voir `BODY-PERF.md`) ; pas de niveau de détail automatique ; pas de cache disque du corps seul ; encodage PNG ≈ 50 ms non réductible ici.

## Vérification
- Les contrôles prouvent la cohérence interne (géométrie, hiérarchie, bandes) ; **aucun contrôle de qualité artistique perceptuelle** (ressemblance à une référence) ; pas de comparaison à des planches d'anatomie de référence.

## Mise à jour : bas du corps
Le membre inférieur (vue de face) est fait : voir `BODY-LOWER-REMAINING.md` pour son reste. Le haut du corps reste limité à la vue de face ; 7 muscles ajoutés au bras (`BODY-MUSCLE-TIERS.md`).

# Coiffure 3D : ce qui reste, par composant

Branche `feat/hair-grammar`. Fait dans cette passe : `HAIR-FRINGE-3D.md`, `HAIR-SPIKY.md`, `HAIR-FLOW-3D.md`, `HAIR-VERIFY-FEATURES.md`, preuves `HAIR-3D-PROOF.md`. Suite de `HAIR-VOLUME-REMAINING.md`.

## Traité (état)
Frange 3D portée par la rotation (bord 2D, plafond sourcil) ; bande de même aire pour la frange v2 ; épis 2D à la source + vrais cônes 3D ; flux des mèches (tourbillon, balayage), largeurs inégales, paquets ; rasé en chaume fondu dans la peau ; tresse tressée ; queue en volume ; lisière adoucie ; **planche de variété câblée** (`variedHairedHead`, `engines/from-host.ts`) ; couche de vérification des traits ; 10 coiffures × graine 9000 sans échec bloquant ; suites hair/head-turntable (778 tests) vertes.
Note d'environnement : `head-turntable-skull` (verify complète) et `hair-boundary` (30 combinaisons) dépassent 30 s ici, **y compris sur le commit de départ** (mesuré) ; elles passent avec `--testTimeout=240000`.

## Non fait ou limité
**Lisière / temple**
- `buzz` de profil : le bord avant des cheveux descend vertical jusqu'à l'oreille avec une petite marche (poche de peau du dessin 2D, `regionFromBoundary` à ≈ 73° – 86°). `relaxRegion` (10 passes) l'adoucit sans la supprimer ; la corriger exige une lisière de tempe propre à chaque coiffure dans `face/hair/boundary` (2D). Le raser n'a pas de patte ni de fondu de côté.
- `lisiere.track` mesure 0,95 – 1,0 sur la graine 9000 ; bornes de style calibrées sur 3 graines (voir `HAIR-VOLUME-REMAINING.md`) : étendre à des centaines de visages.
**Frange**
- Frange v2 : bande unie d'aire équivalente, pas de mèches séparées avec jours en 3D. À faire : lames 3D (pièces `blade`) posées sur le front aux positions de `fringe2.ts`.
**Épis**
- Les épis sont lisses (cônes) : pas de mèches en faisceau, pas de gel. Seule la coiffure `spiky` en porte. Résidu 2D : léger carrelage sombre à la base d'un cas (graine 4).
- Taille : médiane 2D (0,08 U) : lisibles mais discrets de face à petite taille.
**Cheveux longs (`long`, `bob`)**
- De face, les ailes sont toujours une masse sombre posée sur la pente des trapèzes (le point est repoussé hors du cou par `clearNeck`) : **mesuré** : réduire l'évasement du rideau ou plafonner l'épaisseur au cou ne change pas le rendu (essayés et retirés). À faire : drapé vertical qui repose sur l'épaule, mèches séparées, ombre portée du menton.
**Pièces**
- Queue : lisible mais encore une seule pièce sans nœud ni élastique ; chignon : sphère sans spirale en relief ; tresses : l'entrelacs est un zigzag de tube, pas trois torons croisés.
**Mèches**
- Afro / curly : texture de boucles lisible mais encore uniforme à grande échelle (trois échelles de Voronoï, pas de mèches de grosseurs variées ni de zones de volume) ; afro à peine plus large que curly.
**Moteur 2D (`src/face/hair/*`)**
- Seule la coiffure `spiky` est modifiée (`SPIKY_CONES`). Afros penchés / croissant noir : mesurés pendant cette passe (inclinaison médiane ≈ 0,002) et non reproduits sur les graines de mesure ; non retouchés. Frange « rideau » hors limite, dessus trop uniforme, blocs sombres de la lisière : non traités dans le dessin 2D (`HAIR-FORM-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`).
**Vérification**
- Un seul visage (graine 9000) par coiffure pour les contrôles de traits ; pas de test de régression d'image (seulement des mesures). Pas de contrôle automatique « cape » ni « lisière de temple lisse ».

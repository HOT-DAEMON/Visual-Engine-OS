# Profil : ce qui reste à faire (par composant)

Rien ci-dessous n'est caché derrière le rendu : ces points sont connus, non faits, ou approximés.

| Composant | État réel | Reste à faire |
|---|---|---|
| Crâne (voûte) | contour de peau paramétrique 2D, 8 repères nommés, os = peau décalée | vrai volume (SDF/maillage) ; vue de face et 3/4 de l'os ; variations d'âge, de sexe, d'ascendance |
| Os (mode anatomie) | cranium, orbite, arcade, mandibule, dents incisives, sutures, ligne temporale | sutures **indicatives** (ondulation sinusoïdale, pas le tracé réel) ; pas de sinus, palais, os nasaux détaillés, molaires, apophyse styloïde |
| Mandibule | angle gonial exact ; forme du corps/ramus approximative | contour réel (foramen mentonnier, ligne oblique, échancrure sigmoïde calibrée) |
| Profondeurs de tissu | méthode médico-légale ; valeurs = ordres de grandeur écrits de mémoire | **calibrer sur les tables publiées** (Rhine & Moore, Helmer) avec leurs sources ; variantes par âge/sexe/IMC ; coupler au paramètre `softTissue` du visage |
| Nuque / cou | lordose, C7, trapèze, SCM, plis, gorge, thyroïde ; 7 vertèbres | muscles réels (au-delà d'un trait), os hyoïde réaliste, vertèbres détaillées (arcs, facettes), épaule et clavicule (le profil est coupé en buste) |
| Visage de profil | nez (dorsum, pointe, columelle), lèvres, menton, sillons, œil et sourcil simplifiés | œil via le moteur d'yeux existant ; ailes du nez fidèles au moteur de nez ; rides, pilosité (barbe, moustache), bouche ouverte, expressions |
| Oreille | modèle de face projeté à 90°, éclairage `anime` forcé (sans filtre de relief) | oreilles à relief réaliste en profil ; boucles d'oreilles et piercings en profil non testés |
| Cheveux | 3 coiffures de profil (`short`, `undercut`, `updo`) ; nuque dégageable | projeter le moteur de cheveux complet (simulés, franges, longueurs) ; **ligne d'implantation de la nuque = droite lissée** : pointe médiane, duvet, mèches fines |
| Éclairage | croissants d'ombre/lumière + 4 taches radiales | lumière réglable par scène ; ombres portées complètes ; reflets de peau selon matériau |
| Intégration | API TypeScript directe (`renderProfile`) | brancher le profil au compilateur de scène (`shape: 'face-profile'`) et à `facePose` (angles 0°–90° intermédiaires : le profil est un 90° pur) |
| Vérification | 29 contrôles, 3 couches, 200 têtes | mesures sur l'IMAGE rastérisée ; comparaison à des références humaines ; seuils calibrés ; contrôle de symétrie gauche/droite |
| Tests | 15 tests (`skull.test.ts`) | références visuelles du profil (comme `references/visual/`) ; mutations volontaires sur le profil |
| Performance | profil 50 ms (géométrie mémoïsée) ; `verifyFace` −22 % | voir `PERF-3.md` : la rastérisation de FACE (≈ 670 ms) n'a pas été touchée |
| Code | `render.ts` contient quelques `void` résiduels | nettoyage ; extraire les constantes de proportion en table |
| Livraison | branche poussée | PR `feat/skull-profile` → `main` non ouverte (comme les branches précédentes) |

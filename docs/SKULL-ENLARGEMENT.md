# Pourquoi la tête 3D paraissait « élargie » — analyse, correctif, reste à faire

Question posée : *pourquoi la rotation 3D de la tête est-elle élargie par rapport à la tête générée normalement ?* Tout ce qui suit est mesuré (scripts dans `scripts/head-turntable/artefacts-enlargement.ts`, tests dans `tests/skull-enlargement.test.ts`), pas déduit.

## 1. Verdict sur l'hypothèse « on a recréé une apparence 3D au lieu de tourner le dessin 2D »

**Confirmée sur l'architecture, nuancée sur la cause.**

- Le rendu SVG 2D ne passe **pas** par le maillage : trace d'exécution V8 de `compileScene(generateRandomFace(11))`, `engineRows` et `sectionAt` sont appelés **une fois chacun, à l'import** (`head-turntable/spec.ts:38`), jamais pendant le rendu (`ROTATION-CONTRACT.md` §4 bis). La voie volumétrique (`head_3d`) est un second moteur qui **reconstruit** une tête à partir du contour 2D : c'est la source de tout écart.
- À 0°, cette reconstruction est fidèle par construction (demi-largeur des coupes = contour 2D, écart ≤ 0,001 U). **L'élargissement ne vient donc pas d'un défaut de rotation** mais de constantes héritées de la planche de référence, plus des hypothèses qu'il faut bien faire pour la face cachée.
- Nuance : un dessin frontal ne contient rien du dos du crâne. Au-delà de ≈ 40° une hypothèse volumétrique est inévitable ; la règle saine est « le visible à 0° est exactement le dessin 2D, le volume ne sert qu'à deviner le caché ». Le profil à 90° est une pose clé qui existe déjà en 2D (`src/skull`).

## 2. Causes mesurées

| # | Cause | Mesure | Statut |
|---|---|---|---|
| 1 | `Y0` : le sommet 3D était étiré de 14 % sur la voûte (la coupe de la planche ajoutait 0,05 U **au-dessus** du vertex) | sommet du crâne chauve au-dessus du vertex 2D : **+0,051 U** (4 hôtes chauves : graines 42, 4, 16, 36) | **corrigé (têtes chauves)** → +0,001 U |
| 2 | `hairTh` : épaisseur de coupe de la planche (0,05 U par côté, décroissante jusqu'à y = 0,55) dans les coupes du crâne | tête à coupe peinte : largeur +0,060 à +0,096 U sur 8 graines ; sous une coque de cheveux : +0,035 U en moyenne par côté, +0,05 max (graines 11, 77, 3) | chauve : déjà à 0 avant ce correctif ; **coiffé : non retiré, voir §5** |
| 3 | La coque de cheveux apporte déjà l'épaisseur : elle était comptée deux fois | lecture de `shellPoint` : la coque atteint la silhouette 2D des cheveux (`rx`) là où sa rampe est à 1, quelle que soit l'épaisseur du crâne dessous ; celle-ci ne reste visible qu'à la lisière et sur la peau | voir §5 |
| 4 | Indice céphalique 3D (largeur / longueur) | crâne chauve : **0,96–1,01** (8 graines) ; avec épaisseur de coupe : 1,04–1,11 ; humain 0,70–0,90. Déjà suivi par `head.anat.skull.cephalic3d` (info) | **non corrigé** : il reflète le dessin (visage large) ; la profondeur est dérivée pour un crâne de 0,8 × la largeur |
| 5 | Sections superelliptiques (exposants jusqu'à 2,7) : à 45° la silhouette dépasse celle d'une ellipse de mêmes axes | jusqu'à **+5,5 %** (5 graines) | **non corrigé** : propriété de la forme carrée du crâne, pas d'un défaut |

## 3. Correctif livré (têtes chauves)

`headSpecFromProfile` (`engines/from-face.ts`) pose `fit.bare = true` quand la lisière est entièrement sous le sommet. `bare` supprime l'étirement `Y0` : la table de rangées commence **au vertex** (`Y0` = 0,05 dans le repère de la tête), `toEngineY` devient l'identité, le remappage vertical de la voûte (`warpY`/`unwarpY`) est ancré sur ce vertex (`vaultTop`), les poids du crâne comptent l'entrée depuis lui (`skullWeightOf`). Repère de la planche et coupes courtes peintes : **inchangés, octet pour octet** (`bare` est faux par défaut). `legacyCrown` redonne l'ancien étirement pour comparer (tests, artefacts), sans être utilisé par le rendu.

Fichiers touchés : `rows.ts`, `skull-model.ts`, `vault-model.ts`, `head-relief.ts`, `vault-relief.ts`, `skull-relief.ts`, `vault-visibility.ts`, `verify-head.ts`, `verify-host.ts`, `from-face.ts`. Aucun fichier de cheveux.

## 4. Preuves

- `artefacts/skull-enlargement/01-silhouette-ancien-vs-nu.png` : contour 2D (gris), ancien (rouge), nu (vert) sur 4 hôtes chauves : sommet **+0,051 → +0,001 U**, largeur **+0,000 → +0,000 U** (déjà bonne), IoU et peau inchangés (0,996–0,997).
- `02-tete-hote-rotation.png` : tête entière (crâne, oreilles, yeux, cou, volume de cheveux) à 0, 35, 70, 90, 135, 180°, graines 42 / 3 / 11.
- A/B du rapport hôte (`artefacts-head-host.ts`, mêmes graines, code distant propre contre le mien) : graines 11, 77, 3 **identiques** ; graine 42 IoU 0,9975 → 0,9971, peau 0,9902 → 0,9895 ; **mêmes échecs préexistants** (`cephalic3d` info, `hair3d.style.*` de la graine 77).
- Couche de vérification (`verify-enlargement.ts`, branchée dans `headGeometry/Anatomy/Style`) : géométrie (sommet = vertex ≤ 0,02 ; demi-largeur = contour 2D ≤ 0,008 ; `hairTh` = 0), anatomie (indice céphalique en info ; éminence pariétale 0,12–0,36 U et 96–128°), style (calotte sans creux ≤ 0,012 U, rayon ≥ 0,05 U à 0° et 90°). Sur 8 hôtes chauves (graines 42, 4, 13, 16, 36, 41, 55, 67) : 10 contrôles chacun, 0 échec.
- Tests : `tests/skull-enlargement.test.ts` (nominal identique, forme de la mastoïde, position pariétale, transmission, profil 2D, hôtes chauves).

## 5. Ce qui n'est PAS corrigé, et pourquoi (à reprendre par l'agent cheveux)

Retirer `hairTh` sous une coque rend la silhouette 3D **plus étroite** que la silhouette 2D coiffée sur plusieurs styles : écart moyen signé 3D − 2D sur y ∈ [0,15 ; 0,55], ancien → sans épaisseur : short 0,027 → −0,016 ; bob 0,007 → −0,059 ; queue 0,003 → −0,056 ; long −0,042 → −0,109 ; afro −0,019 → −0,019 ; moyenne des |écarts| **0,025 → 0,039**. L'ancienne épaisseur compensait une coque qui n'atteint pas la silhouette 2D. Je n'ai donc pas échangé une erreur contre une autre.

À faire côté coque : (a) atteindre `rx` sur les rangées hautes pour bob / long / queue ; (b) rendre définis les repères de la coque **au-dessus du vertex** (avec un crâne nu complet, `hair-features-3d` et `hair-volume` échouent : normales dégénérées au sommet) ; (c) la lisière est posée avec `faceYToU` (vertex à 0,04 U) alors que le crâne nu a son vertex à 0,05 U ; (d) pointe au sommet de la coque de la graine 8 (bob) observée au rendu à 0° (spec coiffé de `hairVolumeOf`, mesure faite pendant cette tâche, non archivée en image).

## 6. Limites restantes, par composant

Voir `SKULL-VAULT-REMAINING.md` (voûte) et `SKULL-PROFILE-2D.md` (profil). Hors périmètre de cette tâche : cheveux (autre agent), arbre de pose et silhouette SVG (étape 2), rotation 2D des cheveux (étape 4).

# Erreurs rencontrées et corrections — suite (3/3)

Suite de `docs/ERRORS.md`.

## Session 9 (rotation de tête)

### 12. Deux impressions visuelles contradictoires et erronées, corrigées par une mesure précise

**Symptôme** : en vérifiant visuellement la rotation de tête à l'œil nu sur une
première scène de test, deux yeux tournés en sens opposé semblaient se
chevaucher de façon excessive — j'ai d'abord soupçonné un bug de parallaxe.
Après avoir élargi l'espacement, l'impression inverse est apparue : la
compression horizontale semblait absente (l'œil tourné à 35° paraissait aussi
large que l'œil neutre).

**Ce qui s'est réellement passé** : aucune des deux impressions n'était
fiable. Une mesure précise (comptage programmatique des colonnes de pixels
non-fond dans la bande verticale de chaque œil) a montré que la compression
correspond exactement à la physique attendue : 251px contre 307px pour l'œil
neutre, un ratio de 0,817 — à 0,002 près de `cos(35°) = 0,819`. L'écart entre
les deux impressions visuelles erronées et la réalité mesurée tient
simplement à la difficulté de juger ~18 % de différence de largeur à l'œil,
sur une image affichée en miniature.

**Correction** : aucune — le moteur était déjà correct. Seule ma méthode de
vérification a changé (mesure plutôt qu'impression).

**Leçon retenue, qui généralise la leçon de la session 6 (#8)** : une
impression visuelle sur une vignette n'est fiable ni pour AFFIRMER un défaut
ni pour l'ÉCARTER. Avant de conclure quoi que ce soit sur une variation de
pourcentage modeste (10-20 %), mesurer précisément (position de pixels,
comptage de colonnes, etc.) plutôt que de se fier à un coup d'œil — dans les
deux sens, pas seulement pour confirmer un soupçon de bug.

## Session 10 (liner ailé, cils, iris détaillé)

### 13. Collision d'identifiants SVG : deux `e-iris-clip`

**Symptôme** : un test d'opt-in (« sans `iris.detail`, aucune trace du moteur de détail ») échouait
alors que rien n'était censé être dessiné.

**Cause** : le compilateur de matériaux (`materials/compile-surface.ts`) génère déjà `<id>-clip` pour
la surface de l'iris, soit `e-iris-clip`. Mon moteur d'iris déclarait lui aussi `e-iris-clip` : avec
`iris.detail` actif, le SVG contenait donc deux `id` identiques (invalide ; le premier l'emporte).

**Correction** : identifiant renommé `<id>-idetail-clip`. Garde-fou ajouté : un test vérifie que TOUS
les `id` d'une scène combinant liner, cils longs, mèches et iris détaillé sont uniques.

**Leçon** : un test d'absence (« rien n'est émis par défaut ») est un bon détecteur de collisions de
noms ; et les identifiants SVG se préfixent par le module qui les crée, jamais par un nom générique.

### 14. Aile du liner mesurée par rapport à la tangente de la paupière : elle retombait

**Symptôme** : sur la silhouette `almond`, l'aile du liner partait vers le BAS malgré `liftDeg: 24`.

**Cause** : l'angle était relatif à la tangente de la paupière au canthus externe, qui plonge déjà
fortement à cet endroit ; relever de 24° une tangente qui descend à ~35° donne une aile qui descend
encore.

**Correction** : l'aile est orientée par rapport à l'HORIZONTALE de l'œil (vers l'extérieur) ; seul le
départ reste tangent à la paupière (continuité), infléchi à mi-chemin vers la direction voulue.

### 15. Un test de « mèches » mesurait mal la propriété visée

**Symptôme** : le test `clump` échouait alors que le rendu était correct.

**Cause** : la somme des écarts entre toutes les pointes voisines inclut les écarts ENTRE paquets,
qui ne rétrécissent pas. La propriété réelle est que les écarts AU SEIN d'un paquet se resserrent.

**Correction** : le test compare la médiane des écarts (dominée par les écarts intra-paquet) et vérifie
que les paquets restent distincts (écart maximal ≫ médiane).

### 16. Test existant intermittent sous charge (corrigé)

**Symptôme** : lors de la suite complète, `engine.test.ts › first-eye … rendu resvg OK` dépassait son
délai de 5 s (observé à ~9 s puis ~16 s) ; isolé, il passe (3 passages sur 3).

**Cause** : la machine de travail n'a qu'un cœur (`nproc` = 1). Ce test est le premier de son fichier
et paie l'initialisation native de resvg + l'analyse des polices ; en parallèle avec les autres
fichiers de tests il dépasse 5 s. L'empreinte exacte de `first-eye` n'a jamais bougé : le rendu par
défaut est inchangé, ce n'était pas un défaut de rendu.

**Correction** : `vitest.config.ts` avec `testTimeout: 30_000` (commentaire expliquant la raison).

## Session 11 (visage complet)

### 17. Le flanc de la mâchoire dépassait la largeur déclarée du crâne

**Observé** : le test de contour a échoué — `halfWidthAt` donnait 151,05 pour une demi-largeur de 150 (crâne de 300 px).
**Cause** : le point de contrôle de sortie du coin de mâchoire (`p2` de la 2ᵉ cubique) est reculé le long de la tangente ; quand le menton est plus étroit que la mâchoire, ce recul poussait `p2.x` au-delà de `W/2`, et la cubique suivait.
**Correction** : `p2.x` borné à `W/2` (`face/outline.ts`). Une cubique reste dans l'enveloppe convexe de ses points de contrôle : borner les contrôles suffit à garantir la boîte [-W/2, W/2]. Test dédié (`tests/face-geometry.test.ts`) sur tous les échantillons.
**Leçon** : le test écrit AVANT d'afficher le résultat a trouvé ce que l'œil n'aurait pas vu (1 px sur 150).

## Session 12 (cheveux, cou, pilosité, asymétrie)

### 18. Deux anciens tests échouaient dès que l'asymétrie est devenue aléatoire

**Observé** : `paire en miroir` et `indifférent à la forme et à la grosseur` (random-face.test.ts) en échec.
**Cause** : leur visage de référence venait de `generateRandomFace`, qui tire maintenant une asymétrie ; ils vérifient pourtant la symétrie miroir.
**Correction** : visage de référence explicitement symétrique (`asymmetry` à 0) ; le cas asymétrique a ses propres tests (`face-extras.test.ts`). Aucun test n'a été assoupli.

### 19. Première zone de cheveux : une calotte de 12 % de H (aspect « crâne chauve avec un liseré »)

**Observé** : au premier rendu, les cheveux étaient limités au haut du crâne ; le front restait immense sous une frange minuscule.
**Cause** : `browLimitY` valait −H/2 + 0,12 H quelle que soit la ligne des yeux.
**Correction** : `browLimitY = max(0,12 H, eyeY − 0,2 H)` — le front a une hauteur proportionnée. Les yeux restent bornés par la même limite : leur placement est inchangé, seule leur marge haute dépend de la ligne des yeux.

### 20. Défauts de rendu corrigés après lecture des images

- **Pattes et rideaux coupés net** (aspect casque) → bas en biseau (coin extérieur relevé).
- **Frange à « épaules » carrées** : ses coins hauts dépassaient le crâne (calés sur la largeur à la hauteur de la frange, plus large que celle du haut) → calés sur le contour à leur propre hauteur ; coins bas relevés.
- **Barbe de quelques jours : un rectangle au-dessus de la lèvre** → zone en forme de moustache.
- **Barbiche en « tube »** (trop longue, étroite) → longueur réduite, haut en arc sous la lèvre.
**Leçon** : les invariants (tests) garantissent le placement, pas l'esthétique ; seule la lecture des images a trouvé ces quatre défauts.

### Limite connue

Le cou se termine par une base plate élargie (pas d'épaules ni de vêtement) ; voir `docs/ROADMAP.md`.

## Session 13 (cheveux par mèches, pilosité, axes indépendants)

### 21. Une arête entre deux sommets autorisés traversait le coin de tempe (21 échecs sur 240 graines)
Le garde-fou ne projetait que les SOMMETS des mèches. Une arête reliant un sommet au-dessus de la limite des sourcils à un sommet hors du
contour coupait l'angle extérieur de l'œil. Correction : `guard.fit` subdivise (récursivement, 5 niveaux) toute arête dont le milieu tombe dans la
zone interdite. Détecté par le test existant « aucun œil recouvert » ; désactiver la projection fait échouer 55 tests.

### 22. Test de « crâne couvert » devenu faux avec une implantation réelle
Il comptait comme « à couvrir » tout point du contour au-dessus de `centerY`, or une ligne reculée ou irrégulière peut passer plus haut. Le test
lit maintenant la ligne d'implantation réelle (`geo.hairline`).

### 23. Tresses presque invisibles
Posées à `hw(y) + 0,012 W` et dessinées derrière la tête, elles étaient cachées à moitié (largeur ≈ 0,05 W). Elles sont maintenant posées hors du
point le plus large du visage (joues comprises) + leur demi-largeur, et tombent droit.

### 24. Détails d'outillage
Aire de polygone signée (`polyArea` négatif selon l'orientation) : les tests prennent la valeur absolue. Fond de scène `#333` refusé (format
`#rrggbb` imposé). `git commit` sans identité : identité locale au dépôt configurée.

### Limite connue
Les cheveux ne suivent pas encore la rotation 3D du visage entier ; une mèche texturée très serrée (crépu) est une approximation de silhouette,
pas une simulation de brin. La tresse est un motif de chevrons, pas un tressage réel à trois brins.

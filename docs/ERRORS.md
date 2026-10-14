# Erreurs rencontrées et corrections — eye-engine

Chaque entrée : ce qui a été observé, pourquoi, et ce qui a été changé.
Objectif : ne jamais re-déboguer deux fois la même chose, et ne jamais
laisser croire qu'un test vert prouve plus que ce qu'il prouve vraiment.

## Session 4

### 1. Sens du `pinch` horizontal inversé dans mes propres tests (pas dans le moteur)

**Symptôme** : `tests/brow-pinch.test.ts`, trois assertions échouaient avec
des messages du type « expected -110.8 to be greater than -100 ».

**Cause réelle** : le code du moteur était correct. C'est le COMMENTAIRE et
le SENS de mes assertions de test qui étaient inversés. Pour
`outerSide='right'` (s=+1), le canthus interne (côté nez) est à x
NÉGATIF. « Se rapprocher du nez » signifie donc un x qui devient PLUS
négatif, pas plus positif — l'inverse de ce que j'avais écrit dans le
premier jet du test.

**Comment détecté** : en lisant le message d'échec de vitest et en
recalculant à la main la formule (`xMid - s*lenPx/2 + pinchX`) pour les
valeurs concrètes du test, plutôt qu'en supposant que le test avait
raison.

**Correction** : inversion des `toBeGreaterThan`/`toBeLessThan` dans les
trois tests concernés, avec un commentaire explicite sur la convention de
signe (« le nez est du côté x négatif pour outerSide=right »). Le code du
moteur (`eye-geometry.ts`) n'a pas été modifié suite à cette erreur.

### 2. Métrique de test incorrecte pour la coordination inter-yeux (bug de test, pas de moteur)

**Symptôme** : `tests/inter-eye-coordination.test.ts`, colère ET peur
échouaient, dans les DEUX sens (colère semblait écarter, peur semblait
rapprocher) — signe classique d'une erreur de référentiel plutôt que d'un
signe simplement inversé.

**Cause réelle** : ma fonction `browHeadWorldX` ne faisait que lire la
coordonnée LOCALE du chemin SVG (repère de l'œil), sans lui ajouter la
position monde de l'ancre sur laquelle l'œil est posé. Avec les
paramètres choisis pour le test (largeur d'hôte 300, sourcil assez long),
la tête du sourcil se trouvait par coïncidence exactement à x=0 (le
centre du visage) à l'état neutre — un cas particulier où bouger dans
n'importe quelle direction depuis zéro AUGMENTE la valeur absolue, ce qui
masquait complètement la vraie direction de convergence.

**Comment détecté** : en calculant à la main la position monde attendue
(ancre + local) pour les valeurs concrètes produites par le test, et en
remarquant que le neutre tombait exactement sur 0 — un signal que le
scénario de test était un cas dégénéré, pas que le moteur avait un bug.

**Correction** : deux changements distincts au niveau du TEST (aucun au
niveau du moteur) :
1. `browHeadWorldX` prend désormais en paramètre la position monde de
   l'ancre et l'ajoute à la coordonnée locale extraite du SVG, au lieu de
   ne mesurer que la coordonnée locale.
2. La scène de test utilise un hôte plus large (600 au lieu de 300) pour
   que les têtes de sourcil soient clairement séparées du centre à l'état
   neutre (test ajouté explicitement pour ça : « ni au centre, ni
   superposées », marge > 5 px vérifiée), laissant de la place pour
   observer une convergence ou un écartement monotone sans ambiguïté de
   signe.

**Leçon retenue** : quand une assertion géométrique échoue dans les DEUX
sens à la fois pour des cas qui devraient être opposés, soupçonner un
mauvais référentiel (local vs monde) avant de soupçonner un mauvais signe
dans le code testé.

### 3. Style `'round'` visuellement trop proche de `'almond'` au premier essai

**Symptôme** : aucun test cassé, mais la vérification visuelle (rendu
`examples/eye-styles.json`) montrait un œil « round » à peine différent
de l'œil « almond » par défaut.

**Cause** : les coefficients choisis pour resserrer le canthus externe
(`upOut * 0.55`) et augmenter le bulbe (`k * 1.22`) étaient trop proches
des valeurs almond pour produire un effet perceptible à l'échelle d'un
œil normal.

**Comment détecté** : inspection visuelle directe du rendu (pas par les
tests, qui ne vérifiaient que la non-régression et la validité — aucun
test n'imposait un SEUIL de différence perceptuelle, ce qui est cohérent :
la perception visuelle n'est pas un bon candidat pour une assertion
automatisée précise).

**Correction** : coefficients renforcés (`upOut * 0.32`, bulbe `k * 1.45`)
et ajout d'un arrondi du canthus INTERNE spécifique au style `'round'`
(`innerRoundBoost`), documenté dans le code comme une exception délibérée
à la règle générale « le canthus interne ne change pas selon le style ».
Revérifié visuellement après correction.

### Ce qui n'a PAS été trouvé en erreur (vérifié explicitement)

- La cohérence de la lumière/matériaux entre l'œil et le sourcil n'a pas
  été affectée par l'ajout du groupe `<g id="{eyeId}-brow">` : les 174
  tests existants (dont les empreintes de référence SVG) sont restés
  verts sans modification, à l'exception de l'empreinte de `first-eye`
  (mise à jour délibérément après vérification visuelle du nouveau
  cadrage, pas parce que le rendu avait un défaut).
- Le style `'almond'` (par défaut) produit un SVG strictement identique
  à avant l'introduction de `shape.style` : vérifié par un test dédié
  (`eye-shape-style.test.ts`) qui recalcule la formule d'origine à la
  main, pas seulement par « les autres tests n'ont pas cassé ».

## Session 5 (refonte d'architecture)

### 4. Script de réécriture d'imports : corruption des fichiers barrel nouvellement créés

**Symptôme** : après avoir créé `expressions/index.ts` à la main (contenu correct),
le relancer du script générique de réécriture d'imports le corrompait — ses
imports internes `./apply` et `./deltas` devenaient `../apply` et `../deltas`.

**Cause** : le script déduit l'ancien emplacement d'un fichier en cherchant quelle
clé de `MOVES` a pour VALEUR le chemin actuel du fichier. Comme j'avais mappé
`"expressions" → "expressions/index"`, le script a cru que `expressions/index.ts`
lui-même ÉTAIT l'ancien `expressions.ts` déplacé, et a recalculé ses imports
internes comme s'ils partaient de la racine — alors qu'ils étaient déjà corrects
pour un fichier situé dans `expressions/`.

**Correction** : ne jamais passer le script générique sur un barrel que je viens
d'écrire à la main ; je l'ai simplement réécrit après coup à chaque fois que ce cas
s'est présenté (`expressions/index.ts`, `geometry/eye/index.ts`). Documenté comme
piège connu plutôt que corrigé dans l'outil (l'outil est jetable, utilisé une
seule fois pour cette session).

### 5. Erreurs d'extraction par plage de lignes (off-by-one) — trois occurrences

En découpant `eye-geometry.ts`, `panel.ts`, et `robot.ts` (`lens.ts`) à partir de
plages de lignes (`sed`/Python), j'ai trois fois fixé une borne de fin une ligne
trop tôt, coupant une accolade ou un `);` fermant :
- `geometry/eye/primitives.ts` : la fonction `cubicDeriv` perdait sa dernière
  accolade fermante.
- `schema/panel.ts` : la plage ne contenait pas `export const PanelSpec = z` ni
  `.strict();` / `export type PanelSpec`, seulement le corps de l'objet.
- `render/robot/lens.ts` : le dernier `body.push(el('circle', {...}))` perdait son
  `);` de fermeture.

**Comment détecté** : dans les trois cas, `tsc --noEmit` a immédiatement signalé
une erreur de syntaxe précise (`Expression expected`, `'}' expected`), jamais une
erreur silencieuse — la vérification systématique après chaque extraction a
rattrapé les trois avant qu'ils n'aillent plus loin.

**Correction** : relecture des lignes exactes autour de la borne suspecte
(`sed -n` ciblé) avant de corriger, plutôt que de deviner une nouvelle borne.

**Leçon retenue** : pour une extraction par plage de lignes, toujours vérifier la
ligne de fin ET la ligne juste après dans le fichier source avant de considérer
la plage correcte — l'erreur la plus fréquente est une borne de fin trop courte
d'une ligne, jamais trop longue.

### 6. Fonctions internes non exportées, invisibles une fois le fichier éclaté

**Symptôme** : après le découpage de `schema.ts` et de `eye.ts`, des dizaines
d'erreurs `has no exported member` / propagation en `unknown`/`never` à travers
tout le projet.

**Cause** : dans un fichier unique, un `const Place = z.object(...)` sans `export`
est accessible à tout le reste du fichier par portée de module. Une fois ce
fichier éclaté en plusieurs fichiers, cette portée partagée disparaît : tout
symbole utilisé par un AUTRE fichier du même domaine doit être explicitement
exporté, même s'il ne l'était pas dans le monolithe d'origine.

**Correction** : passe systématique d'ajout d'`export` sur tous les `const`/
`function` de haut niveau concernés, plutôt que d'exporter au cas par cas en
réaction à chaque erreur (plus rapide et évite d'en oublier).

### Vérification finale de non-régression

Au-delà des 176 tests et du typecheck, la refonte a été validée par une
comparaison OCTET PAR OCTET des 9 scènes d'exemple rendues avant/après le
refactor (voir `docs/CHANGELOG.md`, session 5). Première comparaison : les
fichiers différaient. Investigation : la différence venait entièrement d'un bloc
`<metadata><c2pa:manifest>…</c2pa:manifest></metadata>` et d'un attribut
`xmlns:c2pa` sur la balise `<svg>` racine — une signature de provenance de
contenu ajoutée par la plateforme de livraison au moment du `present_files` de la
session précédente, absente du SVG que le moteur produit lui-même. Une fois ces
deux éléments neutralisés par une comparaison, les 9 fichiers sont strictement
identiques. Point important : ne jamais conclure à une régression sur la seule
foi d'un hash qui diffère sans avoir d'abord diffé le contenu réel.

## Session 6 (archétypes : préréglages d'œil + compound_eye + gem_eye)

### 7. Collision d'id entre un identifiant choisi à la main et la convention interne de `compileSurface`

**Symptôme** : le test de scène mixte (les 6 types d'objets ensemble) échouait avec
un id dupliqué `c-dome-clip`, détecté uniquement quand `compound_eye` partageait
une scène avec d'autres objets — jamais en l'isolant seul (un œil composé seul
produit un SVG valide quand même, puisque la DUPLICATION d'une définition
identique ne casse rien visuellement, seulement l'unicité des id).

**Cause réelle** : `compileCompoundEye` appelle `compileSurface('${id}-dome', ...)`
pour le dôme, ce qui fait que `compileSurface` fabrique en interne, pour les
reflets spéculaires, un `<clipPath id="${id}-dome-clip">` — et le code du dôme
définissait LUI-MÊME, séparément, un clip pour les facettes sous le nom
`${id}-dome-clip` : coïncidence de nommage entre un identifiant « interne » de
`compileSurface` (jamais documenté comme réservé) et un identifiant choisi à la
main dans un autre fichier, sans lien logique entre les deux.

**Comment détecté** : le test qui assemble les 6 types d'objets dans une seule
scène et vérifie que tous les id du SVG sont uniques — exactement le genre de
test « qui met plusieurs fonctionnalités ensemble » que la consigne demande
d'avoir en continu, pas seulement un test par fonctionnalité isolée.

**Correction** : renommé l'identifiant propre au dôme de `${id}-dome-clip` en
`${id}-facets-clip`, qui ne peut pas entrer en collision avec un suffixe que
`compileSurface` pourrait générer (`-base`, `-diffuse`, `-env`, `-clip`, `-spec`,
`-coat`, `-halo`).

**Leçon retenue, généralisée** : tout fichier de rendu qui appelle
`compileSurface('<prefix>', ...)` NE DOIT PAS réutiliser `<prefix>` comme racine
d'un id qu'il fabrique lui-même par ailleurs (seuls les suffixes `-base`,
`-diffuse`, `-env`, `-clip`, `-spec`, `-coat`, `-halo` sont réservés par
`compileSurface`, mais le plus sûr est de ne jamais faire dériver un id maison du
même préfixe). Le test « scène mixte, tous les id uniques » (déjà présent, voir
`tests/compound-gem-eye.test.ts`) reste la meilleure protection contre cette
classe de bug — gardé et jamais retiré.

## Session 6 (suite) — bogue visuel signalé par l'utilisateur

### 8. Style 'sharp' (tsurime) : coin externe qui gonfle en bulle au lieu de rester une pointe localisée

**Symptôme signalé** : « la partie de la forme des yeux de chats est bombée,
tirée vers le haut vers la droite, montrant une déformation non équilibrée »
(archétype `feline`, qui utilise `shape.style: 'sharp'`). Visible aussi sur
l'exemple `eye-styles.json`, où je ne l'avais pas repéré visuellement — la
vignette était trop petite pour que l'œil déformé saute aux yeux.

**Cause réelle** : dans `geometry/eye/opening.ts`, le point de contrôle du coin
externe (`u2`) pour les styles `'sharp'` et `'drooping'` était calculé avec un
terme `k * hUp * 1.65` (respectivement `k * hLo * 1.35`) — une excursion qui
grandit avec la HAUTEUR de l'œil, sans plafond. Sur un œil haut (220px au lieu
des 120-130px utilisés dans mes vérifications visuelles initiales), ce point de
contrôle s'échappait à plus de 300px du coin, bien au-delà de la hauteur totale
de l'œil, gonflant toute la paupière supérieure en une bulle asymétrique au lieu
d'un petit coup de pinceau localisé au coin.

**Comment détecté** : signalé par l'utilisateur sur l'archétype `feline` en
conditions réelles d'usage — pas par les tests existants. Les tests en place
vérifiaient l'absence de NaN/Infinity et des relations d'ordre (sharp plus haut
que almond) mais AUCUN ne bornait la PROPORTION de l'excursion par rapport à la
taille nominale de l'œil. Diagnostic : comparaison de rendus à tailles croissantes
(210×130 correct à l'œil nu, 320×220 visiblement déformé), confirmant que le
défaut était proportionnel à la hauteur plutôt que constant.

**Correction** : la montée du point de contrôle est désormais bornée par
`Math.min(w * 0.16, hUp * 0.85)` — un plafond fixé par la LARGEUR de l'œil, qui
ne peut plus s'échapper avec la hauteur. Même principe appliqué à `'drooping'`
par préemption (aucun signalement sur ce style précis, mais il utilisait la même
formule non bornée sur `l1`, donc le même risque latent).

**Test de régression ajouté** : `tests/eye-shape-style.test.ts` vérifie
désormais, pour `'sharp'` et `'drooping'`, que la bbox verticale de la fente
reste un multiple raisonnable (< 1.1×) de la hauteur nominale, sur 4 couples
largeur/hauteur différents — l'ancienne formule produisait un ratio qui CROÎT
avec la hauteur (jusqu'à ~2,7× sur le cas signalé) au lieu de rester constant.
Mutation testée : la restauration de l'ancienne formule fait échouer ce test
précis.

**Leçon retenue, généralisée** : une vérification visuelle sur UN SEUL jeu de
dimensions (celui des tout premiers exemples) ne suffit pas à couvrir un
paramètre génératif comme `shape.style` — il faut tester (visuellement ET par
assertion bornée) sur plusieurs tailles/proportions avant de considérer une
géométrie paramétrique comme correcte. C'est exactement le type d'angle mort
que la consigne de « challenger constamment » demandait de chercher — celui-ci
avait échappé à six sessions de vérifications parce que les démonstrations
visuelles réutilisaient systématiquement des dimensions proches les unes des
autres.

## Session 7 (richesse de la pupille)

### 9. `docs/ROADMAP.md` affirmait un état « visible/invisible » déjà acquis pour la pupille — c'était inexact

**Constat** : avant de commencer cette session, j'ai vérifié par `grep` qu'AUCUN
champ `visible` n'existait réellement dans `src/schema/eye-iris-pupil.ts`,
alors que `docs/ROADMAP.md` (ligne « États visible/invisible ») listait déjà la
pupille comme couverte, aux côtés du highlight secondaire, des cils et du
sourcil — qui, eux, ont bien un mécanisme d'invisibilité (`count: 0`, `null`).

**Cause** : une généralisation imprécise au moment où cette ligne avait été
écrite (session 4) — la pupille n'avait alors ni `size: 0` possible (minimum
0.12) ni champ dédié, donc rien ne permettait réellement de la rendre
invisible, contrairement à ce que la ligne du tableau laissait entendre.

**Correction** : un vrai champ `pupil.visible: boolean` a été ajouté cette
session (voir `docs/CHANGELOG.md`, session 7), et la ligne de `ROADMAP.md` a
été corrigée avec une note explicite plutôt que simplement réécrite en
silence — pour qu'une relecture future comprenne qu'il y a eu une correction,
pas juste une mise à jour.

**Leçon retenue** : une ligne de statut « ✅ » dans la documentation doit être
vérifiée dans le CODE avant d'être réutilisée comme base pour une nouvelle
tâche, pas seulement citée de mémoire — exactement le réflexe qui a permis de
repérer cette inexactitude avant de bâtir dessus.

## Session 8 (moteur de cils + galerie 48)

### 10. Un test de mutation a révélé un vrai trou de couverture (pas juste validé le moteur)

**Constat** : en testant que la mutation « `lengthVariation` ignoré » fasse
échouer la suite, le test est passé À TORT (23/23 verts) — la mutation n'était
PAS détectée.

**Cause** : mon seul test sur `lengthVariation` vérifiait qu'avec la valeur à
0, deux seeds différentes produisent la MÊME longueur — ce qui reste vrai que
le code multiplie par `lengthVariation` ou l'ignore complètement (0 annule le
terme dans les deux cas). Je n'avais écrit aucun test vérifiant qu'une valeur
POSITIVE produit réellement un effet.

**Correction** : ajout d'un test positif dédié (`lengthVariation=1` produit un
écart mesurable entre cils), qui fait échouer la mutation comme attendu une
fois ajouté.

**Leçon retenue, déjà notée en session 7 mais reconfirmée ici** : un test de
mutation n'est utile que s'il révèle VRAIMENT un trou — quand il ne détecte
rien, la bonne réaction est de soupçonner le test, pas de conclure que le code
était déjà correct par chance. Un test « à 0, rien ne se passe » ne prouve
jamais qu'« à 1, quelque chose se passe ».

### 11. Isolation incomplète dans deux tests de géométrie des cils

**Symptôme** : deux tests censés isoler un seul paramètre (`lengthVariation`,
puis `archStrength`) échouaient avec un écart mesurable alors que je venais
d'annuler précisément CE paramètre.

**Cause** : la courbure (`curl`, défaut 0.6) et l'éventail (`sweep`, défaut
25°) font varier la DIRECTION de chaque cil selon sa position le long du bord
— donc même une longueur scalaire strictement constante produit des distances
pointe-base différentes d'un cil à l'autre, par pur effet de direction. Mes
tests ne neutralisaient que la dispersion statistique (`*Variation`), pas les
paramètres de morphologie de base (`curl`, `sweep`) qui, eux aussi, font
varier la géométrie observée d'un cil à l'autre.

**Correction** : `curl: 0, sweep: 0` ajoutés aux tests concernés, en plus des
`*Variation` déjà à 0.

**Leçon retenue** : pour isoler UN paramètre dans un système à plusieurs
entrées couplées, il faut neutraliser TOUTES les autres sources de variation
mesurée par l'assertion — pas seulement celles qui portent un nom évoquant
« variation » ou « dispersion ». Ici, la morphologie de base (pas seulement
les champs de dispersion statistique) influençait la métrique testée.

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

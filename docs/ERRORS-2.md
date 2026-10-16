# Erreurs rencontrées et corrections — suite (2/3)

Suite de `docs/ERRORS.md`.

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

# Erreurs rencontrées et corrections — eye-engine

Chaque entrée : ce qui a été observé, pourquoi, et ce qui a été changé.
Objectif : ne jamais re-déboguer deux fois la même chose, et ne jamais
laisser croire qu'un test vert prouve plus que ce qu'il prouve vraiment.

> Fichier découpé en parties de ≤ 200 lignes : `ERRORS.md` (sessions 4–5) → `ERRORS-2.md`
> (sessions 6–8) → `ERRORS-3.md` (sessions 9–11, le plus récent).

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
- 8 : `ERRORS-8.md` (moteur de crâne en profil, feat/skull-profile).

# Nez : calibration de la vue de dessous, protocole v2 (12 nov. 2026)

Branche `feat/hair-grammar`. Suite de `docs/NOSE-UNDERVIEW.md` §4–§5, qu'elle **corrige**. Reste à faire : `docs/NOSE-REFS-REMAINING.md`.
Régénérable : `python3 scripts/nose-refs/extract_04.py` puis `npx tsx scripts/nose-refs/fit-underview.ts` puis `npx tsx scripts/artefacts-nose-underview.ts`.

## 1 · Ce qui n'allait pas dans le protocole v1
1. **Tangage libre par nez**, ajusté sur les quatre grandeurs à la fois : il absorbait l'erreur du modèle (déjà signalé dans `NOSE-UNDERVIEW.md` §4).
2. **Mesures contaminées par le roulis** : les rapports du triangle étaient normalisés par l'étendue verticale de l'IMAGE. Or plusieurs ellipses de la réf. 04 sont inclinées
   (nez 4 : −24°, 5 : −31°, 13 : −32°, 8 : −56°, 7 : −79°). Preuve chiffrée : pour 30° de roulis, le dépassement du sommet mesuré « image » passe de 0,178 à −0,010, alors que la même
   grandeur dans le repère propre de l'ellipse reste identique (test d'invariance, `tests/nose-underview.test.ts`).
3. **`lobuleRim` fixé à 0,5**, sans mesure.

## 2 · Protocole v2
- **Repère propre de l'ellipse** (`frame` dans `measures-04.json` et dans `NoseView.frame`) : triangle exprimé le long du grand / petit axe → invariant au roulis. Il n'est retenu que si
  |angle du grand axe| ≤ 45° et rapport d'axes ≤ 0,85 ; sinon l'orientation est **ambiguë** et le nez est exclu, pas deviné : nez 7 (−79°) et 8 (quasi rond). 11 nez utilisés (le 14 reste dégénéré).
- **Identification des angles sur deux observables seulement** (`src/face/nose/underview-identify.ts`, module unique partagé par l'ajustement, les artefacts et les tests) :
  tangage et lacet d'un nez sont déduits de (rapport d'axes, |décalage latéral du sommet|). Le lacet décale la pointe (devant le plan), pas le sous-nez (dans le plan). Le **roulis est lu** sur l'angle mesuré.
- **Jugement sur trois autres grandeurs** jamais utilisées pour fixer ces angles : hauteur du triangle, position de sa base, dépassement du sommet. Le coût compte aussi l'écart sur les deux grandeurs
  d'identification (un premier essai sans ce terme trouvait un optimum **dégénéré** : r ≥ 0,55 impossible à descendre alors que 4 nez valent 0,34–0,46).
- **Toutes les erreurs sont normalisées par l'écart-type de la grandeur** sur les références : l'erreur est une fraction de variance non expliquée ; la médiane sans modèle vaut ≈ 1 par construction.
- Leave-one-out : constantes réajustées sans le nez i, angles du nez i identifiés par ses deux grandeurs, trois autres prédites. Références de comparaison au même protocole : médiane, et régression linéaire sur (r, |u|).
- Identifiabilité : profil du coût pour chaque constante (plateau = coût ≤ minimum + 0,02) et bootstrap des nez (B = 8, petit : indicatif).

## 3 · Résultats (n = 11, `underview.generated.ts`, `metrics.json`)
| indicateur (erreur normalisée, 1 = « aucune information ») | valeur |
|---|---|
| modèle ajusté, en échantillon | 0,947 |
| médiane sans modèle, en échantillon | 1,019 |
| modèle, leave-one-out (5 grandeurs) | 1,090 |
| médiane, leave-one-out | 1,124 |
| sur les 3 grandeurs PRÉDITES : modèle LOO / régression (r, \|u\|) LOO / médiane LOO | **1,349** / 1,228 / **1,038** |
| ancien jeu de constantes (v1) évalué au protocole v2 | 1,471 |

**Lecture honnête.**
- **Retrait d'une affirmation** : `NOSE-UNDERVIEW.md` §4 annonçait « le modèle réduit l'erreur d'environ 28 % ». Sous un protocole équitable ce n'est **pas vrai** : le modèle est à égalité avec la médiane en LOO
  (1,09 contre 1,12) et **moins bon qu'elle** sur ce qu'il prédit réellement (1,35 contre 1,04). L'ancienne calibration était, en plus, nettement fausse une fois le roulis compensé (1,47).
- **Aucun jeu de constantes ne rend ce modèle prédictif.** Le meilleur (0,947) est un coin dégénéré : `alarTop` et `alarBase` sur la borne 0,95 (aile aussi avancée que la pointe) ; l'enveloppe devient quasi
  ronde dès 40° de tangage (r ≈ 0,95) et la vue n'est plus valide au-delà ; elle ne sait pas descendre sous r ≈ 0,55. Les jeux intermédiaires essayés (ailes 0,6/0,4 et 0,75/0,6) sont pires que la médiane (2,15 et 1,54).
- **Identifiabilité** : `alarBase` NON identifié (profil monotone, chute brutale à la borne : 1,34 → 0,95) ; `alarTop` sans effet utile (contraint par `alarTop ≥ alarBase`) ; `nostril` plateau 0,68–0,86 (large) ;
  `lobuleRim` plateau étroit 0,14–0,32 (le 0,5 fixé est hors plateau : coût 1,44), **mais conditionnel** aux ailes dégénérées, donc non adopté.
- Cause probable (hypothèse, non testée) : le modèle compare UN nez par défaut à 11 morphologies différentes ; la variation entre les nez de la réf. est surtout morphologique, pas une rotation du même nez.
  Laisser varier des axes morphologiques par nez rouvrirait la critique des degrés de liberté libres : à ne faire qu'avec un protocole défini d'avance.

## 4 · Décision
`UNDERVIEW_MODEL` (utilisé par le rendu) **reste le jeu v1**, explicitement étiqueté « a priori, non validé » dans `underview-model.ts`. L'optimum dégénéré est conservé comme `UNDERVIEW_FITTED` (résultat négatif traçable, jamais utilisé pour le rendu).
Changer le rendu sur cette base dégraderait la silhouette sans preuve de gain.

## 5 · Superposition sur la réf. 04, recalculée honnêtement (`01-superposition-ref04.png`)
Angles lus sur les observables (tangage, lacet par r et |u|, signe du lacet par le signe du décalage mesuré, roulis par l'angle de l'ellipse) ; le sommet n'est PAS utilisé pour placer le moteur.
- Écart médian du sommet : **31,4 % du petit axe** (27,6 % sur l'ancienne normalisation par l'étendue verticale). Les « 22,7 % » annoncés avant venaient d'un tangage ajusté sur le sommet : non comparables.
- Placement « médian » sans modèle (sommet au décalage médian du repère propre) : **23,0 %**. Le modèle ne fait mieux que lui que pour **3 nez sur 11** (6, 11, 3).
- Pour 5 nez sur 11 (1, 5, 9, 11, 13) l'identification sature à tangage 0° : le modèle ne reproduit pas leur rapport d'axes (≤ 0,50) avec un tangage ≥ 0. Pour les nez 3 et 10 elle choisit un lacet de 52° qui incline
  lui-même l'ellipse de ≈ 44° (roulis « lu » −58°) : configuration à ne pas prendre pour une vue réelle.
- Conclusion de l'écart « 68 % sur les vues obliques » : il était en grande partie un artefact de comparaison (roulis et lacet non pris en compte) ; une fois corrigé, l'erreur reste forte (37–98 % sur les nez 1, 5, 9, 13), donc le défaut est aussi structurel.

## 6 · Tests
`tests/nose-underview.test.ts` (28) : invariance au roulis des grandeurs du repère propre (et dérive des grandeurs « image »), 11 nez valides / 7 et 8 exclus, résidu stocké recalculé, **résultat négatif verrouillé**
(le test échouera si le modèle devient réellement meilleur : bonne nouvelle, alors mettre ce document à jour), non-identifiabilité d'`alarBase`, optimum ajusté distinct du jeu adopté, déterminisme de l'identification.

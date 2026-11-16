# Nez : plafond du rapport L/H, planche 06 re-comparée, réf. 02 / 01, estimateurs d'ellipse (14 nov. 2026, passe 2)

Suite de `NOSE-REFS-REMAINING.md`. Tout ce qui est chiffré ici est recalculé par `tests/nose-refs-aspect.test.ts` (9 tests). Preuves : `artefacts/nez-aspect-plafond/` et `artefacts/nez-refs/`.

## 1. Le « 0,825 » : cause établie (restait « non établie »)
`scripts/nose-refs/aspect-ceiling.ts` mesure (sortie `references/nez/aspect-ceiling.json`). L/H de la silhouette = largeur ÷ (base du nez − racine).
- **Trois bornes se cumulaient dans l'ajustement v1** : (a) l'évasement des ailes est allé à sa borne basse 0 (ailes les plus étroites) ; (b) la largeur était bornée à 0,28 alors que le schéma va à 0,3 ; (c) `nose.root.height`, qui fixe le HAUT de la silhouette, n'était pas exploré. Ce jeu donne exactement **0,8248** (test).
- **Axe inerte** : `nose.length` explorait 0,10–0,25, mais le moteur `structured` le ramène au plancher de zone (`ZONE_LIMITS.nose.min = 0,17`). Les longueurs 0,115 / 0,126 / 0,15 / 0,161 des archétypes v1 n'avaient AUCUN effet : de 0,08 à 0,17 la silhouette est identique (test).
- **Plafond réel** : racine 0, évasement 1, largeur 0,3, longueur 0,17 → **L/H = 1,399**. Donc plat-trapèze (1,23) et cloche-ailes (0,98) sont atteignables ; **ellipse large (1,60) et losange (1,52) ne le sont pas** par la silhouette de face (elle part de la racine, pas du lobule) : `02-plafond-LH.png`.

## 2. Réajustement des archétypes (axes libérés) et planche 06 re-comparée
`scripts/nose-refs/fit.ts` : longueur ≥ plancher de zone, largeur ≤ 0,3, `nose.root.height` ajouté. Même fonction de coût qu'avant (le test la recalcule). v1 conservé dans `references/nez/fit-06-v1.json`.

| Forme | résidu v1 → v2 | L/H réf. | L/H v1 → v2 |
|---|---|---|---|
| pyramide | 0,073 → 0,072 | 0,73 | 0,74 → 0,73 |
| cloche-ailes | 0,139 → 0,123 | 0,98 | 0,83 → **0,98** |
| plat-trapèze | 0,214 → 0,164 | 1,23 | 0,83 → 1,11 |
| losange | 0,391 → 0,310 | 1,52 | 0,83 → 1,04 |
| ellipse large | 0,518 → 0,441 | 1,60 | 0,83 → 1,05 |

Lecture de `06-superposition.png` (silhouettes sur la planche réelle) : pyramide et cloche-ailes suivent la référence ; plat-trapèze, losange et ellipse **restent visiblement différents** (le moteur garde un col d'arête étroit que les aplats n'ont pas). Résidus toujours > 0,15 pour ces trois : **non reproduits**, `REPRODUCIBLE_MAX` inchangé. Le gain sur plat-trapèze (0,214 → 0,164) ne passe pas le seuil.
Têtes complètes (`01-tetes-archetypes.png`, moteur `structured`, mêmes graines) : la différence cloche-ailes v1 → v2 est **subtile** (ailes un peu plus larges) ; la pyramide allonge nettement le nez. Je ne la présente pas comme spectaculaire.

## 3. Conséquence sur la vérification (test modifié, motif)
Avec la cloche-ailes v2, la carte « champignon » v1 n'a plus de col détectable à 40° (marge −0,23) : le contrôle négatif devenait aveugle sur ce nez. Le jeu de constantes v1 est GELÉ comme nez témoin dans `tests/nose-lit-verify.test.ts` (`CLOCHE_V1`) ; les règles positives restent appliquées aux archétypes actuels. Aucun seuil n'a été relâché.

## 4. Réf. 02 quantifiée (8 nez au trait propre)
`scripts/nose-refs/extract_02.py` → `references/nez/measures-02.json`, `artefacts/nez-refs/02-overlay.png`. Une première passe (dilatation 6) a coupé 3 nez sur 8 (L/H max 2,49) : détectée sur l'overlay, corrigée (dilatation 16, bande de ±3 px) ; les 8 boîtes sont vérifiées à l'œil.
- **Seule grandeur robuste : L/H de la boîte d'encre, médiane 0,59, étendue 0,45–0,84.** Nez par défaut (0,55) et pyramide (0,73) DANS l'étendue ; cloche-ailes (0,98, issue de la planche 06, autre vue) HORS étendue (test).
- Rapports haut/max et bas/max du profil : sortis dans le JSON mais **non fiables** (un trait mince, un point isolé fait varier le bas de 0,01 à 0,80) : aucune conclusion moteur n'en est tirée.
- Limites : traits, pas aplats ; 5 nez sur 8 en trois quarts ; 8 nez = échantillon petit.

## 5. Réf. 01 : partiellement quantifiée (🟡, pas ✅)
`extract_01.py` → `measures-01.json`, `01-overlay.png`. 21 amas ; lecture visuelle : **17 valides**, 4 exclus (2 coupé, 10 = deux nez fusionnés, 14 chevauche 16, 16 = nez + signature) ; la liste d'exclusion est SAISIE après lecture de l'image, elle n'est pas déduite. L/H des 17 : médiane 0,87, étendue 0,51–2,29 (la boîte inclut les hachures d'arête). **Narines, lobule et reflet de pointe NON mesurés** (traits trop fins, fond moucheté) ; aucune règle du moteur n'en dépend.

## 6. Estimateur d'ellipse : écart quantifié
`ellipse-estimators.ts` + `.py` → `references/nez/ellipse-estimators.json` : moments d'aire (moteur) contre `cv2.fitEllipse` (mesure) sur les MÊMES enveloppes, 6 nez × 3 tangages × 2 lacets = 36 cas. Rapport d'axes : écart médian 1,6 %, max 4,6 % ; angle : médian 0,04°, max 0,6° ; grand axe ×1,00–1,04. **Négligeable** devant le lacet/roulis non modélisés (22–68 %). Limite : enveloppes propres du moteur, pas contours rasterisés bruités.

## Reste (voir `NOSE-REFS-REMAINING.md`)
Archétypes toujours non branchés dans le générateur aléatoire (qui tourne en moteur `classic`, où le plancher de zone et donc cette analyse ne s'appliquent pas : à étudier avant tout branchement) ; vue de dessous non branchée dans `head_3d` ; matériau/texture propres au nez ; ellipse/trapèze/losange non reproduits.

**Mise à jour (v3)** : `NOSE-PLATE06-GLOBAL.md` — un optimiseur global ramène le plat-trapèze à 0,134 (< 0,15) ; ellipse large et losange restent hors de portée. Les chiffres v2 ci-dessus sont conservés (`references/nez/fit-06-v2.json`).

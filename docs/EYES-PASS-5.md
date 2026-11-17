# Yeux — passe 5 : réponse à l'audit des cils (`Audit_cils.md`)

Chaque affirmation de l'audit a été vérifiée contre le code et les données, pas relue. Verdicts : ✅ confirmé · 🟡 confirmé mais nuancé · ❌ réfuté / déjà vrai · ➕ trouvé en plus.
Tout est reproductible : `python3 scripts/eye-refs/extract_lashes.py` → `cluster_lashes.py 4` → `npx tsx scripts/artefacts-eyes-pass5.ts` → `artefacts/eyes-pass5/`.

## 1–2. Couverture et segmentation
- ✅ La réf. 17 n'entrait pas dans l'extraction des cils. **Essayée puis rejetée** : les boîtes de `eyes_of` ratent les éventails de cils (yeux 1, 4, 17, 19), prennent des sourcils pour des yeux
  (13, 15) et incluent une tuile coupée (0) → `artefacts/eyes-pass5/05-ref17-extraction-rejetee.png`. Il faut un détecteur à cellules annotées (comme 14/15), pas un seuil. Reste à faire.
- ✅ Segmentation heuristique : l'orientation (paire / ancre / heuristique) est déjà consignée par œil dans `measures-lashes.json`. Les ancres CELLS sont des **annotations humaines** et sont
  désormais nommées comme telles dans `extract_iris_colour.py` (champ `annotations`) ; la couche « confiance » demandée est faite pour les iris (`fiable` / `ambigu`, relecture visuelle consignée).
- ➕ **Bug d'extraction que l'audit n'a pas vu** : `bendDeg = a1 − a0` (et `startAngleDeg`, `endAngleDeg`, angles de pointes) n'étaient pas ramenés à ±180°. **54 traits sur 437** avaient
  |bendDeg| > 180°, physiquement impossible. Corrigé (`wrap180`), mesures régénérées (mêmes 66 yeux, 437 traits). Effet : les médianes des cils du **bas** changent beaucoup
  (départ réf. 12 : 51° → −15°, réf. 16 : 100° → −43°) ; celles du haut peu (réf. 12 : 78° → 74°). Garde-fou : `tests/eye-lash-corpus.test.ts` (aucun angle hors ±180°).

## 3. Synchronisation des données ✅
- 49 yeux éligibles (≥ 2 traits hauts) contre **27** lignes dans l'ancien `lash-families.json` : sortie périmée. Le script lui-même ne tournait plus (`bodyCenterX` n'existe plus dans le schéma v2).
- Réécrit sur le schéma v2 ; la sortie porte `meta` : version de l'extracteur, empreinte SHA-256 des mesures, paramètres, yeux **inclus / exclus avec motif**. Test : empreinte identique
  aux mesures présentes ; inclus + exclus = tous les yeux ; groupes < 3 yeux marqués `singular`.
- `12-11` ✅ n'existe pas (réf. 12 : `12-00` → `12-10`). 41 sources distinctes citées par les familles, 1 seule absente. Retirée ; test « toute source citée existe ».

## 4. Clustering
- 🟡 **4.1 « variables calculées non exploitées »** : `lean` n'existe plus dans le schéma v2, et son signe n'est **pas normalisé** (le signe de `startAngleDeg` dépend de l'orientation verticale
  de la planche : réf. 15 haut −81°, bas +85°) : l'utiliser aurait mélangé des conventions. `baseWidth` est disponible (`--with-lean-width`). La variable « touffe » du script valait **1,0 pour tous**
  (`ends` = extrémités du squelette, toujours ≥ 2) : remplacée par la part de pointes de silhouette `clump > 1`.
- ✅ **4.2 groupes trop petits** : avec K = 4 sur 49 yeux : groupes de 2, 2, 41 et 4. Un clustering à 41/49 n'est pas une taxonomie. Les petits groupes sont marqués `singular` (singularité ou erreur
  d'extraction) ; le fichier porte `status: exploratoire`.

## 5. Les dix familles
- ❌ **5.1 « pas issues des clusters »** : c'est le choix du moteur, pas un défaut : les familles sont des intentions artistiques écrites à la main, le clustering est un outil de contrôle. Rien changé,
  désormais écrit en tête de `lash-families.json` et du script.
- ✅ **5.2 incohérence des sources** : voir `12-11`. ✅ **5.3 presets, pas grammaires** : vrai (nombre, longueur, courbure fixes par famille). Non traité (voir « Reste à faire »).

## 6. Fusion et génération
- ✅ **6.1 fusion des paramètres** : l'ordre était `{...existant, ...INK, ...famille}` : l'encre écrasait matériau, opacité, brillance et variation de teinte alors que le commentaire disait
  « conservé » ; le bas était forcé à 0,9. Contrat explicite : `applyLashFamily(eye, id, { ink: 'family' | 'keep' })`. `'family'` (défaut) garde le rendu actuel ; `'keep'` ne règle que la structure.
  Tests : apparence conservée / imposée ; `artefacts/eyes-pass5/02-contrat-encre-keep-family.png`.
- ✅ **6.2 même famille sur les deux yeux** : vrai. 🟡 Anatomiquement, une forte asymétrie de famille est incohérente (les deux yeux d'un visage ont le même style de cils) ; seule une variation
  **bornée** (nombre ± 1–2, longueur ± 10 %) serait crédible. Non fait.
- ✅ **6.3 `random-eye` indépendant** : vrai (aucune référence aux familles). Non branché.

## Les six points « à résoudre »
| Point | État |
|---|---|
| Distance minimale de la galerie 0,0089 | ✅ **0,0201** (≥ 0,02, comme aux 48 existants). Agrandir le pool (320 → 5 000) ne change **rien** (0,0095–0,0121) : `diamond` et `diamond_v2` saturent. Quotas **adaptatifs** : diamond 4, diamond_v2 5, circle 12, chibi 12. Interleave glouton (jamais deux enveloppes identiques de suite). |
| Règle « cils » dans la vérification par pixels | ✅ 3 contrôles : ligne médiane hors de l'ouverture (géométrie), encre sombre (anatomie), encre en aplat (style) — échantillons de corps ≥ 3 px. 0 échec sur la galerie des 100 et sur 10 familles × 8 yeux. |
| Encre non en aplats noirs francs | ✅ Mesuré : encre des réfs 12, 13, 15, 16 = luminance médiane **0–2**, neutre ; moteur : `#120e18` (**14**, bleutée). Remplacé par `#040404` (rendu : 4). Réfs 14 (34) et 17 (57) = autres styles, non utilisées. |
| Épaisseurs liner / dispersion / rayons « interprétés » | 🟡 Encre mesurée ; **iris mesurés** (voir ci-dessous). Épaisseur du liner et dispersion restent **interprétées** : voir « Reste à faire ». |
| 24 cils recouvrent encore l'ouverture | ✅ **0** sur 19 021 : rotation ≤ 50°, puis raccourcissement, puis **amincissement** (les 24 étaient des mèches du bas plus larges que longues, 18–28 px pour 4–13 px), puis omission (8 cils, racine déjà dans la fente). |
| 100 formes et almond non retravaillés | ⬜ Seule la **distinction** a été traitée (distance, quotas). Almond et forme des 100 : non retravaillés. |

## Iris colorés (réf. 14 et réf. 15 rangées 3–5) — `extract_iris_colour.py`
- Mesure : ellipse d'iris (rx, ry / largeur d'œil), pupille, reflets, anneau d'encre. Une mesure n'est `fiable` que si le critère automatique **et** la relecture visuelle l'acceptent.
- **7 fiables** : 14-01, 14-03, 14-05, 15-04, 15-05, 15-08, 15-09. **5 ambigus** (gardés) : 14-00 et 14-04 (partiels), 14-02 (sous-segmenté), 15-06 et 15-07 (ellipse inclinée à tort).
- Résultat : rx/L médiane 0,205 (0,176–0,238) ; hauteur/largeur médiane **1,15** (1,06–1,33). Moteur (galerie) : rx/L 0,148–0,361, hauteur/largeur 1,00–1,22 (p10–p90) →
  la largeur est couverte, **le plafond de hauteur/largeur du moteur est plus bas que celui des références** (1,22 contre 1,33). Constat, pas encore branché.
- ❌ **Silhouette de la réf. 14 : non mesurable** (sclère blanche sur fond blanc, bord bas de paupière ouvert : aucun polygone fermé). Consigné, aucune forme inventée.

## Reste à faire (aussi dans `EYES-REMAINING.md`)
Détecteur de cellules pour la réf. 17 · 8 yeux de la réf. 13 non tracés · hauteur/largeur d'iris jusqu'à 1,33 dans la galerie · mesure de l'épaisseur de liner et de la dispersion (pixels) ·
variation bornée entre les deux yeux · branchement des familles dans `random-eye` · reprise de l'almond et de la forme des 100 · iris 14-00/14-02/14-04 et 15-06/15-07 à resegmenter.

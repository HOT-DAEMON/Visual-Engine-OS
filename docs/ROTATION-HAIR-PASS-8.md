# Cheveux sous rotation — passe 8 (mèches conformes au crâne)

Branche `feat/hair-grammar`. Suite de `ROTATION-HAIR-PASS-7.md` (§3.1 « longs à ±30–45° » : traité ici ; le reste de §3 y reste la référence). Preuves : `artefacts/rotation-hair-pass-8/` (planches avant/après de têtes entières, `mesures-avant.json`, `mesures-apres.json`). Scripts : `scripts/rotation-hair-pass8-proof.ts` (planches), `scripts/rotation-hair-pass8-metrics.ts` (mesures, même script sur l'ancien commit et sur le nouveau).

## 1. Fait dans cette passe
| # | Sujet | Statut |
|---|---|---|
| 1 | Mèche qui traverse la joue (longs / bob à ±30–45°) : cause établie et corrigée | FAIT |
| 2 | `poseLock` : sommets du contour ET ligne médiane = projection exacte du crâne (`Skull.projectX`), comme les masses | FAIT |
| 3 | Contrat de largeur redéfini sur une enveloppe MESURÉE (`STRAND_STRETCH`) | FAIT (coût : voir §3) |
| 4 | Règles de vérification `pose.strand-conform`, `pose.strand-face-cover`, `pose.strand-stack` + contrôles négatifs | FAIT (la règle « recouvrements » de PASS-7 §3.1 est faite, mais ce n'est PAS un détecteur de la joue : voir §4) |
| 5 | Rideau de mèches empilées / dalles côté proche (9002) | FAIT en grande partie à l'œil ; la mesure d'empilement ne le voit pas (§4) |

## 2. Diagnostic (mesuré, pas supposé)
Ancienne carte (`strandMap`) : une mèche était translatée avec sa racine et sa pente de projection plafonnée à 1. Dès que la mèche suit le crâne sur une grande étendue (mèche de balayage du sommet vers la tempe, étendue x 27 → 163 px à 0°), sa queue ne suit plus la surface : elle reste à l'intérieur de la silhouette et traverse le visage.
- **Écart ligne médiane posée ↔ projection exacte** sur 84 cas (7 coiffures × 3 graines × ±30/±45°) : par cas, médiane **73,8 px**, p90 111,7 px, max **125 px (0,36 W)**. Après : 0.
- **Visage couvert par des mèches** (sous les sourcils, 80 % de la demi-largeur ; posé − face) : avant max **23,9 points** (long 9002 à +45°), p90 2,8 ; après max **3,6**, p90 0,7. À 0° la zone est vide.
- Piège découvert : pour ces mèches la ligne médiane n'est PAS au centre du contour (spine x 12→72, contour x 27→163 : le contour a été repoussé par `guard.fit` après la ligne médiane). Un « ruban » (contour = ligne médiane + décalage borné) a été essayé : faux pour elles (décalages de 90 px), abandonné ; la projection sommet par sommet est la seule carte cohérente avec la coque.
- Planches comparées sur 10 coiffures : courte / pointes / bouclée / afro quasi inchangées (ce sont des masses), bob / long / tresses nettement plus propres (`artefacts/rotation-hair-pass-8/01…03`).

## 3. Contrat modifié (honnêteté)
Avant : largeur par rangée × [0,45 ; 1] (jamais étirée). Après : enveloppe **mesurée** `STRAND_STRETCH = [0,05 ; 3,5]` (`hair-pose-strand.ts`). Mesuré sur 21 896 mèches : max 3,10 (p90 2,17), min 0,09 ; par cas, la mèche la plus étirée vaut ×2,9 en médiane.
- Une mèche vue de profil à 0° (limbe) et qui se présente à 45° devient **plus large** : c'est la surface qui se déplie, pas un défaut ; mais le dessin de face n'a pas de largeur « vraie », donc ×3 peut être trop. Non tranché ; à juger sur planches à ±60° (§6).
- `w0` (largeur de racine lue par le rendu) garde l'ancien facteur [0,45 ; 1] : il peut donc être plus petit que la largeur du contour. Pas de défaut vu ; à unifier.
- `strandMap`, `rowCache`, `STRAND_SCALE` restent exportés (tests de pente, `w0`) mais ne positionnent plus les mèches ordinaires. Pièces attachées (queue, chignon) : inchangées (rigides).
- `poseLock` perd son paramètre `rows` (plus de table d'intégrale).

## 4. Règles de vérification (`src/verify/hair-pose-strands.ts`)
| Id | Couche | Seuil (mesuré) | Contrôle négatif |
|---|---|---|---|
| `pose.strand-conform` | géométrie, erreur | écart ≤ 1e-6 W (avant : 125 px) | lignes médianes décalées de 20 px |
| `pose.strand-face-cover` | anatomie, erreur | posé − face ≤ 0,05 (après : max 0,036 ; avant : 0,239) | dalle posée au milieu du visage |
| `pose.strand-stack` | style, avertissement | p95 d'empilement posé / face ≤ 1,5 | mèches triplées |
- **Limite honnête** : `pose.strand-stack` ne discrimine pas la joue traversée. Mesuré : médiane 1,00, p90 1,25, max 1,29 après ; 0,88 / 1,00 / 1,00 avant (l'ancien code empilait MOINS). C'est une garde contre le doublement de mèches ; l'opacité cumulée des semi-transparences n'est pas mesurée.
- Corpus `checkHairPose` : 10 coiffures × 3 graines × 6 lacets, aucune erreur (`tests/hair-pose-strands.test.ts`, 14 tests).

## 5. Tests
- `tests/face-pose-hair-strands.test.ts` : test « passe 8 » (tout sommet = projection exacte, ordonnées intactes, > 100 000 sommets) ; contrat de largeur sur `STRAND_STRETCH`.
- Régression à 0° : `scripts/regress.ts check` inchangé (à lacet nul `poseHair` rend l'objet d'origine).
- Batterie `tests/hair-*`, `tests/face-pose*`, `tests/rotation*` (35 fichiers, lancée avant l'ajout de `hair-pose-strands.test.ts`) : 843 tests verts + 1 échec attendu historique ; un test de lisière (`hair-boundary`) a dépassé 30 s sous charge et passe seul (59/59). `hair-pose-strands.test.ts` : 14/14 à part.

## 6. Reste à faire, par composant
1. **Dalle à bord droit au flanc** (9004 à ±45°) : la patte / l'aile du côté qui se présente montre sa forme rectangulaire (dessinée de face, vue de biais). Il faut une extrémité effilée dessinée à la construction, ou un fondu de lisière sous pose. NON TRAITÉ.
2. **Fines diagonales sous la mâchoire** (9004 à −45° / −30°, absentes en rasé et en court : ce sont des mèches) et **éventail de mèches sur le cou** (9000 à −45°). Cause établie : 8 mèches `fine` / `hairline` (largeur 0,5–4,3, ex. #167 #169 #172 #198 #215 #254 #269 #271 de 9004) descendent jusque sous la mâchoire ; leur ligne médiane (x≈100, y −111→38) n'est PAS leur contour (x 91→164) ; et `Skull.hangHalf` vaut la largeur de MÂCHOIRE (142 px, un cylindre) sous la mâchoire : un point à |x| < 142 y est traité comme posé sur une surface avant qui n'existe pas (le menton se rétrécit), donc il glisse sur le menton. Les diagonales existaient avant la passe 8. Décision de modèle à prendre (pas un patch) : profondeur des cheveux sous la mâchoire (rigide à profondeur d'ancre, comme queue / chignon, avec fondu sur une bande sous `jawY`, ou ancrage au contour du menton). Piège : ne pas toucher à `hangHalf` sans repasser `pose.mass-thickness` et la planche des longs. NON TRAITÉ.
3. **Profondeur avant / arrière** : le dessin de face ne dit pas si une mèche est devant ou derrière le crâne ; la projection la met sur la face avant. Décision « vue de dos : profondeur par courbe » toujours à prendre avant le tangage. NON TRAITÉ.
3 bis. **Patte (côté qui se présente) à ±45°** : rectangle à bord intérieur droit avec un crochet vers l'oreille (contour `boundary.segment('sideburn')` x' 126→150, y −110→−18 sur 9004 à −45°, visible aussi en « court »). Elle est dessinée de face, donc « foreshortened » : vue de biais elle montre sa vraie forme mécanique. Piste : extrémité effilée dessinée à la construction + fondu de lisière sous pose. NON TRAITÉ.
3 ter. **Oreille proche absente à −45° pour TOUTES les coiffures** (rasé, court, long ; elle est dessinée à −30°) : défaut du visage, pas des cheveux, découvert en comparant les têtes entières ; il rend la zone de la patte vide. À traiter avec la tranche 7. NON TRAITÉ.
4. **Coque rasée ±45° côté lointain, coque `base` posée, tranche 7 (cou, crochets d'oreille, base afro), crâne asymétrique 0,92 / 1,14, tangage / roulis, coin de bouche à 30°, halo et ombre du menton** : repris de `ROTATION-HAIR-PASS-7.md` §3.2–3.7, NON TRAITÉS dans cette passe.
5. **Validation à ±60° / ±75°** des mèches projetées exactement (étirement ×3 ?), et de toutes les coiffures (la planche de preuve ne porte que 8 coiffures × 3 lacets).
6. **Opacité des recouvrements** (semi-transparences superposées) : non mesurée.

## 7. Méthode
- Comparer avant / après avec un `git worktree` sur le commit précédent et le MÊME script (`rotation-hair-pass8-metrics.ts`).
- Mesurer la grandeur qui discrimine le défaut visible (visage couvert) avant d'écrire la règle ; vérifier que l'ancien code la viole (`23,9 > 5`).
- Ne jamais fixer un seuil avant mesure ; un contrôle négatif par règle.

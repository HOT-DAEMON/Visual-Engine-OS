# Moteur capillaire — passe 5 : la raie comme sillon, ombre de peau suivant la lumière

Code : `src/hair-grammar/{observe-part,part-line,part-edits,part-shape}.ts` (nouveaux) · `{observe-structure,dome,intent-run,repair,repair-local,repair-dome,compose-verify,part,reference-fit}.ts` (modifiés) · `src/render/face/hair-skin-shadow.ts` (nouveau) · `src/render/face/hair.ts`, `src/face/hair/sim/drape.ts`
Tests : `tests/hair-engine-part.test.ts` (19) · `tests/hair-skin-shadow.test.ts` (4). Suite capillaire complète : 49 fichiers, 1003 tests verts.
Preuves (têtes entières) : `artefacts/hair-engine-pass5/` (4 planches + `metrics.json`) — régénérées par `npx tsx scripts/hair-grammar/artefacts-pass5.ts`.
Reste à faire par composant : `HAIR-PASS5-REMAINING.md`. Étude de la segmentation : `HAIR-PASS5-SEGMENT.md`.

Méthode : chaque ligne de `HAIR-PASS4-REMAINING.md` a été relue ; la cause a été MESURÉE avant de coder ; aucun seuil n'a été relâché pour « passer ».

## 1. Raie — le diagnostic (« la netteté baisse en moyenne »)
- L'ancienne mesure prenait la colonne la MOINS couverte de la calotte : elle lisait donc une large fenêtre chauve comme une raie. Le remplissage de calotte (`anat.dome`) comble une fenêtre PAR DÉFINITION : la « netteté » baissait (0,85 → 0,76 ; 0,77 → 0,50) sans que la raie ait changé. Ce n'était pas une régression du remplissage mais une métrique qui mesurait autre chose.
- Une raie est une LIGNE de crâne à découvert, mince, entre deux rideaux de mèches. Une fenêtre chauve est un manque de mèches. Les deux objets sont maintenant distingués partout.
- Mesure sur 9 cas (raie −0,4 / 0 / +0,4 × graines 1–3, de face, génération brute) : sillon lu **3/9 avant → 9/9 après** (planche 02 ; fenêtres avant : 0,43–0,75 rx).

## 2. Ce qui a été construit (cinq pièces qui partagent UNE lecture)
- `observe-part.ts` — observateur de sillon sur une référence (pixels) : sillon (course de colonnes vides ≤ `GROOVE_MAX_H` = 0,14 H) vs fenêtre (plus large, rapportée à part, jamais comptée comme netteté). Référence de couverture = 75e centile (la médiane tombait à 0 quand la fenêtre dépassait la moitié des colonnes jugées).
- `part-line.ts` — lecture EXACTE sur la ligne de crâne `x = xp` projetée (élévation 30°–89°) par intervalles de balayage sur les contours des lames (≈ 0,3 ms une coiffure). Couloir libre (± `PART_HALF` = 0,035 H) + ouverture entre les deux rideaux. Valable à tous les lacets (la mesure par colonne ne valait que de face). Lecture incrémentale (`withLock`) : des centaines de candidats évalués sur la mesure exacte.
- `part-shape.ts` — génération : `clearCorridor` (écarte les mèches qui recouvrent le couloir) puis `closeFlanks` (ajoute jusqu'à 8 mèches-rideaux le long de la tangente 3D de la ligne, 3 familles essayées, racine jusqu'à 0,08 H au-dessus de l'échantillon visé). Objectif `10 × excès + ouverture moyenne`, visé à 0,85 × le plafond.
- `part-edits.ts` + `repair-local.ts` — le solveur local connaît la raie : une mèche qui recouvre le couloir coûte `PART_SEVERITY`, et ses éditions candidates incluent l'écartement latéral. **Cause des chutes par graine** (intention complète graine 5 : 1,00 → 0,09), hypothèse de la passe 4 COHÉRENTE avec le test de non-régression de la graine 5 (vert avec les gardes ; non rejoué sans) : les réparations locales poussaient des mèches sur le couloir, et le remplissage de calotte le recouvrait (`repair-dome.ts` ne testait que la zone, pas la ligne). Gardes : `crossesPart` exact dans le remplissage, phase 2b `clearCorridor`, phase 3b `closeFlanks`.
- `compose-verify.ts` — contrôles `raie : couloir libre` et `raie : sillon étroit (netteté ≥ 0,6)` ; défauts `style.part` (par mèche) et `style.partgap` (global). Même lecture que la génération, le solveur et le remplissage : ils ne peuvent plus se contredire.

## 3. Lisibilité — règles de jugement (pas de victoire par absence)
- L'ouverture ne se juge qu'à partir de 45° d'élévation (plus bas, c'est le front, où la frange naît plus haut) ; si moins de 4 échantillons y sont, on juge les 4 plus hauts (une raie décentrée de face n'a que 7 échantillons, tous < 48°). Moins de 4 échantillons au total : **non lisible** → netteté neutre (1), et les planches l'affichent comme « non lisible », jamais comme une netteté de 1,00.
- `part −0,3` à ±30°/±45°/±60° : la ligne est du côté détourné (hors de la calotte visible) : 0–1 échantillon. C'est une limite de VISIBILITÉ, pas un succès.
- `measureArt` rastérise désormais avec le crâne devant les mèches `back` (option `skull` de `referenceFromPainted`, défaut inchangé) : sans cela, une mèche arrière comblait le sillon dans le masque.

## 4. Résultats (planche 03, `metrics.json`) — 50 cas : raie {−0,4 ; −0,3 ; 0 ; 0,3 ; 0,4} × lacet {−45 ; −30 ; 0 ; 30 ; 45} × graines 1–2
- Couloir libre : **50/50**. Netteté ≥ 0,6 sur les cas lisibles : **30/30** (20 cas non lisibles, côté détourné).
- Résiduels : `anat.dome` pour raie −0,4 et −0,3 à 30° (graine 1) — la calotte n'atteint pas la couverture exigée sans fermer le couloir (voir REMAINING).
- Intention complète (planche 01, graine 2, 5 lacets) : score réparé 0 à tous les lacets, aucun défaut `style.*`.
- Régression : `tests/hair-engine-art.test.ts`, `-pass4`, `-repair-local` inchangés et verts ; la graine 5 a un test de non-régression dédié.

## 5. Ombre des mèches sur la peau suit la lumière
- Avant : `skinShadow` (`sim/drape.ts`) décalait le ruban de (0,006 W ; 0,011 H), valable pour UNE lumière (azimut 330°, élévation 55° = lumière de référence du schéma).
- Après : `hair-skin-shadow.ts` — le rendu translate le groupe d'ombres de (voulu − cuit), le voulu étant le décalage cuit TOURNÉ de l'écart d'azimut et multiplié par `shadowReach` (la règle existante de l'ombre portée des mèches, 1 à 55°, bornée 0,45–2,2). Aucune géométrie recalculée ; lumière de référence → translation nulle, rendu historique inchangé au bit près (testé pour 3 formats).
- Preuve : planche 04 (même visage, 6 lumières).

## 6. Tests déjà en échec (3)
- `highlights-system` : corrigé en amont. `eye-gallery-ext3` et `nose-visibility` : échouent à l'IDENTIQUE sur un worktree propre du commit de départ (mesuré) ; ils dépendent du flux « yeux/nez » (hash de SVG recalés à chaque passe yeux) et ne touchent pas aux cheveux : NON modifiés ici pour ne pas créer de conflit avec ce flux.

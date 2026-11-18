# Nez 3D : bornes 45° / 60° / 70°, levier d'enfoncement, tangage, seconde planche (18 nov. 2026)

Suite de `NOSE-YAW45.md` (borne du 45°, arbitrage laissé ouvert) et `NOSE-ALAR-SEAT.md` (contrainte à 30°).
Preuves : `artefacts/nez-bornes-60-70/` (`planche-tetes.png`, `planche-zoom.png`, `tete-complete.png`, `stats.json`, `face-cout.json`, `pitch.json`, `pitch-attrib.json`, `plate2-profile.json`).
Code : `src/head-turntable/nose-contour.ts`, `parts.ts` (`alaSeat`, `alaEmbed`), `verify-engines.ts` ; scripts `scripts/nose-refs/yaw-{bounds-stats,bounds-front,levers,pitch-check,pitch-attrib}.ts`, `plate2-{profile.py,engine.ts}`, `scripts/artefacts-nose-yaw-bounds.ts`. Tests : `tests/nose-yaw-bounds.test.ts`, `nose-principles.test.ts`.

## 1. Le problème posé
Le rappel latéral des ailes (`maxPull`) était le SEUL levier. Au plafond 0,25 la borne du 45° était faible pour le plat-trapèze (0,058 → 0,057 U, 80 % au-dessus de la tolérance) ; à pleine force (0,6) elle tenait (0,028) mais les ailes rentraient dans la bosse centrale et disparaissaient de la silhouette de face. 60° et 70° n'étaient pas bornés.

## 2. Ce qui est fait : un second levier, qui ne touche pas la face
`yaw45-levers.ts` (aucun rendu) compare trois leviers sur 40 graines × 4 types. Le débordement d'une aile à lacet θ vaut x'(tête) − x'(aile), x' = x·cosθ − z·sinθ − √((ex·cosθ)²+(ez·sinθ)²). Abaisser z de Δ lève x' de Δ·sinθ **sans toucher x** : donc ni la largeur ni la silhouette de face. Le levier retenu est l'**enfoncement** : fraction `embed` (0 = posée, 1 = centre de l'aile sur la surface de la joue) du décalage `ALA_Z_LIFT` = 0,022 × ka. Réduire `ez` seul a été essayé : trop faible (plat-trapèze 0,063 contre 0,057).
`alaSeat(spec)` résout `{pull, embed}` par point fixe (8 itérations). Pour chaque borne en excès : enfoncer d'abord, rappeler pour le reste, chacun plafonné à SA limite par borne.

| Lacet | tolérance (U) | enfoncement max | rappel max |
|---|---|---|---|
| 30° | 0 | 0 (comportement validé inchangé) | 0,6 × alaX |
| 45° | 0,0067 (1 px de planche) | 1 | 0,25 × alaX |
| 60° | 0,0265 = débordement propre du nez de la planche | 1 | 0 |
| 70° | 0,041 = idem | 1 | 0 |

Au-delà de 70° : non borné (à 80°–90° le contour devient celui du nez : calcul 0,047 contre rendu 0,035–0,041, la formule ne décrit plus la même chose). L'enfoncement est plafonné à 1 (la moitié de l'ellipsoïde émerge encore) : au-delà l'aile ne serait plus qu'une rondeur de joue. Choix de style, non mesuré.

## 3. Effet chiffré (`stats.json`, 40 graines 500 + 37·k, calcul analytique)
Débordement max (U) / part au-dessus de la tolérance, AVANT (commit f5d0ce2) → ACTUEL :
| Type | 45° | 60° | 70° | rappelées (avant → actuel) | enfoncement saturé |
|---|---|---|---|---|---|
| libre | 0,0117 → **0** | 0,0565 → 0,0281 | 0,0786 → 0,041 | 17,5 % → 0 % | 1/40 |
| pyramide | 0,0358 (37,5 %) → **0,0067 (0 %)** | 0,073 → 0,0369 | 0,0889 → 0,0485 | 70 % → 10 % | 22/40 |
| cloche-ailes | 0,0349 (32,5 %) → **0,0067 (0 %)** | 0,0722 → 0,0368 | 0,0884 → 0,0479 | 70 % → 10 % | 19/40 |
| plat-trapèze | 0,0565 (80 %) → **0,0203 (10 %)** | 0,0957 → 0,0483 | 0,1112 → 0,0627 | 100 % → 35 % | 40/40 |
- Arbitrage du 45° tranché : l'enfoncement fait mieux que la pleine force du rappel (plat-trapèze 0,0282 / 12,5 %, rappel médian 0,40 × alaX, ailes effacées de face) avec un rappel nul en médiane et une largeur de face intacte (1,000–1,032, `eng.nose.front-width` inchangée).
- Le débordement à 30° reste 0 dans tous les états ; il est même plus facile à tenir (un nez ×2,6 tenait déjà à 30° : le test de saturation de `nose-alar-seat.test.ts` passe à ×3,5).
- Rendu de confirmation (`nose-alar-seat.test.ts`) : calcul et différence de rendus s'accordent à 0,004 U près à 45°, 60° et 70° sur des nez élargis, ailes enfoncées comprises.
- Coût en vue de FACE (`face-cout.json`, bande du nez, 8 graines) : profondeur inchangée (0 %), identifiants de pièce changés sur 0,2–0,8 % des pixels (plat-trapèze 0,84 %).
- Résiduel REPORTÉ, pas caché : règles informatives `eng.nose.alar-contour-45`, `eng.nose.alar-contour-60-70` (excès au-dessus de la tolérance ; plat-trapèze ≈ 0,022 U) et `eng.nose.alar-embed` (saturation = nez trop large pour le modèle 3D).

## 4. Seconde planche (`rotation_head_1.jpg`) : ce qu'elle permet et ne permet pas
Dessin à la main, cheveux au premier plan. **Sur les trois-quarts (cellules 3, 4, 6, 8) les cheveux couvrent la joue lointaine** (contrôle visuel) : le contour du nez n'y est pas mesurable, et le nez y est un simple trait nettement à l'intérieur du visage, sans aile dessinée. Aucune borne de contour ne peut donc être posée ou contredite par cette planche.
Le **profil** (cellule 2) se mesure (`plate2-profile.py`, même estimateur côté moteur `plate2-engine.ts`, saillie à la corde ± δ·H, δ ∈ {0,06 ; 0,09 ; 0,12}) :
- planche 2 : **0,050–0,055 H** ; ligne des yeux 0,626 H, pointe 0,751 H (accord avec `rotation_head_1.measures.json`).
- nez de la planche 1 (`REF_SPEC`) : 0,069–0,077 H.
- nez aléatoires du moteur (10 graines × 4 types) : 0,075–0,115 H, médiane ≈ 0,095.
Lecture : la planche 2 est un style de nez ≈ 30 % plus plat que la planche 1, et ≈ moitié moins projeté que le nez typique du moteur. Les tolérances 60°/70° (calibrées sur la planche 1) sont donc LÂCHES par rapport à la planche 2. Un facteur de projection global serait un paramètre de style (donnée, pas géométrie) : **non fait**.

## 5. Tangage ≠ 0 : mesuré, la contrainte NE tient PAS telle quelle (`pitch.json`, `pitch-attrib.json`)
Débordement par rendu (3 graines par type, tangages −30, −15, 0, 15, 30). À tangage 0 le rendu concorde avec le calcul (≤ 0,01 U). À |tangage| = 30° le débordement du nez entier monte jusqu'à 0,099 U (pyramide 70°, −30°) contre 0,044 au calcul à tangage 0.
Attribution (nez entier contre ailes seules, 2 graines) : à −30° les ailes seules débordent de 0 à 0,012 U, le reste vient de la **bosse centrale et de la pointe**, qui ne sont pas bornées du tout ; à +30° les ailes seules donnent 0,029–0,041 U (même ordre que le tangage 0). La contrainte des ailes est donc à peu près valable à +30°, valable à −30°, mais le contour du nez central sort aux tangages non nuls. Non corrigé.

## 6. Preuve visuelle
`planche-zoom.png` (3 nez × lacets 0/45/60/70° × avant/actuel, nez ×3) et `tete-complete.png` (2 têtes AVEC cheveux). Constat : la « boule » de l'aile lointaine qui sortait du contour (et son anneau clair) disparaît à 45°, 60° et 70° pour pyramide et cloche-ailes, le nez se lit en coin ; le plat-trapèze garde une aile en plaque qui dépasse à 60°–70° (résiduel assumé).
Effet de bord visible, non mesuré : à 45° sur la pyramide, l'aile PROCHE enfoncée laisse une tache claire ovale à bord net sur la zone d'ombre de la joue. L'enfoncement est symétrique (le personnage ne dépend pas de la caméra : `nose-principles.test.ts` §3).

## 7. Limites
- Calibré sur UN nez stylisé (planche 1) : borne de style, pas un canon anatomique.
- Tangage ≠ 0 : bosse centrale et pointe non bornées (§5). Un seul côté (aile lointaine ; symétrie par construction).
- Tache claire de l'aile proche à 45° (§6) : à corriger côté éclairage (`nose-light.ts`), non fait.
- Pas de mesure de teinte nez/joues, pas de rougeurs de la réf. 05 (graphite) : voir `NOSE-REFS-REMAINING.md`.

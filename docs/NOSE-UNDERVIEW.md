# Nez : vue de dessous / dessus / trois quarts et quantification de la réf. 04

Branche `feat/hair-grammar`. Ce document décrit ce qui a été fait ET mesuré. Le reste est dans `docs/NOSE-REFS-REMAINING.md`.
Preuves visuelles : `artefacts/nez-underview/` (régénérables : `npx tsx scripts/artefacts-nose-underview.ts`) ; métriques : `artefacts/nez-underview/metrics.json`.

## 1 · Audit avant écriture (rien n'a été dupliqué)
- Moteur de nez existant (`src/face/nose/`, régions, axes, contraintes) : **conservé**. La vue de dessous le LIT (`noseGeometry`) et n'ajoute qu'une élévation z par région.
- Moteur de lumière (`src/relief`) : non touché. Couche de vérification (`src/verify`) : **étendue** (`nose-underview.ts`, branchée dans `verifyFace`).
- Compilateur propre au nez : **non nécessaire** (même conclusion que `NOSE-REFS.md` §2) : la vue de dessous est une fonction pure, pas un `kind` de scène.

## 2 · Quantification de `references/nez/04.jpg` (`scripts/nose-refs/extract_04.py` → `measures-04.json`)
Seuils de couleur → 14 amas (un par nez, texte exclu) → `cv2.fitEllipse` sur le cyan, `minEnclosingTriangle` sur le rouge. Aucune valeur saisie à la main.
- 14 nez trouvés ; **13 exploitables** : le n°14 (vu de face par dessous) n'a quasi pas de triangle rouge (31 px) → déclaré « dégénéré », exclu des statistiques.
- Résidu radial médian de l'ellipse : **0,044** du demi-axe (ellipses tracées en traits partiellement masqués par l'encre : c'est une limite de la mesure).
- Plages mesurées (n = 13) : largeur de base du triangle / ellipse 0,38–0,80 (médiane 0,545) ; hauteur du triangle / ellipse 0,26–0,95 (0,55) ; sommet sous l'ellipse 0,04–0,73 (0,21).
- Corrélation rapport d'axes ↔ hauteur du triangle : **−0,33** seulement (n = 13) : l'inclinaison seule n'explique pas la hauteur du triangle. Pas de loi simple à en tirer.
- Preuve de l'ajustement : `artefacts/nez-refs/04-overlay.png` (ellipse magenta, triangle orange sur l'image).

## 3 · Vue de dessous (`src/face/nose/underview.ts`)
Élévation z (fraction de `tip.projectionPx`) : lobule en dôme, aile entre `alarTop` (jonction lobule) et `alarBase` (pied), narines à `nostril`, sous-nez à 0.
Projection : tangage (autour de x ; > 0 = caméra sous le nez, la pointe monte à l'écran) puis lacet (autour de y), pivot sur la base du nez.
Sorties : enveloppe convexe lobule + ailes (**le lobule ferme la silhouette**), ellipse équivalente (moments d'aire), triangle « base des narines → sous-nez »,
narines projetées, `nostrilVisibility` (cachées d'en haut, visibles d'en bas : défaut trouvé sur une planche puis corrigé).
Le triangle utilise les extrémités EXTERNES des narines : ma première version prenait les pieds d'aile (trop écartés : largeur 0,70–0,97 hors de la plage mesurée) ; corrigé car la référence mesure la « base des narines ».

## 4 · Calibration — **SUPERSEDÉE le 12 nov. 2026 : voir `docs/NOSE-UNDERVIEW-CALIB.md`**
> **CORRECTION** : le tableau et la « lecture honnête » ci-dessous décrivent le protocole v1 (tangage libre par nez, mesures non compensées du roulis). Sous le protocole v2 équitable, l'affirmation « le modèle réduit l'erreur d'environ 28 % » est **fausse** (le modèle est à égalité avec la médiane en leave-one-out et moins bon sur les grandeurs prédites). Conservé pour l'historique.

Trois fractions z ajustées (`alarTop`, `alarBase`, `nostril`) sur 4 grandeurs de la réf. 04 (rapport d'axes, hauteur du triangle, position de sa base, dépassement du sommet), **tangage libre par nez** (inconnu). `lobuleRim` = 0,5 FIXE : non calibré.
Contrainte anatomique : `alarTop ≥ alarBase` (un premier ajustement sans elle plaçait le haut de l'aile derrière son pied).

| indicateur | valeur |
|---|---|
| résidu RMS du modèle | 0,220 |
| prédicteur « médiane » sans modèle | 0,341 |
| leave-one-out (un nez retiré) | 0,246 |

**Lecture honnête** : le modèle réduit l'erreur d'environ 28 % en leave-one-out, ce qui est réel mais modeste. Le tangage reste libre par nez (y compris sur le nez retiré), donc la comparaison avantage le modèle : ne pas la lire comme une prédiction à tangage connu.
Un essai avec 4 constantes libres a donné des valeurs très différentes pour un résidu voisin (non-identifiabilité) : c'est pourquoi `lobuleRim` est fixé. Les tangages ajustés par nez (`pitchDegPerNose`) sont des paramètres de nuisance : ne pas les lire comme les angles de dessin réels.

## 5 · Preuves visuelles et mesurées
> **CORRECTION** : les chiffres « 22,7 % / 68 % » de `01-superposition-ref04.png` venaient d'un tangage ajusté sur le sommet et de mesures non compensées du roulis ; recalculés sans cela dans `NOSE-UNDERVIEW-CALIB.md` §5 (31,4 % du petit axe, contre 23 % sans modèle).
- `01-superposition-ref04.png` : moteur recalé (centre + largeur d'ellipse seulement) sur 6 nez de la réf. 04. Écart du sommet du triangle prédit / mesuré : **médiane 22,7 %** de la hauteur d'ellipse ; 14–22 % sur les vues quasi frontales (3, 6, 10), jusqu'à 68 % sur les vues obliques (1, 9, 13 : lacet et roulis non modélisés dans cette comparaison).
- `02-balayage-tangage-lacet.png` : même nez de −30° à +80° de tangage et de −45° à +45° de lacet.
- `03-tete-et-dessous.png` : tête entière éclairée (moteurs existants, inchangés) et vue de dessous du MÊME nez, même teinte de peau, pour le nez par défaut et les deux archétypes.
- Tests (`tests/nose-underview.test.ts`, 17) : mesure saine ; résidu stocké = résidu recalculé ; invariants (déterminisme, hauteur du triangle strictement croissante avec le tangage, sens du tangage et du lacet, miroir, enveloppe) ; couverture des plages mesurées par les axes EXISTANTS ; défauts injectés détectés.
- Vérification (3 couches, `src/verify/nose-underview.ts`) : 324 contrôles (12 visages × 3 tangages) → 0 erreur, 0 avertissement (`metrics.json`). À 80° un avertissement de style est attendu (ellipse 0,27 < 0,34, la plus plate des références) : **non masqué**, voir le test.

## 6 · Limites constatées (non cachées)
- ~~La vue de dessous est diagnostique (aplats)~~ : depuis le 12 nov. elle est éclairée par `src/relief` (`NOSE-UNDERVIEW-LIT.md`), avec les défauts de géométrie qui y sont listés. Elle ne remplace pas le rendu de face.
- Silhouette anguleuse : enveloppe convexe de polygones peu denses (visible sur les planches) ; les ailes ressemblent à des plaques. Le sous-nez / columelle n'est pas une masse : le sommet du triangle flotte hors de la silhouette.
- `alarBase` n'est identifié que faiblement par la réf. 04 (le coût est plat au-delà de ~0,5).
- L'estimateur d'ellipse du moteur (moments d'aire) n'est pas celui de la mesure (moindres carrés sur traits) : écart non quantifié.

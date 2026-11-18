# Nez 3D à 45° : borne mesurée contre la planche de rotation (17 nov. 2026, 2e passe)

Suite de `NOSE-ALAR-SEAT.md` (contrainte à 30°) et `NOSE-WIDTH-3D.md` §5 (45° non borné, non comparé à la planche).
Preuves : `artefacts/nez-45deg/` (`planche-tetes.png`, `planche-zoom.png`, `stats.json`, `engine.json`). Code : `scripts/nose-refs/yaw45-{ref.py,engine.ts,stats.ts}`, `scripts/artefacts-nose-yaw45.ts`. Tests : `tests/nose-yaw45.test.ts`.

## 1. Question et méthode
Un nez en trois-quarts dépasse-t-il le contour de la joue à 45° sur la planche (`references/face/rotation_head.jpg`, tête rasée, lacets 0 à 180°) ?
- **Mesure planche** (`yaw45-ref.py`) : contour gauche relevé sur les PIXELS de la vue (1 U = 150 px), saillie = écart à la corde tendue entre deux ancres encadrant le nez (sous l'œil t 0,50/0,54/0,58 ; lèvre sup. 0,70/0,72/0,74), 3 seuils de fond → bande min–médiane–max sur 27 combinaisons. Écrit `references/nez/measures-45deg-protrusion.json`.
- **Même estimateur côté moteur** (`yaw45-engine.ts`) : contour du tampon d'identifiants d'une tête RASÉE rendue sous le tangage ajusté de la planche (`refView`, 17,73°), même corde. Plus la valeur « exacte » par différence de rendus (nez réduit à un fil).

## 2. Résultats
| Vue | Planche (pixels), U : min / médiane / max | `REF_SPEC` rendu, même estimateur | Nez de `REF_SPEC` seul (différence de rendus) |
|---|---|---|---|
| 20° | 0 / 0,017 / 0,024 | 0,006 / 0,013 / 0,019 | 0 |
| 45° | 0,005 / 0,015 / 0,021 | 0,002 / 0,009 / 0,015 | **0** |
| 70° | 0,023 / 0,043 / 0,057 | 0,012 / 0,033 / 0,039 | 0,037 |
- Les bandes se recouvrent : l'estimateur est comparable des deux côtés (test de parité).
- **À 45° le nez de la planche ne dépasse pas le contour** : la saillie à la corde (≈ 0,01) est la courbure de la joue, pas le nez (différence de rendus = 0). Par calcul, `REF_SPEC` ne déborde pas jusqu'à 45° et déborde à 60° (0,025) et 70° (0,038).
- Corrige la phrase de la passe précédente (« un nez en trois-quarts dépasse normalement le contour ») : vrai pour un nez réaliste ou à partir de ≈ 60°, **faux pour la planche à 45°**.

## 3. Ce qui est posé
`nose-contour.ts` : `ALA_CONTOUR_BOUNDS` = `{30°, tol 0, rappel max 0,6 × alaX}` et `{45°, tol 0,0067 U (1 pixel de planche), rappel max 0,25 × alaX}`. `alaPull` (`parts.ts`) retient le plus grand rappel demandé par une borne, plafonné à SA limite. Rien au-delà de 45° (60°, 70° : la planche montre le nez qui sort).
Règle `eng.nose.alar-contour-45` (`verify-engines.ts`, **info**, jamais bloquante) : débordement résiduel à 45°.

## 4. Effet chiffré (`stats.json`, 40 graines 500 + 37·k × 4 types, calcul analytique)
Débordement max à 45° (U) / part des nez au-dessus de la tolérance :
| Type | 30° seul (avant) | 45° rappel ≤ 0,25 (défaut) | 45° rappel ≤ 0,6 (plein) |
|---|---|---|---|
| libre | 0,025 / 17,5 % | 0,012 / 2,5 % | 0,007 / 0 % |
| pyramide | 0,049 / 70 % | 0,036 / 37,5 % | 0,012 / 15 % (3 saturés) |
| cloche-ailes | 0,049 / 70 % | 0,035 / 32,5 % | 0,012 / 7,5 % (2 saturés) |
| plat-trapèze | 0,058 / 100 % | 0,057 / 80 % | 0,028 / 12,5 % (5 saturés) |
Le débordement à 30° reste 0 dans les trois cas ; la largeur de face (`front-width`) reste 1,000–1,032.

**Contrôle par RENDU au tangage de la planche** (`engine.json`, `yaw45-engine.ts`, 20 graines par type, état actuel = rappel 0,25) : débordement exact du nez à 45°, médiane / max : libre 0 / 0 ; pyramide 0 / 0,027 ; cloche-ailes 0 / 0,017 ; plat-trapèze 0,003 / 0,033 (planche : 0). Essai préalable à 6 graines, avant la borne : plat-trapèze médiane 0,023 (0,013–0,040), non conservé en fichier. La table ci-dessus est analytique au tangage 0 ; au tangage 17,73° le résiduel est plus faible (tendance cohérente, non démontrée pour les autres tangages).

## 5. Pourquoi 0,25 par défaut (arbitrage visible, à trancher)
À pleine force (0,6) le plat-trapèze est rappelé de 40 % en médiane : ses ailes rentrent dans la bosse centrale et **disparaissent de la silhouette de face** (`planche-tetes.png`, ligne 1, colonnes 0° « plein ») ; 5 nez sur 40 saturent encore. Le plafond 0,25 est le seuil que la règle `alar-pull` appelle déjà « trop large pour le modèle 3D ». Coût : la borne est **faible** pour le plat-trapèze (0,058 → 0,057) et partielle pour pyramide/cloche. Un seul réglage (`maxPull` du 45°) bascule d'un comportement à l'autre ; décision laissée au propriétaire du moteur.

> **Mise à jour du 18 nov. 2026** : l'arbitrage du §5 est tranché par un levier d'enfoncement et 60°/70° sont bornés : `NOSE-YAW-BOUNDS.md`. Les chiffres ci-dessus décrivent l'état du commit f5d0ce2.

## 6. Limites (non traité)
- Calibrée sur UN nez stylisé (planche) : borne de style, pas un canon anatomique. Une seconde planche (`rotation_head_1.jpg`, cheveux couvrant le contour) n'a pas été exploitée.
- Mesure au tangage 0 (comme le 30°) : la contrainte n'est pas validée à d'autres tangages ; la comparaison planche utilise le tangage 17,73°.
- Un seul côté (aile lointaine) ; 60° et 70° non bornés ; l'anneau clair de l'aile lointaine est toujours visible (`planche-zoom.png`).

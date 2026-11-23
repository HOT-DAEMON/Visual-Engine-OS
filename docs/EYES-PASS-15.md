# Yeux — passe 15 : reflets sous rotation sphérique, coût de rastérisation mesuré

Suite de `EYES-PASS-14.md` et `EYES-REMAINING.md`. Règle respectée : aucun nouveau moteur ; la correction réutilise la matrice de projection de `geometry/eye/turn3d.ts` déjà consommée par l'iris et la pupille. Aucun paramètre ajouté : rien d'orphelin.

Reproduire : `npx vitest run tests/eye-turn-highlights.test.ts tests/eye-svg-cost.test.ts` ; preuves : `npx tsx scripts/artefacts-eyes-pass15.ts apres` (et `avant` sur l'ancien `globe-inner.ts`, puis `planche`) → `artefacts/eyes-pass15/` ; calibration : `npx tsx scripts/eye-refs/calibrate-svg-cost.ts 50`.

## 1. Audit de l'affirmation « reflets ET pupille non déformés »
`EYES-REMAINING.md` (01 Enveloppe) affirmait que reflets et pupille ne suivent pas la projection sphérique. Vérifié dans `render/eye/globe-inner.ts` :
- **Pupille : l'affirmation était fausse.** Elle est ajoutée à `irisGroup` (`pupil.markup`), donc elle passe dans le groupe `turnT` avec l'iris.
- **Reflets : l'affirmation était juste.** Ils étaient posés après le groupe `turnT`, dans le repère de face : position et forme ne se comprimaient pas, alors que `confine: 'iris'` découpe dans l'ellipse de l'iris.
- **Intégration au visage : affirmation périmée.** `face/pose/eye-pose.ts` fournit déjà `headTurn: { model: 'sphere', azimuthDeg, parallax: false }` aux yeux des visages en rotation.

## 2. Correction (`render/eye/globe-inner.ts`)
Les reflets (liste détaillée et deux reflets par défaut) sont enveloppés dans la même matrice locale (`turnT`) que l'iris. Identité exacte quand il n'y a pas de rotation : SVG et PNG identiques octet à octet à lacet 0° (vérifié sur le visage de graine 11).
Choix assumé : seule la matrice locale au centre est appliquée (comme pour l'iris), pas une reprojection point par point de chaque reflet ; la courbure à l'intérieur d'un reflet de 0,2 R d'iris est négligeable.

## 3. Preuve
- `tests/eye-turn-highlights.test.ts` (pixels, resvg) : rapport largeur / hauteur du reflet = compression horizontale `cos(az+lacet)/cos(az)` (écart < 0,06) et décalage au centre de l'iris = même facteur, pour (35°, 22°), (−35°, −22°), (40°, 0°) ; identité à lacet 0. **Sur l'ancien code : 3 cas sur 4 échouent** (rapport 1,0 au lieu de 0,59).
- Visuel : `artefacts/eyes-pass15/00-planche-avant-apres.png` (tête entière et gros plans à 0°, 25°, 40°) ; au lacet 40°, le reflet rond de l'œil lointain débordait de l'iris sur la sclère, il devient une ellipse étroite dans l'iris (`yeux-avant-yaw40.png` / `yeux-apres-yaw40.png`).

## 4. Coût de rastérisation : `svg-weight` → `svg-cost` (`verify/eye-cost.ts`)
- Constat (passe 14) : le seuil de 140 ko était un mauvais proxy. Mesuré ici sur 100 yeux (galeries 3 et 4, médiane de 3 rastérisations après échauffement) : corrélation avec le temps **0,66 pour les applications de filtre, 0,45 pour les ko, 0,38 pour le nombre de tracés**.
- Modèle : `ms = 14,9 + 3,0 × applications de filtre + 0,045 × ko` (R² = 0,45). Les ko pèsent très peu une fois les filtres comptés ; `nodes` est retiré (colinéaire avec les ko, coefficient négatif au premier ajustement).
- Règle `svg-cost` (style, avertissement) : coût prédit ≤ 120 ms (≈ 2,4 × la médiane mesurée de 49 ms ; le plus lourd des 100 yeux fait 127 ms). Galerie 4 : **0 avertissement** (44 avec l'ancien seuil), coût prédit médian 56,5, max 75,7.
- **Limites** : les ms sont celles de la machine de calibration (la passe 14 mesurait 185 à 237 ms sur une autre : seul l'ordre relatif se transpose) ; R² de 0,45, donc le modèle classe mal les yeux proches ; le plafond n'est pas calibré sur un budget de frame. Les mesures sont dans `references/eyes/measures-svg-cost.json`, les constantes testées contre ce JSON.

## 5. Vérification de rendu (géométrie / anatomie / style)
- Géométrie + anatomie : loi `cos(az+lacet)/cos(az)` sur la forme et la position des reflets, en pixels (test ci-dessus). **Aucune règle ajoutée à `verifyEye`** : une règle sur la géométrie des reflets serait tautologique (transformation linéaire du même centre) ; seul un contrôle en pixels détecte le défaut.
- Style : `svg-cost` remplace `svg-weight`.

## 6. Reste à faire → `EYES-REMAINING.md` § Passe 15

# Moteur capillaire — contrat d'interopérabilité (TODO « problème majeur »)

Code : `src/hair-grammar/interop.ts` · tests : `tests/hair-engine-interop.test.ts` (7) + `tests/hair-engine-geom-bridge.test.ts` (14) · preuves : `artefacts/hair-engine/12-interop.png`, `artefacts/hair-engine-pass2/02-*.png`.

## Constat
Deux moteurs : PRINCIPAL (`src/face/hair`, `src/render/face/hair-lock.ts`, `hair-detail.ts` : `HairLock` = polygone + rang + ton + calque + axe) et GRAMMAIRE (`src/hair-grammar` : `LockSpec` 3D → `Blade` 2D → SVG).
Ils coexistaient sans contrat : pas de repère commun, pas de vocabulaire commun, aucune vérification.

## Ce qui est fait (sens grammaire → principal)
- `frameFromEyes(gR, gL, mR, mL)` : similitude (échelle + rotation + translation) qui envoie les deux yeux de la grammaire sur ceux du principal ; testé exactement (6 décimales) et conservation des rapports de distances.
- `grammarToHairLocks(painted, {frame, head, headW})` : une `HairLock` par mèche peinte — polygone `bladeOutline`, `spine`, `w0`, `profile 'ribbon'`, `layer`, `tone` borné, `kind` d'après la famille,
  `rank` d'après la largeur relative (`mass ≥ 0,30` · `main ≥ 0,13` · `fine ≥ 0,05` · `hairline`), `tier` 0–3 d'après la longueur, `edge` réservé à mass/main.
- `checkHairLockContract` : invariants vérifiables (≥ 8 points finis, aire > 0, ton ∈ [−1, 1], spine ≥ 4 points et proche de la racine, `w0 > 0`, tier, calque, `edge`) ; le test prouve qu'il DÉTECTE les violations.
- Mesuré (artefact 12) : 50 mèches de TOUSLED → 0 violation, rangs 16 mass / 27 main / 7 fine.

## Ce qui reste à faire (honnêtement NON fait)
1. ~~Sens inverse~~ FAIT (passe 2) : `HairLock.geom` est lu par `celBands`, `lockMarkup`, `hairGloss` — voir `HAIR-GEOM-BRIDGE.md`.
2. ~~Aucun test de rendu~~ FAIT (passe 2) : `lockMarkup` rend de vraies `HairLock` de la grammaire (14 tests, artefact pass2/02).
3. `kind`: `sweep → flow`, `mass → lock` sont des correspondances de nom ; les types `plait`, `tuft`, etc. du principal n'ont pas d'équivalent généré.
4. Les relations d'occlusion et la composition (`compose*.ts`) ne passent pas le contrat : le principal garde ses calques `back/front/over`.
5. Une chaîne de génération UNIQUE (une seule entrée, un seul `HairProfile`) n'existe pas : le pont est un adaptateur, pas une fusion.
6. Cadrage des yeux seulement : pas de calage sur le crâne ni la ligne d'implantation (suffisant pour un visage de face, à contrôler sous forte rotation).

# Raccords du corps et membre supérieur — itération 07

Reprend les deux listes de restes (`BODY-UPPER-LIMB-04-REMAINING.md`, `BODY-JUNCTIONS-05-REMAINING.md`). Règle suivie : un changement n'est gardé que s'il a une preuve visuelle ET une mesure ; ce qui n'a pas tenu est dit plus bas. Ce qui reste : `BODY-JUNCTIONS-07-REMAINING.md`.

## 1. Fondu des normales aux raccords peau/peau (gardé, effet visible faible)
**Défaut** (`BODY-JUNCTIONS-05-REMAINING.md` §2, liseré à l'aine). Les enveloppes de peau partagent un tampon de profondeur : à l'intersection de deux surfaces le pixel garde la normale de la plus proche, d'où une arête nette.
**Correction** (`src/body/volume/pixel.ts`, `seamStats`). Les pixels de peau situés à moins de 0,024 h d'un pixel de peau d'un AUTRE volume, de profondeur voisine (|Δz| < 1,5 % h, donc jamais une silhouette) et de normale voisine (≤ 75°) reçoivent la moyenne gaussienne des normales de la fenêtre. Au-delà de 75° c'est un contact (aisselle, bras contre le flanc), un pli réel, laissé tel quel. Option `seamBlend: false` = ancien rendu.
**Mesure** (`artefacts/upper-limb-07/mesures/fondu-normales.json`, 5 archétypes × 3 lacets) : saut moyen de normale entre pixels voisins de deux peaux 18,2–27,8° → 10,0–16,1° (rapport 0,54–0,62), 1 500–3 100 pixels fondus.
**Effet sur l'image — à ne pas surévaluer** : 0,3–0,9 % des pixels du corps changent, de 1,4–2,9/255 en moyenne (max 13–23) à 460 px de haut. Preuve : `comparaison-hanche-face.png` (l'arête diagonale bassin/cuisse s'adoucit), `comparaison-hanche-dos.png`. C'est un adoucissement, pas un congé de géométrie.

## 2. Arrondi de l'épaule (gardé, partiel)
**Défaut** (`BODY-JUNCTIONS-05-REMAINING.md` §1 « pointe d'acromion »). Le gros plan montre que ce n'est ni la clavicule ni le trapèze : la peau du tronc atteignait sa paroi la plus large exactement à `y.acr`, d'où une plaque à coin vif au-dessus de l'arc du deltoïde (bissection : rendu de la peau seule, puis retrait de volumes).
**Correction** (`src/body/volume/trunk.ts`) : clé de profil `ya2` à 30 % de la chute acromion → aisselle, où la demi-largeur vaut 0,965 × x.acr (0,90 à l'acromion) ; la paroi la plus large passe sous l'acromion, là où le bras recouvre la peau. Clavicule (`front.ts`) : extrémité acromiale rentrée (0,55 → 0,38 de la distance joint → acromion), abaissée de 0,01 h, moins saillante (z 0,02 → 0,012 h) et amincie (a 0,016 → 0,012 h).
**Preuves** : `comparaison-acromion.png` (veryMuscular, plaque à coin remplacée par une pente continue), `comparaison-epaule-face.png`. Test : la section de peau la plus large de la zone épaule est sous `y.acr + 0,2 (aisselle − acromion)` pour 4 archétypes.
**Réserve mesurée** : le coin n'est pas supprimé, il est descendu. Angle de rotation maximal du contour supérieur de l'épaule (rendu, fenêtre 0,04 h) : identique à avant pour 8 archétypes sur 9 (adultMale 45°, veryMuscular 52°…), **pire pour `obese` (27° → 53°, cause non étudiée)**. Une pointe de clavicule reste visible sur le gros plan.

## 3. Couche de vérification (rendu)
Nouveau contrôle de style `junction.sty.seam-normal-jump` (`src/verify/junction-render.ts`) : saut moyen après fondu ≤ 0,65 × le saut sans fondu ET ≤ 16°, mesuré sur le G-buffer du rendu de face. Seuils posés APRÈS observation (rapports mesurés 0,54–0,62). Contrôle négatif : `seamBlend: false` fait échouer le contrôle. C'est un proxy (angle moyen à rayon fixe), pas un angle de pli.
Les couches géométrie (`no-floating-muscle`, `shoulder-symmetry`, `pelvis-closed`…) et anatomie (`slope-width`, deltoïde, cuisse > genou) de l'itération 05 sont inchangées et passent sur 12 archétypes sur 13 (`baby` : voir restes).

## 4. Essais retirés (mesurés, non gardés)
- **Effilage de l'extrémité du trapèze** (deux stations, a 0,046 → 0,02 h) : aucun changement visible sur le gros plan, et `no-floating-muscle` dépassait la borne (child 0,083 h > 0,08 contre 0,074 h sans). Retiré.
- **Coupole du deltoïde élargie** (0,40/0,34 → 0,48/0,40 puis 0,56/0,46 du rayon) : fait une bosse sur la pente ; rotation maximale du contour 45° → 63° (adultMale). Retiré.

## 5. Reproduire
```
npx tsx scripts/body-refs/junction-snap.ts artefacts/upper-limb-07/apres   # 5 vues
npx tsx scripts/body-refs/zoom-shot.ts veryMuscular 0 -1.35,-0.2,0.85,0.7 out.png 900
npx tsx scripts/body-refs/seam-stats.ts artefacts/upper-limb-07/mesures/fondu-normales.json
npx vitest run tests/body-junction.test.ts tests/body-pixel.test.ts
```
`avant/` a été rendu depuis le code de l'itération 06, avant toute modification. `zoom-shot.ts` accepte `KEEP=<regex>`, `DROP=<regex>`, `SCALE=<k>` pour isoler des volumes.

## 6. Tests ajoutés (`tests/body-junction.test.ts`)
Fondu : rapport ≤ 0,65 et image modifiée (> 120 pixels, ≥ 1,5/255 en moyenne, max ≥ 10) sur 4 archétypes ; contrôle négatif du contrôle de style ; paroi la plus large sous l'acromion sur 4 archétypes. Régression : 259 tests verts sur `tests/body-*`, `tests/neck-*`, `pipeline-body` (les autres suites du dépôt n'ont pas été relancées).

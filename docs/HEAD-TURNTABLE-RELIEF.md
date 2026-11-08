# Tête en rotation — reliefs : bosses pariétales, asymétrie, joues, oreille lointaine, cou → épaules

Suite de `HEAD-TURNTABLE-REMAINING.md` (les cinq points « à faire » de ce fichier). Légende : ✅ fait et vérifié · ⚠️ fait avec une limite connue · ⬜ non fait.
Preuves : `artefacts/head-turntable-v5/` (`npx tsx scripts/head-turntable/artefacts-relief.ts`, `audit-chin-registration.ts`, `compose-relief.py`). Contrôles : `HEAD-TURNTABLE-RELIEF-VERIFY.md`. Reste à faire : `HEAD-TURNTABLE-RELIEF-REMAINING.md`.

## 1. Principe : aucun moteur ajouté

Aucun nouveau moteur de crâne ou de visage. Le maillage de la tête (`mesh.ts` → `headMesh`) reste la pile de sections superelliptiques de `rows.ts` / `skull-model.ts` / `jaw-model.ts`.
Un seul point d'entrée est ajouté : un DÉPLACEMENT RADIAL `headRelief(engine)(y, th)` (`engines/head-relief.ts`) = relief du crâne + relief des joues, appliqué à chaque sommet,
puis borné à la demi-largeur `a` de la section (le contour de face reste celui du moteur de visage). Tout est lu dans les paramètres des moteurs existants :

| Relief | Fichier | Lit | Convention de position (non mesurée) |
|---|---|---|---|
| Éminences pariétales | `engines/skull-relief.ts` | `skull.vaultPeak`, `skull.vaultHeight` | y ≈ 0,24 U, azimut 112° (derrière le conduit auditif), σ 0,085 U / 24° |
| Asymétrie du crâne | `engines/skull-relief.ts` | `face.asymmetry` (`eyeDy`, `eyeRollDeg`, `mouthTiltDeg`) | aplatissement occipital (150°) d'un côté, bombement frontal (40°) de l'autre, bosses de tailles ± 25 % |
| Pommette | `engines/cheek-relief.ts` | `cheek.boneProjection`, repères yeux / base du nez | y = ligne des yeux + 0,6 × (base du nez − yeux), azimut 52° |
| Plénitude de joue | idem | `cheek.volume` | 0,07 U sous la pommette, azimut 58° |
| Creux sous la pommette | idem | `cheek.hollow`, `cheek.masseterBlend` | 0,12 U sous la pommette, azimut 66° |
| Masséter | idem | `softTissue.masseter.volume`, `cheek.masseterBlend` | base du nez / bouche + 0,04 U, azimut 74° |
| Oreille lointaine | `engines/ear-cull.ts` | lacet seul | omise pour |sin lacet| entre 8° et 35° (et de dos) |
| Cou → épaules | `engines/neck3d.ts` | `skull.trapezius`, `skull.c7` | évasement ×(1 + k t²) sur les 0,3 U du bas, k = 0,12 + 0,36 × trapezius |

Les gains (0,03 – 0,06 U) et les positions sont des CONVENTIONS d'anatomie artistique, bornées et vérifiées, PAS des mesures sur une personne. Ils ont été réglés une fois en regardant
les rendus (a0 0,014 → 0,02 ; gains de joue × 1,5 : les premiers étaient à peine visibles) et vérifiés ensuite : aucune borne de contrôle n'a été déplacée après coup.

## 2. Ce qui est VOLONTAIREMENT inchangé

- **La planche** : `headRelief(planche) = null`. Sa silhouette est MESURÉE et contient déjà ses bosses et ses joues ; les ajouter les compterait deux fois. Changements sur la planche : l'oreille lointaine à 20° (omise, comme sur le dessin : 829 px de moins à 600 px de haut) et cinq contrôles de style (oreille, cou). Écart de silhouette à 20° : 0,0231 → 0,0220 U ; à 160° : 0,0215 → 0,0185 U ; les autres vues identiques (`mesures/planche-machoire-*.json`).
- La face à 0° et le profil à 90° : le relief est nul à moins de 4° de la face et, pour les joues, à 90° ; `head.geo.front2d` passe sur 12 graines.
- Les têtes issues d'un visage seules (`mandLandmarks`) reçoivent relief et évasement du cou.

## 3. Bosses pariétales et asymétrie

Amplitude des bosses `A = clamp(0,02 + 0,022 (0,45 − vaultPeak) + 0,01 (vaultHeight − 0,5), 0,006, 0,026)` : une voûte dont le sommet est en arrière et haute accentue les bosses.
Valeurs sur 12 graines : 0,0125 – 0,0230 U (voir `artefacts/head-turntable-v5/04-champs-de-relief.png`). Asymétrie signée `(eyeDy/0,012 + eyeRollDeg/4 + mouthTiltDeg/4)/3` ∈ [−1, 1] :
−0,25 à +0,35 sur les graines 1 – 12 (la plupart < 0,2). Le facteur de côté est CONTINU (`sin th / 0,5` borné) : pas de saut à la nuque.
Limite : l'asymétrie vient de l'asymétrie du VISAGE (yeux, bouche) : c'est une hypothèse de corrélation crânio-faciale, pas une donnée du moteur de crâne (qui n'a aucun axe d'asymétrie) ; voir le reste à faire.

## 4. Joues

Quatre gaussiennes (pommette, plénitude, creux, masséter) multipliées par une fenêtre en azimut (montée 8° – 24°, descente 72° – 90°) et en hauteur (0,45 – 1,0 U). Sur 12 graines : maximum
+0,011 à +0,020 U, creux −0,0005 à −0,016 U. La joue est un ENFANT du visage : ses hauteurs sont recalculées depuis `lm.eyeY`, la base du nez et la bouche. Les références
`rotation-3d/06.jpg` (plans de la tête : plan de face, plan de joue, bande crânienne) justifient l'arête de transition entre face et côté vers 50° – 60°.

## 5. Oreille lointaine à 20°

Sans omission, l'oreille lointaine de la planche occupe 829 px à 600 px de haut (0 – 580 px selon la graine : 0 pour la graine 4, 1 pour la 1, 577 pour la 6). `farEarSide(view)` ne dépend que du lacet
(le tangage de la planche est modeste) ; à fort tangage (grille de `05-grille-lacet-tangage-*.png`) la règle n'est pas recalée : limite documentée.

## 6. Cou → épaules

Les références `rotation-3d/03.jpg`, `05.jpg` et `07.jpg` montrent le cou comme un entonnoir qui rejoint les trapèzes ; la planche (`rotation_head.jpg`) coupe le cou net. Les têtes issues d'un visage
reçoivent l'évasement du moteur de crâne (`trapezius`, `c7`) ; la coupe reste un disque plat. Les muscles (SCM, platysma) et le moteur `src/neck` ne sont PAS branchés : ⬜.

## 7. Menton à 70° — diagnostic avec mesure

`audit-chin-registration.ts` : sur chaque vue on cherche le décalage VERTICAL du rendu qui minimise l'écart à la silhouette mesurée. À 70° un décalage de +0,045 U fait tomber le maximum de 0,2075 à 0,0475 U et
l'écart moyen de 0,033 à 0,0155 U ; à 135° : 0,135 → 0,039. Le décalage varie de 0 à 0,055 U selon la vue (`mesures/chin-registration.json`) : cohérent avec une planche dessinée à la main dont la hauteur
de menton dérive d'une vue à l'autre. Ce n'est PAS prouvé : un menton rendu trop bas de façon dépendante de la vue donnerait la même mesure. L'essai d'un tangage par vue (iris et bouche) a donné des tangages de 20° – 30°
dispersés et un décalage d'origine : abandonné, `REF_PITCH` inchangé. La forme du menton n'a donc PAS été modifiée ; l'erreur de forme restante est ≤ 0,048 U.

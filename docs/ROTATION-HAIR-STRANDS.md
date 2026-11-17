# Rotation — cheveux : mèches, pièces attachées (étape 4 des tranches C)

Code : `src/face/pose/hair-pose-strand.ts`, `densify.ts`, `hair-pose.ts`, `skull.ts` (`rowMap`), `src/render/face/hair.ts`. Tests : `tests/face-pose-hair-strands.test.ts` (50), `tests/face-pose-hair.test.ts`. Preuves : `artefacts/rotation-hair-strands/`.

## Principe
On NE fait PAS un maillage 3D : on reprojette le dessin 2D existant (`HairGeometry`) avec la projection du crâne utilisée pour les masses (`skull.projectX`). Section du crâne = ellipse `(hx, k·hx)`, `k = DEPTH_RATIO = 1,03` (mesuré, voir DECISIONS). Un point à l'azimut φ passe de `hx·sin φ` à `hx·ρ·sin(φ + ψ·cos φ)` ; hors du contour, l'épaisseur est conservée.

## Mèches (`locks`)
- **Racine collée** : la racine de chaque mèche suit la coque projetée ; le reste de la mèche est translaté par `G(x) − G(xr)` où `G` = intégrale de `clamp(pente, 0,45 ; 1)` (table par rangée quantifiée, 128 cellules). Conséquence prouvée : la largeur d'une mèche reste entre 0,45× et 1× celle de la même mèche de face (à 0,75 px de mesure près, voir VERIFY). Résout l'étirement ×2,2 du bord lointain à 30°.
- **Contour densifié** (`STRAND_EDGE = 0,002 W`) car la projection n'est pas affine ; `spine` n'est jamais rééchantillonnée (le rendu la lit par indice).
- **Calque `over`** : opacité = smoothstep(n_z / 0,35) avec n_z = cos(φ + a) (champ `alpha` de `HairLock`, groupe d'opacité dans `hair.ts`). Une mèche qui passe derrière l'horizon s'efface ; elle ne peut pas « apparaître » (rien n'est dessiné derrière l'horizon sur le dessin de face).

## Pièces attachées (queue, chignon, tresses)
Rigides : `x' = x·cos a + z·sin a`, profondeur d'ancrage propre (côté 0 ; bas −k·hangHalf ; sommet −0,15·k·rx). Elles tournent comme un solide, pas comme une peau.

## Limites connues (à documenter pour la suite)
1. **Pas de vue de dos** : la méthode ne crée aucune donnée cachée. Au-delà de ≈ ±50° la projection est plafonnée (`PSI_MAX = 0,95`). Décision requise (clé dessinées vs profondeur par courbe) **avant la tranche 8**.
2. **Mèches longues à ±30–45°** (planche 03b) : les mèches ancrées au-dessus de l'oreille (φ ≈ −50°) passent devant la joue, ce qui est géométriquement juste mais très chargé : superpositions semi-transparentes, doublons de panneaux latéraux. À traiter : fusion des mèches `over` proches, ordre de profondeur par z d'ancrage, atténuation de l'alpha par chevauchement.
3. **Chignon / queue** qui se fondent ou disparaissent aux grands lacets (l'alpha d'une pièce rigide n'est pas encore lié à sa profondeur d'ancrage).
4. **Coupe rasée (buzz)** : lue comme un visage chauve avec une petite calotte orange ; la teinte du dégradé de coupe n'est pas encore projetée avec assez d'opacité en bordure.
5. **Séquence demandée −90° → +90°** : le schéma limite `yawDeg` à ±75 ; la séquence livrée va de −75° à +75° par pas de 15°.
6. **Défauts à 0°** (crochets près de l'oreille, base d'afro à bords droits) : non traités ici (tranche 7).

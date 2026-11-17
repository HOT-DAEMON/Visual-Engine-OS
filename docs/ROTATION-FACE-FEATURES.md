# Rotation — traits du visage posés (prérequis B : étape 3 hôte + étape 5, partie 1)

Branche : `feat/hair-grammar`. Code : `src/face/pose/features.ts`, `src/face/pose/eye-pose.ts`, `src/render/face/face.ts`, `src/composition/expand.ts`. Tests : `tests/face-pose-features.test.ts`.

## Ce qui est fait
Quand `face.headPose.yawDeg ≠ 0`, chaque composant suit SON nœud de l'arbre de pose (`posedFace().nodes`, déjà calculé à l'étape 1) :
- **décalage** = position projetée du nœud − position neutre (0°) ; **raccourcissement horizontal** = `scaleX` du nœud = |cos(azimut + yaw) / cos(azimut)| borné à [0,12 ; 1,8] ;
- appliqué comme une transformation SVG PAR COMPOSANT (`translate · scale(sx,1)` autour du centre neutre). Aucune rotation globale de l'image (interdite par `ROTATION-STEP-05`).

| Composant | Nœud | Mécanisme |
|---|---|---|
| Nez (corps, ombres de contact, ailes, liserés, régions de structure) | `nose` | groupe SVG ; le nez dépasse du crâne (z = 0,16 W) donc se déplace plus que la bouche |
| Bouche (+ moustache, ombre de contact, liseré) | `mouth` | groupe SVG |
| Menton | `chin` | groupe SVG |
| Ombres d'orbite | `eyeL` / `eyeR` | groupe SVG |
| Joues (fard) | `cheekL` / `cheekR` | groupe SVG |
| Oreilles (+ ombre + liseré) | `earL` / `earR` | groupe SVG ; l'oreille dont `visible` est faux (derrière le crâne) n'est pas dessinée |
| Yeux et sourcils (objets posés sur l'ancre `canthus-*`) | `eyeL` / `eyeR` | `expand.ts` ajoute le décalage à l'ANCRE et règle `headTurn = { yawDeg, model: 'sphere', azimuthDeg, parallax: false }` : le moteur d'yeux raccourcit l'enveloppe lui-même, l'œil tourne sur place (aucune double parallaxe) |
| Régions de peau (lumière du dos du nez, joues, tempes, front, menton) | `nose` / surface du crâne | `poseRegions` : le nez suit le nœud, les autres régions suivent `skull.projectX` (même projection que les cheveux), largeur × pente locale ; cou inchangé |

Convention : `yaw > 0` = le visage se tourne vers la droite de l'image ; l'oreille côté gauche de l'image se découvre, celle de droite passe derrière.

## Garanties testées
- 0° : SVG identique à l'octet près (`scripts/regress.ts check` : tout « exact », hard-13 « close rms=0.00 » comme avant) ; l'ordre historique des oreilles est conservé quand `posed` est nul.
- ±30° : symétrie miroir (œil gauche à +30° = − œil droit à −30° ; nez à l'identique), nez plus déplacé que la bouche, visibilité des oreilles, déterminisme, aucun `NaN`.
- Yeux : azimuts de signes opposés, `headTurn` transmis aux deux yeux, ancre décalée dans le bon sens.

## Ce qui n'est PAS fait (à traiter, par composant)
1. **Tangage (pitch) et roulis (roll)** : absents du contrat (`FaceHeadPose` n'a que `yawDeg`) ; `posedFace(lm, yaw, pitch)` accepte un tangage mais aucun rendu ne l'utilise. Noté « capacité absente » tant que non décidé (`ROTATION-HAIR-DECISIONS.md`).
2. **Affine par composant, pas une vraie surface** : le nez n'est pas re-dessiné en 3/4 (pas d'aile cachée, pas de pointe qui dépasse du contour) ; la bouche garde sa largeur de face (raccourcie seulement). Au-delà de ≈ ±50° le profil du nez et des lèvres exige des dessins clés (`underview` existe pour la vue de dessous, pas pour le profil).
3. **Liserés de peau et ombre portée du menton** : le halo clair et l'ombre portée à l'extérieur du contour (visibles à ±30° sur la planche 03a) viennent de couches non posées (`skinLayer`, `rim('head')`) ; à corriger séparément.
4. **Sourcils** : portés par l'objet œil ; ils suivent l'œil mais pas leur propre nœud `browL/browR` (écart de profondeur de 0,004 W négligé).
5. **Barbe / pilosité faciale** (`renderFacialHair`) : la barbe n'est pas posée (seule la moustache suit la bouche).
6. **Cou** : `neckOf` est calculé mais le rendu du cou n'applique pas encore la torsion (`TWIST`).
7. **Bijoux d'oreille** (`ear/jewelry.ts`) : suivent l'oreille par le groupe, non recalculés en visibilité propre.

## Lien avec l'audit des yeux (`ROTATION-STEP-03-EYES-RESULT.md`, branche distante)
Le défaut n°2 de cet audit (« les yeux de l'hôte ne reçoivent aucune pose de tête ») est CORRIGÉ ici par `eyePoseOf` : `headTurn` est écrit sur les deux yeux (azimut issu de `faceNodes`, borné à ±55° par le schéma) et l'ancre est décalée du déplacement du nœud. Le tangage reste à 0 (ambiguïté de signe `flat`/`sphere` non tranchée, voir cet audit) ; l'occlusion de l'œil lointain par l'arête du nez reste absente.

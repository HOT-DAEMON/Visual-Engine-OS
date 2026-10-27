# Yeux — ce qui reste à faire, par composant

Légende : ✅ fait et testé · 🟡 partiel (précisé) · ⬜ non fait · ❔ existant avant ce chantier, **non audité** dans cette passe.

## 01 Enveloppe palpébrale / 02 Canthi
- ❔ EYE-01A→01K, EYE-02A→02G : géométrie existante (12 styles, pli, caroncule, plica…) non retravaillée ; un audit ligne à ligne contre le TODO reste à faire.
- ✅ Rotation 3D de chaque enveloppe (modèle `sphere`). 🟡 Les cils, le liner et le sourcil dérivent de l'ouverture tournée mais leur épaisseur n'est pas
  recalculée anisotropiquement ; le sourcil n'est pas reprojeté sur la sphère du front.
- ⬜ Intégration au visage : `FaceParams` ne passe pas `headTurn.model = 'sphere'` ni l'azimut (± 22°) à chaque œil ; à brancher dans `render/face` (la pose du visage
  garde le modèle `flat` + sa propre parallaxe). `headTurn.parallax` est prévu pour cet hôte.
- ⬜ Reflets (disques) et pupille ne sont pas déformés par la projection sphérique (seul l'iris suit la jacobienne centrale).

## 03 Globe / sclère
- ✅ Humidité naturelle (film lacrymal + ménisque), vaisseaux, chroma, occlusion locale, marques.
- ⬜ EYE-03C→03H (limbe/cornée/réfraction cornéosclérale) : non touchés. ⬜ OPT-02 réfraction réelle (déformation de l'iris derrière la cornée) ; `appearance.refraction` ne
  fait qu'appliquer l'effet du moteur partagé. ⬜ OPT-03 diffusion sous-surface.

## 04 Iris
- ✅ Couches de couleur (masques, gradients radial/angulaire, spots, fusion émulée, halo, irrégularité à graine).
- ❔ Régions, collarette, fibres, cryptes, anneaux (EYE-04A→G, J, K, N) : `iris.detail` existant, non audité. ⬜ Relief stromal (04K) réel (normales).
- 🟡 `blend` limité à normal / multiply / screen, **émulés** par pré-mélange avec la couleur dominante (pas de `mix-blend-mode` en SVG whitelisté).
- 🟡 Dégradé angulaire : secteurs de 7,5° ; des traînées radiales fines peuvent apparaître sur les grands iris (augmenter `stepsFor` si besoin).

## 05 Pupille
- ✅ A, C, D, E, F, G (par `light` explicite), H, I, J. ⬜ G : `light` ne suit pas encore l'intensité de la lumière de la scène (à lier à `LightVector.intensity`).
- 🟡 Contours concentriques des profils : traits centrés recouverts par le remplissage — approximation correcte pour opacité 1, pas pour des contours translucides.
- 🟡 Le reflet par défaut (grand disque en haut à gauche) **masque** souvent les pupilles non rondes ; les planches de preuve le réduisent explicitement.
  Correction possible : décaler le reflet primaire hors de la pupille quand `pupil.shape` ≠ ronde.
- ⬜ Mode `fast` du flou de bord (`edge.softness`) : reste un filtre.

## 06 Cils — ⬜ non traité dans cette passe (générateur existant non audité ; styles graphiques, faisceaux, asymétrie à vérifier).

## 07 Microanatomie
- ✅ A, B, C, F, H + LOD. ⬜ D microrelief cutané (pores, normales), E irrégularité des bords palpébraux, G petits plis des canthi.
- 🟡 LOD : paramètre explicite `lod.eyePixels` ; le visage/la scène ne le renseigne pas encore automatiquement à partir de la taille finale en pixels.

## 08 Expression / 09 Extensions non humaines
- ❔ Expression (`expressions/`) non retouchée ; ⬜ le système de matériaux unifié de la §4 (contrat commun sclère/iris/pupille/cornée/paupières/bord lacrymal/cils/
  extensions) n'est pas créé : les matériaux existants (`ColorSource` + `MaterialRef`) et le moteur d'apparence sont réutilisés, sans nouveau contrat.
- ⬜ Cornée translucide, sclère sombre minérale, œil artificiel : réalisables avec `iris.layers` + `appearance.emission`, non présentés dans les artefacts.

## Vérification (`verifyEye`)
- ⬜ Non intégré à `verifyFace` (les deux yeux d'un visage ne sont pas vérifiés par ce module) ; pas de contrôle de symétrie entre deux yeux ni de cohérence de
  teinte avec le style cel de la tête ; `style` mesure le poids/filtres/contraste, pas une adéquation à un style cible nommé.
- 🟡 Contrôles anatomiques paramétrés pour des yeux humains : les styles stylisés produisent des avertissements, jamais des erreurs (choix volontaire).

## Performance
- 🟡 Voir `EYES-PERF.md` : filtres opt-in restants (glow d'iris, douceur de reflet, bord de pupille, effets d'apparence).
- ⬜ Cache de compilation non utilisé par `verifyEye`.

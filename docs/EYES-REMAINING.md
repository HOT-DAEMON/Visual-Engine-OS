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

## Passe « références mesurées » (2026-11-13) — voir `EYES-REFS.md`
- ✅ Extraction de 5 yeux (04, 07, 11 de face ; 10a, 10b en 3/4) → `references/eyes/measures.json` ; almond recalé ; 100 formes ; vérification enveloppe + pixels ; 31 paramètres prouvés.
- ⬜ **Références 13, 14, 15, 17 non mesurées** (planches de formes : au trait, flèches d'inclinaison, sprites pixelisés) — 13 et 17 fourniraient des dizaines de silhouettes à tracer pour de nouvelles recettes d'enveloppe ; 12 et 16 sont mesurées automatiquement (aspect d'iris, reflets) mais seul l'aspect d'iris est consommé : la position des reflets (dy ≈ −0,44) ne l'est pas encore.
- ⬜ **Références non tracées** : 06, 09 (canthi coupés), 03, 05 (yeux trop petits), 01, 02 (cel), 08 (chibi, tracé raté). Les ancres restent posées à la main ; une segmentation
  automatique fiable (sclère ombrée, peau claire) n'existe pas.
- ⬜ **Mesures non reversées au moteur** : palette de sclère (3 bandes) et de peau périoculaire, épaisseur du trait de paupière haute (`upperLidLineThicknessOverWidth`),
  position des reflets (dx, dy) : mesurées dans le JSON, pas encore consommées par un générateur ou un défaut.
- 🟡 **Enveloppes** : seule l'amande (et, via la base, sharp / drooping / compressed) est recalée. `round`, `chibi`, `angular`, `triangle`, `circle`, `diamond*`,
  `rounded_rect` n'ont pas de référence frontale correspondante. Le canthus **externe** n'est pas corrigé ; `tiltDeg` par défaut (6°) reste au-dessus des 0,5–5,7° mesurés
  (inchangé pour ne pas casser les scènes existantes).
- 🟡 **Boucle « jusqu'à parfait »** : une seule passe de correction de l'almond (ajustement numérique + contrôle visuel). À l'écran la différence est subtile par défaut.
- ⬜ **Détail atomique de l'iris** : galaxie/prisme (04), circuits d'or (06), bulles de cristal (07), dentelle de givre (09), étoiles (10) ne sont reproduits que par des
  couches existantes (anneaux, secteurs, gradients, reflets) ; pas de facettes ni de bulles réalistes, pas de cils dorés, pas de rayons de lumière.
- 🟡 **Galerie des 100** : distance minimale entre silhouettes 0,0103 (quelques paires proches) ; non branchée dans `generateRandomFace` (qui pioche encore dans les 48 via
  `galleryPair`) : les têtes de `artefacts/eyes-100/04-…` injectent les yeux par le script d'artefacts. 21 avertissements `pupil-to-iris` (pupilles en fente du moteur, 0,82).
- 🟡 **Vérification** : la vérification sur pixels (`scripts/lib/verify-eye-render.ts`) vit dans `scripts/` et n'est pas appelée par `verifyFace` ; pas de contrôle de symétrie
  entre deux yeux ; seuils d'enveloppe issus de 3 yeux de face seulement.
- ⬜ Test `hair-boundary` : délai de 30 s dépassé quand le CPU est saturé (lancé en parallèle d'autres rendus) ; passe seul — à surveiller, sans rapport avec les yeux.

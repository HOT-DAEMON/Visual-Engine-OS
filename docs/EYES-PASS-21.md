# Passe 21 — pli `cel` rattaché, reflet hors des pupilles non rondes, pupille liée à la lumière de la scène

Principe appliqué : les références nourrissent les composants atomiques existants ; aucun moteur nouveau, aucun paramètre sans effet visible. Chaque correctif a une preuve en pixels
(`artefacts/eyes-pass21/`, produite par `scripts/artefacts-eyes-pass21.ts` pour les planches 03–04 et `rapport.json`), un test (`tests/eye-pass21.test.ts`) et une règle `verifyEye`.

## 1. Pli de paupière du fini `cel` (hérité de la passe 19b)
- **Cause** : le fini `flat` retire le dégradé d'ombre du pli (`-crease-shadow`) ; ne restait qu'un trait fin à `crease.height` de l'ouverture, détaché sur une tête entière.
- **Correctif** (`src/render/eye/lids-fold.ts`, `celCreaseFill`) : en `cel` seulement, la zone entre le bord libre et le pli reçoit UN aplat à bord dur, ton d'ombre de la peau,
  opacité `0,10 + 0,22 × crease.depth`. `flat` et `shaded` : SVG inchangé.
- **Preuve** : `00-avant-cel.png` / `01-apres-cel.png` (graines 7, 12, 23), `zoom-avant.png` / `zoom-apres.png` (graine 7, même zoom), `04-tetes-entieres.png`.
- **Test** : aplat plein (pas de `url(`) en cel, absent en flat, dégradé conservé en shaded ; opacité croissante avec `depth` ; aucun aplat sans pli.
- **Vérification** : `cel-crease-readable` (style, avertissement) : pli de moins de 0,8 px à la taille de rendu.

## 2. Reflet primaire hors de la pupille non ronde (05 × OPT-01)
- **Cause** : le disque par défaut, posé à 0,85 du rayon d'iris vers la lumière, recouvrait fentes, croix, étoiles ; les planches le réduisaient à la main.
- **Règle unique** (`src/geometry/eye/highlight-clearance.ts`) : le reflet glisse le long du limbe, du côté de la lumière (écart ≤ 70°, plus petit écart qui convient), à une distance
  ≥ étendue de la pupille dans sa direction + rayon du disque, centre et disque dans l'iris. Il ne se rapproche jamais du centre. Pupille ronde et simple : `pupilKeepOut` = `null`,
  position historique à l'identique.
- **Lue par** le rendu historique (`highlightOffsets`), `placeHighlights` (reflets `list` ancrés à la lumière, hors rôle secondaire) et `verifyEye` : une seule géométrie.
- **Preuve** : `02-avant-pupilles.png` / `02-apres-pupilles.png` (8 formes), `04-tetes-entieres.png` (fente, croix, étoile sur tête entière).
- **Tests** : 7 formes (disque hors de la pupille, centre dans l'iris, côté lumière), pupille ronde = formule historique exacte, contrôle négatif (désactiver le dégagement fait échouer 8 tests).
- **Vérification** : `highlight-clear-of-pupil` (géométrie, avertissement : pas de place quand la pupille approche l'iris), `highlight-keeps-light-side` (anatomie, erreur).

## 3. Lumière de la pupille liée à l'intensité de la scène (EYE-05G)
- **Paramètre** : `pupil.response.follow` (0-1, défaut 0). `lumière effective = light + (intensité de scène − light) × follow` ; le modèle (`circular`, fentes) en tire la taille.
  `follow` = 0 ou modèle `fixed` : aucune réaction, valeur historique.
- **Câblage** : `effectivePupilSize(pupil, sceneIntensity)` ← `resolveEye(raw, sceneIntensity)` ← `compileEye` (`worldLight.intensity`) et `verifyEye` / `checkEyeCornea` (`light.intensity`).
- **Preuve** : `03-pupille-lumiere-de-scene.png` (follow 0 / 1 × scène 0,15 / 0,55 / 1) : constante à 0 ; dilatée en scène sombre, contractée en scène vive à 1.
- **Tests** : taille effective indépendante de la scène à `follow` 0, monotone décroissante à 1, mélange à 0,5, `fixed` inerte, SVG différent en pixels.

## Limites connues (voir `EYES-REMAINING.md`)
- Sur une tête entière l'iris est petit : le reflet dégagé peut rester au contact de la pupille (fente, œil droit de la graine 12) ; la règle ne pousse pas le reflet hors de l'iris.
- Le reflet secondaire (petit disque opposé) n'est pas dégagé : il chevauche parfois la pupille, voulu (double reflet des références au trait).
- `follow` ne s'applique pas au rendu des têtes en rotation (`head-3d-eyes.ts` : `resolveEye` sans intensité) ni à `checkEyeAppearance` (taille nominale).
- L'intensité de scène agit aussi sur tout l'ombrage de l'œil (hors pupille) : c'est le comportement existant, non modifié.

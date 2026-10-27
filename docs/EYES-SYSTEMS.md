# Yeux — systèmes ajoutés (branche `feat/eyes-systems`)

Réponse à `TODO-EYES-SYSTEMS.md` / `TODO-EYES-SYSTEMS-2.md`. Règle suivie : **chaque ajout est opt-in et neutre par défaut** — un œil qui ne les
mentionne pas est rendu comme avant (sauf le gain de vitesse, voir `EYES-PERF.md`, et ses références mesurées). Ce qui reste à faire : `EYES-REMAINING.md`.
Preuves visuelles et chiffrées : `artefacts/eyes/` (régénérables : `npx tsx scripts/artefacts-eyes.ts`).

## Carte des étapes (une étape = un commit = ses tests)

| # | Étape | Identifiants | Géométrie pure | Rendu | Tests |
|---|-------|--------------|----------------|-------|-------|
| 1 | Profils de pupille | EYE-05A,C,D,E,F,G,H,I,J | `geometry/eye/pupil-shape.ts` | `render/eye/pupil.ts` | `pupil-profile.test.ts` (7) |
| 2 | Reflets | OPT-01, OPT-04, §3.1 | `geometry/eye/highlights.ts` | `render/eye/highlights-render.ts` | `highlights-system.test.ts` (6) |
| 3 | Couleurs d'iris | EYE-04H,I,L,M,O | `geometry/eye/iris-layers.ts` | `render/eye/iris-layers-render.ts` | `iris-layers.test.ts` (8) |
| 4 | Microdétails sclère | EYE-07A,B,C,F,H ; EYE-01 humidité | `geometry/eye/micro-detail.ts` | `render/eye/micro-render.ts` | `eye-microdetail.test.ts` (5) |
| 5a | Rotation 3D des enveloppes | enveloppes (12 styles) | `geometry/eye/turn3d.ts` | `render/eye/eye.ts`, `globe-inner.ts` | `head-turn-sphere.test.ts` (9) |
| 5b | Moteur d'apparence → œil | `APPEARANCE.md` | — | `render/eye/look.ts` | `eye-appearance.test.ts` (8) |
| 6 | Vérification | cohérence géométrique / anatomique / style | — | `verify/eye.ts` | `verify-eye.test.ts` (7) |
| 7 | Performance | temps de génération | — | `render/eye/soft-shadow.ts` | `eye-perf.test.ts` (9) |

## 1. Pupille (`pupil.shape` + sous-blocs, schéma `schema/eye-pupil-profile.ts`)

Formes : `round, slit_vertical, slit_horizontal, star, diamond, polygon, cross, keyhole`. Chaîne : profil unitaire → rayons de l'iris → déformation
(`deform.squash/skew/irregularity`, harmoniques lisses à graine) → rotation (`orientationDeg`) → centre (`center.x/y`) → copies (`multiple`).
- **Invariant** (testé sur toutes formes × déformations × copies) : tout point reste dans l'iris (`IRIS_FIT` = 0,95 ; réduction homogène sinon).
- **Réponse lumineuse** (`response.model` : `fixed|circular|vertical_slit|horizontal_slit`, `response.light` 0 sombre → 1 éblouissant, 0,5 neutre) :
  facteur circulaire `1,45 − 0,9·l`, fentes `6^(0,5−l)` ; strictement décroissant ; appliqué à `size` AVANT iris détaillé/fibres (une seule taille).
- **Bord** (`edge.softness`, `edge.tint`) : flou de netteté + liseré teinté. Contours concentriques : traits centrés recouverts par le remplissage.
- **Chemin historique** : `isLegacyPupil()` = rendu octet pour octet identique (round/fentes sans option).

## 2. Reflets (`highlights.list`, ≤ 6, schéma `schema/eye-highlights.ts`)

Par reflet : `kind` (`reflection` = cause physique, suit la lumière ; `graphic` = effet artistique), `role`, `shape` (circle, ellipse, star, diamond,
sparkle, cross), `anchor` (`light` | `iris` | `globe`), taille/aspect/rotation, couleur (null = couleur de la lumière), opacité, `softness`, `intensity`
(halo), `confine` (`globe` | `iris`). **Règle d'occlusion** (testée) : le centre ne sort jamais de la zone de confinement ; le contour reste dans la boîte
de l'ouverture ; la position demandée ramenée est signalée (`clamped`). Liste vide = deux reflets historiques inchangés.

## 3. Couleurs d'iris (`iris.layers`, ≤ 8, schéma `schema/eye-iris-layers.ts`)

Couche = `color/color2`, `mask` (full, ring, sector, half, spot), `inner/outer`, `angleDeg` (0° haut, horaire), `span`, `gradient` (none, radial, **angular**),
`opacity`, `feather`, `irregularity` (graine œil + indice de couche), `blend` (normal, multiply, screen — **émulés** : pas de `mix-blend-mode` dans la liste
blanche SVG), `glow`. Gradient angulaire = secteurs interpolés (le SVG n'a pas de dégradé conique), sans couture (testé). Rendu dans un repère circulaire
puis écrasé à l'ellipse de l'iris ; clip au limbe. Exemples du cahier des charges : `artefacts/eyes/02-iris-couches.png`.

## 4. Microdétails (`microdetail`, null par défaut)

`vessels` (troncs depuis les deux canthi + ramifications, jamais dans l'iris — testé), `chroma` (chaud près des canthi, froid sous la paupière haute),
`tearFilm` (reflet diffus + ménisque brillant : l'humidité naturelle demandée), `occlusion` (ombre de contact), `imperfections`, `lod.eyePixels`.
**LOD** continu et monotone : ≥ 220 px détail complet, < 70 px plus de ramifications, < 40 px plus de vaisseaux ; le LOD ne fait que RETIRER (sous-ensemble
exact des troncs, testé) — l'identité de l'œil ne change pas.

## 5a. Rotation 3D de l'enveloppe (`headTurn.model: 'sphere'`)

Chaque point de l'ouverture est repris sur la sphère de la tête (inverse de l'orthographique), tourné (lacet puis tangage), reprojeté ; sortie = position
reprojetée − centre non tourné. **Propriétés démontrées par tests** : identité exacte à 0° ; compression au centre = `cos(azimut+lacet)/cos(azimut)` (loi de
`FACE-POSE.md`) ; lacet pur sans cisaillement vertical ; le canthus qui part du côté de la rotation se raccourcit plus que l'autre ; largeur strictement
décroissante avec |lacet| et hauteur avec |tangage| pour les **12 enveloppes** ; symétrie miroir ; `facing` (z de la normale) pour détecter un œil derrière le
crâne. Options : `azimuthDeg` (position de l'œil sur la tête, ±22° pour un visage), `radiusFactor` (3 = œil 30 mm / tête 90 mm), `parallax` (faux : l'œil
tourne sur place ; vrai : il suit la parallaxe, ≈ 2 largeurs à 40° pour un azimut de 22°). Le modèle `flat` historique reste le défaut.
L'iris suit la matrice jacobienne locale de la projection au centre de l'œil.

## 5b. Moteur d'apparence (`appearance`, null par défaut)

Contrat de `APPEARANCE.md` respecté : base `skin` (peau périoculaire) et `iris` (couleur dominante). Branché sur : ombre du pli et des paupières (`light.shadow`
dérivée), lumière de contour du bord inférieur (`rimStrength`), teinte des reflets (`reflection.tint`), effets sur le seul disque de l'iris (`glow`, `bloom`,
`emission`, `refraction`, `grain` via `compileEffects`, UN filtre), étalonnage (contraste, saturation, luminosité) des matériaux d'iris et de sclère.
Ignorés pour un œil (voir `EYES-REMAINING.md`) : `opacity`, `shading.cel`, `gradient` racine→pointe.

## 6. Vérification (`verifyEye`, `verify/eye.ts`) — même contrat `Check/Report` que `verifyFace`

- **geometry** : coordonnées et SVG finis (pas de NaN/Infinity), ouverture simple (aucune auto-intersection) et d'aire > 0, iris qui rencontre l'ouverture,
  pupille(s) dans l'iris, reflets confinés, vaisseaux hors iris, œil non retourné derrière le crâne (sphère).
- **anatomy** : iris/ouverture (0,22–0,95), pupille/iris ≤ 0,8, aspect de l'iris ≤ 1,35, fraction d'iris visible ≥ 0,5 (avertissements : les styles stylisés
  sortent volontairement des bornes humaines), centre de l'iris dans l'ouverture (erreur), reflet physique du côté de la lumière (erreur).
- **style** : budget de filtres (≤ 14) et poids SVG (≤ 140 Ko), contraste iris/sclère, pupille plus sombre que l'iris.
Mesures : `artefacts/eyes/08-verification.png`, `verification.json`. Les 12 enveloppes par défaut passent sans erreur.

## Compatibilité et modifications de l'existant

- Tests existants modifiés : `head-turn.test.ts` (nouveaux champs par défaut de `headTurn`), empreinte `first-eye` dans `__snapshots__/engine.test.ts.snap`
  (le défaut de rendu change : ombres sans filtre). Les 34 références de `references/visual/` sont toutes `close` (RMS ≤ 1,5, ≤ 0,2 % de pixels > 8/255) : **aucune
  référence regénérée**.
- Nouveau champ top-niveau d'œil : `renderQuality` (`fast` défaut | `reference` = flou gaussien historique, conservé comme étalon de mesure).
- `compileEye` : extraction de `resolveEye()` (archétype → expression → réponse lumineuse → étalonnage), réutilisée par la vérification.

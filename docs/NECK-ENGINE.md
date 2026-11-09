# Moteur de cou (`src/neck/`, `src/render/neck/`)

Implémente `docs/TODO-NECK-SYSTEMS.md`. Ce qui n'est PAS fait est dans `docs/NECK-REMAINING.md` ; la preuve visuelle de chaque paramètre est dans `docs/NECK-PROOF.md`.

## 1. Audit préalable : existait-il un moteur de cou ?

Non. Le cou existait en **cinq calculs indépendants**, chacun recalculant largeur, profondeur et évasement :

| Avant | Rôle | Après |
|---|---|---|
| `face/landmarks.ts` (formule inline) | demi-largeur, haut, base (`lm.neck`) | appelle `neck/frame.ts` (source unique) |
| `render/face/neck.ts` | contour + dégradé de face | **supprimé** → `render/neck/` |
| `face/structure/neck.ts` + `render/face/structure/neck.ts` | SCM, platysma, ombre du menton | SCM et platysma retirés (doublons) ; reste l'ombre du menton (propriété de la tête) ; formule du platysma = `neck/anatomy.ts` |
| `face/pose/neck.ts` | section 3D, `TWIST = 0,55`, profondeur 0,85 | lit `lm.neck.twistShare` / `depthRatio` / `depthHalf` |
| `skull/neck.ts`, `body/volume/neck.ts`, `head-turntable/engines/neck3d.ts` | profil, volumes du corps, maillage tournant | **non refondus** (voir REMAINING) ; `neck3d` lit déjà `lm.neck` |

Garde-fou : `tests/neck-engine.test.ts` échoue si la formule du cadre, `renderNeck` ou `neckPath` existent en deux endroits.

## 2. Décision : pas de nouveau « compilateur » enregistré

Le registre central (`render/registry.ts`, `COMPILERS`) est un type mappé exhaustif : ajouter un objet de scène = schéma + entrée + union.
Un `kind: 'neck'` aurait été **un second cou dessiné** : le cou n'est jamais un objet autonome, il est l'enfant de la tête (`host`) et le parent du torse (`body`).
Il s'enregistre donc comme **composant** du contrat central (`anatomy/components.ts`, id `neck`, déjà présent) et s'exprime par `host.face.neck.system`. L'extension du registre n'est pas nécessaire ; si un cou autonome devient utile (cou sans tête), le point d'entrée `neckModelOf` est déjà pur et indépendant du visage.

## 3. Contrats (TODO §8) — `src/neck/types.ts`

Six objets distincts, jamais une classe unique : `NeckComposition` (compose les autres, aucune géométrie), `NeckMorphology`, `NeckRig`, `NeckDeformationStack`, `NeckSurfaceProfile`, `NeckAttachmentGraph`.
Le **schéma** (`schema/neck-system.ts`) complète `FaceNeck` sans le dupliquer : `width`, `length`, `flare`, `thickness`, `muscles`, `platysma`, `cervicomentalDeg`, `shade`, `chinCoupling` restent la source unique de ces grandeurs.

Cinq couches indépendantes (TODO §3) : morphologie · anatomie · espèce · style · modificateurs. Changer le style ne change pas la morphologie (`style.ts` : décalages bornés sur 4 curseurs) ; changer le matériau ne change ni la géométrie ni le rig (testé).

## 4. Pipeline — `neckModelOf` (pur, déterministe, mémoïsé par le visage)

1. `frame.ts` — `lm.neck` : demi-largeur, haut, base, `depthRatio`, `depthHalf`, `twistShare`. Compression/étirement (M05/M06) y raccourcissent le cou : **la base du corps suit**.
2. `morphology.ts` — fusion `FaceNeck` + `NeckSystem` + style + bornes d'espèce ; toute borne est consignée (`Correction`).
3. `work.ts` — géométrie primaire GEO-01 : centre-ligne + sections superelliptiques (paramétrées par rayon), évasement lié au trapèze, sablier, cône, anneaux, bruit déterministe (`mulberry32`). Au-dessus de la mâchoire le cou est **plafonné au contour de la tête** (il reste derrière) ; sous la mâchoire il retrouve sa largeur sur 12 % de la longueur (cou de taureau).
4. `stack.ts` + `operators.ts` — les 12 opérateurs (ordre canonique, plage, domaine, lectures croisées) puis garde-fous (pas d'inversion de surface, écarts de stations bornés ; relâchés **seulement** pour `fantasy`).
5. `controllers.ts` — `HeadPoseController` (pose bornée par le rig et par « sous la tête »), `NeckDeformationController` (M01–M08, M10), `BodyLanguageController` (`expressions.ts`).
6. `attachments.ts` — collisions d'accessoires annulaires (déplacement explicite).
7. `anatomy.ts` — douze structures NECK-01…06G, visibilité **calculée** (masse, âge, tension, extension, peau, espèce).
8. `geometry.ts` — **seul** endroit où une station devient point, silhouette ou normale (face, profil, 3D).

## 5. Rendu — `src/render/neck/`

`path.ts` contour (lisse ou à facettes selon l'angularité) · `skin.ts` peau du cou : assemble les couches du moteur de peau PARTAGÉ (`skin/layers.ts`), le terminateur venant des **normales réelles** (détail : `NECK-APPEARANCE.md`) · `muscles.ts` SCM/trapèzes/platysma · `reliefs.ts` larynx, hyoïde, trachée, vaisseaux, clavicules, fosse, plis, fanon · `surface.ts` écailles/plaques/plumes (rangées, spirale, pavage, amas, gorge lisse) · `attach.ts` collier, écharpe, crête, collerette, pointes.
Couleur : `ra.base` de l'apparence (la peau de la tête) ; tout ce qui est éclairé (peau, écailles, plaques, plumes, accessoires, fanon) passe par `toneOfNormal` = arrêts du terminateur partagé. **Aucune formule d'éclairage propre au cou.** `elementColor: null` ⇒ éléments en peau.
`GAIN` (`ctx.ts`) : calibrage visuel des reliefs, appliqué en un seul endroit.

## 6. Espèces, styles, mouvements

Espèces (`species.ts`) : `human reptile avian dragon armored serpent fantasy` — structures disponibles, courbure/segments/torsion maximaux, limites articulaires. Hors limite ⇒ ramené + consigné ; structure absente ⇒ visibilité 0 + `disabledBy`.
Styles : `realistic caricature anime sculpture painting`. Stratégies : `chain`, `weighted`, `centerline`, `fields` (coexistent) ; `cage` non implémentée.
Mouvements : M01 flexion/extension, M02 inclinaison, M03 rotation (`twistShare`), M04 translation, M05/M06 compression/étirement, M07 courbure distribuée (stratégie), M08 torsion progressive, M09 `secondary.ts` (ressort amorti, `pose.tissueLag`), M10 contact (collier/écharpe, menton).

## 7. Vérification (TODO §9) — `src/verify/neck.ts`, dans `verifyFace`

Géométrie (finitude, axe monotone, ancrages haut/base, plancher de section, contour non croisé, accord face/sections, axe partagé face/profil) · anatomie (sous la tête, structures conformes à l'espèce, proportions humaines, visibilités) · style (teinte de la peau du cou à ≤ 12° de la tête, passage par le moteur de peau partagé, mode cel ≤ 3 tons).
24 visages : 0 erreur. 5 contrôles négatifs détectés (`artefacts/neck/10-verification.json`).

## 8. Tests

`neck-engine` (22) cadre/déterminisme/opérateurs/espèces/pose/vérification · `neck-criteria` (14) critères §10 · `neck-appearance` (3) un seul moteur d'apparence · `neck-visible` (67) un cas par paramètre du schéma, **garde de couverture** : une feuille du schéma sans preuve fait échouer le test.

## 9. Artefacts

`artefacts/neck/` : 01 morphologies · 02 anatomie · 03 opérateurs · 04 mouvements · 05 espèces · 06 styles · 07 lumière · 08 têtes entières · 09 silhouettes sous lacet · 10 vérification · 11 tableau de preuves · 12a/12b apparence **avant** (ombrage propre) / **après** (moteur de peau partagé), 8 conditions : lumière gauche/droite, cel, torsion, dragon, autre identité, massif.
Régénérer : `npx tsx scripts/artefacts-neck.ts [préfixe …]`.

## 10. Raccord au corps (session 21)

Le corps ne lit le cou que par `NeckAnchor` (hauteur, menton, base, demi-largeur de base). La demi-largeur est la **dernière section du moteur de cou** (`anchorFromLandmarks`, `src/body/anchor.ts`), pour la scène comme pour `anchorFromFace` ; avant cette session la scène recalculait une largeur avec l'ancienne formule (écart jusqu'à −28,8 % sur un cou en cône : le point 4 ci-dessus n'était vrai que pour la position de la base). Le torse ne dessine plus de SCM. Le fondu de la base est borné par `neckPath` (`BodyRenderOpts.neckContour`). Preuves : `tests/neck-body-junction.test.ts` ; défauts restants : `docs/NECK-REMAINING.md` §F.

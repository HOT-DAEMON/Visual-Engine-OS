# Yeux — passe 13 : étoiles rayonnantes, luminance, cellules, fentes, lime-cyan

Suite de `EYES-PASS-12.md` (§ 7 et `EYES-REMAINING.md` § Passe 12). Règle respectée : les références **enrichissent les moteurs existants** (éclats `placeHighlights`, `renderIrisDetail`, `globe-inner`) ; aucun moteur par référence. Trois paramètres d'éclat, un paramètre d'iris et un paramètre de fente sont ajoutés, tous opt-in (défaut = rendu historique).

Reproduire : `python3 scripts/eye-refs/extract_iris_atoms.py` (mesures), `npx tsx scripts/eye-refs/calibrate-atoms.ts [famille]`, `calibrate-lift.ts`, `calibrate-vibrance.ts` (calibrages), `npx tsx scripts/artefacts-eyes-pass13.ts` (preuves → `artefacts/eyes-pass13/`), `npx vitest run tests/eye-iris-pass13.test.ts`.

## 1. Mesures (`references/eyes/measures-iris-atoms.json`, régénéré)
- **Détecteur d'étoiles** : les corps qui se touchent (arc blanc + flare central, étoiles d'anneau reliées par leurs pointes) formaient une composante unique (Feret 1,0 R sur ice). Séparation par bassins versants sur la transformée de distance, marqueurs = h-maxima (h = 30 % du maximum de la composante) : on ne coupe qu'aux vrais étranglements. Effet sur les références : 04 → 26 étoiles, 07 → 13, 10a → 20, 10b → 11 ; le grand flare de 07 passe de 0,67 à 0,58 R.
- **Étoiles de l'anneau de 10b** : 0,39 R (0,39 / 0,39 / 0,37 / 0,36), flare central 0,81 R. L'ancien moteur : 0,31 R.
- **Fentes sur TOUTES les références** (la doc disait « 04 seulement » ; 03, 05, 06, 09 l'étaient déjà) : persistantes 03 : 9, 05 : 9, 06 : 34, 09 : 19, 04 : 33, 07 : 6, 10a : 7, 10b : 4, **08a / 08b : 0**. Nouvelle mesure de **dérive** (angle à la bande interne contre externe) : 04 = 5,8 °/ρ, 07 = 3,6, 10a = 3,7, 10b = 5,3 ; 09 = 36 (fentes très courbes, non reprises).
- Part de blanc pur (canal minimum > 235) du disque d'iris : 0 à 0,108 (04 : 0,108 ; 10b : 0,092 ; 08b : 0).

## 2. Paramètres ajoutés
| Paramètre | Fichier | Rôle | Preuve |
|---|---|---|---|
| `highlights[].rays` (0–4) | `eye-highlights.ts`, `render/eye/highlight-rays.ts` | aiguilles effilées au-delà du corps (en rayons du corps), la première pointe la plus longue | test : plus de pixels blancs, SVG plus riche ; artefact 03 |
| `highlights[].tint` | `highlights-render.ts` | dégradé radial cœur (`color`) → teinte aux pointes ; l'aura prend la teinte | test : une teinte rouge rougit les pixels ; artefact 03 |
| `highlights[].jitter` (0–1) | `geometry/eye/highlights.ts` | lobes et aiguilles inégaux, déterministes (empreinte de la position et de la taille) | test : même SVG deux fois, image ≠ étoile régulière |
| `iris.lift` (0–1) | `eye-iris-pupil.ts`, `globe-inner.ts` | courbe à genou sur le disque d'iris : identité sous 0,35 et en 1, bosse de 0,4 × valeur ; noirs et blancs en place | test : luminance +3 au moins, part sombre ± 0,03 |
| `slits.curve` (±40 °/ρ) | `eye-iris-pupil.ts`, `render/eye/iris-atoms.ts` | fentes en 4 segments avec dérive angulaire ; 0 = SVG historique | test : prism à 6,2 °/ρ (réf. 5,8), plus que `curve = 0` |
Autres changements : `softness` 0,2 par défaut sur les éclats de famille (les références ont des bords doux : divise les cellules de ice par 2) ; liste blanche SVG de `core/svg.ts` : `amplitude`, `exponent`, `offset` ; `eyeGeometry` inchangé.

## 3. Réglages de famille (`eye-iris-families-photo2.ts`)
- Helpers `flare` (étoile rayonnante) et `radiant` (applique rayons / teinte aux éclats `primary` / `secondary`).
- **ice-star** : 6 étoiles d'anneau `sparkle` à 6 pointes (taille 0,38, l'étoile du bas ×0,7 car rognée par la paupière, comme en 10b), flare central à 8 pointes, vides ramenés à 0,4, `lift` 0,6, vibrance 0,355, texture réduite (densité 0,02, fibres 0, poussière 4).
- **fire-halo** : texture réduite (densité 0,2, contraste 0,2, fibres 8, 6 pointes d'accent, 18 braises), anneau élargi et éclairci (`#ff9a5a`, 0,27–0,52), couronne externe plus lumineuse, `lift` 0,5, vibrance 0,152.
- **emerald-facets / prism-star** : éclats rayonnants teintés (vert clair / or), `lift` 0,93 et 0,38 ; prism : `slits.curve` 8.
- **lime-cyan** : détail atomique (réf. 08 : anneaux fins concentriques, points cyan) : arcs continus jaunes (`#ffe83a`, ρ 0,62, largeur 0,04) et 16 braises cyan ; texture et collerette renforcées (densité 0,35, contraste 0,7, fibres 20, collerette 0,85), `lift` 0,17, vibrance 0,105.

## 4. Résultats (moteur / référence) — `artefacts/eyes-pass13/05-rapport-passe13.json`
| Famille (réf.) | Luminance | Part sombre | Pics sat. | Étoiles top 6 | Cellules | Fentes (dérive) |
|---|---|---|---|---|---|---|
| prism (04) | 125,7 / 126,1 | 0,178 / 0,154 | 0,781 / 0,783 | 0,346 / 0,362 | 200 / 167 | 43 / 33 (6,2 / 5,8) |
| emerald (07) | 124,5 / 128,8 | 0,166 / 0,101 | 0,741 / 0,738 | 0,325 / 0,312 | 54 / 105 | 19 / 6 (8,4 / 3,6) |
| lime-cyan (08a) | 169,5 / 169,4 | 0,020 / 0,003 | 0,786 / 0,786 | — | 52 / 5 | 1 / 0 |
| fire (10a) | 92,7 / 89,1 | 0,316 / 0,373 | 0,720 / 0,720 | 0,353 / 0,348 | 60 / 44 | 15 / 7 (3,3 / 3,7) |
| ice (10b) | 104,7 / 103,3 | 0,252 / 0,297 | 0,730 / 0,729 | 0,507 / 0,473 | 41 / 31 | 2 / 4 (4,7 / 5,3) |
Avant la passe : luminance sous la référence de 14 à 22 ; cellules fire 200 / 44, ice 65 / 31 ; anneau d'ice 0,31 / 0,39.

## 5. Couche de vérification (`scripts/lib/verify-eye-atoms.ts`)
- `iris-luminance-plausible` (style) : luminance moyenne de l'iris entre 60 et 200 (références 89–169, marge d'environ 30).
- `iris-white-share-plausible` (style) : part de blanc pur ≤ 0,2 (références 0–0,108) : les étoiles rayonnent, elles ne couvrent pas l'iris.
- `atomic-edge-density` : seuil 12 pour un iris à fentes / vides / facettes taillées ; **9 (`ATOM_EDGE_MIN_LIGHT`) pour un détail léger** (arcs et braises seuls). Choix à valider : à 12, cinq yeux lime-cyan des galeries 3 et 4 échouaient (gradient 9,3–11,8) ; iris dépouillé : 6,3–6,6.
- Les cellules ne sont pas une règle de rendu (le détecteur est en Python) : elles sont verrouillées par le test de calibrage (fire et ice ≤ 2 × la référence).
- Cohérence géométrique : `highlights-confined` a attrapé l'étoile du bas d'ice (dépassait de 3,6 px) ; corrigée à la source.

## 6. Tests
`tests/eye-iris-pass13.test.ts` (opt-in, preuve pixel de chaque paramètre, calibrage luminance ± 10, étoiles ± 0,08, cellules ≤ 2 ×, fentes, lime-cyan, règles et contre-exemples). Mis à jour : `highlights-system` (12 reflets, déjà périmé), `eye-iris-pass11` (contre-exemple de vibrance sur ice, filtre `-vib` aussi pour `lift`), `eye-iris-pass12` (lime-cyan a un détail atomique ; contre-exemple de part sombre à 2 reflets). Suite yeux / visages : 41 fichiers sur 42 verts ; le test d'identité 300 de `eye-gallery-ext3` échouait déjà avant cette passe (empreintes figées).

## 7. Reste à faire → `EYES-REMAINING.md` § Passe 13

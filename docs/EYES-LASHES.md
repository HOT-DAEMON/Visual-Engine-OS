# EYES-LASHES — familles de cils (réfs 12, 13, 14, 15, 16)

Objectif : échantillonner les cils des références pixel par pixel et en tirer des familles distinctes (touffes, plumes, style féminin…) **en réglant le moteur de cils existant**
(`src/schema/eye-lashes.ts`, `src/geometry/eye/lashes.ts`, `lash-extras.ts`, `src/render/eye/lashes-render.ts`), sans créer de moteur par référence.
Vérification : voir `EYES-LASHES-VERIFY.md`. Reste à faire : fin de ce fichier. (Session du 2026-11-15, v2.)

## Fichiers (aucun doublon : les fichiers existants ont été modifiés en place)
| Fichier | Rôle |
|---|---|
| `scripts/eye-refs/extract_lashes.py` (v2, réécrit en place) | échantillonnage des 5 planches -> `references/eyes/measures-lashes.json` (version 2) + contrôles `artefacts/eyes-refs3/02-cils-segmentation-{12..16}.png` |
| `scripts/eye-refs/compose_lash_panel.py` | planche `06-references-vs-moteur.png` (œil de référence au-dessus du rendu moteur) |
| `src/schema/eye-lashes.ts` | 3 paramètres ajoutés, tous opt-in (défaut = rendu historique, octet pour octet) : `bendDeg`, `rootFuse`, `span` |
| `src/geometry/eye/lashes.ts`, `lash-extras.ts` | cil courbe (`bentLash`), mèches (`clump`) compatibles cubiques, point d'entrée unique `eyeLashSet` (rendu ET vérification) |
| `src/generation/eye-lash-families.ts` | 10 familles = jeux de paramètres du moteur existant ; `lashFamilyForSeed` |
| `src/generation/random-face.ts` | option `lashFamily: LashFamilyId \| 'auto' \| null` |
| `src/verify/eye-lashes.ts` | couche de vérification des cils (géométrie / anatomie / style), appelée par `verifyEye` |
| `tests/eye-lash-{families,params,verify}.test.ts`, `tests/random-face-lash-family.test.ts` | preuves (pixels, géométrie, défauts injectés, liaison aux mesures) |
| `scripts/artefacts-eyes-lashes.ts` | planches 03, 04, 05, 07, 08, 09 |

## Ce que le moteur ne savait pas faire, et ce qui a été ajouté
Les références montrent des cils **tracés** : courbes en S, effilés en aiguille, enracinés dans un trait de paupière épais, groupés côté externe.
Le moteur dessinait des triangles droits posés sur le bord (seule la mèche de coin `flick` était une courbe).
- `bendDeg` (−60…80, défaut 0) : rotation de la tangente entre racine et pointe, vers la normale du bord. > 0 : la pointe se redresse (cas général mesuré) ; < 0 : elle se couche vers l'extérieur (réf. 14). Avec `bendDeg`, `curl` règle **où** la courbure se produit.
- `rootFuse` (0…1, défaut 0) : racine enfoncée de +0,3 à −0,6 épaisseur de bord (test) et base élargie jusqu'à +80 %.
- `span` ({from,to}, défaut 0,05–0,95) : zone du bord occupée par les cils (références : position médiane des pointes 0,65–0,83).
- Familles tracées : `lids.thickness` relevée (`lidThickness`, valeur **I**) car le cil s'enracine dans un trait noir épais dans les références.

## Méthode d'extraction v2
1. **Regroupement autour de chaque iris** (planches 12, 16) : iris = blob compact après ouverture (rayon 1,2 % de la largeur de planche) ; chaque composante d'encre est rattachée à l'iris le plus proche ; sourcils, joues, sourires et boîtes contenant l'iris d'un autre œil (fusions) sont écartés. Le v1 ne gardait parfois que l'iris.
2. Réf. 13 : composantes connexes (`eyes_of`). Réfs 14 et 15 (iris colorés) : cellules de grille mesurées ; encre = sombre **et** peu saturé (écarte iris, flèches rouges, aplats) ; sourcils retirés.
3. **Orientation externe par construction** (le v1 la devinait au plus grand dépassement, ce qui était faux) : planches 12 et 16 = appariement de miroir (masque retourné qui recouvre l'autre à > 0,8 d'IoU ; le plus à gauche a son externe à gauche) ; 15 = colonne ; 13 et 14 = ancres visuelles consignées (externe à droite, sauf 13-04 : masse de cils à gauche). Les yeux sans partenaire sont étiquetés `heuristic` (jamais présentés comme sûrs).
4. Par œil : **pointes** verticales par tranches de hauteur (15–92 %) -> ligne médiane, effilement, angle base/pointe par rapport à la normale locale ; **traits** (squelette de la base à la pointe, chemin ordonné) -> longueur, angle de départ, courbure signée, effilement, position le long de la paupière.
5. Résumé par planche dans `measures-lashes.json` (`summary`). Résultat : 66 yeux (12 : 11, 13 : 12, 14 : 6, 15 : 10, 16 : 27) ; orientation par construction pour ≥ 80 %.

## Mesures retenues (ordres de grandeur, fraction de la largeur L de l'œil)
- Position médiane des pointes : 0,65–0,83 (12, 13, 16) -> `span.from` ≥ 0,35 pour les familles à cils externes.
- Courbure médiane des pointes −3° à −13°, des traits latéraux −15° à −32° (P10 jusqu'à −49° / −73° pour les ailes) -> `bendDeg` 12–55 (signe moteur inversé : > 0 = se redresse).
- Longueur : pointes 0,04–0,08 L (P90 0,08–0,13), traits latéraux 0,12–0,14 L (P90 0,19–0,6) ; largeur à mi-longueur 0,37–0,74 de la base.
- Réf. 14 : traits du canthus externe couchés (départ ≈ 90° de la normale, courbure −32°) -> famille `trainants` (`bendDeg` < 0).

## Les 10 familles (sources, valeurs et provenance M/I/C dans `eye-lash-families.ts`)
`plume`, `touffes`, `frange-dense`, `fin-feminin`, `aile-liner`, `rond-kawaii` (6 d'origine, retravaillées) ; **nouvelles** : `trio-externe` (12), `touffes-bas` (15, 16 : cils du bas en touffes), `ticks-reguliers` (15, 16), `trainants` (14).

## Intégration
- Galerie : `extraEyeLashFamily(index)` (55 % des 100 yeux ; flux PRNG à part) tire désormais parmi 10 familles. Planche 04 : échelle par œil.
- `generateRandomFace(seed, { lashFamily })` : une famille imposée, ou `'auto'` (flux dérivé dédié `seed ^ 0x7c15a3e1`). Sans option, visages **inchangés** (testé).

## Limites connues (honnêtes) -> aussi dans EYES-REMAINING.md
- Les valeurs `bendDeg` (12–55) sont **interprétées** au-delà de la médiane mesurée : l'extraction mesure sur peu de pixels et sous-estime les courbes en S.
- Écart visuel restant (planche 06) : les références sont des aplats noirs francs ; le moteur reste un rendu à dégradés. Épaisseur de paupière des familles = **I**, non mesurée.
- `clump` avec `bendDeg` et une zone qui descend vers le canthus interne : les mèches convergent sur l'iris (planche 05, case « clump 0,9 + bend ») ; les familles à mèches utilisent `span.from` ≥ 0,2.
- Mesures de lignes de squelette bruitées pour les traits très fins (largeur de base 1–2 px) : `taperMid/taperTip` des traits peu fiables ; l'effilement retenu vient des pointes.
- Les familles ne s'adaptent pas à l'inclinaison de l'ouverture : 4 cas sur 174 (yeux très inclinés) gardent un cil dont la pointe retombe dans l'ouverture (avertissement `upper-lash-tips-outside-opening`).
- Pas de cils multicolores, pas d'animation, pas de dispersion de couleur le long du cil.

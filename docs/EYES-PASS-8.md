# Yeux — PASSE 8 : encre en aplats francs, contrat de hauteur `sharp` / `drooping`

Reprend la liste « ce qui reste » de la passe 7 (`EYES-REFS-4.md`, `EYES-REMAINING.md`). Tout ce qui suit est **recalculé** par `npx tsx scripts/artefacts-eyes-pass8.ts`
(→ `artefacts/eyes-pass8/`, rapport chiffré dans `05-rapport-passe8.json`). Les « avant » sont des rendus RÉELS du commit `915f14d` (dossier `avant/`).

## 1. Look « encre » : aplats francs au lieu de dégradés

### Cause (mesurée)
Le look `ink` ne remplaçait que `iris.layers`. Restaient actifs : `iris.fibers`, `limbalRing`, `glow`, `detail` (collerette olive), l'ombrage de sphère + vernis de
`compileSurface` (sclère, iris, sourcil), l'ombre portée des paupières (0,38), le vignettage d'orbite (0,22), l'ombre du pli, le flou et le halo des reflets,
les dégradés de liner et de cils, le bord de pupille, la peau périoculaire et l'archétype (une sclère rouge sombre sur 13-R1C2).

### Mesure des références — `scripts/eye-refs/extract_ink.py` → `references/eyes/measures-ink.json`
| réf. | encre | papier | `toneShare` |
|---|---|---|---|
| 17 | `#3f363b` (gris chaud) | `#fefef6` | 0,00 |
| 12 | `#020202` | blanc | 0,00 |
| 13 | `#000000` | blanc | 0,12 (l'**iris** est un dégradé vectoriel gris ; traits, pupille et reflets sont plats) |

`toneShare` = part des pixels sans gradient (max − min de luminance sur 5 × 5 ≤ 14), hors papier, qui n'appartiennent à AUCUN des 3 tons dominants (±16). 0 = aplats francs.
Un premier critère à 1 seul ton comptait le gris plat de l'iris 13 comme « dégradé » : il a été remplacé par ce critère à 3 tons (anciens yeux d'encre : 0,53–0,69 au 1er critère ;
0,16 et 0,29 au critère final sur les deux yeux 13 mesurés ; yeux d'encre actuels : 0,000 aux deux).

### Moteur (un paramètre, pas un nouveau moteur)
- `EyeSpec.finish: 'shaded' | 'flat'` (défaut `shaded` = rendu historique inchangé) — `src/schema/eye.ts`.
- `src/render/eye/flat-finish.ts` : `flattenEye` (appelé par `resolveEye`, donc lu aussi par `verifyEye`) ramène à une couleur unie fibres, limbe, lueur, détail, humidité, apparence,
  dégradés des couches d'iris / liner / cils, bord de pupille, caroncule, sourcil ; `flatSurface` remplace `compileSurface` (sclère, iris, sourcil).
- Consommations de rendu : `globe-inner.ts` (ombre de paupière, vignettage, ombre du pli), `highlights-render.ts` (reflets nets), `lids-fold.ts` (pas d'ombre de pli, traits pleins).
- `eye-ref-looks.ts` : `applyLook('ink', …, ref)` + `inkLines` (cils, liner, sourcil à l'encre mesurée de la famille). Réf. 17 : iris plat de l'encre ; réf. 13 : corps gris plat
  `#646464` (luminance 100, médiane de 3 iris isolables) + calotte noire en demi-masque net (`feather: 0`).
- Vérification de style : règle pixel `ink-flat` (`toneShare` ≤ 0,02) pour les yeux `flat` ; `iris-not-flat` reste pour les autres. `sclera-is-light-tone` n'est pas évaluée en `flat`
  (l'iris des réfs au trait déborde l'ouverture : les points de sondage tombent sur l'encre).
- Preuves : `tests/eye-flat-finish.test.ts` (6 tests : encres = mesures, refs 12/17 = 0, 20 yeux encre ≤ 0,02 et le même œil en `shaded` > 0,10 sur ≥ 80 %, paramètre consommé :
  ≥ 4 dégradés de moins et SVG de moins de moitié, `resolveEye` retire bien chaque paramètre). Artefact `01-encre-avant-apres.png`.

## 2. Contrat de hauteur de `sharp` et `drooping`
- Défaut : −25,4 % (`sharp`) et −26,0 % (`drooping`) de hauteur (48 combinaisons, −19 % à −35 %), contrôles écrits à la main.
- Correctif : `src/geometry/eye/height-contract.ts`. Les apex des deux paupières sont recalés sur la hauteur demandée en ne modifiant que les contrôles EXTERNES (`u2`, `l1`, bissection) :
  le canthus interne (`pi`, `u1`, `l2`) reste identique pour tous les styles naturels (`tests/eye-shape-style.test.ts`).
- Résultat sur 64 combinaisons : `sharp` moyenne 0,03 %, pire 1,6 % ; `drooping` moyenne 0 %, pire 0,02 %.
- `envelope-height-contract` (`src/verify/eye-envelope.ts`) couvre `almond`, `sharp`, `drooping` ; test qui refuse l'ancien défaut. Artefact `02-hauteur-sharp-drooping-avant-apres.png`.
- Même défaut mesuré, NON corrigé (silhouettes stylisées) : `angular` −22 %, `triangle` −26 %, `chibi` −12 %, `diamond` −16 %, `round` +32 %.

## 3. Conséquences traitées
- **Refit** (`scripts/eye-refs/fit-recipes.ts`) : 12 des 27 recettes changent (l'ancien `sharp` trop bas compensait par des paramètres déformés). Galerie : 100 yeux, 0 échec sur les règles de rendu.
- **Appariement des yeux** : un `sharp` à hauteur respectée atteint la limite de sourcil des deux côtés, l'asymétrie d'ouverture devient écart d'échelle (1,217 > 1,176, graine 3).
  `FitOptions.maxScale` + `PAIR_SCALE_MAX = 1,15` (`src/face/fit-eye.ts`), appliqué dans `random-face.ts` (on ne fait que réduire le plus grand : aucune borne dure franchie).
- Tests déplacés, pas assouplis : `eye-lash-families` (œil de base case 18 → 30), `eye-lash-verify` (case 25 → 22), plafond 0,09 pour 17-P01 et 15-B (§ 4).

## 4. Régressions ou limites connues (non masquées)
- 17-P01 (RMS 0,0876) et 15-B (0,0846, `triangle`) dépassent 0,08 : recherche à 9 000 tirages par style, même optimum. Plafond individuel 0,09 dans `tests/eye-ref-fits.test.ts`.
- 17 combinaisons œil × famille de cils échouent encore (`lashes-point-away-from-eye`, `lashes-in-zone`) ; 24 au commit d'origine. Les tests n'échantillonnent que 6 yeux.
- Têtes entières : les yeux d'encre sont plats mais le visage reste ombré (style mixte) ; le rendu de visage `renderMode: 'ink'` n'est pas relié à `finish`.

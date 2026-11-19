# Tache claire de l'aile proche à 45° (pyramide) — 18 nov. 2026

> **CORRECTION (3e passe, `NOSE-ALAR-SPOT-2.md`)** : la mesure de ce document portait sur l'aile **lointaine** (côté ombre, la moins visible), et non sur la proche comme écrit ; le correctif du rebond reste valide pour cette aile. Le rapport ≠ 1 des graines 2 et 5 est le contour de lumière de l'anneau (rapport 0,90–1,11 sans lui), pas un défaut ; l'ovale clair à 60° est celui de l'aile proche et est corrigé par la continuité du terminateur.

Suite de `NOSE-YAW-BOUNDS.md` : l'enfoncement de l'aile proche avait laissé, à 45° sur la pyramide, une tache claire ovale à bord net sur la joue dans l'ombre. Cette passe la **mesure**, en établit la cause **par ablation**, et la corrige dans l'éclairage (`nose-light.ts`, `paint.ts`), sans toucher à la géométrie.

## 1. Mesure (`scripts/nose-refs/alar-spot-measure.ts`)
Sur le tampon sur-échantillonné de la chaîne de rendu (`rasterize` → `paint`, têtes rasées, lumière trois-quarts droite en cel) :
- masque d'aile = pixels `PART.bump` dont le poids d'aile ≥ 0,999, de l'aile **proche** (profondeur moyenne la plus faible) ;
- anneau = pixels de peau `PART.head` à 2–7 px du masque ;
- **rapport** = luminance moyenne (aile) / luminance moyenne (anneau) ; **bord** = 90ᵉ centile du saut de luminance à la lisière.

Pyramide, 6 graines (11 + 37·k), rapport médian : 30° 0,94 ; **45° 1,10** ; 60° 0,91. Par graine à 45° : 1,165 · 0,788 · 0,972 · 1,101 · 0,594 · 1,126.

## 2. Cause (ablation, pyramide 45°, mêmes graines)
| Variante | Rapport médian |
|---|---|
| état d'origine | 1,101 |
| normale non adoucie (fusion 0) / 0,95 / 1 | ≈ 1,10 / 1,10 / 1,10 |
| profondeur de l'aile non allégée | 1,119 |
| allègement de la saillie 0,8 → 0,95 → 1,0 | 1,101 → 1,096 → 1,094 |
| **sans lumière de rebond** | **1,054** (6 graines sur 6 en baisse) |
| sans contour de lumière | 1,164 (monte : ce n'est pas lui) |

Décomposition médiane (aile / joue voisine) : ombre portée 0,935 / 0,959 ; n·l −0,09 / −0,22 ; lumière directe nulle des deux côtés ; **occlusion 0,60 / 0,75**. La différence ne vient donc pas de la lumière directe : le **rebond** (`bounceAt`) est coupé par un **seuil d'occlusion** (palier franc en cel). L'aile, qui dépasse de la joue, a une occlusion plus basse, franchit le seuil, reçoit un rebond que la joue n'a pas : ovale clair à bord net. La comparaison visuelle avec et sans rebond (graine 11) concorde : l'ovale disparaît sans rebond.

## 3. Correctif
`bounceAo(spec, g, ao, reachPx)` (`nose-light.ts`) : pour chaque pixel d'aile, moyenne de l'occlusion des pixels de peau trouvés dans 8 directions à moins de `0,06 · ppuHi` ; l'aile reçoit le **maximum** (un vrai pli sous l'aile reste occulté) entre sa valeur et cette moyenne, fondu par le poids de l'aile. C'est le même principe que `BLEND` (normale) et `litDepth` (profondeur) : l'aile se fond dans la face.
- `reliefLight` renvoie en plus `aoBounce` ; `paint.ts` ne l'utilise **que** pour `bounceAt`. `ao` (terme direct, `shadeAt`) est inchangé : pas de zone d'aile noire côté éclairé.
- `alaWeigher(spec)` précalcule les deux ellipsoïdes une fois (l'ancien `alaWeight` refaisait la résolution de `alaOf` à chaque pixel) ; `alaWeight` en dérive, `litDepth` l'utilise. Valeurs identiques.

## 4. Résultat mesuré
Rapport par graine à 45°, avant → après : 1,165 → 1,067 · 0,788 → 0,659 · 0,972 → 0,912 · 1,101 → 1,033 · 0,594 → 0,380 · 1,126 → 1,072 ; **médiane 1,101 → 1,033, maximum 1,165 → 1,072**. À 30° : rapport médian 0,94 → 0,87, bord médian 12,6 → 3,8 ; à 60° : 0,91 → 0,90, bord inchangé (7,1).

Preuves : `artefacts/nez-aile-tache/planche-zoom.png` (2 pyramides × 30/45/60°, nez ×3, avant/après) et `planche-tete.png` (têtes complètes avec cheveux, 0° et 45°, avant/après). Régénération : `npx tsx scripts/artefacts-nose-alar-spot.ts artefacts/nez-aile-tache apres` (l'« avant » = les deux fichiers de `src` mis de côté par `git stash`).

## 5. Tests
`tests/nose-alar-spot.test.ts` : (a) seuls les pixels d'aile changent, jamais vers le bas, `ao` intact, au moins 50 pixels modifiés ; (b) graine 11 à 45° : rapport ≤ 1,1 (1,165 avant, 1,067 après). Verts, ainsi que les 33 fichiers `nose*`, `head-turntable*`, `head3d*`, `light`, `highlights-system` (267 tests) avant l'ajout de ce fichier. **Suite complète non relancée.**

## 6. Limites et restes
- ⬜ Le rapport n'est pas ramené à 1 (médiane 1,03, max 1,07) : un écart d'occlusion réel subsiste. Les graines 2 et 5 montrent une aile **plus sombre** que la joue (0,66 et 0,38, déjà 0,79 et 0,59 avant) : non examiné.
- ⬜ La mesure est bruitée : écart-type de luminance de l'anneau ≈ 18, supérieur au saut de bord (≈ 11) ; le « bord net » ne se lit pas de façon fiable sur ce chiffre. Preuve principale : visuelle (graine 11) et ablation par graine.
- ⬜ 6 graines pyramide seulement ; **cloche-ailes et plat-trapèze non mesurés après correctif** (la campagne a dépassé le temps imparti).
- ⬜ À 60°, un ovale clair subsiste sur la planche zoom, avant comme après ; cause non établie (rien ne prouve que ce soit le rebond).
- ⬜ Seul le style cel est mesuré ; les autres styles de lumière ne sont pas vérifiés.
- ⬜ Pas de règle de vérification `src/verify` pour ce défaut : seulement un test.

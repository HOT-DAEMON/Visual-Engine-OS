# Stylisation (T13) et vérification de rendu (T14)

## Profil de stylisation (`schema/face-style.ts`, `face/stylize/`)

Neuf contrôles ; sept agissent sur la géométrie, deux sur le rendu :

| Contrôle | Effet (gain 1) |
|---|---|
| `chinProjection` | écart de `chin.projection` à 0,5 ×4 dans le sens existant |
| `jawWidth` | écart de `jawWidth` à 0,8 ×3,5 (borné 0,5–0,98) |
| `angularity` | `jaw.angle` −80 %, `mandible.bodyCurve` −70 %, menton vers le carré (`chin.form`), graisse −100 % |
| `jawNeckContrast` | `neck.width` −35 % |
| `mouthSize` | `mouth.width` ±50 % (bornée par le contour) |
| `cornerAsymmetry` | s'ajoute à `mouth.cornerAsym` |
| `simplify` | raccords (`upperBlend`, `lateralBlend`, `lowerBlend`, préauriculaire, masséter, aile, philtrum) → 0 : plans francs |
| `outline` (rendu) | intensité des contours dessinés (`ink.ts`) |
| `detail` (rendu) | opacité des détails fins (plis, creux, relief du masséter) |

Propriétés : NEUTRE (tous gains à 0 → paramètres non touchés, `outline` et `detail` ne comptent pas) ; IDEMPOTENT (`baked`) ;
l'exagération garde le SENS du trait (un menton fuyant devient plus fuyant) ; les RELATIONS essentielles (`stylize/relations.ts` : menton < mâchoire,
cou entre menton et mâchoire, bouche dans le contour, ordre vertical, menton sous la lèvre) restent vraies sur 150 visages à exagération maximale (test).

## Style ≠ matériau ≠ éclairage

`renderMode` (`realistic`, `anime`, `ink`) est un autre champ. `anime` bascule l'ombrage de la peau en `cel` ; `ink` applique un filtre global (niveaux de gris + seuil à 0,7,
`ink-filter.ts`). Aucun des deux ne lit ni n'écrit la géométrie : l'empreinte géométrique (`geometryDigest`) est identique dans les trois modes (vérification + test).

## Couche de vérification de rendu (T14)

- `src/verify/structure.ts` — pour `anatomyEngine: 'structured'`, 3 couches dans `verifyFace` :
  - géométrie : nombres finis, polygones non dégénérés, parois > 0, ouverture dans la narine, dômes dans la pointe, philtrum assez long, ligne de fermeture monotone, commissures dans le contour, angle cervico-mentonnier ∈ [70°, 160°] ;
  - anatomie : columelle au-dessus de la lèvre, dômes au-dessus des narines, sillon hors narine, masséter entre pommette et gonion, silhouette = os + muscle + graisse, silhouette ≥ os, volume des lèvres ±7 %, lèvre inférieure liée à la mandibule, dents inférieures dans la cavité, étirement de joue ≤ ×1,6 (avertissement) ;
  - style : cinq relations essentielles, idempotence, mode de rendu et détail sans effet sur la géométrie, contours ∈ [0, 1].
- `scripts/lib/verify-render.ts` — mesures sur les PIXELS (resvg) : largeur de peau à la hauteur du gonion et de la mâchoire = largeur géométrique (±4 %), narine plus sombre que la peau, côté éclairé plus clair, lèvres plus rouges, encrage ≥ 90 % binaire, silhouette stable entre modes (IoU ≥ 0,985), contour dessiné présent seulement sur demande.
- Tests « mutation » (`tests/face-structure-verify.test.ts`) : on casse volontairement la géométrie, la vérification doit devenir rouge (une vérification qui ne peut pas échouer ne prouve rien).

# Yeux — passe 20 : plus aucun paramètre orphelin

Consigne : « éviter les redondances, les paramètres orphelins, les fonctionnalités inutilisées ; les valeurs des paramètres exposés doivent être consommées et
prouvables visuellement ». Cette passe ne crée aucun moteur : elle mesure, puis branche dans le rendu existant.

## 1. Audit mécanique (`scripts/lib/eye-param-audit.ts`)

Un balayage à la main (`eye-param-sweeps.ts`, 60 chemins) ne peut pas garantir qu'on n'oublie rien. L'audit part du **schéma** `EyeSpec` (268 feuilles : nombres,
énumérations, booléens, couleurs) :

1. chaque feuille est variée (bornes du schéma, milieu, tiers, autres membres d'énumération, bascule, deux couleurs) ;
2. dans des **contextes** : œil nu, apparence active, pupille étoile / polygone / croix / fente / multiple, tête en `sphere`, pli épicanthique, mèches, expression,
   microdétails + cornée, et 60 yeux de galeries qui possèdent déjà la brique (`generateExtraEye`, `…2`, `…3`) ;
3. on compile et on compare le SVG ; une feuille qui ne le change jamais est **orphelin** ;
4. sinon on retente avec 5 autres graines (effets à graine : marques de la sclère), puis on cherche le **paramètre voisin** qui la conditionne et on le consigne
   (`gatedBy`).

Résultat (16 s, `tests/eye-pass20-audit.test.ts`) : 268 feuilles, **0 orphelin**, 3 exemptées (`id`, `place.host`, `place.variation` : sans hôte, aucun effet),
9 conditionnées (ex. `appearance.glow.radius` n'agit que si `glow.intensity` > 0 ; `appearance.texture.scale` que si `texture.kind` = `grain`).
Avant la passe : **6 orphelins**, tous dans `appearance`, que la doc nommait « limites assumées » :

| Paramètre | Convention | Où il est lu |
|---|---|---|
| `appearance.opacity` | 1 = opaque ; < 1 : l'œil entier devient translucide | `eye.ts` (attribut du groupe racine) |
| `reflection.intensity` | 0,5 = neutre, opacité des reflets × 2·valeur (≤ 1), comme la peau | `globe-inner.ts`, `highlights-render.ts` |
| `reflection.size` | 0,5 = neutre, taille × (0,6 + 0,8·valeur), comme la peau | idem |
| `shading.mode` | `cel` : un œil `shaded` devient `cel` (un fini explicite n'est jamais écrasé) | `resolveEye` (`effectiveFinish`) |
| `shading.castShadow` | 0 = ombre des paupières inchangée ; profondeur et opacité × (1 + 0,5·valeur) | `globe-inner.ts` (`shaded` et `cel`) |
| `shading.highlightBand` | 0 = aucune ; croissant de lumière sur l'iris, largeur 0,32·valeur du rayon | `globe-inner.ts` |

Une seule source : `src/render/eye/appearance-levers.ts` (`eyeLevers`, `effectiveFinish`). Les leviers sont lus sur l'œil **brut**, car `flattenEye` met
`appearance` à null pour les finis `flat` / `cel` (ils retirent les effets du moteur d'apparence, pas ces six leviers).

## 2. Preuves

- **Identité** : SHA-256 de 120 yeux de galeries (40 par galerie) identique avant et après ; l'œil à apparence absente, `{}` ou aux valeurs par défaut a des
  leviers neutres (`NEUTRAL_LEVERS`) et un SVG identique à l'octet.
- **Pixels** (`tests/eye-pass20-levers.test.ts`, rastérisation resvg) : l'opacité fait reparaître le fond ; les reflets s'éteignent / grandissent ; l'ombre
  assombrit en `shaded` comme en `cel` ; la bande croît avec la valeur ; deux lumières opposées donnent des croissants disjoints (recouvrement 0,00) ; `shading.mode: 'cel'` donne
  un SVG **identique à l'octet** à `finish: 'cel'`.
- **Images** : `artefacts/eyes-pass20/02A…` et `02B…` (6 leviers × bas / neutre / haut sur deux yeux), `03-tetes-entieres.png` (têtes entières avec et sans leviers,
  graines 7 et 23, lacets 0° / ±20–25°), `rapport.json` (audit + vérification). Script : `scripts/artefacts-eyes-pass20.ts`.

Trois défauts trouvés EN REGARDANT les images (aucun n'était visible aux tests écrits d'abord, qui passaient tous) :
1. **Bande presque blanche et opaque jusqu'au bord** (œil A, `cel`) : elle se confondait avec la sclère et tronquait l'iris → bornée à 93 % du rayon, opacité 0,62 en aplat / 0,45 sinon.
2. **Lavis sur l'œil de galerie 9** (grosse iris, groupe de l'iris enveloppé dans le filtre `vibrance` / `lift`) : un bloc brun à bord horizontal en bas de l'iris. Premier
   diagnostic (« arcs ambigus ») **faux**, réfuté par la mesure (tracé à deux arcs et à quatre quarts d'arc : mêmes 15 005 pixels). Cause réelle : un rectangle de
   ±3 rayons dans le chemin, qui agrandit la boîte englobante du groupe filtré → rectangle ramené à la boîte de l'iris (±1,05 R). Les quatre quarts d'arc sont gardés
   par précaution (drapeaux non ambigus), pas comme correctif.
3. **Zone morte en bas de plage** : le trou à 100 % du rayon, décalé de 0,32·valeur·R, contenait tout le clip à 93 % → croissant **vide** pour toute valeur < 0,22
   (0 pixel à 0,2 : le paramètre redevenait orphelin). Trou ramené au même rayon que le clip : épaisseur = 0,32·valeur·R exactement.
Mesuré sur l'œil 9 après correction : 501 / 1 090 / 4 173 px à 0,2 / 0,4 / 1. Gardes (`eye-pass20-levers.test.ts`) vérifiées par contrôle négatif : le trou à 100 %
donne 0 px (échec), le grand rectangle 30 013 px au lieu de < 10 148 (échec).

## 3. Couche de vérification (`src/verify/eye-appearance.ts`)

Silencieuse pour un œil sans apparence ou à leviers neutres. Lit l'œil brut.

| Couche | Contrôle | Seuil |
|---|---|---|
| géométrie | `band-clear-of-pupil` | 1 − 0,32·bande − pupille / iris ≥ 0 |
| anatomie | `eye-opacity-readable` | opacité ≥ 0,25 |
| anatomie | `reflection-scale-bounded` | taille des reflets ≤ × 1,4 |
| style | `band-visible` | épaisseur ≥ 0,6 px au LOD courant |
| style | `cast-shadow-visible` | profondeur ajoutée ≥ 0,5 px |
| style | `reflection-visible` | reflet principal ≥ 0,8 px |

Tous en avertissement (un œil stylisé n'est jamais « faux »). Un levier invisible à la taille de rendu est un orphelin à l'écran : la règle de style le dit.
La règle `eyes-same-finish` de la paire d'yeux compare désormais le fini **effectif** (`shading.mode: 'cel'` sur `shaded` = `cel`).
Tests : `tests/eye-pass20-verify.test.ts` (6).

## 4. Limites, dites franchement

- L'audit est une condition **nécessaire** (le SVG change) ; il ne juge ni la beauté ni la fidélité aux références. `appearance.gradient` (tableau) n'est pas balayé
  et reste sans objet pour un œil.
- Bande de lumière discrète à l'échelle d'une tête entière (œil ≈ 90 px) : lisible sur les gros plans, presque invisible sur `03-tetes-entieres.png`.
- Sur `03-tetes-entieres.png`, le fini `cel` d'une tête entière montre un arc fin de pli de paupière détaché au-dessus de l'ouverture et des regards qui
  paraissent divergents (graine 7). Mesuré : `shading.mode: 'cel'` est identique à l'octet à `finish: 'cel'` sur la tête, donc ce défaut est hérité de la passe 19b,
  **non investigué ici**.
- Ce qui n'a pas été fait dans cette passe : voir `EYES-REMAINING.md`, section « Passe 20 ».

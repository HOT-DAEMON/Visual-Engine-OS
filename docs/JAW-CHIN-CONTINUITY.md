# Continuité mandibule → menton (silhouette du bas du visage)

Code : `src/face/jaw/contour.ts` (construction), `src/verify/jaw-continuity.ts` (mesures + contrôles), `tests/chin-continuity.test.ts`.
Banc : `npx tsx scripts/chin-fuzz.ts 10000` (10 000 visages tirés, aucune violation).

## Le défaut (campagne de 100 visages, planches 01–03)

Mentons pointus « décollés » : une mâchoire presque horizontale qui s'arrête net, puis un menton qui pend au milieu comme une goutte d'eau.
Visages signalés : 9, 10, 15, 16, 18 · 25, 29, 34, 40 · 41, 47, 49, 58.

## Cause (mesurée, pas supposée)

Le contour partait du coin de mâchoire G vers le coin du menton C par une corde de pente φ_corde (≈ 40–60° depuis la verticale), mais arrivait en C avec une
tangente figée par la forme (rond 17°, pointu 29°) : **plus verticale que la corde**. Une cubique qui arrive plus verticalement que sa corde fait un creux
(contrôle intérieur), puis la symphyse repart vers le bas : la goutte. Rotation de tangente à contre-sens mesurée : **30 à 80°** sur le bas du contour,
sur *tous* les visages (les 13 signalés n'étaient que les cas les plus visibles). Un menton plus étroit que la droite G → bas du menton produisait le même effet.

## La construction (convexe par définition)

Les angles de tangente (depuis la verticale, vers l'axe) croissent toujours : `φ_départ du corps < φ_corde < φ_arrivée en C ≤ φ_max < 90°`.

1. **Plancher de largeur** : C doit être à l'extérieur de la droite G–bas. `chinHalf = max(demandée, droite × 1,12 + renflement)`. Le renflement vaut peu pour une
   pointe (V arrondi), davantage pour un menton rond ou carré. Calculé **au repos** : ouvrir la bouche ne change pas la largeur du menton.
2. **Départ du corps plus vertical que la corde** (la mandibule bombe). Il peut dépasser la pente du ramus : évasement local de l'angle gonial, borné au coin.
3. **Poignées bornées** à 85 % de la distance à l'intersection des tangentes : polygone de contrôle convexe.
4. **Symphyse** : arrivée horizontale (jamais de V). Largeur du bas = **fraction** de la largeur atteignable (`shape.flat / 0,95`), donc le réglage
   « largeur de la symphyse » reste toujours effectif au lieu d'être écrêté.
5. **Rayon de pointe minimal** (`MIN_TIP = 0,02 W`) : si la pointe est trop aiguë, la part de rotation du corps diminue par pas de 0,05 (le V s'arrondit).

Conséquences assumées : un menton plus étroit que le plancher est élargi (correction `chin-continuity` enregistrée) ; `chinWidth` par défaut passe de 0,22 à
0,35 (0,22 était lui-même sous le plancher) ; `chin.widthPx` n'est plus « préservée » par `jawWidth`/masséter (voir `dependencies.ts`).

## Vérification (trois couches, `checkJawSilhouette`)

| Couche | Contrôle | Seuil |
|---|---|---|
| Géométrique | contour convexe (rotation à contre-sens du corps + symphyse) | ≤ 2° |
| Anatomique | menton non plus étroit que la droite mandibule ; pente de la corde (avertissement) | ≤ 72° |
| Style | pas de goutte (largeur à 25 % de la queue / largeur au coin) ; pointe arrondie | ≥ 0,30 ; ≥ 0,015 W |

Contrôle négatif testé : l'ancienne géométrie (contrôle intérieur) dépasse le seuil de convexité.

## Reste à faire (honnête)

- Évasement gonial : mesuré hors du corps ; pas de borne dédiée (à ajouter si une mâchoire « en oreilles » apparaît).
- Seuils fixés sur 10 000 visages tirés, pas sur des mâchoires dessinées à la main ; l'œil du directeur artistique reste le dernier juge (planches 01–03 re-générées).
- Menton fendu (`cleft`) : mêmes contraintes, non testé séparément.
- Rendu 3/4 et profil : la silhouette de face seule est garantie.

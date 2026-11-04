# Tête en rotation (`src/head-turntable`)

Moteur de TÊTE COMPLÈTE vue sous n'importe quel lacet (0° → 360°) : crâne, mâchoire, cou, oreilles, nez, bouche, yeux, sourcils, cheveux.
Il est CALÉ sur des mesures prises sur `references/face/rotation_head.jpg` (planche de rotation 0° → 180°), pas sur l'œil.
Ne pas confondre avec `src/lighting/head-turn.ts` / `src/geometry/eye/turn3d.ts` : ceux-là font tourner un ŒIL ; ici c'est la tête entière.

Suites : références et méthode de mesure `HEAD-TURNTABLE-REFERENCES.md` · vérification `HEAD-TURNTABLE-VERIFY.md` · reste à faire `HEAD-TURNTABLE-REMAINING.md`.
Preuves visuelles : `artefacts/head-turntable/` (voir son `README.md`).

## Utilisation

```ts
import { renderHead, refView, REF_SPEC, verifyHeadTurn } from './src/head-turntable';
const r = renderHead(refView(45), REF_SPEC, { frame: defaultFrame(760), ss: 3 });   // { svg, rgba, ids, regions, ppu, ... }
```

`refView(yaw)` = lacet + tangage de caméra de la planche (17,7°). `renderHead` est pur et déterministe (testé). Le SVG renvoyé est autonome
(PNG incrusté, même principe que le moteur corps `src/body/volume/pixel.ts`) ; `ids` / `regions` donnent, par pixel, la pièce et la région
peinte (peau, cheveux, œil, bouche, oreille, cou) — c'est ce qui permet de vérifier l'IMAGE rendue.

Chaîne complète reproductible (≈ 1 min) : voir la fin de ce fichier.

## Repère et caméra

Unité **U** = hauteur de tête de la planche (sommet des cheveux → bas du menton, mesurée sur le profil : 150 px). x vers la droite de l'image à lacet 0,
y vers le BAS depuis le sommet, z vers l'AVANT. Pivot = axe du cou (x = 0, z = 0). Caméra orthographique : lacet autour de la verticale de la tête, puis
tangage de caméra b (`src/head-turntable/math.ts`) :

    x₁ = x cos a − z sin a ;  z₁ = x sin a + z cos a ;  y₂ = y cos b − z₁ sin b ;  z₂ = y sin b + z₁ cos b      (z₂ grand = proche)

Lacet > 0 ⇒ le visage se tourne vers la GAUCHE de l'image (convention de la planche : à 90° le nez pointe à gauche). b = 17,73° est AJUSTÉ (voir
références) : la caméra de la planche est SOUS la tête (contre-plongée) — on y voit le dessous du menton et le plan de coupe du cou.
Conséquence : les hauteurs d'image des traits du visage dérivent avec le lacet (jusqu'à 0,10 U entre 0° et 90°) ; le modèle les reproduit, il ne les « corrige » pas.

## Modèle (tête à plat)

| Pièce | Représentation | Fichier |
|---|---|---|
| Crâne + mâchoire | pile de 26 sections elliptiques (y, demi-largeur a, face avant zf, face arrière zb), spline de Catmull-Rom | `ref-fit.ts` (généré), `sections.ts`, `mesh.ts` |
| Cou | cylindre elliptique évasé en bas, plan de coupe fermé (disque) | `mesh.ts` (`neckMeshes`) |
| Nez, lèvres | « bosses » demi-elliptiques posées sur la surface, hauteur = profil mesuré − face avant | `parts.ts` (`bumpOf`), `spec.ts` |
| Ailes du nez | deux ellipsoïdes | `parts.ts` |
| Oreilles | ellipsoïde aplati, bord antérieur sur le crâne, bord postérieur ouvert de 50° | `parts.ts` (`earFrame`) |
| Yeux, sourcils, bouche, narines, joues | TEXTURES calculées sur la surface (coordonnées tête x, y) : le raccourcissement en 3/4 vient de la géométrie | `face-tex.ts` |
| Cheveux | région de la surface au-dessus d'une lisière y(azimut), spline monotone de Hermite | `sections.ts` (`hairlineY`), `paint.ts` |

Rendu (`render.ts`) : maillages → tampon de profondeur sur-échantillonné (`raster.ts`) → peinture par pixel (`paint.ts` : ombrage à deux tons, lumière FIXE
en repère caméra, lisière, textures, ombre sous le menton) → contours (silhouette + arêtes internes, épaisseur visible ≈ 0,011 U) → réduction → SVG.

## D'où vient chaque constante (`spec.ts`)

Chaque constante est étiquetée : **[ajusté]** moindres carrés sur les 9 vues · **[mesuré]** lu sur un masque de couleur · **[annoté]** relevé à la main sur grille (±0,01 U).

| Constante | Valeur | Origine |
|---|---|---|
| Tangage de caméra | 17,73° | [ajusté] yeux + bouche, 9 vues, 26 observations, résidu 0,012 U (yeux), 0,006 U (bouche) |
| Œil : x, y, z | 0,170 ; 0,629 ; 0,386 U | [ajusté] |
| Bouche : y, z | 0,861 ; 0,373 U | [ajusté] (centre de la cavité, en retrait des lèvres) |
| Bout du nez : y, z | 0,735 ; 0,527 U | [mesuré] avancée max. du profil 90° |
| Sections a, zf, zb | 26 rangées | [mesuré] face 0°/180° et profil 90°, hauteurs ÷ cos b, lissées ([1 2 1], 2 passes) |
| Dessous de mâchoire, menton | rangées y ≥ 0,85 | [annoté] caché par le cou sur la planche |
| Taille d'œil, d'iris, de bouche, d'oreille, de narines | voir `spec.ts` | [mesuré] / [annoté] |
| Lisière des cheveux | 9 nœuds en azimut | [ajusté] IoU sur masques de cheveux, 5 lacets de calage, 4 hors échantillon |
| Palette | peau `#fde7cd`, cheveux `#f3e290`, encre `#493831`… | [mesuré] médianes de couleur sur la planche |

## Reproduire toute la chaîne

    python3 scripts/head-turntable/measure-rotation.py            # planche -> references/face/rotation_head.measures.json
    npx tsx scripts/head-turntable/fit-rotation.ts                # mesures  -> src/head-turntable/ref-fit.ts (généré)
    python3 scripts/head-turntable/annotate-face-refs.py          # 01 / 02 / 05 -> references/face/face_refs.measures.json
    npx tsx scripts/head-turntable/artefacts-turntable.ts         # rendus + rapport de vérification
    python3 scripts/head-turntable/compose-artefacts.py           # montages, superpositions, détails
    python3 scripts/head-turntable/hair-iou.py                    # recouvrement des cheveux
    # recalage optionnel de la lisière : export-hair-masks.py .scratch/refhair puis fit-hairline.ts .scratch/refhair

Tests : `npx vitest run tests/head-turntable.test.ts` (13 tests, ≈ 17 s : déterminisme, symétrie, périodicité, vérification des 3 couches, détection de défauts injectés).

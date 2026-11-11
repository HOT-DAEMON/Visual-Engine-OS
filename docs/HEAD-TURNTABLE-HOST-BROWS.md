# Sourcils de l'hôte dans la tête 3D

Suite de `HEAD-TURNTABLE-HOST-OVERLAP.md` (yeux de l'hôte). Même principe : **aucun nouveau moteur**, la tête 3D lit le moteur de sourcil qui dessine déjà le visage de face (`geometry/eye/browGeometry`).

## Ce qui est branché

| Étape | Fichier | Rôle |
|---|---|---|
| Géométrie | `render/head-3d-eyes.ts` | `browGeometry(g, eyebrow, crease.height)` (même appel que `render/eye/eyebrow-render.ts`, pli de paupière compris), contour fermé + ligne médiane + épaisseur locale + couleur dominante, ramenés dans le repère de l'hôte (`toHostFrame`) puis en U |
| Type | `head-turntable/types.ts` | `HostBrow` (`outline`, `line`, `widths`, `color`), `HostEye.brow?` ; région peinte `REGION.brow = 7` |
| Peinture | `head-turntable/brow-host-tex.ts` | remplissage de la teinte du sourcil (assombrie de 22 % vers l'encre), filet d'encre fin **à l'intérieur** du contour |
| Choix | `head-turntable/face-tex.ts` | `browTex` : avec `eyeHost` → sourcil de l'hôte (ou **aucun** s'il n'en a pas) ; sans hôte → arc de la planche |
| Relations | `engines/host-eyes.ts` | `spec.brow` (point haut, tête, queue, demi-épaisseur) lu de la ligne médiane réelle : les contrôles oreille ↔ sourcil lisent le vrai sourcil |

Le sourcil est peint comme les autres textures du visage (coordonnées tête, projection le long de z, surfaces tournées vers l'avant) : il suit la rotation et le roulis, et le sourcil lointain disparaît avec le visage.

## Défaut trouvé et corrigé pendant le travail

Un filet d'encre centré sur le bord épaississait le sourcil de 0,0056 U : l'aire rendue valait ×1,3 à ×2,3 celle du contour de l'hôte sur les sourcils fins. Le filet est maintenant tracé à l'intérieur : ×0,96 à ×1,03.

## Contrôles (`verify-brow.ts`, couche anatomie, hôtes seulement)

Par côté : `line` (distance moyenne de la ligne médiane de l'hôte au sourcil rendu à 0°), `area` (aire rendue / aire du contour), `above-eye` (le bas du sourcil reste au-dessus de la paupière), `midline` (bord interne à ≥ 0,01 U de l'axe) ; globalement `rotates` (à 35° le sourcil est encore peint). Un côté sans sourcil : `none` (aucun pixel de sourcil rendu).

| Contrôle | Borne | Mesuré (13 hôtes avec sourcil) |
|---|---|---|
| `line` | ≤ 0,006 U | 0 – 0,0010 |
| `area` | 0,85 – 1,2 | 0,96 – 1,03 |
| `above-eye` | ≥ 0 | 0,021 – 0,125 |
| `midline` | ≥ 0,01 | 0,053 – 0,141 |
| `rotates` à 35° | ≥ 30 px | 116 – 595 |

Les bornes ont été écrites **après** avoir vu ces valeurs (16 graines : 13 avec sourcils, 3 sans). Elles détectent un décalage de 0,03 U et un sourcil enfoncé dans l'œil (`tests/head-turntable-brow.test.ts`, 6 tests). Contrôles par tête : 97 → 112 (hôte avec sourcils), 105 (sans).

## Preuves

`artefacts/head-turntable-v7/01-sourcils-hote.png` : visage de l'hôte, 3D avant, 3D après à 0°, 35° et 70°, pour les graines 42, 77, 3 et 11 (11 n'a pas de sourcil : la tête 3D n'en a pas).

## Reste à faire

Voir `PIPELINE-HEAD-3D-REMAINING.md`. Propre aux sourcils : poils (`browHairs`) non repris, le sourcil est un aplat ; pas de froncement ni d'expression (réf. 02, ≈ 30°) ; un seul style de remplissage (pas de dégradé de l'hôte) ; sourcil lointain à fort lacet non vérifié séparément ; la tête issue d'une graine (`variedHead`) et la planche gardent l'arc quadratique.

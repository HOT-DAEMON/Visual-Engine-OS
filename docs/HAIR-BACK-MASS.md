# Masse arrière des cheveux longs — fin de la « masse noire »

Branche `feat/hair-grammar`. Contexte : `HAIR-SKULL.md`. Vérification : `HAIR-SKULL-VERIFY.md`. Reste à faire : `HAIR-SKULL-REMAINING.md`. Preuves : `artefacts/hair-skull/02-cheveux-longs-masse-noire.png`.

## Ce que c'est
Pour `bob`, `long` et les archétypes simulés, une sous-couche est posée DERRIÈRE la tête, entre les mèches arrière : sans elle, on verrait le fond à travers la chevelure. Elle ne dessine pas la silhouette ; ce sont les mèches qui la dessinent, la masse ne fait que les doubler.

## Défauts de l'ancienne construction (mesurés ; moyennes sur 14 visages `bob` puis 14 `long`, mêmes graines avant/après)
| mesure | avant (bob / long) | après (bob / long) |
|---|---|---|
| largeur à 6 % sous le haut / largeur maximale (couvercle : 1 = plat) | 0,95 / 0,93 | 0,54 / 0,63 |
| largeur à 3 % au-dessus du bas / maximale (1 = bas plat) | 0,82 / 0,89 | 0,76 / 0,81 |
| aire / boîte englobante (1 = rectangle) | 0,87 / 0,91 | 0,85 / 0,88 |
| teinte de la masse / luminance des cheveux | 0,27–0,37 | 0,66–0,82, médiane 0,72 sur 156 visages (`BACK_MASS_TONE = −0,4`) |

- **Couvercle plat** au niveau des tempes : « oreilles de chat » qui dépassaient jusqu'à 0,44 W du crâne.
- **Bas plat** à la mèche la plus basse : un rectangle collé derrière la tête.
- **Contour pris sur la mèche la plus extérieure** : aucune mèche ne dépassait de la masse, bord nu visible.
- **Bavoir noir** : la masse, très sombre et d'opacité pleine sous le menton, formait une tache continue entre le cou et les mèches.

Seul le couvercle change nettement en chiffres. Le bas (0,76–0,81) et l'aire/boîte (0,85–0,88) gagnent peu : une chevelure longue qui tombe droit est naturellement proche d'un rectangle. Le résultat visuel (plus de bavoir, plus de bord nu) tient à la fermeture arrondie, au fondu et à la teinte ci-dessous, pas à ces deux rapports.

## Construction (`back-mass.ts`), ligne par ligne, gauche et droite séparément
1. **HAUT = le crâne.** Demi-largeur `a(y)` du contour du crâne + épaisseur de coque, en CLOCHE (maximum courant, figé sous la mâchoire). Le haut se referme sur le sommet : plus de couvercle.
2. **FLANCS = l'étendue des mèches**, rétrécie d'une largeur de mèche (`inset` 0,018 W) : les pointes extérieures dépassent de la masse.
3. **ÉVASEMENT borné** (`flare` 0,8, pente maximale) sous la tempe : une mèche isolée ne tire pas un coin.
4. **PLANCHER** = 0,97 × la largeur du crâne (ou du cou plus bas) : jamais de trou entre la masse et la tête.
5. **BAS** = 85ᵉ centile des pointes arrière, relevé de 0,05 H, FERMÉ en demi-ellipse (`backMassCloseHeight` = min(0,11 H, 0,3 × hauteur)). Les pointes pendent sous la masse.

Lissage 1-2-1 (3 passes) borné : il ne sort pas des mèches, ne rentre pas sous la tête. `rowExtents` parcourt les ARÊTES des polygones : aucune ligne n'est sautée entre deux sommets éloignés (l'ancienne enveloppe ne lisait que les sommets).

## Teinte et fondu (rendu, `hair-look.ts`, `hair-back-fade.ts`)
- `backMassColor = ra.tone(−0,4)` : la masse est à ≈ 0,7 de la luminance des cheveux, non plus 0,3.
- **Fondu** autour de la mâchoire : dégradé linéaire `userSpaceOnUse`, opaque jusqu'à 0,04 H avant la mâchoire, 0,4 à mi-fondu, nul 0,1 H après. Un fondu long (premier essai) faisait une fumée grise sous le menton ; la bande étroite l'a supprimée.
- **Mode encre** (`sim.ink`) : aplat + contour, sans dégradé : choix du style, pas un défaut.

## Raccord avec le reste
- `body-lock.ts` : `isBodyLock` = mèche simulée, `lock`, `cheek`, `fringe` ou sans genre. Source unique pour la construction ET la vérification ; cônes, volutes et occluders n'entrent jamais dans l'étendue de la masse (elles tiraient des « oreilles » à 0,5 W).
- La coque avant (`scalp.ts`) et la masse arrière partagent la même épaisseur `crown` (donc la même loi `thickness.ts`).
- Les mèches arrière `main` sont désormais bornées en montée (`fitReach`) : elles ne recourbent plus par-dessus le sommet (0,20 H sur un bob).

## Limites
Voir `HAIR-SKULL-REMAINING.md` : petits triangles colorés sous le cou (rubans `flow`/`mass` arrière), masse non reliée au profil, archétypes simulés non revus mèche par mèche.

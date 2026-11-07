# Cheveux ↔ crâne — coque, portée et cohérence

Branche `feat/hair-grammar`. Suite de `HAIR-BOUNDARY.md`. Masse arrière : `HAIR-BACK-MASS.md`. Vérification : `HAIR-SKULL-VERIFY.md`. Reste à faire : `HAIR-SKULL-REMAINING.md`. Preuves : `artefacts/hair-skull/` (`npx tsx scripts/artefacts-hair-skull.ts`).

## Le problème (mesuré, graines fixes, 14 visages par coiffure, axes v2 cohérents)

Les cheveux étaient dessinés comme une enveloppe libre, sans loi qui les lie au crâne qu'ils recouvrent :

| coiffure | montée max des mèches (fraction de H) avant → après | dôme de la coque (max) avant → après |
|---|---|---|
| buzz | 0,268 → 0,013 | 0,004 → 0,004 |
| short | 0,440 → 0,057 | 0,142 → 0,055 |
| spiky | 0,390 → 0,098 | 0,140 → 0,056 |
| curly | 0,390 → 0,164 | 0,192 → 0,176 |
| afro | 0,373 → 0,256 | 0,264 → 0,254 |
| bob | 0,360 → 0,075 | 0,156 → 0,062 |
| long | 0,351 → 0,058 | 0,165 → 0,061 |
| ponytail | 0,394 → 0,074 | 0,150 → 0,040 |
| bun | 0,344 → 0,073 | 0,151 → 0,041 |
| braids | 0,343 → 0,050 | 0,154 → 0,040 |

Une coupe rase avec 0,27 H de cornes, une queue de cheval tirée avec un dôme d'afro, des cheveux longs avec des volutes qui partent à l'horizontale : trois symptômes d'une seule absence, un **volume admis par coiffure**.

## Les trois lois

### 1. Épaisseur anatomique de la coque (`thickness.ts`)
`THICKNESS[style] = { cap, puff }` : épaisseur maximale de la coque (fraction de W) et part du gonflement `silhouette.puff` que la coiffure admet.

- tirées en arrière (queue, chignon, tresses) = 0,035 W, plaquées ; rase 0,01 W ; courtes 0,045–0,05 W ; bob/long 0,06 W (le poids tasse) ; bouclé 0,16 W ; afro 0,32 W ;
- **genou doux** (`shellThickness`) : identité jusqu'à 70 % de `cap`, saturation exponentielle au-delà. Les valeurs du moteur classique (≤ 0,9 `cap`) bougent de moins de 3 % ; seuls les tirages gonflés du v2 sont ramenés dans la plage ;
- **gain d'asymétrie** limité à ×1,35 (`GAIN_LIMIT`) : le gain de silhouette montait à ×2,1 et doublait l'épaisseur d'un seul côté ;
- le soulèvement des racines (bosse de la raie) est compté DANS l'épaisseur : T + soulèvement ≤ `maxShell` (`shell.ts`) ;
- `distanceOutsideSkull` : vraie distance normale au contour du crâne (échantillonnage en u², segments). L'écart horizontal à `a(y)` est faux près du sommet, où le contour est presque horizontal (il faisait paraître une coque normale « large » de plusieurs centimètres).

### 2. Portée des formes libres (`reach.ts`)
`REACH[style] = { up, side }` : montée maximale au-dessus du sommet (fraction de H) et éloignement maximal au contour du crâne (fraction de W, distance réelle). Une forme libre est une licence de style, pas de proportion.

`fitReach(ctx, c, halfWidth, lateral)` met le déplacement depuis la racine à l'échelle d'un facteur unique (forme, enroulement, courbure conservés ; seule la longueur diminue ; la racine ne bouge pas ; identité si la forme respecte déjà la portée). La demi-largeur de la forme compte dans la borne : le BORD d'une mèche large ne sort pas non plus.

- `lateral = true` : cônes, rubans en S, volutes (`shapes.ts`) ;
- `lateral = 'cranial'` : mèches de corps (`massLocks`, `classicLocks`, mèches arrière `main`) : l'éloignement n'est borné qu'au-dessus de la tempe ; leur chute le long du visage et du cou est légitime, leur envol sur le crâne ne l'est pas.

Couverture : cônes, rubans, volutes, **mèches `mass`** (0,21 H sur queue de cheval avant), **mèches `main`/`fine` classiques** (afro 0,53 H, bouclé 0,26 H), **mèches arrière** recourbées par-dessus le sommet (bob 0,20 H). L'ordre des tirages aléatoires est conservé : les autres valeurs d'une graine ne bougent pas.

### 3. Cohérence des axes avec la coiffure (`random-hair-v2.ts`)
Coupe rase : pas de rideau devant l'oreille, pas d'oreille rangée sous une mèche, pas de favori long (lanière de 0,3 H pendant à côté du visage). Corrigé APRÈS le tirage, sans consommer de tirage : toutes les autres valeurs de la graine sont identiques.
`SHELL.buzz.reach = 'none'` : une aile de 14 px s'arrêtant en plateau horizontal à la tempe (carrés visibles sur les tempes, 6 % des coupes rases) est supprimée ; la coupe rase s'arrête au coin de la tempe.

## Ce qui n'est PAS modifié
Le contour de la lisière (`boundary/`), les archétypes simulés (Verlet), la frange, les mèches de côté (oreille, joue), le rendu de profil. Voir `HAIR-SKULL-REMAINING.md`.

## Test modifié délibérément
`tests/hair-v2.test.ts` : l'ancien test « le gonflement épaissit la coque » prenait une coupe courte et exigeait un épaississement proportionnel. C'est exactement le comportement supprimé (une coupe courte n'a pas le volume d'un afro). Le test porte maintenant sur `curly`, et un nouveau test vérifie que la coupe courte garde un gonflement, plafonné.

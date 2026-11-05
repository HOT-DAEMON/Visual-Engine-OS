# Éclairage par relief dans le pipeline principal (`kind: 'head_lit'`)

> État au 5 nov. 2026. Avant : « `relief` (relief de la tête) non branché ».

## Contrat

`HeadLitSpec` (`src/schema/head-lit.ts`) : `host` (visage), `light` (surcharge partielle de la lumière de scène), `style` (`soft` | `cel2` | `cel3`), `shadowHue`
(`warm` | `cool`), `contrast`, `bias`, `rim`, `ao`, `ppu`.

Rendu = f(géométrie, matériaux, éclairage, caméra) : le relief (profondeur, normales, régions) ne dépend que de la **géométrie du visage** ; la lumière est celle de la
scène (`scene.light`) surchargée par `light`. Un éclairage local égal à la lumière de scène donne le même rendu que cette lumière de scène (testé).

Le calque est le champ `top` de `CompiledObject` : posé **après** tous les `overlay`, dans le repère de l'hôte. Il multiplie et éclaire **tout ce qui est dessiné dessous**
(cheveux compris) : un autre objet qui chevauche le visage est éclairé aussi.

Un seul éclairage par hôte ; hôte non-visage refusé. Le SVG est mémoïsé par le contenu.

## Coût mesuré (visage 11, cache froid, une mesure par cas)

| Réglage | Temps | SVG |
|---|---|---|
| visage seul | 335 ms | 534 Ko |
| relief `ppu` 2,4 | 4 630 ms | 1 142 Ko |
| relief `ppu` 2,4, 2ᵉ appel (cache) | 102 ms | 1 142 Ko |
| relief `ppu` 1,6 | 1 641 ms | 871 Ko |
| relief `ppu` 1,2 | 1 130 ms | 755 Ko |

Le relief est **~13× le coût du visage à ppu 2,4** : c'est la couche la plus chère du pipeline. J'ai fixé le défaut à `ppu` 1,6 pour le temps de génération
**sans avoir comparé la qualité visuelle de 1,6 et 2,4** : la planche utilise le défaut 1,6. À trancher à l'œil.

## Preuve visuelle

`artefacts/pipeline-wiring/02-face-profil-relief.png` : de face, + relief doux, + relief cel 2 tons (lumière 320°, élévation 50°). Le relief fait apparaître l'ombre du nez,
l'arcade, le modelé de la mâchoire et l'ombre portée sur le cou ; le cel 2 tons donne des bords nets. Cohérence : l'ombre du nez tombe à l'opposé de la source.

## Reste à faire

- Qualité 1,6 vs 2,4 non comparée ; aucune optimisation du calcul (le coût vient du champ de relief par pixel) : candidat prioritaire pour le temps de génération.
- Le relief ne lit pas l'orbite publiée (`relief/head.ts` a ses constantes) ni le matériau de peau indépendant (il utilise la couleur dominante).
- Pas d'éclairage par relief du corps (`litFigure` existe, non branché) ni du profil.
- Un seul `top` : le relief ne se compose pas avec un second calque `top`.

# Cheveux v2 (suite) — franges, côtés, occlusions, ombrage cel, couleurs

Suite de `docs/HAIR-V2.md`. Code : `fringe2.ts`, `sides.ts`, `occlusion.ts`, `render/face/hair-cel.ts`, `hair-lock.ts`, `generation/random-hair-v2.ts`.

## Moteur générique de frange (`fringeEngine`, `fringe2.ts`)

Un seul constructeur de mèche (`blade` : courbe quadratique racine → pointe, tangente de départ quasi verticale) ; les modes ne font que
choisir nombre, largeur, pointe, longueur et position du **jour**. **Jamais de masse pleine** : le front reste visible entre les mèches.
Toutes les pointes sont bornées à `guard.yF − 0,016 H` (le garde-fou ramène une pointe qui dépasse à `yF`, il ne la pousse plus de côté).

| Mode | Contenu | Jour |
|---|---|---|
| `sheer` | 70–110 fils de 0,004–0,008 W, rang `hairline`/`fine`, fondu 0,55 | 2–5 fenêtres sans fils (`gap`) |
| `blades` | 5–7 grandes mèches triangulaires pointues (cône) ; le côté `side` descend jusqu'au sourcil, l'autre reste court | jour central de demi-largeur `0,34·gap·xF` |
| `wispy` | 26–36 mèches fines étagées, pointes très irrégulières | clairsemé au centre |
| `asym_brow` | grandes mèches balayées jusqu'au sourcil d'un côté, courtes de l'autre | front ouvert côté court |

`cheekLocks` ajoute les mèches latérales (voir ci-dessous). `fringeBottom` (bord inférieur) reste fourni et ≤ `yF`.

## Comportement propre à chaque côté (`sides`, `sides.ts`)

Chaque côté de l'IMAGE est résolu indépendamment : `ear` ∈ `auto|covered|free|tucked`, `cheek` ∈ `none|short|long`. La **zone d'oreille**
est calculée par la même formule que le rendu des oreilles (`earZone`) : l'oreille dessinée est l'oreille testée.

- `covered` : rideau de mèches centrées sur l'oreille, à bout presque carré, élargies jusqu'à ≥ 60 % de couverture **mesurée** (grille 18×18).
- `free` : toute mèche (hors frange/joue/occluder) qui touche l'oreille passe au calque **arrière** — l'oreille se détache, cheveux derrière.
- `tucked` : comme `free` + une mèche rangée qui coiffe le haut de l'oreille (couverture ≤ 0,5).
- `cheek` : mèche de joue devant l'oreille ; garde-fou `cheek` (marge 0,03 W au niveau des yeux, jusqu'à 0,085 W sous le nez : jamais sur l'œil).
- `auto` : coiffures longues/volumineuses → `covered` ; tresses → `tucked` ; autres → `free`.

## Mèches qui passent devant le visage (`occlusion`, `occlusion.ts`)

Cibles : `eyeLeft`, `eyeRight`, `brows`, `nose`, `mouth` (part 0–1). Chaque cible reçoit 1 mèche (2 au-delà de 60 %) **attachée à
l'implantation**, calque `over` (dessiné **après** les yeux : `compileScene` ajoute un calque final). La largeur est ajustée par
dichotomie (11 itérations) jusqu'à ce que le recouvrement **mesuré** sur la vraie géométrie égale la demande (écart < 0,06 en pratique ;
tolérance de vérification 0,12). `≥ 0,95` = composant entièrement masqué. La bouche est plafonnée à 0,6. Le générateur aléatoire
n'active **pas** les occlusions par défaut (`occlusions: true` pour les autoriser) : l'œil reste l'objet principal.

## Ombrage cel (`appearance.shading`, `hair-cel.ts`)

`mode: cel` : par mèche épaisse, **au plus 3 aplats à bords nets**, rognés par le contour réel (clip-path) :
ombre (côté opposé à la lumière, s'amincit continûment quand la mèche est parallèle à la lumière → pas de saut le long d'un S),
ombre propre (pied de mèche, `bands: 3`), bande de reflet blanche à contour dur (`highlightBand`). `castShadow` : ombre portée teintée
(teinte d'ombre proche de la principale, légèrement bleutée) décalée à l'opposé de la lumière, **entre** les mèches.

## Couleurs (génération v2)

`VIVID_SHARE = 0,35` + les 8 % d'origine : **47 %** de couleurs vives mesurées sur 300 seeds (16 % avec la définition de `isVivid` pour la v1).
12 familles de teinte. Dégradé racine → pointe sur 55 % des têtes (analogue ±25–70°, parfois complémentaire ; 2 ou 3 couleurs).
Reflets : teinte propre à chaque famille (voir `docs/APPEARANCE.md`).

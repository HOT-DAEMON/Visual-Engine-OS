# Nez : extraction des références et branchement sur le moteur d'éclairage

Branche `feat/hair-grammar`. Ce document décrit ce qui a été fait ET mesuré. Ce qui n'a pas été fait est dans `docs/NOSE-REFS-REMAINING.md`.
Preuves visuelles : `artefacts/nez/` (régénérables : `npx tsx scripts/artefacts-nose.ts`).

## 1 · Audit avant écriture (rien n'a été dupliqué)
- Moteur de nez existant : `src/face/nose/` (12 régions, 7 axes, contraintes) ; rendu de face `src/render/face/structure/nose.ts`. **Conservés tels quels.**
- Moteur de lumière existant : `src/relief/` (LIGHT-VISIBLE-06, `head_lit`). **Réutilisé, aucun second moteur d'éclairage.**
- Couche de vérification existante : `src/verify/` (`verifyFace` : géométrie, anatomie, style). **Étendue**, pas remplacée.
- **Écart trouvé** : `headRelief` modélisait le nez par trois gaussiennes fixes (dos, pointe, ailes) qui ignoraient les régions du nez
  (parois, gouttière, dômes, narines, sillons). Le nez était donc éclairé sans rapport avec ses propres paramètres.

## 2 · Compilateur propre au nez : nécessaire ? — NON
Le nez n'est pas un `kind` de scène : c'est un enfant du visage, compilé par le `host` qui passe déjà par le registre de compilateurs existant.
Un `kind: 'nose'` obligerait à dupliquer la résolution d'hôte, la peau et le cadrage de `compileHost`, et ne servirait à aucune scène.
Aucun compilateur n'a donc été enregistré. La couche de lumière a déjà son enregistrement (`head_lit`) ; le nez y est lu via `noseRelief`.

## 3 · Ce que disent les six références
Lecture visuelle (qualitative), faite image par image :
- `01.jpg` crayon, 22 vues (¾, dessous, dessus) : ailes qui enveloppent la pointe, narines en virgule, hachures sous la base.
- `02.jpg` traits : arête en double ligne, plan de la base hachuré, pointe et ailes en deux niveaux.
- `03.jpg` dessous en dégradé : anneau de la base, narines en virgules sombres, ailes qui bordent le lobule.
- `04.jpg` construction : **ellipse** (enveloppe lobule + ailes) et **triangle** (base des narines, sommet = columelle) selon l'inclinaison.
- `05.jpg` crayon, 24 vues, dont détails de peau (pores, rougeurs) sur la pointe.
- `06.png` construction : cinq silhouettes de base en aplat → nez dessiné → nez encré.

**Seule `06.png` a été MESURÉE** (aplats uniformes, segmentables). Les cinq autres ne sont pas quantifiées (voir « reste à faire »).

## 4 · Mesure de `06.png` (`scripts/nose-refs/extract_06.py` → `references/nez/measures-06.json`)
Segmentation de l'aplat rose, colonne de gauche, profil de largeur à 25 niveaux normalisé + rapport L/H. Aucune valeur saisie à la main.

| silhouette | L/H mesuré | remplissage de la boîte |
|---|---|---|
| pyramide | 0,73 | 0,58 |
| ellipse large | 1,60 | 0,80 |
| cloche à ailes | 0,98 | 0,58 |
| trapèze plat | 1,23 | 0,69 |
| losange petit | 1,52 | 0,69 |

## 5 · Ajustement du moteur sur ces mesures (`scripts/nose-refs/fit.ts`)
Recherche aléatoire déterministe + descente par coordonnée sur 10 axes du contrat EXISTANT (aucun nouveau paramètre). Comparaison sur les
72 % du haut de la silhouette : le bas des références est fermé par le contour du lobule, le moteur ferme le nez par une base plate.

| archétype | résidu | L/H moteur | L/H réf. | verdict |
|---|---|---|---|---|
| pyramide | 0,073 | 0,74 | 0,73 | **reproduit** |
| cloche à ailes | 0,139 | 0,83 | 0,98 | **reproduit** (profil), rapport L/H encore trop bas |
| ellipse large | 0,518 | 0,83 | 1,60 | non reproductible de face |
| trapèze plat | 0,214 | 0,83 | 1,23 | non reproductible de face |
| losange petit | 0,391 | 0,83 | 1,52 | non reproductible de face |

Seuil « reproduit » : résidu ≤ 0,15 (`REPRODUCIBLE_MAX`). Le L/H du moteur plafonne à 0,825 sur trois ajustements : je n'ai **pas** établi pourquoi.
Seuls `pyramide` et `cloche-ailes` sont exportés (`noseArchetype()`). Les autres restent mesurés mais déclarés hors de portée.
`tests/nose-archetypes.test.ts` recalcule le résidu depuis la référence : si le moteur change, il casse au lieu de mentir.

## 6 · Branchement sur le moteur d'éclairage (`src/relief/nose.ts`)
Le nez devient un volume construit sur ses régions, ajouté au champ de profondeur de `headRelief` (même `LightModel`, même peau, mêmes ombres) :
arête et parois (`dorsum`, `sidewall.slope`), gouttière (`sidewall.concavity`), socle de pointe + deux dômes (`domes.*`), un volume par aile
(`alae.volume`), creux de narine orienté selon son inclinaison (`nostrils.opening`), sillons alaires (`groove.depth`), projection (`tipH`).

**Défauts rencontrés puis corrigés** (constatés sur les images, pas supposés) :
1. première version : ombre verticale en « corne » le long de l'arête (palier de paroi trop haut → trop de volume) → paroi abaissée, épaulement progressif ;
2. première version : ligne sombre horizontale sous le nez = coupure franche de la boîte de calcul → boîte élargie + fenêtre lissée.
Le contrôle `nose-relief-edge-zero` (§8) existe pour que ce second défaut ne revienne pas sans être vu.

## 7 · Preuve que chaque axe produit une différence visible et localisée
`tests/nose-relief.test.ts` : pour chaque axe, relief au minimum vs au maximum ; effet visible (px de profondeur), ≥ 90 % de la masse du
changement dans la région de l'axe, fuite hors région < 25 % du pic. **8 axes sur 8 passent.**
`artefacts/nez/metrics.json` (rendu éclairé 300°/45°, cadrage nez) — part de pixels dont la luminance change de plus de 6/255 :

| axe | pixels changés | Δ luminance moyenne |
|---|---|---|
| projection de la pointe | 20,6 % | 4,96 |
| pente des parois | 8,8 % | 2,17 |
| volume des ailes | 5,3 % | 1,10 |
| gouttière des parois | 4,0 % | 0,99 |
| relief des dômes | 3,4 % | 0,69 |
| séparation des dômes | 1,9 % | 0,41 |
| sillon alaire | 1,3 % | 0,25 |
| ouverture des narines | 1,0 % | 0,21 |

**Lecture honnête** : projection, pente des parois et volume des ailes se voient nettement. Séparation des dômes, sillon alaire et
ouverture des narines sont mesurables mais **discrets** à cette échelle (≈ 1–2 % des pixels). Ils sont prouvés par le relief, pas « convaincants »
à l'œil seul ; les rendre plus lisibles reste à faire.

## 8 · Couche de vérification (`src/verify/nose-relief.ts`, branchée dans `verifyFace`)
- géométrie : relief fini ; nul sur le bord de la boîte ; pente maximale ≤ 0,3 × projection par pixel ;
- anatomie : le nez culmine dans sa moitié basse ; narines plus basses que la pointe ; relief ≤ 2,2 × projection ;
- style : le nez n'est pas plat (pic ≥ 0,6 × projection, `warn`).
`tests/nose-relief-verify.test.ts` : 12 visages aléatoires passent ; des défauts **injectés** (marche, falaise, NaN, nez plat, pic à la racine,
narine trop haute) sont détectés. Limite connue : une marche de 0,4 × projection n'est vue que par le contrôle de bord, pas par la pente.

## 9 · Peau, matériau, texture
La couleur de peau du nez est celle de l'hôte : `litHead` reçoit la peau du visage et `noseRelief` ne fournit qu'une hauteur. Le partage de teinte
avec les autres composants vaut donc **par construction** ; il n'a pas été mesuré région par région. Le nez n'a **pas** de matériau ni de texture propres
(voir `NOSE-REFS-REMAINING.md`).

## 10 · Planches (`artefacts/nez/`)
- `01-silhouettes-references.png` : silhouettes mesurées de la réf. 06 (violet) et silhouette du moteur ajustée (jaune pointillé) ;
- `02-axes-eclaires.png` : les 8 axes au minimum et au maximum, éclairés ;
- `03-tete-complete-archetypes.png` : tête entière et gros plan, nez par défaut, « pyramide », « cloche-ailes » (même visage, même peau, même lumière).
Le visage lui-même (crâne, yeux) est celui du moteur existant, non retouché.

# Moteur capillaire — passe 4 : calotte, largeurs, profondeur, lumière 3D, segmentation par mèche

Code : `src/hair-grammar/{dome,repair-dome,repair,compose-verify,occlusion-stability,observe-strands}.ts` · `src/render/face/{hair-light,hair-cel,hair-lock}.ts`
Tests : `tests/hair-engine-pass4.test.ts` (13) · `tests/hair-light3d-main.test.ts` (7) · `tests/hair-engine-strands.test.ts` (8)
Preuves (têtes entières) : `artefacts/hair-engine-pass4/` (`README.md`, `metrics.json`) — régénérées par `npx tsx scripts/hair-grammar/artefacts-pass4.ts`.
Reste à faire par composant : `HAIR-PASS4-REMAINING.md` (et `HAIR-PASS3-REMAINING.md` pour ce que la passe 3 laissait et que celle-ci ne touche pas).

Méthode : chaque ligne de `HAIR-PASS3-REMAINING.md` a été relue, sa cause MESURÉE avant de coder, et aucun seuil n'a été relâché pour « passer ».

## 1. Intention combinée (planche 08) — « variété des largeurs » 0,94 > 0,9 à tous les lacets
- Hypothèse de la passe 3 : les pointes libres (`fray`, 0,16 × la largeur de la mère) tirent le CV. **Confirmée par ablation** (sans `tips`, le CV repasse sous la limite).
- Cause de fond : le CV mesurait une population MÉLANGÉE (mèches + filles). Les filles sont fines PAR CONSTRUCTION ; leur nombre dépend de `Intent.tips`, pas de la variété des largeurs de la coiffure.
- Correctif (`compose-verify.ts`) : le CV est calculé sur les **mèches racines** (sans `parent`), mêmes limites 0,1–0,9. Sans filles, la valeur est identique à l'ancienne (testé à 1e-9).
- Le garde-fou que la mesure mélangée masquait est rendu explicite : « filles plus fines que leur mère » (largeur / mère, max ≤ 1).
- Vérifié : des largeurs uniformes échouent toujours (< 0,1), des largeurs chaotiques aussi (> 0,9), même avec des filles. Style vert à −60, −30, 0, 30, 60°.

## 2. Calotte couverte à 63 % à 30° (minimum 70 %)
- Le défaut `anat.dome` est GLOBAL (aucune mèche fautive : il en MANQUE une). `repairCycle` ne traitait que les défauts portant une `lock` — il restait donc tel quel (4 → 2).
- Cause mesurée sur rendus : `applyPart` pousse toutes les mèches du dessus de côté, la frange comprise, qui glisse autour du crâne ; le front reste nu. « Sans raie » : 0 échec sur 42 cas ; avec raie −0,3 : 9/42 (jusqu'à 36 % de couverture).
- Première hypothèse (couloir de raie trop large) **réfutée** : diviser le couloir par 2 ou ajouter des mèches fines de flanc ne changeait presque rien.
- `dome.ts` : masque et ratio de calotte extraits de `compose-verify` — vérification ET réparation jugent exactement les mêmes cellules.
- `repair-dome.ts` (phase 3 du cycle) : plus grande zone nue (composante 4-connexe), 5 abscisses × 3 hauteurs de racine AU-DESSUS de la zone, 5 caps latéraux × 3 longueurs ≈ 225 candidats évalués sur la trame (≈ 1 ms chacun). Un candidat est refusé s'il touche un œil, le nez, la bouche (mêmes prédicats que le solveur local) ou s'il recouvre une cellule du **couloir de la raie** (contrainte dure : la raie reste un sillon à découvert entre deux rideaux).
- La phase se déclenche sur le défaut puis vise seuil + 0,10 (le seuil détecte une panne ; un résultat posé juste dessous laisserait le front à demi nu). `domeLimit` n'a pas bougé.
- Mesuré (6 graines × 7 lacets = 42 cas par réglage) : **0 échec de calotte** pour raie −0,3, +0,4, 0 et intention complète (9 / 7 / 2 / 7 avant) ; score jamais pire ; aucun nouveau défaut géométrie/œil/visage ; +5 à 20 % de temps. À 30°, planche 08 : 63 % → 82 %.
- `Intent.part` est maintenant transmis au vérificateur (`VerifyOpts.part`) : seul le remplissage l'utilise.

## 3. Profondeur de volume : inversion « cas par cas »
- Le « 0,11 → 0,17 » de la passe 3 portait sur 3–10 paires par cas : 1 inversion de plus suffit à le produire. Sur 48 cas (2 intentions × 4 lacets × 6 graines) : taux par paire plan 0,094 (2147 paires) contre volume 0,101 (494) — **aucun gain par paire**, mais 202 → 50 paires inversées au total.
- Diagnostic : les paires « inversées » sont de vrais croisements en X. Leur signe NET est quasi nul (confiance médiane 0,18 contre 0,63 pour les stables, 326 paires) et bascule pour un rien ; or le rendu découpe ces mèches en tronçons et n'utilise jamais ce signe net. La métrique par paire est mal conditionnée pour les croisements.
- Ajout (`occlusion-stability.ts`) : `segRate` / `segLength` = part de la LONGUEUR imposée (intervalles francs) dont le côté « devant » change à +8°. Les champs historiques sont inchangés.
- Résultat : plan 3,2 % (972 de longueur imposée), volume 2,9 % (191). Le volume impose **5× moins de longueur ordonnée** à fiabilité égale. 3 cas sur 48 inversent plus de paires que le plan (bruit).
- Décision : `RIBBON_K` **n'est pas recalibré** (aucun signal à corriger). Tests statistiques à la place d'un test par cas.

## 4. Segmentation par mèche d'un raster (`observe-strands.ts`)
- Ce que la passe 3 jugeait impossible l'est si l'on cherche les frontières là où l'image en contient : une VALLÉE de luminance perpendiculaire au flux. Orientation (tenseur de structure) → luminance lissée le long du flux → vallée = moyenne des voisins en travers − pixel > 0,07 → noyaux érodés comme marqueurs (coupent les ponts d'une vallée interrompue) → croissance multi-sources → les traits reviennent à la mèche qu'ils bordent.
- Descripteurs par mèche : centre, longueur et largeur (rectangle équivalent par moments d'ordre 2), axe, ton, aire.
- Validation contre la VÉRITÉ TERRAIN du moteur (étiquettes de peinture connues, 6 coiffures) : rappel (IoU ≥ 0,5) ≈ 0,53, précision ≈ 0,63, pureté ≈ 0,86 ; composantes 32–45 pour 39–55 mèches visibles ; ≈ 40 ms.
- Première version (composantes brutes) : rappel 0,26 — les ponts d'une vallée interrompue fusionnaient les mèches ; les marqueurs l'ont doublé.

## 5. Apparence du moteur principal
- Constat : `exposure` était branchée dans `celBands` (reflet) mais l'**élévation** de la lumière (`LightVector.z`) n'atteignait jamais le rendu : `ld` est une direction 2D unitaire.
- `hair-light.ts` : `shadowReach` — un écran à la profondeur h derrière la mèche reçoit l'ombre décalée de h·(lx, ly)/lz, donc h·cot(élévation) le long de `ld`. Facteur 1 à l'élévation de référence du schéma (55° : rendu d'origine IDENTIQUE), borné 0,45–2,2 (20° : ×2,20 ; 85° : ×0,45).
- `tubeExposure` : une queue, un chignon, une tresse (`part`) ou une mèche simulée (`sim`) est un faisceau CYLINDRIQUE, pas un ruban. Part de la moitié visible aussi éclairée = 1 − θ/π, θ = angle entre la composante de L perpendiculaire à l'axe et la vue : de face 1, dans le dos 0, rasante perpendiculaire 0,5. Sans producteur 3D, c'est un modèle PHYSIQUE (cylindre), pas une valeur inventée ; absent (`light` non transmis) → comportement 2D d'origine.
- Correctif au passage : `gloss(i)` ignorait le gain d'exposition pour une mèche sans `geom` (`g ? … : 1`).
- Filtres SVG : examinés — `feGaussianBlur` isotropes (racines, lisière, ombre sur la peau) : aucune dépendance de direction, rien à lier à la lumière. Reste l'opacité/direction de `skinShadows` (voir REMAINING).

## 6. Couche de vérification (géométrie · anatomie · style)
Nouveaux contrôles : style « variété des largeurs (CV, mèches racines) » et « filles plus fines que leur mère » ; anatomie « calotte couverte » partagée avec la réparation (`dome.ts`) ; cycle de réparation à 3 phases (local → table `FIXES` → remplissage de calotte). Le journal (`Attempt`) consigne chaque mèche ajoutée (`scope: 'global'`, avant/après).

## Compromis assumé : netteté de la raie
Le remplissage comble la calotte, donc réduit la « fenêtre chauve » que la métrique de netteté lit comme raie. Moyennes à 0° (netteté) avant → après : raie −0,3 0,85 → 0,76 ; raie 0 0,84 → 0,69 ; intention complète 0,77 → 0,50. Position lue plus proche de la demande (|u−x| 0,047 pour −0,3). Le couloir de la raie est garanti libre PAR CONSTRUCTION (test). Cause des chutes par graine (ex. intention complète graine 5 : 1,00 → 0,09) NON élucidée.

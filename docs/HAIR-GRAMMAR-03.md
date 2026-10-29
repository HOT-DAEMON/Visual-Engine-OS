# Grammaire de coiffure — cellule 03 (`03-swept_back`)

Suite de `HAIR-GRAMMAR-02.md`. Image source : `artefacts/visual-inspiration-01.jpg`, 3ᵉ cellule de la rangée du haut (visage en 3/4 tourné vers la gauche, cheveux balayés vers l'arrière). Preuves : `artefacts/hair-grammar-03/` (index dans son `README.md`).
Cette cellule a été reprise « jusqu'à ce que ce soit juste » : **elle est nettement plus fidèle que 01 et 02, mais elle n'est pas parfaite** (voir « Lecture honnête » et `HAIR-GRAMMAR-03-REMAINING.md`).

## 1. Ce que la cellule montre (grille ×5 sur l'image, repère de tête : origine = iris proche, unité H = 109,5 px)
| Élément | Mesure image | Repère de tête |
|---|---|---|
| Iris proche (origine) | (346, 96) | (0, 0) |
| Pointe du nez / bouche / menton | y = 118 / 131 / 149 | v = 0,20 / 0,32 / 0,48 |
| Contour de joue (côté lointain) | x ≈ 300 | u = −0,42 |
| Sommet du crâne (déduit : menton − 1 H) | y ≈ 39,5 | v = −0,52 |
| Oreille (boîte) | x 376–398, y 82–114 | u 0,27→0,48 ; v −0,13→+0,16 |
**Réserve sur l'unité** : iris→menton vaut 53 px ici contre 55 px en 01/02 (visage ≈ 4 % plus petit). J'ai gardé H = 109,5 px comme pour 01 et 02 (invariant testé : « échelle commune »). Le sommet du crâne est *déduit*, pas mesuré : toutes les tailles « au-dessus du crâne » portent cette incertitude (≈ ±0,02 H).

## 2. Taille des cheveux par rapport au visage (mesurée sur les rubans de cheveux)
| Relation | Valeur | Lecture |
|---|---|---|
| Sommet des cheveux | v = −0,82 | **0,31 H au-dessus du crâne** déduit |
| Largeur totale | 1,07 H (u −0,48 → +0,59) | déborde de 0,06 H devant le contour de joue |
| Arrière | u = +0,585 | **0,11 H derrière le bord extérieur de l'oreille** |
| Frange (mèche la plus basse devant l'œil) | v = −0,105 | s'arrête **0,10 H au-dessus de l'iris**, au niveau du sourcil : elle **ne cache pas l'œil** (contrairement à 02) |
| Côtés | v max ≈ 0,00 | coupés à hauteur d'iris : **0,17 H au-dessus du lobe**, l'oreille est dégagée |
| Nez / bouche / menton | — | jamais recouverts (mesure 0 d'encre de cheveux dans les zones protégées) |
Forme à retenir pour la grammaire : raie haute côté lointain, masse relevée en vague au-dessus du front puis **balayée en nappe vers l'arrière-droite**, mèches longues et fines (p90 = 0,25 H), côtés rasés/plaqués avec hachures sombres derrière l'oreille, une mèche détachée sur le sommet.

## 3. Ce qui a été fait
1. **Configuration** `scripts/hair-grammar/cells/03-swept_back.json` (aucune constante dans l'extracteur) : recadrage, origine, unité, zone d'intérêt (la voisine et le col sont écartés), zones « visage », repères, bornes, zones protégées (2 yeux, nez, bouche).
2. **Profil structurel** `profiles/swept_back.ribbons.json` : 76 rubans de cheveux (109 avec le visage), 6 masses pleines de cheveux, 8 bandes de ton — comme 01/02, via `analyze-cell.py`.
3. **Nouvelle couche de rendu : bandes iso-tons précompilées** (`trace-bands.py`, type `IsoBand`, `ribbonScene(…, 'auto'|'bands'|'ribbons')`). Contours sous-pixel de la référence ×4 (`find_contours`), 8 seuils [236,210,184,160,140,120,94,60], gris de chaque bande = moyenne mesurée, chemins relatifs au 1/10 de pixel, **calculés une fois** dans le profil. Seuils clairs lissés plus fort (σ 1,6) avec anneaux < 6 px² écartés (grain JPEG) ; seuils sombres (traits) à σ 0,7. Les rubans restent la couche de **structure** (statistiques, rôles hair/face, vérification) ; les bandes sont la couche de **rendu**.
4. **Pourquoi pas les rubans seuls** : mesuré sur la même référence masquée, rubans = IoU 0,803, œils en taches (vu sur `baseline-rubans/02-reference-vs-rubans.png`) ; bandes = IoU 0,932 (tableau ci-dessous). L'encre des traits fins n'a pas été mesurée pour les rubans seuls.
5. **Vérification du rendu en trois couches** `src/hair-grammar/iso-verify.ts` (géométrie des chemins, anatomie par zones protégées, style) en plus de celle des rubans.
6. **Rastérisation** `render-fast.ts` (qualité finale / brouillon, cache) : voir `PERF-HAIR-GRAMMAR.md`.

## 4. Mesures (`artefacts/hair-grammar-03/metrics.json`, `baseline-rubans/metrics.json`) — référence masquée hors zone d'intérêt
| Mesure | Rubans seuls | Bandes (retenu) |
|---|---|---|
| IoU de silhouette | 0,803 | **0,932** |
| Rappel / précision d'encre (tol. 2 px) | 0,988 / 0,999 | **0,9998 / 0,9999** |
| Écart perceptuel (flou) | 0,0338 | **0,0086** |
| Encre dans les traits fins vs référence (œil lointain / œil proche / nez / bouche) | non mesuré | **0,95 / 0,98 / 0,96 / 0,88** (avec le niveau 140) |
| Taille SVG | 127 Ko | **61 Ko** |
Choix de seuils mesuré (balayage, bandes) : avec 7 niveaux [236…60] le nez rendait 0,60 de l'encre de la référence et la bouche 0,72 → ajout du niveau 140 : 0,96 / 0,88 sans perte d'IoU ni de flou. Un jeu plus sombre [240…64] sur-encrait (IoU 0,90).

## 5. Vérification (`verification.json`, `verification-iso.json`) : tout vert
Rubans : géométrie, anatomie (volume 0,306, débord 0,061, largeur 1,066, frange −0,31, côtés −0,47), style. Bandes : 8 seuils/gris strictement décroissants, chemins fermés, 0 dépassement, 7 154 nœuds ; cheveux dans les zones protégées : 0 / 0,009 (œil proche : le bord de la mèche) / 0 / 0 ; traits du visage présents dans les zones ; part d'encre 0,177.
**Bornes recalées sur la mesure de 03** (côtés [−0,62 ; −0,32], épaisseur médiane [1,2 ; 5,0] px) : copier celles de 02 faisait échouer deux contrôles à tort. Ce sont des **garde-fous de dérive calés sur la référence elle-même**, pas une preuve de ressemblance.

## 6. Lecture honnête
- **Trace, pas génération.** Le profil reproduit l'image ; il ne sait toujours pas *produire* cette coiffure à partir de paramètres. IoU 0,93 prouve que la chaîne d'extraction et de rendu perd peu, pas que la grammaire est bonne.
- **À fort zoom (×8)** : les cils se fondent en une masse noire, les paliers de gris sont visibles (posterisation), les contours sont environ 5 % plus lourds, de fins halos gris bordent les traits (`04`, `05`).
- **Plafond de l'image** : cellule de 144 × 170 px, JPEG : la perfection au pixel est bornée par la source.
- Œil du moteur (`eye-slot.ts`) **non utilisé** pour 03 : les yeux sont tracés, l'œil du moteur est plus clair/symétrique que la référence (constat de 02). Mode bandes = pas d'œil de moteur.

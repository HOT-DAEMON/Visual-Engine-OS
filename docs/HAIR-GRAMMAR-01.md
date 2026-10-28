# Cellule 01 « tousled » — analyse, résultats, écarts

Référence : `artefacts/visual-inspiration-01.jpg`, cellule en haut à gauche, zone `artefacts/hair-grammar/refs/h01-roi-156x150.png` (156 × 150 px, vêtements exclus pour les métriques : lignes < 132).

## Analyse de la référence (repères mesurés sur grille, px de la cellule)
| Élément | Mesure |
|---|---|
| œil proche (iris) / œil lointain | (77, 95) / (≈40, 96), caché sous les mèches |
| pointe du nez / centre de la bouche / menton | (43, 112) / (61, 130) / (60, 148) |
| angle de mâchoire côté proche | ≈ (112, 122) |
| sommet du crâne (déduit) | y ≈ 41 ; les cheveux montent à y ≈ 5 (≈ 0,35 H au-dessus du crâne) |
| débord avant des cheveux lointains | jusqu'à x ≈ 7 alors que le contour du visage est à x ≈ 38 |
| structure | épi côté lointain-haut (≈ 45, 38) ; longues mèches balayées vers la droite avec retroussés en pointe ; frange diagonale qui descend vers l'œil ; mèches latérales longues derrière l'oreille ; oreille cachée |
Calage de la vue : lacet −45,9°, tangage 2,7°, échelle 109,5 px/H ; résidu RMS **3,1 px** (6 repères). Le lacet obtenu est plus fort que les ~35° estimés à l'œil.

## Grammaire utilisée (profil `tousled.ts`)
Cinq familles : `mass` (sous-couche de volume), `sweep` (balayage vers l'arrière-droite, retroussés), `fringe` (frange diagonale), `farSide` (mèches du côté lointain), `nearSide` (mèches derrière l'oreille). Directions traduites image → tête (axe caméra-droite = (0,70 ; 0 ; −0,72)).

## Résultats mesurés (`artefacts/hair-grammar/metrics.json`)
- IoU de silhouette : **0.53** (1,0 = identique)
- Encre de la référence retrouvée à ±2 px (rappel) : **0.75** ; encre du moteur présente dans la référence (précision) : **0.73**
- Part de pixels d'encre : référence 0.213, moteur 0.158
- 50 mèches ; construction 12.9 ms, rastérisation 24.2 ms (médianes)
Tolérance : 8 px sur l'image ×4, soit 2 px sur la cellule d'origine. Les traits fins se superposent facilement : un rappel de 0,75 **ne signifie pas** une ressemblance visuelle.

## Verdict honnête
**La cellule 01 n'est PAS reproduite « parfaitement ».** Ce qui est acquis : calage 3/4 de la tête (nez, bouche, œil, mâchoire se superposent bien — voir `03-superposition…png`), cheveux de la bonne taille globale, frange qui s'arrête au bon niveau (vérifié), chaîne rapide. Ce qui manque : les cheveux sont décalés vers la droite/bas par rapport à la référence ; l'épi et la touffe en haut à gauche sont absents ; les mèches sont trop régulières et trop droites, sans l'enchaînement de S et de retroussés de l'original ; la hauteur du volume est sous-estimée ; le dégradé de gris et les hachures de pointe sont absents. Détail dans `HAIR-GRAMMAR-REMAINING.md`.

## Vérification (trois couches, `verify.ts`)
Géométrie, anatomie, style : toutes **vertes** sur le rendu courant. Elles ont d'abord signalé deux échecs réels (frange 0,45 H sous la ligne des yeux, au-delà du nez) ; la frange a été raccourcie. Un test vérifie que la couche anatomique échoue bien sur une frange doublée.

## Mise à jour : ajustement par synthèse
Voir `HAIR-GRAMMAR-FIT.md`. Mesures actuelles : IoU de silhouette 0,71 (avant 0,53), rappel d'encre 0,95, précision 0,93. Verdict inchangé : **pas « parfait »**, rendu encore brouillon ; la liste complète est dans `HAIR-GRAMMAR-REMAINING.md`.

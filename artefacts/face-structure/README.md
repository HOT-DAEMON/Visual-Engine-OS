# Artefacts — moteur de structure du visage

Images de preuve produites par `npx tsx scripts/artefacts-face-structure.ts [01 … 14]` (rendu réel resvg, aucune retouche).
Les surcouches colorées dessinent les régions EXPOSÉES par la géométrie (`noseGeometry().regions`, `structureGeometry()`, `mouthGeometry()`) ; les chiffres écrits
sur les images sont MESURÉS sur cette même géométrie. Graine 321 sauf mention. Spécification : `docs/TODO-FACE-SPEC.md` ; état : `docs/FACE-STRUCTURE-STATUS.md`.

| Fichier | Tâche | Ce qu'il prouve | À regarder |
|---|---|---|---|
| `01-nez-regions.png` | T1 | les 12 régions du nez sont des objets distincts | rendu, régions colorées, ancien nez à droite |
| `02-nez-sept-axes.png` | T2 | sept axes dissociés, chacun bas puis haut | longueur, largeur, racine : très lisibles ; projection, pointe, base : discrets de face (limite de la vue de face) |
| `03-machoire-decomposee.png` | T6 | silhouette = os + muscle + graisse | 264 + 0 + 0 → 264 ; +27 muscle → 291 ; +20 graisse → 285 (px) |
| `04-mandibule-regions.png` | T3, T4 | branche, angle, corps, bord inférieur, préauriculaire, masséter | les deux cellules de droite : courbure rectiligne / bombée, EFFET DISCRET (±0,2 de poignée, plafonné : au-delà le contour faisait des boucles) |
| `05-menton-controles.png` | T5 | forme, symphyse, fossette, sillon, transitions | pointu / rond / carré, fossette, sillon : nets ; projection : lisible surtout par l'ombre |
| `06-tissus-mous.png` | T6, T8 | joues, pommette, creux, masséter, plis | « sourire » : joues qui remontent (bourrelets clairs) |
| `07-bouche-elements.png` | T7 | éléments de la bouche, asymétrie, adaptation au visage | cellule 2 : chaque élément étiqueté. Cellule « large, mâchoire carrée » : la bouche reste PETITE à l'image (limite : sa largeur est bornée à 80 % du contour à hauteur des lèvres, et sur cette graine le bas du visage est étroit) ; la largeur relative (carrée > étroite) est prouvée par test, pas par cette image |
| `08-articulation.png` | T11 | dents inférieures et lèvre suivent la mandibule | dents sup. fixes (140,6 px), dents inf. 140,3 → 154,0 → 167,7 ; rangée du bas : décalage latéral, protrusion (166,2 : la denture remonte), tête inclinée (angle 94°) |
| `09-trois-deformations.png` | T12 | A + B + C sans s'écraser | le contour cyan (os) est IDENTIQUE dans les huit cellules : gonion 167,69 px, menton 74,26 px. Dans « serrage », l'effet est SATURÉ : cette mâchoire massive est déjà au plafond de 49,5 % de W |
| `10-cou.png` | T9 | angle cervico-mentonnier, platysma, menton ≠ cou | les MESURES écrites changent (angle 115° → 97° tête inclinée, 131° relevée ; ombre 23 → 38 px) ; « menton très projeté » : demi-cou inchangé (74,4 px) ; « cou épais » 93,2 px. Visuellement les différences sont DISCRÈTES : la tête ne tourne pas, seule l'ombre varie |
| `11-dependances.png` | T10 | projection du menton → raccords, pas la mandibule | raccord latéral 7,1 → 10,1 → 13,4 px ; ombre sous-mentonnière 23 → 33 → 43 px ; corps de mandibule 146,26 px et cou 74,4 px INCHANGÉS |
| `12-stylisation.png` | T13 | exagération croissante, relations préservées | six profils sur la même graine |
| `13-modes-de-rendu.png` | T13 | même géométrie : réaliste, anime, encrage N&B | l'encrage est un dessin au trait lisible (seuil relatif à la peau) |
| `14-galerie.png` | — | six graines, classic / structured côte à côte | mêmes têtes, mêmes yeux : seuls les calques de structure changent |

## Limites visibles sur les images (honnêtes)
- Vue de face uniquement : la projection du nez et du menton ne se lit que par l'ombre.
- Les dents et la langue sont des formes simples (bandes et ellipse).
- Le titre de `09` est coupé à droite (titre long) ; le texte complet est ci-dessus.
- `13` : le cou, de la couleur de la peau, se fond dans le papier blanc en encrage ; seule son ombre est noire.
- Défauts trouvés et corrigés grâce à ces images (voir `docs/ERRORS-5.md`, nos 16 à 18) : ligne parasite du bord inférieur, encrage tout noir, ombre sous le menton en disque.

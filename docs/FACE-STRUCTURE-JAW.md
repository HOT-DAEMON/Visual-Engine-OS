# Mâchoire, mandibule, menton, tissus mous, joues, cou (T3–T6, T8, T9)

## Largeur de mâchoire décomposée (T6)

`silhouette = os + muscle + graisse` (`face/jaw/structure.ts · jawSilhouette`), en demi-largeurs :
- os : `jawWidth × W / 2` (le paramètre historique devient la largeur OSSEUSE) ;
- muscle : `min(1, softTissue.masseter.volume + 0,6 × deform.articulation.clench) × 4 % × W` ;
- graisse : `softTissue.fat × 3 % × W` ;
- silhouette extérieure : somme, plafonnée à 49,5 % de W ; c'est elle qui trace l'angle de la mâchoire (`contour.ts`).
La graisse arrondit l'angle apparent (+0,2 au plus sur `jaw.angle`) ; le serrage l'accentue (−0,1). Neutre : muscle = graisse = 0 → silhouette = os (test).

## Correspondance des mots du cahier des charges

| Notion | Paramètre unique |
|---|---|
| largeur de la mandibule | `jawWidth` |
| hauteur de la branche montante | `jawY` |
| angle mandibulaire | `jaw.angle` |
| convergence vers le menton | `jaw.taper` |
| courbure du corps | `mandible.bodyCurve` (longueur des poignées du corps) |
| profondeur avant-arrière | `mandible.depth` (largeur de la branche ombrée, préauriculaire) |
| bord inférieur | `mandible.lowerBorder` (netteté : liseré + ombre) |
| région préauriculaire | `mandible.preauricular` |
| volume des joues sur l'os | `cheek.volume` (longueur de la poignée du ramus) |

Régions exposées (`structureGeometry().mandible`) : `ramus`, `gonion` + `gonialDeg`, `body` + `bodyLengthPx`, `lowerBorder`, `preauricular`, `masseter`.
Invariant testé : AUCUN de ces axes ne bouge le contour du crâne (du sommet à la tempe).

## Menton (T5)

Neuf contrôles, mesurés sur le contour réel (`structure/chin.ts`) : largeur (`chinWidth`), hauteur (`chin.height`), projection (`chin.projection`),
forme continue pointu → rond → carré (`chin.form`, `null` = symphyse historique exacte), largeur de symphyse (`symphysisWidth`), profondeur (`symphysisDepth`),
fossette ronde (`dimple`) et sillon vertical (`groove`) séparés, transitions supérieure / latérale / inférieure (`upperBlend`, `lateralBlend`, `lowerBlend`).
Limite : la hauteur demandée est bornée par la place disponible sous la lèvre (la hauteur ne peut que diminuer au-delà).

## Tissus mous et joues (T6, T8)

`structure/tissue.ts` : par joue, quatre volumes (pommette, chair, creux sous-malaire, transition masséter) ; autour de la bouche, quatre volumes péri-labiaux ;
sous le menton, une zone sous-mentonnière d'épaisseur propre. Les plis (nasogénien, péri-buccal) sont des polylignes de base que le champ de tissu déplace (voir DEFORM).

## Cou (T9)

`structure/neck.ts` : angle cervico-mentonnier effectif = `neck.cervicomentalDeg − 0,8 × inclinaison − 8° × ouverture` (borné 70°–160°) ;
profondeur de l'ombre du menton `= shadowReach × (1 + (115° − angle) / 65)` ; tension du platysma ; sterno-cléido-mastoïdiens ; bande sous-mandibulaire.
Menton ≠ cou : la largeur du cou ne lit JAMAIS la projection du menton, sauf couplage explicite `neck.chinCoupling` (0 par défaut ; testé).
En vue de face l'angle ne se voit pas : il règle l'ombre portée et la tension (limite documentée).

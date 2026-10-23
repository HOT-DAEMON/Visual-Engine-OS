# Zones verticales du visage et frontière d'implantation

Sources : `src/face/zones-limits.ts` (bornes), `src/face/zones.ts` (mesure), `src/verify/zones.ts`. Moteur `structured` seulement ; `classic` est inchangé.

## Les sept zones (fractions de H, sommet du crâne → menton)
| Zone | De → À | Borne |
|---|---|---|
| cuir chevelu | sommet du crâne → implantation (centre) | — |
| front | implantation → limite des sourcils | 0,09–0,30 ; part du front dans (sommet → yeux) : 0,18–0,55 |
| yeux | sourcils → ligne des yeux | — |
| nez | ligne des yeux → base du nez | **≥ 0,17** (le nez ne remonte pas entre les yeux) ; ≤ 0,26 |
| philtrum | base du nez → haut de la lèvre | **0,06–0,115** (jamais trop long) |
| lèvres | haut → bas de la lèvre inférieure | — |
| menton | bas de la lèvre inférieure → menton | 0,07–0,24 |
La somme des sept zones vaut exactement (menton − sommet)/H (aucun trou, aucun recouvrement) : invariant testé.

## Corrections appliquées (rien en silence)
- Nez : `noseLengthFrac` relève la longueur effective (`nose.length` du contrat reste la valeur demandée).
- Bouche : `mouthCeilingY` plafonne le philtrum, `philtrumFloorY` l'empêche d'être écrasé ; correction `mouth-philtrum-zone` enregistrée dans les repères.
- Même calcul dans `jaw/params.ts` (plancher de la bouche pour la mandibule) : une seule source.
- Par défaut : nez 17,0 %, philtrum 11,5 % (avant : 14,6 %), menton 17,3 %.

## Frontière d'implantation
`hairBoundary` : ligne d'implantation (celle de `buildHairline`), arc du crâne au-dessus de la tempe, point de tempe, bornée à 98,5 % de la demi-largeur du contour
(le bruit de la ligne peut sortir de quelques pixels aux tempes). Contrôles : sous le sommet (+3 % H), au-dessus des sourcils, tempe dans le crâne (85–100 %).
Le front varie avec la hauteur du crâne (test : ligne des yeux plus haute → front plus court).

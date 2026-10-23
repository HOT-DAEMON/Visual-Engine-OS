# Preuves visuelles — menton continu et lobule sur la base du nez

- `avant-apres-01/02/03.png` : les 13 visages signalés (9, 10, 15, 16, 18 · 25, 29, 34, 40 · 41, 47, 49, 58), rendus à 300×380 avec l'ancien code
  (commit `f9dc597`) puis avec le nouveau. Gauche = avant, droite = après.
- `campagne-100/` : campagne complète de 100 visages (graines 1–100) après correction : 5 planches + `rapport.json` (échecs, avertissements, corrections du résolveur, temps).
- Preuves chiffrées : `docs/JAW-CHIN-CONTINUITY.md` (10 000 visages, 0 violation) ; `npx tsx scripts/chin-fuzz.ts 10000`.

Ce que ces images montrent : la mandibule se prolonge sans rupture jusqu'au menton (plus de menton « goutte d'eau » ni d'épaule horizontale), et les oreilles ont
une hauteur réaliste (bas du lobule à la base du nez).

Limites : les oreilles sont maintenant plutôt petites sur certains visages (hauteur dictée par la distance yeux → base du nez) ; `anchors.mouth < 1` ou
`lobule.length` permettent d'allonger. Rendu de face uniquement.

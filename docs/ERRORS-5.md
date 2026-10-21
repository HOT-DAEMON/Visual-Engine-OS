# Erreurs rencontrées pendant la tâche « structure du visage » (et leur correction)

Chaque entrée : symptôme → cause réelle → correction → garde-fou qui l'empêche de revenir.

1. **Paroi latérale de largeur négative.** Symptôme : `meanWidthPx = −1,07` au premier test de fumée. Cause : j'avais défini la paroi par l'ancien `wallHalf`, plus étroit que
   l'arête (`half`) près de la pointe. Correction : paroi = `amp × sin(πt)^0,7` pilotée par la pente, bornée par `max(half + w, wallHalf)`. Garde-fou : `structure-sidewall-width-positive`.
2. **Cassure de tangente du contour (`outline-c1` à 3,27° > 3°).** Cause : le bombement du ramus déplaçait latéralement la poignée du cubique, hors de la tangente d'arrivée au gonion.
   Correction : agir sur la LONGUEUR de la poignée le long de la tangente (`ramusHandle`), jamais sur sa position latérale. Détecté par `verifyFace` sur 12 visages structurés ; garde-fou : `tests/face-structure-verify.test.ts`.
3. **Fente de bouche dans un sourire fermé.** Cause : le retroussement de la lèvre supérieure ne montait qu'un seul bord. Correction : les deux bords bougent ensemble, séparation seulement si les dents sont découvertes (`sep`).
4. **Dents inférieures « hors de la cavité » (31 visages sur 80).** Cause : le bas des dents était exactement sur le bord de la lèvre (polygone sur la frontière). Correction : 0,3 px au-dessus du bord, dents derrière la lèvre.
5. **Volume des lèvres non conservé en grimace.** Cause : j'amincissais de 25 % sans allonger. Correction : épaisseur ÷ élargissement uniquement ; la tension redresse la ligne.
6. **Règles de dépendance fausses.** `chin-width → lateralBlendPx` et `mouth-open → upperTeethY` étaient déclarés mais faux ; le test par perturbation les a démasqués. Table corrigée (`upperTeethTopY`, retrait de la règle fausse).
7. **Test de non-déformation du crâne faux.** J'avais pris « au-dessus des yeux » ; la tempe peut être au-dessus de la ligne des yeux, donc la branche montante y entrait. Le crâne est « du sommet à la tempe ».
8. **Vérification d'image : silhouette surévaluée de 5 %.** Cause : le halo d'ombre autour de la tête comptait comme « tête ». Correction : mesure sur la COULEUR de peau, amorcée hors de l'axe (le centre est le nez ou les lèvres) et sur des lignes où le visage est plus large que le cou.
9. **Test de rendu trop lent (30 s par cellule).** Cause : la rastérisation. Correction : `cellSvg` (SVG seul) pour les tests de balisage, `cell` (PNG) pour les artefacts.
10. **Garde-fous du dépôt** : `feFuncR/G/B` et `tableValues` n'étaient pas dans la liste blanche SVG (`core/svg.ts`) ; ils y ont été ajoutés explicitement plutôt que contournés.
11. **Stylisation non neutre.** `amplify` imposait un écart minimal même à gain nul, et `chinWidth` était rebornée : un visage « neutre » changeait. Correction : profil neutre → paramètres rendus tels quels (test d'identité).
12. **Plis doublés.** Le sillon nasogénien était peint par le nez de base ET par le calque de plis. Le calque ne peint plus que le creusement dû à l'expression.
13. **Sandbox.** Un rendu lancé avec `&` est tué à la fin de l'appel ; les planches sont rendues avec `setsid nohup`.
14. **Boucles du contour à courbure de corps extrême.** En portant l'effet de `mandible.bodyCurve` à ±0,3 (poignées jusqu'à 0,68), 9 visages sur 40 avaient un contour non monotone en y (`outline-monotone`). Effet ramené à ±0,2 et poignée plafonnée à 0,58 (la valeur historique maximale 0,55 reste inchangée) ; test de régression sur 16 visages aux deux extrêmes.
15. **Dômes alaires hors de la pointe (sur 3 visages de 80).** La pointe n'est pas une ellipse (sa forme dépend de `tip.roundness`). Les dômes sont maintenant réduits par pas de 7 % jusqu'à ce que 98 % de leurs sommets soient dans le polygone de la pointe.
16. **Étiquettes d'artefacts coupées par le bord de l'image.** Les étiquettes de la moitié droite sont alignées sur leur fin (`text-anchor="end"`).

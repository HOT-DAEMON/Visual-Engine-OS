# ERRORS-9 — systèmes d'yeux (feat/eyes-systems)

Format : symptôme → cause → correction → garde-fou.

1. **Planche d'yeux : les cellules 1 et 2 affichaient les couleurs de la cellule 4.** Cause : tous les yeux de la planche s'appelaient `e`, donc les `id` de dégradés/clipPaths
   (`e-il0`, `e-il-clip`…) étaient dupliqués dans le SVG assemblé ; le dernier gagnait. Pas un bug du moteur. Correction : id unique par cellule (`c${i}`) dans `scripts/lib/eye-sheet.ts`.
2. **Rotation 3D : les cellules à 40° étaient vides.** Cause : la rotation sphérique inclut la parallaxe réelle du centre de l'œil (≈ 2 largeurs à 40° pour un azimut de 22°), l'œil
   sortait du cadre. Correction : `turnOpening(..., recenter = true)` (l'œil tourne sur place), parallaxe exposée (`shift`, option `headTurn.parallax`). Garde-fou : test « recentrage ».
3. **Identité à 0° : 1 octet de différence attendu.** Le modèle historique émet un groupe d'identité `translate(0 0)`. Le test compare modulo ce groupe, explicitement.
4. **Flou de l'ombre des paupières = 72 % du temps de rastérisation.** Découvert par profilage par élimination, pas supposé. Premier remplacement (remplissage plat + rampe intérieure) : écart max
   42/255, discontinuité d'alpha au bord ; refusé et remplacé par rampes intérieure + extérieure continues (max 7–9).
5. **`src/verify/index.ts` tronqué à 0 octet** par un script de refactor (`open(p,'w')` avant `read()` dans la même expression). Restauré depuis git. Garde-fou : lire dans une variable avant d'ouvrir en écriture.
6. **Test de vitesse instable en suite complète** (charge parallèle). Mesures désormais entrelacées (réf/fast alternés), seuil lâche ; la preuve chiffrée est le banc, pas le test.
7. **Script d'artefacts tué (code 137, mémoire).** Le getter `.pixels` de `@resvg/resvg-js` COPIE le tampon à chaque accès ; lu dans une boucle de 200 000 itérations. À lire une seule fois.
8. **Chiffres de performance arrondis de mémoire dans la doc** (518 → 198 ms au lieu de 498,6 → 171,1). Relus contre `perf.json` avant livraison et corrigés. Règle : aucun chiffre dans une doc sans fichier de mesure.
9. **Reflet par défaut qui masque les pupilles non rondes** : constaté sur la planche de preuve, NON corrigé (documenté dans `EYES-REMAINING.md`) ; la planche réduit explicitement ce reflet.

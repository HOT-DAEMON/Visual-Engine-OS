# Périmètres du visage — état par composant et reste à faire

Suite de `FACE-PERIMETERS.md`. ✅ fait et vérifié · ⚠️ partiel · ⬜ non fait. Rien n'est marqué fait sans contrôle ou artefact.

| Composant | État | Fait (preuve) | Reste à faire |
|---|---|---|---|
| Front | ⚠️ | périmètre défini, mesuré (0,126 – 0,360 H sur 200 graines), borné et vérifié | non forcé : l'implantation reste un paramètre libre ; un front de 0,36 H n'est qu'avertissement |
| Sourcils | ⚠️ | périmètre mesuré sur le contour réel du sourcil ; vérifié | forme, longueur, arche et épaisseur non reliées au périmètre ; 7 visages sur 200 sans sourcil : non contrôlés ; poils (`browHairs`) non repris |
| Écart sourcil / paupière (flexible) | ✅ | **forcé** dans [0,008 H ; 0,06 H] (`fitEyeToFace`), contrôlé œil par œil ; test non aveugle | bornes calibrées sur 200 graines, pas sur une référence dessinée ; l'expression ne module pas encore la plage (surprise = plafond identique) |
| Enveloppe palpébrale | ⚠️ | périmètre mesuré, borné | sur certains visages l'œil est limité par la zone des sourcils (graine 42 : échelle 0,28, `limitedBy: up`) et reste petit et haut : **non corrigé** |
| Zone entre les yeux | ⚠️ | définie (glabelle → bas de la fente), vérifiée (largeur 0,12 – 0,36 W) | distance intercanthale non forcée vers le canon (0,4 – 2,1 × la fente) ; seul un avertissement existe |
| Nez | ⚠️ | périmètre défini pour commencer sous la zone entre les yeux ; contrôles `nose-below-interocular` et `nose-tip-below-interocular` (0 échec) | `nose/frame.ts` place toujours la racine jusqu'à 0,09 H au-dessus de la ligne des yeux et la région de peau « nez » couvre le pont : le **modelé** du nez n'est pas recadré sur ce périmètre (⬜) |
| Philtrum | ⚠️ | mesuré (0,06 – 0,115 H, bornes existantes de `zones-limits.ts`) | non forcé |
| Bouche | ⚠️ | mesurée, bornée ; rapport bouche / intercanthale vérifié | largeur non forcée ; lèvres fermées sur graines minces (graine 42) |
| Menton | ⚠️ | mesuré ; rapport menton / bouche vérifié (min 0,53, borne 0,5) | le menton en pointe de bouclier est un choix de stylisation conservé : non modifié |
| **Aspect mécanique** | ⚠️ | contrainte de l'écart (plafond 0,072 → 0,060 H) ; aucune autre action sur le rendu de face | **l'essentiel reste à faire** : dégradés de la peau, pupilles fendues et iris « reptile » de certaines galeries, traits de sourcil uniformes, menton en V, aplats cel de la tête 3D en blocs ; aucune de ces corrections n'est faite ici |
| Vérification de style | ⚠️ | rapports canoniques en avertissements (4 familles) | aucun contrôle perceptif (lisibilité du visage à petite taille, harmonie des teintes) |

Ordre conseillé : (1) recadrer `nose/frame.ts` et la région de peau du nez sur le périmètre 6 ; (2) lever la limite « up » des yeux (zone des sourcils) pour que les yeux ne rétrécissent pas ; (3) relier forme et arche du sourcil au périmètre 3 ; (4) traiter l'aspect mécanique par le matériau (dégradés) plutôt que par la géométrie.

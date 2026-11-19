# Preuves visuelles — crâne nu, forme de la mastoïde, position pariétale, profil 2D

Générées par `npx tsx scripts/head-turntable/artefacts-enlargement.ts` (rendu réel, aucun montage). Analyse : `docs/SKULL-ENLARGEMENT.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `01-silhouette-ancien-vs-nu.png` | 4 hôtes chauves (graines 42, 4, 16, 36) : contour 2D (gris), ancien 3D (rouge), crâne nu (vert). Sommet **+0,051 → +0,001 U**, demi-largeur 0,000 → 0,000 U (déjà bonne), IoU et peau inchangés |
| `02-tete-hote-rotation.png` | la tête entière de l'hôte (crâne, oreilles, yeux, cou, volume de cheveux) à 0, 35, 70, 90, 135, 180°, graines 42 / 3 / 11 |
| `03-profil-2d-lit-la-voute.png` | le profil 2D lit 9 mesures de voûte (contour nominal gris, −1 bleu, +1 orange) ; cellule `parietalHeight` régénérée après la correction du sens (+1 = éminence haute, voir `docs/SKULL-VAULT-2.md`) |

Les planches des 38 paramètres de voûte, dont les cinq nouveaux (`mastoidSize`, `mastoidDirection`, `mastoidSlope`, `parietalHeight`, `parietalAzimuth`), sont dans `artefacts/skull-vault/parametres/` ; le registre de preuves (`artefacts/skull-vault/verification/proofs.json`) donne désormais 48 preuves perceptibles (38 + 10 de la passe 2). Les yeux en rotation sont dans `artefacts/rotation-step-03-yeux/`.

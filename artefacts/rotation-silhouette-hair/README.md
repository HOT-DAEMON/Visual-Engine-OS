# Rotation 2D : silhouette du crâne et masses de cheveux

Régénérer : `npx tsx scripts/rotation-proof.ts`. Détail, mesures, limites : `docs/ROTATION-HAIR-MASS.md`.

| Fichier | Ce qu'il montre |
|---|---|
| `01-rendu-lacet-x-coiffures.png` | Rendu RÉEL du moteur, têtes entières : lacet −45, −30, 0, +30, +45° (colonnes) × short, long, afro, bob, buzz, ponytail (lignes). Seuls la silhouette du crâne et les MASSES de cheveux sont posées ; yeux, nez, bouche, oreilles et mèches restent de face (étapes suivantes). Le changement visible est faible : facteur de silhouette 0,968 à 40°. |
| `02-geometrie-masses-silhouette.png` | Surcouches dessinées hors du moteur : contour de face en pointillé gris, silhouette posée en cyan, masses de cheveux (sous-couches, masse arrière, masse simulée, base) en orange, à −40, 0, +40°. La masse suit la silhouette sans jour ni décollement ; le bord de masse reste sur le bord du crâne. Les crochets près de l'oreille et la base d'afro à bords droits existent déjà à 0°. |
| `metrics.json` | Facteur de silhouette (yeux, mâchoire) et nombre de sommets des masses, par coiffure et lacet. |

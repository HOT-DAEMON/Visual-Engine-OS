# Artefacts — visage complet (cheveux, cou, pilosité, asymétrie)

Preuves visuelles et mesurées. Tout se régénère avec `npx tsx scripts/gallery-faces.ts && npx tsx scripts/artefacts-face.ts`.
Sur les images 05 et 06, les surcouches sont dessinées HORS du moteur (`scripts/lib/proof.ts`) à partir des mêmes
repères que ceux qu'il utilise : tirets jaune = limite des sourcils, cyan = base du nez, vert = bouche,
pointillé blanc = axe du visage, rectangles magenta = empreintes réelles des yeux, croix rouges = canthi internes
(ancres), contours orange = cheveux, violets = moustache/barbe.

| Image | Ce qu'elle prouve |
|---|---|
| `01-galerie-48-visages.png` | Les 48 paires d'yeux des galeries (gauche/droite) posées sur 48 visages complets aléatoires. |
| `02-styles-cheveux-x-franges.png` | 7 styles × 4 franges sur le MÊME visage : seul le cheveu change, le reste est identique. |
| `03-pilosite-moustaches-x-barbes.png` | 4 moustaches × 4 barbes sur le même visage. |
| `04-cous.png` | Largeurs/longueurs/évasements de cou, bornés par le menton et la mâchoire. |
| `05-asymetrie-symetrique-vs-legere.png` | Haut : symétrique ; bas : mêmes visages, asymétrie légère (échelle 6 %, rotation 2,2°, canthi décalés de 0,7 % de H, bouche inclinée). |
| `06-preuve-placement-enfants.png` | Tailles d'yeux de 0,5 à 1,6, cheveux variés, moustache + barbe : les canthi restent sur leurs repères, les cheveux ne touchent jamais les empreintes des yeux. |
| `metrics.json` | Invariants mesurés sur 1500 visages (voir ci-dessous). |

## Mesures (`metrics.json`)

| Invariant | Valeur |
|---|---|
| Cheveux recouvrant un œil | 0 / 1500 |
| Moustache sur un œil | 0 / 1500 |
| Barbe sur la bouche | 0 / 1500 |
| Erreur max d'ancrage du canthus (px, coordonnées monde, yeux tournés) | 1,1·10⁻¹³ |
| Rotation d'asymétrie max / écart d'échelle max / décalage canthi max | 2,2° / 6 % / 0,70 % de H |
| Visages avec cheveux / moustache / barbe | 1344 / 282 / 445 |

# Artefacts — cheveux complets, pilosité, axes indépendants

Preuves visuelles et mesurées. Régénération : `npx tsx scripts/gallery-faces.ts && npx tsx scripts/artefacts-hair.ts`.
Même visage de base (seed 321, identité d'yeux 3) : seules les propriétés testées changent. Surcouches de l'image 09 dessinées HORS du moteur
(`scripts/lib/proof.ts`) : croix rouges = canthi internes, rectangles magenta = empreintes réelles des yeux, contours orange/violet = cheveux/pilosité.

| Image | Ce qu'elle prouve |
|---|---|
| `01-coiffures-x-textures.png` | 10 coiffures (colonnes) × 5 textures (lignes) : la texture s'applique à N'IMPORTE QUELLE coiffure, silhouettes réellement différentes. |
| `02-queue-chignon-tresses.png` | Queue haute / côté / couettes / basse, chignon petit / gros / double, tresses 1 à 6 (dont tressé + tresses). |
| `03-implantation-tempes-eclaircissement.png` | 4 formes d'implantation × recul des tempes 0 / 0,5 / 1 ; dernière ligne : irrégularité forte + éclaircissement croissant. |
| `04-meches-longueur-densite-raie.png` | Variance de longueur (pointes dentelées), densité, raie large (cuir chevelu visible), mèches fines vs principales. |
| `05-pilosite-barbes-x-moustaches.png` | 6 barbes × 5 moustaches (moustache seule, bouc, courte, longue). |
| `06-favoris-transitions-zones-clairsemees.png` | Favoris none / short / long / mutton ; transition peau/poils 0 vs 1 ; zones clairsemées. |
| `07-axes-independants-peau-sous-ton-texture.png` | Clarté de peau (lignes) × sous-ton rosé→neutre→olive→doré (colonnes) sur le même visage ; textures et couleurs variées : peau claire + crépu, peau foncée + blond. |
| `08-sourcils-cils-systemes-distincts.png` | Sourcils et cils (teinte, épaisseur, densité) distincts de la chevelure. |
| `09-visages-aleatoires-et-placement.png` | 24 visages aléatoires complets : canthi sur leurs repères, cheveux jamais sur les empreintes des yeux. |
| `10-galerie-48-visages.png` | Les 48 paires d'yeux (gauche/droite) des galeries sur 48 visages complets, avec le nouveau système. |
| `metrics.json` | Invariants sur 1500 visages. |

## Mesures (`metrics.json`)

| Invariant | Valeur |
|---|---|
| Cheveux recouvrant un œil / favoris sur un œil | 0 / 1500 · 0 / 1500 |
| Points d'implantation sous la limite des sourcils | 0 (marge minimale 3 % de H) |
| Mèches par visage (moyenne) | 142 |
| Visages avec attache (queue/chignon) / éclaircissement / tempes reculées | 311 / 304 / 456 |
| Crépu sur peau claire / raide sur peau foncée (couplage absent) | 73 / 126 |
| Monopaupière (pli = 0) | 370 |
| Sourcils de teinte différente des cheveux | 1500 / 1500 |

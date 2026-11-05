# Preuves visuelles — lisière des cheveux

Régénérer : `npx tsx scripts/artefacts-hair-boundary.ts` (les images `avant/` viennent du commit `ff8b33e`, avant ce travail).

| Image | Ce qu'elle prouve |
|---|---|
| `01-lisiere-8-visages.png` | La lisière (4 tronçons colorés, légende) sur 8 visages réels. |
| `02-avant-apres-classic.png`, `02-avant-apres-v2.png` | Les 10 coiffures avant / après, moteurs classic et v2. |
| `03-implantation-hors-du-crane-avant-apres.png` | Le défaut corrigé : implantation hors du contour (rouge, jusqu'à 1,535 ×) vs sur le crâne (vert, 0,985). |
| `04-rotation-lisiere-schema.png` | **Schéma de géométrie** : la lisière suit la surface du crâne pour 6 poses. Pas un rendu complet de tête tournée (non branché). |
| `05-reperes-de-racine-et-vent.png` | Repères de racine (normale, flux) et direction du vent (champ de flèches). Interface, pas de simulation. |
| `06-style-de-lisiere-couleur-et-coiffure.png` | Bord selon couleur de cheveux × peau (teinte de peau mesurée en légende) et coiffure. |
| `07-tete-complete-10-coiffures.png` | Têtes complètes, 10 coiffures. |
| `08-verification-3-couches.png`, `verification.json` | 15 contrôles × 600 visages : 0 échec. |

Limites : « contrôles passés » ne dit pas « beau » ; revue humaine nécessaire. Détail : `docs/HAIR-BOUNDARY-REMAINING.md`.

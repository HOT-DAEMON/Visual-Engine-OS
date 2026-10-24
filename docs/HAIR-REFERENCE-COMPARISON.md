# Comparaison aux 12 références (indépendante de mes métriques)

Planches : `artefacts/hair-masses/02-…` (réf. 01–06) et `03-…` (réf. 07–12) : référence en haut, moteur en bas, même cadrage.

## Ce que j'ai fait
1. **Comparaison visuelle** de chaque coiffure à sa référence (images ouvertes et regardées, avant de pousser).
2. **Mesure sur les pixels** (`scripts/artefacts-hair-masses.ts`, `inkStats`) : sur le tiers supérieur de chaque cellule, remplissage de l'encre dans sa boîte englobante, décalage horizontal du centre de masse d'encre, allure hauteur/largeur. Cette mesure ne passe pas par la géométrie du moteur.

## Résultats (moteur − référence)
| Réf. | Archétype | Encre : remplissage (moteur − réf.) | Centroïde x | Allure h/l |
|---|---|---|---|---|
| h01 | tousled | +0.220 | -0.077 | +0.059 |
| h02 | side_sweep | +0.134 | -0.251 | +0.008 |
| h03 | swept_back | +0.268 | -0.025 | -0.044 |
| h04 | bun_undercut | +0.015 | -0.332 | +0.203 |
| h05 | messy_bangs | +0.202 | -0.078 | +0.060 |
| h06 | wavy_swept | +0.218 | -0.024 | +0.092 |
| h07 | quiff_undercut | -0.076 | +0.068 | +0.174 |
| h08 | braid_updo | +0.113 | +0.011 | +0.069 |
| h09 | fluffy_messy | +0.251 | -0.102 | +0.137 |
| h10 | messy_long_bangs | +0.208 | -0.083 | +0.058 |
| h11 | pompadour_strand | +0.152 | -0.068 | +0.066 |
| h12 | cornrows_side | +0.109 | -0.058 | +0.096 |

## Lecture honnête
- **Le remplissage est partout plus élevé dans le moteur** (+0,1 à +0,27 sauf 07 et 04) : les références sont en grande partie BLANCHES (reflets larges, mèches claires 01, 03, 06, 09) ; mon encre est presque uniformément noire avec des arcs blancs fins. L'écart ne se corrige pas par réglage : il manque des **aplats blancs larges découpés par mèche**.
- **Les silhouettes restent trop proches entre elles.** Le volume du dessus, la largeur et le balayage diffèrent, mais l'œil voit encore un « bonnet » sur la plupart des planches. Les références ont des mèches longues et courbes qui dépassent du crâne ; les miennes restent des rubans courts.
- **Vue 3/4** : les références sont en 3/4, le moteur rend de face. La mesure porte donc sur la masse et la logique de mèches, pas sur la forme exacte.
- Les références 01, 03, 06, 09 sont blondes : comparer leur remplissage d'encre à un rendu noir n'est pas équitable. Je les garde dans le tableau pour la transparence.
- Mesure grossière (seuil de luminance 70, une seule bande) : elle détecte un grand écart, elle ne certifie pas la ressemblance.

**Conclusion : je ne peux pas affirmer que le résultat est « parfait ».** La structure (zones, longueurs, rasage, volume, encre, vérification) est en place et testée ; la fidélité au dessin ne l'est pas. Voir `docs/HAIR-MASSES-REMAINING.md`.

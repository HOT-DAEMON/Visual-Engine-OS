# Cheveux simulés — ce qui reste à faire (par composant)

## Fait
Simulation Verlet 3D + collision ; masse → paquets → brins ; flux depuis la raie ; drapé ; ombres portées sur la peau ; détecteur « électrocuté » ; couverture ; contrôles géométrique/anatomique/style ; 15 archétypes ; 12 références extraites.

Passe « lames + silhouette » :
- Masse de volume par colonnes (`sim/mass.ts`) : plus de crâne nu entre mèches, bord de frange échancré. Paramètres `sim.blade`, `sim.mass`.
- Limite des franges ramenée aux vrais sourcils (`simBrowY`), règle géométrique adaptée.
- Profondeur et pente de retombée par archétype (`depth`, `slope`) : silhouettes distinctes.
- Chignon (volume enroulé), tresses et rangées (plis en chevrons), racines latérales aux tempes, `backMass` arrière.
- Perf : voir `docs/PERF-HAIR-SIM.md`.

## Pas fait / insuffisant
1. **Fidélité aux 12 références** : les mèches restent des rubans pointus ; pas de lames lissées en S à 3 tons nets, pas de micro-textures de brin, pas de reflets en bandes par mèche ; couleur/ton plus bleutés que l'encre des références. Pas d'IoU automatique contre l'image.
2. **Vérification de silhouette** : aucune couche comparant la silhouette à une cible par archétype (hauteur du volume, niveau du bord de frange, côté du balayage, oreille couverte).
3. **Vue 3/4** des références : non supportée (moteur de face).
4. **Chignon / tresses / rangées** : primitives posées mais non contrôlées à grande taille ; chignon de taille fixe, sans mèches de raccord.
5. **Arrière du cou** : `backMass` produit mais non vérifié visuellement sur coiffures longues.
6. **Vent**, **épaules dessinées**, couettes sur épaules : non traités.
7. **Yeux et lèvres** (moteur d'apparence, galeries) : non traités.
8. **Performance** : bruit de peau et ombres de contact restent coûteux (voir `docs/PERF-HAIR-SIM.md`).
9. Artefacts : une seule morphologie de visage.

## Mise à jour (passe masses de région)
- Point 2 (vérification de silhouette) : couche `hair-zones.ts` ajoutée (balayage, largeur, zone rasée) ; pas de comparaison à une image cible → voir `HAIR-MASSES-REMAINING.md`.
- Point 1 (fidélité aux 12 références) : encre noir/blanc ajoutée, fidélité toujours insuffisante (`HAIR-REFERENCE-COMPARISON.md`).
- Point 3 (vue 3/4) : géométrie de pose ajoutée (`FACE-POSE.md`), non branchée au rendu.
- Point 8 (performance) : géométrie des cheveux mémoïsée (`PERF-HAIR-SIM.md`).

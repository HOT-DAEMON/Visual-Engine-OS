# Cheveux simulés — ce qui reste à faire (par composant)

## Fait
Simulation Verlet 3D + collision ; hiérarchie masse → paquets → brins ; flux depuis la raie ; ordre de profondeur ; drapé front/joues/oreilles/épaules ; ombres portées sur la peau ; détecteur « électrocuté » ; couverture ; mesures raster ; contrôles géométrique/anatomique/style ; 15 archétypes (dont mèche rebelle, couettes, hime) ; 12 références extraites ; tests (`tests/hair-sim.test.ts`).

## Pas fait / insuffisant
1. **Fidélité aux 12 références** : rendu en traits fins et pointus, pas de mèches en lames lissées avec 3 tons nets comme sur la planche ; pas de textures de brin (micro-détails), pas de reflets en bandes par mèche. Pas de comparaison automatique à l'image (IoU / tolérance) : seules des tolérances de détecteur par archétype existent.
2. **Vue 3/4** des références non supportée (moteur de face).
3. **Chignon / tresses / rangées** : approximés par des chaînes ; il faut des primitives dédiées (volume enroulé, tresse à 3 brins, rangées parallèles à partir d'un tracé).
4. **Défaut derrière le cou** (arrière plat sous le cou pour les coiffures longues) : non corrigé pour les cheveux simulés (`backBase` non produit) ; `hime` s'appuie sur des brins arrière seuls.
5. **Vent** : effet faible ; pas de test de rendu dédié.
6. **Drapé** : pas d'épaules dessinées (collision seulement) ; couettes sur épaules non vérifiées en raster.
7. **Yeux et lèvres** : branchement du moteur d'apparence et usage des paires d'yeux des galeries : NON traités dans cette passe.
8. **Performance** : mesuré (12 visages, géométrie + SVG + PNG) : classique court ≈ 2,2 s, simulé ≈ 3,2 s. Aucune amélioration globale du temps de génération n'a été obtenue ; pistes : cache de géométrie par graine, réduire filtres SVG par mèche, simulation en `Float32Array`, passes fines optionnelles (`strandsPerPacket: 0`).
9. Artefacts : mesures raster à une seule graine de visage ; étendre à plusieurs morphologies.

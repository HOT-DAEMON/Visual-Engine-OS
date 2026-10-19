# Artefacts : moteur de visage (feat/face-anatomy)

Même visage de base (seed 321, chauve, expression neutre) sauf mention ; seul le paramètre testé change. Régénération :
`npx tsx scripts/artefacts-face-nose-jaw.ts` (01–07) et `npx tsx scripts/artefacts-face-skin.ts` (08–15). Chaque script accepte des groupes en argument.

| Image | Preuve |
|---|---|
| 01 | Dorsum droit / concave / convexe / asymétrique (+ encart de profil tiré de la géométrie) |
| 02 | Pointe : largeur, rondeur, orientation, projection |
| 03 | Ailes (épaisseur, raccord) et narines (forme, inclinaison, asymétrie, visibilité) |
| 04 | Décomposition anatomique du nez, tracée depuis la géométrie réelle |
| 05 | Menton : hauteur, projection, largeur indépendantes (mesures par cellule : bas du visage constant) |
| 06 | Angle mandibulaire et symphyses (ronde, carrée, pointue, fendue) |
| 07 | Mobilité de la mâchoire et déformation des tissus à l'ouverture |
| 08 | Peau sous 8 directions de lumière (flèche = direction réelle du vecteur) |
| 09 | Rugosité par région (uniforme lisse / rugueuse / variable + carte des régions) |
| 10 | Même matériau sur 3 géométries ; même géométrie en 4 styles (lisse, cel, 3000 K, 9500 K dur) |
| 11 | Ombres de contact : sans / avec (nez, menton→cou, orbites) |
| 12 | Lumières de contour : couleur, intensité, largeur, côté, influence parent/enfants/frères |
| 13 | Zones lumineuses ; source proche, très petite, énorme |
| 14 | Galerie de 12 visages aléatoires |
| 15 + `verification-report.json` | Vérification : 120 visages, 71 contrôles, 0 échec |

Limites visibles (détail dans `docs/TODO-FACE.md`) : modelé du nez peu contrasté sur peau foncée ; bas du visage « en entonnoir » pour une mâchoire étroite à fort `taper` ;
la projection du menton et du nez ne se lit que dans la lumière (pas de vue 3/4).

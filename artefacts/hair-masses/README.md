# Preuves — masses de région, silhouettes, encre, pose 3/4

Régénérer : `npx tsx scripts/artefacts-hair-masses.ts` (même visage, seed 321, yeux d'identité 3).

| Fichier | Contenu |
|---|---|
| `01-archetypes-regions-encre.png` | les 15 archétypes avec régions + encre |
| `02-…`, `03-…` | références (haut) contre moteur (bas), 12 coiffures |
| `04-zones-par-archetype.png` | diagnostic : tempe + patte, mèche de joue, nuque, volume, zone rasée par archétype |
| `05-pose-3-4-schema.png` | schéma de géométrie de pose (PAS un rendu de visage) |
| `06-avant-apres.png` | mêmes archétypes sans / avec régions + encre |
| `metrics.json` | vérification par archétype, mesures pixel contre les références, temps |

Limites : voir `docs/HAIR-REFERENCE-COMPARISON.md` (les silhouettes restent loin des références).

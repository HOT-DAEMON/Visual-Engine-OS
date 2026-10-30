# Artefacts — corps (tronc, épaules, membres supérieurs)

Preuves visuelles et mesurées du moteur `src/body/` (docs : `docs/BODY.md`). Tout se régénère avec `npx tsx scripts/artefacts-body.ts` (planches, mesures) et
`npx tsx scripts/bench-body.ts artefacts/body-upper-limb/perf`. Les planches sont rendues par le moteur ; seules les légendes sont ajoutées hors moteur.
Le visage est celui du moteur de visage existant (crâne, cheveux, visage, sourcils, yeux, joues, nez, mâchoire, bouche, menton, oreilles, cou) : identique d'une cellule à l'autre
sauf la planche 06 ; il n'a pas d'axe d'âge, donc un bébé porte un visage adulte (limite connue, `docs/BODY-REMAINING.md`).

| Fichier | Ce qu'il prouve |
|---|---|
| `01-archetypes.png` | 13 archétypes : bébé, petit enfant, enfant, ado fille/garçon, femme, homme, mince, obèse, musclé, très musclé, femme et homme de 78 ans |
| `02-age-x-sexe.png` | 8 âges × 2 sexes : identiques avant la puberté, divergence après ; seins seulement chez la femme adulte, aucun avant 18 ans |
| `03-adiposite-x-musculature.png` | mince / normal / obèse × peu / musclé / très musclé (homme de 28 ans) : les deux axes agissent indépendamment |
| `04-hierarchie-de-presentation.png` | niveaux 0 → 3 puis mode atomes : enveloppes, masses, muscles et segments, repères et micro-détails |
| `05-poses-des-bras.png` | repos, abduction 60°, pose en T, mains aux hanches, pose asymétrique, poings coudes pliés |
| `06-tetes-et-corps.png` | 7 identités de tête complète sur le corps ; jonction cou / trapèzes / clavicules |
| `07-atomes-bebe-adulte-vieux.png` | mode atomes : chaque composant du contrat a sa teinte, atomes cachés en pointillés |
| `08-mains-detail.png` | main : paume ouverte, dos ouvert, mi-fermée, poing de dos / de paume, tranche |
| `verification.json` | 325 corps (13 archétypes × 25 graines) : 9 600 contrôles des 3 couches, 0 erreur, 0 avertissement |
| `influence.json` | chacun des 51 paramètres perturbé : composants modifiés, lecteurs déclarés, 0 changement non déclaré, 0 paramètre sans effet |
| `atomes.json` | catalogue des atomes (id, type, niveau, parent) pour femme, homme, bébé : 285 / 279 / 279 atomes |
| `perf/bench-body.json` | géométrie, SVG (à froid et à chaud), poids, rastérisation générique vs recadrée, par archétype |

Limites visibles sur les images : flexion du coude = raccourcissement de l'avant-bras (extrémité trapue à 75°), doigts fléchis sans détection de collision, ventre du nourrisson sans profil,
torse coupé net à la ligne des hanches. Voir `docs/BODY-REMAINING.md`.

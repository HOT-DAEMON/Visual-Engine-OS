# Artefacts — voûte crânienne, passe 3

Conception : `docs/SKULL-VAULT-3.md` ; validation chiffrée : `docs/SKULL-VAULT-VALIDATION-3.md`. Graine 3, même caméra et même éclairage que les passes 1 et 2.

| Fichier | Ce qu'il prouve |
|---|---|
| `tete-complete/01-chignon-sillon.png` | tête entière avant / après (nue, coiffée), 6 vues : chignon souligné par le sillon nuchal |
| `tete-complete/02-asym-3.png` | asymétries propres : bosses frontales, azimut pariétal, direction de mastoïde |
| `tete-complete/03-cone-mastoide.png` | mastoïde conique, grande, tournée vers l'avant : queue bornée |
| `parametres/*.png` | min / nominal / max / différence de chaque mesure ajoutée et de `mastoidSlope` |
| `gros-plans.png` | chaque structure à son ancre du registre (par côté pour les asymétries) |
| `accord-2d-3d.png` | contour postérieur 2D vs silhouette 3D : nominal ≤ 0,012 U, extrêmes qui divergent rapportés |
| `queue-mastoide.png` | relief de la seule mastoïde conique avant / après la correction de la queue |
| `audit-consommation.png` | 52 / 52 mesures consommées, zone mesurée vs bande déclarée, fuite |
| `plafonds-tissus.png` | plafond de la combinaison des reliefs selon `scalp` × `boneShow` |
| `verification/*.json` | enregistrements (preuves, audit, plafonds, tirages, accord, têtes) |

Régénérer : `tsx scripts/head-turntable/artefacts-vault-3.ts /tmp/vault3 420` puis `python3 scripts/head-turntable/compose-vault-3.py /tmp/vault3 artefacts/skull-vault-3` (`VAULT3_ONLY=tetes,params,...` pour une section).

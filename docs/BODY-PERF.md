# Performance du moteur de corps

Banc : `npx tsx scripts/bench-body.ts [dossier]` (13 archétypes, médianes, toile générique 900×1300 vs toile recadrée sur le corps). Résultats bruts :
`artefacts/body-upper-limb/perf/bench-body.json`. Machine du conteneur, resvg-js, `loadSystemFonts: false` ; les temps de rastérisation varient d'environ ±10 % d'une exécution à l'autre.

## Mesures finales (moyenne des 13 archétypes)
| Étape | Valeur |
|---|---|
| Géométrie à froid (279 atomes) | 2,4 ms |
| SVG à froid (`renderBody`) | 7,2 ms |
| SVG à chaud (`bodyMarkup`, même contenu) | 0,06 ms (cache adressé par le contenu, 200 demandes → 200 succès) |
| Poids du SVG du corps | 121 Ko en moyenne (128 Ko un adulte ; 81 Ko un nourrisson : ses muscles invisibles ne sont pas émis) |
| Rastérisation corps seul, toile générique 900×1300 (1 170 kpx) | 89 ms |
| Rastérisation corps seul, toile recadrée sur le corps (306–741 kpx) | 66 ms (très inégal : bébé 34 ms, adulte ≈ 77 ms) |

## Ce qui a été fait, mesuré palier par palier (adulte masculin, niveau 3, toile générique)
| Palier | SVG | Rastérisation corps seul |
|---|---|---|
| Première version (3 décimales, un `clip-path` par détail du tronc, un dégradé par enveloppe) | 225 Ko | 115 ms |
| 2 décimales ; UN seul groupe découpé pour le tronc ; un dégradé par COUCHE (7 au lieu de ~70) ; détails invisibles non émis | 192 Ko | 96 ms |
| Doigts à 5 points par segment au lieu de 10 ; pas de 3ᵉ dessin (dégradé) sur la main | 131 Ko (−42 % au total) | 94 ms |
| Banc final (13 archétypes, adulte masculin) | 128 Ko | 88–100 ms selon l'exécution (≈ −15 à −24 % au total) |

**Recadrage de la toile** (`bodyBounds`) : gain très inégal, car il dépend de la place que le corps occupe dans la toile. Moyenne des 13 archétypes : 89 → 66 ms (−26 %) ;
bébé 76 → 34 ms (−55 %), enfant 90 → 82, femme adulte 88 → 76, homme adulte 100 → 77 (−23 %). Les comparaisons « avant/après » ci-dessus sont à toile identique ; ne pas les additionner au recadrage.
Les paliers ont été mesurés en séquence sur le même conteneur, une exécution chacun (±10 % de bruit) : l'ordre de grandeur est fiable, le pourcentage exact ne l'est pas.

Profil par niveau de détail (adulte) : niveau 0 → 57 Ko / 79 chemins ; niveau 1 → 68 Ko / 101 ; niveau 2 → 104 Ko / 165 ; niveau 3 → 131 Ko / 255.
L'encodage PNG (≈ 50 ms) coûte autant que le tracé (≈ 43 ms) : il dépend des pixels, d'où le gain du recadrage.

## Ce qui n'a PAS été amélioré (honnêteté)
- Le visage complet (moteur existant, non touché ici) coûte ≈ 130 ms à rastériser (547 Ko de SVG, filtres) ; la figure complète (visage + corps) ≈ 187–200 ms, dont ≈ 58 ms pour le corps.
  Le temps de génération d'une IMAGE de personnage n'est donc réduit que de la part du corps : **pas de gain « drastique » global** tant que le visage n'est pas traité.
- Aucun niveau de détail automatique selon la taille d'affichage ; aucun cache disque propre au corps (le cache de rastérisation de `scripts/lib/raster.ts` s'applique au SVG final).
- Le rapport au coût réel dans un pipeline vidéo n'est pas mesuré (une seule image à la fois).

## Règles de conception qui gardent le corps rapide
Aucun filtre SVG (contrôle `body.no-filter`) ; géométrie pure mémoïsée ; un seul groupe `clip-path` ; 2 décimales ; niveau de détail demandable (`level` 0–3) ; relief musculaire
non émis quand sa visibilité est nulle ; couche de dessin par membre pour ne jamais re-dessiner un détail sous une peau.

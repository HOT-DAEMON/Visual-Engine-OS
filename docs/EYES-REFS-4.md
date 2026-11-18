# Yeux — passe 7 : almond réajusté en unités de largeur (EYES-REFS-4)

Suite de `EYES-REFS-3.md`. Aucun moteur par référence : les mesures de `references/eyes/` recalent l'enveloppe **existante** (`geometry/eye/opening-ref.ts`, 8 facteurs).
Preuves : `artefacts/eyes-pass7/` (régénérer : `npx tsx scripts/artefacts-eyes-pass7.ts`). Chaque chiffre ci-dessous est recalculé dans `05-rapport-passe7.json`.

## 1. Ce qui n'allait pas dans l'ajustement de la PASSE 3
- Le coût comparait des profils **normalisés par leur maximum** : il cachait les écarts de hauteur et de fraction haute. Mesuré en unités de largeur, l'almond livrait **3,1 % de hauteur en moins**
  que demandée (aspect 0,5295 pour 0,5466 ; écart moyen 0,0171 sur 04, 07, 11).
- Les trois yeux de face ne s'accordent pas entre eux : fraction haute 0,77 (04) contre 0,57 et 0,61 (07, 11) ; pic de la paupière basse à 0,46, 0,56 ou 0,62. Un jeu unique de facteurs ne peut pas
  les reproduire tous exactement : l'écart-type inter-références du profil haut (0,049) est plus grand que l'erreur résiduelle (0,015).
- Les angles de canthus étaient calés au centième de degré sur la **moyenne** de trois yeux (écart-type 13° interne, 16° externe) : sur-ajustement sans signification, payé en erreur de profil.
  De plus la mesure (extracteur Python, cordes par longueur d'arc) et le moteur (tangentes paramétriques) n'avaient pas la même définition : un même œil donnait 75°/113° mesuré et 84°/105° côté moteur.

## 2. Ce qui est fait
| Point | Résultat |
|---|---|
| Coût en unités de largeur, par œil, avec **ses propres** aspect / fraction haute / inclinaison (`scripts/eye-refs/fit-almond.ts`) | un jeu de 8 facteurs explique 04, 07, 11 ; boucle « jusqu'à parfait » : relance tant que le coût baisse de plus de 1e-5 (plafond 12 tours) |
| Contrat de hauteur | écart moyen **0,0171 → 0,0003** ; fraction haute 0,0046 → 0,0016 |
| RMS profil haut (moyenne des 3 yeux) | **0,0208 → 0,0149** (04 : 0,0347 → 0,0236 ; 11 : 0,0165 → 0,0071 ; 07 : 0,0111 → 0,0140, légèrement pire) |
| RMS profil bas | 0,0230 → 0,0235 : **pas d'amélioration** (voir § 4) |
| Angle de canthus : définition commune `canthusChordAngles` (`geometry/eye/profile.ts`), tolérance = écart-type inter-références | l'angle n'est plus calé sur la moyenne |
| `--write` écrit réellement `ALMOND_REF` | l'ancienne version n'écrivait rien malgré son en-tête |
| 27 recettes de silhouettes mesurées régénérées (`fit-recipes.ts`) | RMS moyen 0,0446 → 0,0444 ; 3 recettes un peu moins bonnes (≤ 0,002 : 17-C, 15-D, 17-P01) |
| Galerie des 100 : un flux pseudo-aléatoire **par style** | changer la plage d'un style ne remélange plus les réservoirs des autres |
| Losanges (`diamond`, `diamond_v2`) : plage d'aspect 0,40–0,80 et d'inclinaison −8°…16° | `diamond` retombait à 3 formes distinctes (plancher 4) → **5** ; distance minimale entre les 100 : 0,0201, aux 48 existantes : 0,0226 |
| `fitLashesToZone` : 10 → **40** tours | la boucle s'arrêtait en silence à une portée de 0,5506 (> 0,55) sur un œil sharp à fraction haute 0,40 |
| Vérification de rendu : 100 yeux × 9 règles pixels | 0 échec |

## 3. Nouvelles règles de vérification (`src/verify/eye-envelope.ts`, almond seulement)
- `envelope-height-contract` (géométrie, warn) : |hauteur obtenue − hauteur demandée| / hauteur demandée ≤ 5 %. Prouvée **sur l'ancien défaut** : avec les facteurs de la PASSE 3, 14 combinaisons sur 48 échouent ; avec les nouveaux, 0.
- `canthus-opening-angle-inner|outer` (+ `-max`) (anatomie, warn) : bornes = plage des 3 yeux de face ± 20° (`REF_RANGES.canthusChordInner/Outer`), même définition des deux côtés.
- Couches de rendu : la vérification par pixels (`scripts/lib/verify-eye-render.ts`) reste celle de la PASSE 6 (géométrie / anatomie / style) ; la règle de contrat de hauteur est une règle d'enveloppe, pas de pixels.
- Tests : `tests/eye-envelope-verify.test.ts` (4 tests ajoutés), `tests/eye-lash-families.test.ts` (œil de base : la case 18, un almond ; garde-fou si son style change).

## 4. Constats non corrigés (documentés, pas masqués)
- **`sharp` et `drooping` livrent ~27 % de hauteur en moins que demandée** (−28 % et −24,5 % à aspect 0,55 ; −19 % à −35 % sur 48 combinaisons). Contrôles écrits à la main (`hUp × 0,55`, `flick` borné).
  Les 27 recettes l'absorbent (elles sont ajustées sur la sortie réelle du moteur). Corriger change toutes ces silhouettes : test de bornage `PASSE 7 … écart de hauteur CONNU`.
- **Paupière basse près du canthus interne** : les références 07 et 11 descendent vite puis forment un plateau ; l'enveloppe monte plus régulièrement (`artefacts/eyes-pass7/02`). C'est ce qui garde le RMS bas à 0,0235.
  Une position de sommet **exposée** (`upperPeakAt` / `lowerPeakAt` varient de 0,46 à 0,62 selon les références, le moteur les fixe) demanderait un paramètre de schéma + preuve de consommation : non fait.
- **Dôme pâle au-dessus du trait de paupière** quand `upperFraction` est au plancher (0,40) : visible sur la case 6 avant lashes (`recette 15-B, sharp, fraction 0,40`). Préexistant, non corrigé.
- Le plancher de fraction haute du schéma (0,4) borne les sprites plats mesurés à 0,22–0,28 (déjà noté en PASSE 6).
- Les 100 formes : seul l'almond a été retravaillé sur mesures. Les 11 autres enveloppes ne sont pas reprises une à une (voir `EYES-REMAINING.md`).

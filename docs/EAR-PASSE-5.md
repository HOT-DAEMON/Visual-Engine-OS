# Moteur d'oreille — passe 5

Preuves : `artefacts/oreille-passe-5/` (voir son `README.md`). Rendus réels du moteur, jamais retouchés. Mesures AVANT/APRÈS : `scripts/ear-audit/passe5-stats.ts` (150 têtes « natural » × 2 oreilles, graines 9000–9149), lancé sur le commit `ddbbad4` (passe 4) puis sur la passe 5.

## 1. La jupe de peau est supprimée

Défaut : la « jupe de racine » (passe 4) était une bande de peau dessinée entre le bord antérieur de l'oreille et le contour de la tête. Elle se lisait comme une peau qui **sépare** l'oreille de la tête (`AVANT-APRES-04-attache.png`).

Correction (`project.ts`) : plus aucune bande (le champ `root` de `ProjectedEar` et son rendu n'existent plus). L'attache est un **cisaillement latéral du pavillon** (`attachShear`, `anteriorEdge`) :
- le plan de l'oreille reste quasi vertical (`EAR_LEAN`) pendant que le contour de la tête rentre sous l'oreille (mâchoire) ;
- le déplacement vaut l'écart entre la surface d'accrochage et le contour réel (moins 1,2 % de H de recouvrement), mesuré **à partir du bord antérieur réel** du contour (la jonction lobule-joue est en retrait du crus), en tenant compte de l'écartement `sin α · u · H` ;
- il est maximal sur le bord antérieur et s'éteint vers l'arrière (portée 0,30 en `u`) : hélix et lobule restent libres ;
- seule la composante latérale X change : l'ordonnée de chaque repère est identique dans toutes les vues (invariant déjà testé), et de profil le cisaillement est invisible par construction.

| Mesure (150 têtes × 2) | Avant | Après |
|---|---|---|
| Écart du bord antérieur à la tête (fraction de H), médiane / max | 0,094 / 0,162 | **0 / 0,041** |

Contrôle ajouté : `ear-anterior-touches-head-L/R` (géométrie, erreur, ≤ 6 % de H). Le contrôle `ear-attached` tient compte du cisaillement.

## 2. Creux de la conque trop petit, région hélix → lobule trop vaste

Références : `references/orreil/01–03` (conque large qui descend vers le lobule, anthélix en Y, rebord d'hélix épais jusqu'en bas).

| Structure | Avant | Après |
|---|---|---|
| Cavum | borne basse 0,67, borne postérieure 0,58 | borne basse **0,745**, postérieure 0,61, polygone à 8 points |
| Anthélix, corps | `(0,52 ; 0,69)` → `(0,64 ; 0,385)` | `(0,56 ; 0,745)` → `(0,665 ; 0,385)` (queue prolongée vers le lobule) |
| Antitragus | `(0,40 ; 0,695)` | `(0,42 ; 0,75)`, **remonté automatiquement** si le contour (oreille étroite ou pointue) le laisse sortir |
| Hélix | épaisseur 0,075, amincie à 35 % en queue | épaisseur 0,082, amincie à **70 %** seulement : le rebord reste épais jusqu'au lobule |

| Mesure | Avant | Après |
|---|---|---|
| Conque (cavum + cymba) / aire du pavillon, médiane (min–max) | 24,1 % (18,7–29,0) | **30,3 % (23,6–36,4)** |
| Peau lisse (aire sans structure, hors lobule) médiane (max) | 39,8 % (52,4) | **32,5 % (46,8)** |

Contrôles ajoutés (couche anatomie, avertissement) : `ear-concha-share` ≥ 20 %, `ear-bare-share` ≤ 50 %.

## 3. Oreilles « en traits »

Cause : angle d'écartement trop faible (22° en pratique) + pente de mâchoire. Canon relevé : `CANON_MIN_DEG` 21° → **27°**, `FRONT_MIN` 0,26 → **0,34** (largeur de face / H) ; le compositeur « natural » tire 27°–40° (avant 21°–36°). Le détecteur de rendu `not-a-stroke` passe de 0,17 à 0,20.

| Mesure | Avant | Après |
|---|---|---|
| Largeur de face / H (plaque + rebord), médiane (min) | 0,317 (0,268) | **0,472 (0,380)** |
| Angle d'écartement, médiane | 28,7° | 35,5° |

Limite visible : sur une mâchoire très fuyante (tête 22) l'oreille reste inclinée ; elle n'est plus un trait mais reste oblique (`AVANT-APRES-04`).

## 4. Axe renforcé : `scapha.curvature`

Audit à l'échelle de la tête : 67 px (seuil 150). Un simple changement de largeur de gouttière était noyé par la place disponible. Ajout d'une surimpression `scapha:curve-shade` : la moitié haute (courbure > 0) ou basse (< 0) est creusée davantage. Résultat : 321 px à l'échelle de la tête (3 graines : 278/340/345), test ≥ 378 px dans la meilleure vue d'oreille. L'effet est **modéré** en gros plan (`04-scapha-curvature-close-up.png`) : il se lit surtout en trois-quarts et sur la tête.
Audit des autres axes « faibles » (même méthode, seuil 150 px) : cymba 297, crus.thickness 201, crus.angle 235, crus.length 185, antitragus.orientation 303, tragus.tip 338, helix.continuity 243, scapha.gradient 202 — tous au-dessus du seuil, mais le nombre de pixels « francs » reste bas pour `helix.continuity` (20) et `scapha.gradient` (7).

## 5. Vérification (géométrie, anatomie, style)

- Rendu sur pixels : 24 têtes, **0 échec** (erreur ni avertissement) — `verification-rendu.json`.
- Modèle : 90 oreilles composées (3 caractères × 30 graines, ≈ 4 000 contrôles) — `verification-modele.json` : « natural » 0 échec ; « caricature » 1 avertissement (`ear-outline-turn`) ; « fantasy » 5 avertissements (`ear-outline-turn` sur pointes, `ear-concha-share` pour des familles à conque réduite). Aucune erreur.
- Tests : `tests/ear-passe5.test.ts` (5) ; `ear-views` et `ear-verify` adaptés au cisaillement.
- 15 références `references/visual` recalées (`hard-01…18` sauf 09, 10, 13). Vérifié avant recalage : 0 pixel modifié dans la bande centrale 30–70 % de la largeur, tout est sur les oreilles.

- Tête 3D tournante (`head-turntable`) : la conque et l'anthélix agrandis allongent les arêtes tracées à l'encre ; la part d'encre de l'oreille de profil passait à 0,46 (borne `eng.ear.ink` 0,45, test `head-turntable*`). Correction : trait d'encre de face 0,5 → 0,45 (`engines/ear-paint.ts`), non retouché à l'œil : seul le test chiffré le valide, **pas de planche de preuve 3D** pour ce réglage.

## 6. Ce que cette passe ne fait pas

Voir `docs/EAR-REMAINING.md`. En particulier : la tête 3D de profil n'est pas validée pour les oreilles composées ; les autres paramètres des listes TODO (`docs/TODO EAR SYSTEM*.md`) ne sont pas traités ; la jupe n'ayant jamais existé en vue 3D, rien n'y a changé ; les oreilles très inclinées sur mâchoire fuyante restent obliques.

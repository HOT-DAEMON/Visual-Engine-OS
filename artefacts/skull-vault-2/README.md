# Voûte crânienne, passe 2 — preuves visuelles

Front, occiput, tempes, astérion, asymétries : dix mesures de plus, **dans le même moteur**. Toutes les images : graine 3, tête **chauve** (sauf mention), éclairage rasant (azimut 300°, élévation 40°), même caméra, même rendu ; seule la valeur change. Rouge = pixels qui changent. Architecture et décisions : `docs/SKULL-VAULT-2.md` ; protocole, seuils et résultats : `docs/SKULL-VAULT-VALIDATION.md` ; reste à faire : `docs/SKULL-VAULT-REMAINING.md`.

| Fichier | Ce qu'il prouve |
|---|---|
| `tete-complete/01-arcade-torus.png` … `05-asym-fine.png` | **toute la tête**, six vues : avant (nominal, chauve) / après (une famille de la passe 2, chauve) / après coiffée. 5 familles = combinaisons de mesures indépendantes (valeurs en en-tête de chaque planche) |
| `gros-plans.png` | chaque structure **là où le registre l'ancre** (fenêtre 0,62 × 0,5 U centrée sur l'ancre) : min · nominal · max · différence |
| `profil-2d.png` | le moteur 2D (`src/skull`, mode os) lit les mêmes formes : contours min (bleu) / nominal (noir) / max (rouge) pour `browArch`, `frontalEminence`, `metopicRidge`, `occipitalBun`, `inionSize`, `parietalHeight` (sens corrigé) |
| `ancre-parietale.png` | l'ancre de visibilité du registre (point vert) **suit** l'éminence : hauteur, azimut, asymétrie de hauteur |
| `cheveux-suivent-le-relief.png` | la coiffure du banc d'essai est posée sur le même maillage : elle suit le chignon, le méplat, les bosses, l'arcade |
| `parametres/<mesure>.png` | les 10 mesures + `browRidge` (prouvé avec l'arcade active) + `parietalHeight` : min / nominal / max × 6 vues + carte de différence |
| `familles/familles-3.png`, `interactions/*.png` | familles et grilles 3 × 3 de la passe 2 (copies de `../skull-vault/`) |
| `verification/` | `proofs-passe2.json` (mesures), `composites.json` (réglages, contrôles de la passe 2 pour chaque famille, déplacements 2D), `zoom.json`, `aleatoire-passe2.json` (24 voûtes tirées : aucun échec) |

## Lecture des chiffres (protocole : silhouette ≥ 0,4 % de l'union ou ombre ≥ 0,5 %, sur une vue attendue)
| Mesure | Meilleure vue | Silhouette | Ombre |
|---|---|---|---|
| `frontalEminence` | dessus | 0,51 % | 13,70 % |
| `browArch` | 3/4 | 0,48 % | 3,75 % |
| `metopicRidge` | dessus | 0,42 % | 5,02 % |
| `occipitalBun` | dos | 0,00 % | 14,03 % |
| `inionSize` | dos | 0,00 % | 3,51 % |
| `temporalLine` | 3/4 | 0,20 % | 3,73 % |
| `temporalMuscle` | 3/4 | 0,08 % | 5,11 % |
| `asterion` | profil | 0,00 % | 1,63 % |
| `asymMastoid` | 3/4 arrière | 0,51 % | 3,71 % |
| `asymParietalHeight` | dos | 0,00 % | 2,35 % |
| `browRidge` (avec `browArch` = 1) | 3/4 | 0,39 % | 3,77 % |

Les 48 preuves de la voûte (38 + 10) sont perceptibles. Silhouette 0,00 % = relief qui ne change pas le contour dans cette vue ; il est alors jugé sur l'ombre (le chignon se lit en revanche dans le contour de profil, voir `gros-plans.png` et `profil-2d.png`).

## Ce que les images montrent aussi, et qu'il faut savoir
- Au maximum, l'arcade (`browArch` = 1) touche le haut de la paupière : le dessin de l'œil suit la surface et se resserre un peu (`gros-plans.png`, lignes `browArch`).
- `dolicho-chignon` (tête longue + chignon fort) donne un dessus en losange : extrême, mais la couche de vérification est satisfaite.
- Les bosses frontales et la crête temporale sont cachées sous une coiffure qui couvre le front (`tete-complete/*`, ligne « après : coiffée »).
- Le dessin fini du profil 2D est coiffé et masque la voûte : `profil-2d.png` utilise le mode os.

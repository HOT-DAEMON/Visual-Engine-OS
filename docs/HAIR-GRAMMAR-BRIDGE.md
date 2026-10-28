# Priorité 3 — relier `src/hair-grammar/` au pipeline principal (étude, **sans fusion**)

Décision : **ne pas fusionner maintenant.** Ce document pose les questions demandées et leur état. Rien ici n'est implémenté ; ce qui n'a pas été lu est marqué « non vérifié ».
Sources lues : `src/face/hair/index.ts` (en-tête), `types.ts` (`HairLock`, `OcclusionInfo`, `SideInfo`), `sim/index.ts` (signatures), `guard.ts`/`scalp.ts` (signatures), `src/face/landmarks.ts` (`FaceLandmarks`), `src/hair-grammar/{ribbon,ribbon-scene,ribbon-verify,head}.ts`.

## 1. Ce que la grammaire fait mieux
- Part de **formes mesurées** sur une illustration (cap, courbure, longueur, pointe effilée, masses noires pleines avec trous, bandes de reflet) et les exprime **en hauteurs de tête** : la taille d'une mèche se lit par rapport au visage.
- Rendu d'encre à **gris mesurés** (bandes de ton) et silhouettes de masses pleines que le moteur principal n'a pas.
- Vérification **contre une référence** (IoU, rappel d'encre) en plus des mesures internes.

## 2. Ce que le moteur principal fait déjà
- Génération **complète à partir de `FaceParams` + `FaceLandmarks`** (graine → chevelure) : implantation, sous-couche, frange, mèches étagées, queue/chignon/tresses, côtés et oreilles, simulation verlet avec collisions et drapé (`face/hair/sim/`).
- **Occlusions** mesurées (`OcclusionInfo` : recouvrement demandé vs mesuré), garde par composant (`guard.ts`), limites par zone (`zone`), cache de contenu, couche de vérification dédiée (`src/verify/hair-*.ts`).
- Mèche = `HairLock` : polygone fermé + `spine`, `w0`, profil `ribbon`|`cone`, rang, teinte **relative** (−1…1), couche `front|back|over`, étage, fondu.
La grammaire, elle, **ne génère rien** à partir de paramètres (voir `HAIR-GRAMMAR-02-REMAINING.md`, point 7) : c'est aujourd'hui un outil de mesure et de reproduction.

## 3. Données partageables
| Grammaire | Moteur principal | Passage |
|---|---|---|
| `Ribbon` : ligne médiane `(u,v)` + largeur `w` par point | `HairLock.spine` + `w0` + `poly` | **faisable** : `ribbonOutline` donne déjà un contour fermé ; `w` → `w0`/profil |
| Rôle `hair`/`face` d'un ruban | — | le moteur principal n'a pas de rubans « visage » ; ils restent hors du pipeline |
| Statistiques (longueur, largeur, cap, courbure) en H | paramètres de `STYLES`/`flow` (non vérifié en détail) | **le plus prometteur** : alimenter des *paramètres*, pas de la géométrie |
| Repères du visage (iris, nez, bouche, menton, crâne) | `FaceLandmarks` (`eyeY`, `noseTipY`, `mouthY`, `chinY`, `jawY`, `W`, `H`) | adaptateur de repère à écrire (iris+unité ↔ `W`,`H`) |

## 4. Primitives incompatibles
- `ToneMass` (bandes de gris absolues avec trous évenodd) et `SolidMass` (masses noires avec trous) : le moteur principal n'a pas d'équivalent direct (teinte relative, rendu par appearance partagée ; le type `Poly` n'a pas été vérifié pour les trous).
- Gris **absolus** mesurés vs teinte **relative** + éclairage : mélanger les deux casse la cohérence d'ombrage.
- Repères : repère de tête (origine = iris, unité = hauteur de tête, y vers le bas) vs repères du visage propres à `FaceLandmarks`.
- Encre noire sur papier (rendu BD) vs rendu piloté par matériaux/éclairage : deux styles de sortie.

## 5. Conserver l'apparence partagée
Le moteur d'apparence ne doit pas être contourné : tout import de la grammaire doit livrer de la **forme** (rubans/masses/rang/étage) et laisser la **couleur** au moteur d'apparence ; les gris mesurés ne servent qu'à calibrer une teinte relative (`tone`). Comment l'apparence est branchée sur les cheveux : **non vérifié** (aucune référence à « hair » trouvée dans `src/appearance/` par recherche de texte ; le branchement est ailleurs).

## 6. Graphe du visage et occlusions
Un import doit passer par les mêmes `guard` et mesures d'occlusion que les mèches natives : mêmes boîtes de composants, mêmes zones protégées (yeux, sourcils, nez, bouche). Condition d'acceptation : `OcclusionInfo.measured` calculé sur les mèches importées, jamais copié.

## 7. Chemin proposé (aucune étape faite)
1. Adaptateur de repère `HeadFrame ↔ FaceLandmarks` (test : mêmes positions d'yeux/nez/bouche à 1 px).
2. Extraire des statistiques de rubans sur les cellules 01 et 02 (même unité H) ; comparer à celles des archétypes existants ; ne retenir que ce qui diffère réellement.
3. Adaptateur **à sens unique** `Ribbon → HairLock` derrière un drapeau, pour **une** coiffure (02) ; rendu par le moteur principal.
4. Comparer au rendu actuel et à la référence ; passer les mesures d'occlusion et la vérification existante.
5. Seulement si 1 à 4 sont verts : décider d'une fusion plus large. Non-régression : suite `regress` du dépôt, mêmes graines.

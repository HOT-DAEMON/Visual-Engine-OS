# Couche de vérification de la tête éclairée

Code : `src/head-turntable/verify-light.ts` ; pipeline : `src/verify/head-3d.ts` (`checkHead3dLit`, ids `head3d.<id>.lit.*`, uniquement si la tête porte `lit`). S'ajoute aux trois couches de `HEAD-TURNTABLE-VERIFY-HEAD.md` ; ne mesure que ce que la lumière ajoute. Mesures : `artefacts/head3d-lit-v2/mesures-verification-eclairee.md`.

Chaque contrôle porte une borne écrite avant la mesure ; quand la mesure a montré un défaut de la BORNE (pas du rendu), elle a été corrigée et le motif est noté ci-dessous.

## Géométrie
| id | mesure | borne | note |
|---|---|---|---|
| `lit.side.<yaw>.<pitch>` | luminance de la peau (visage + crâne) côté lumière / côté opposé, 4 vues (0°/0, 45°/0, 90°/0, 45°/30°) | ≥ 1,04 (hard ≤ 45°, info à 90°) | la lumière est fixe dans la scène, pas dans la tête. De profil la peau est une paroi latérale : parité mesurée 0,99 sous une lumière presque frontale → information |
| `lit.silhouette` | pixels de silhouette différents, éclairé / sans lumière | 0 | la lumière ne touche pas la géométrie |

Le cou est exclu de `lit.side` : il fond vers l'ombre à sa base (conception de la planche) et faussait la partition à 90° (0,96 au lieu de ≥ 1).

## Anatomie
| id | mesure | borne |
|---|---|---|
| `lit.ala.count` | pixels d'aile mesurés à 30° | ≥ 30 (sans eux le contrôle ne mesure rien) |
| `lit.ala.normal` | écart max (°) normale éclairée / face, coque de l'aile | ≤ 35 (mesuré 10,2 ; ellipsoïde brut > 35, test de sensibilité) |
| `lit.chin.shadow` | part du haut du cou (35 %) à l'ombre portée sous clé 300° / 60° | 0,05 – 0,9 (mesuré 0,51, graine 11) |
| `lit.hair.floor` | contraste WCAG du 5e centile des cheveux (hors trait) contre l'encre, à 90° | ≥ 1,1 (99 si chauve) |

Erreurs de mesure corrigées : l'écart d'aile incluait le flanc du nez dans la zone de fondu (41–49° à tort) ; le plancher des cheveux comptait les pixels d'encre de la lisière.

## Style
| id | mesure | borne |
|---|---|---|
| `lit.ink.kept` | part de l'encre (hors cheveux) recouverte par la lumière | ≤ 0,05 (mesuré ≤ 0,022) |
| `lit.pixels.black` | pixels noirs purs, 4 vues | 0 |
| `lit.dL` | ΔL OKLab ombre-lumière de la peau | 0,12 – 0,55 (réf : cel 0,21–0,30, peint 0,40–0,50 ; mesuré 0,30 en cel) |
| `lit.tones.flat` | part des pixels dans les 8 teintes (16 niveaux) les plus peuplées | ≥ 0,6 en cel (mesuré 0,95) ; information en peint |

## Limites
- 3 graines × 2 motifs de lumière (3/4 droite cel, latérale gauche) ; autres motifs (par en dessous, zénithale) non mesurés.
- Pas de contrôle de ressemblance aux références, ni de raccord de lumière tête ↔ cou ↔ corps.
- Coût ≈ 6–8 s par appel (4 rendus + un tampon) ; non mémoïsé.

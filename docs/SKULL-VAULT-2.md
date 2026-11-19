# Voûte crânienne — passe 2 : front, occiput, tempes, astérion, asymétries

Suite de `SKULL-VAULT.md` (architecture) et de `SKULL-VAULT-REMAINING.md` (ce qui restait à faire). Même règle : **on enrichit le moteur existant, on n'en crée pas un second**. Aucune référence, aucun nouveau moteur : dix mesures de plus, portées par le registre, lues par la même chaîne de relief et par le même profil 2D, prouvées sur le rendu. Protocole et résultats : `SKULL-VAULT-VALIDATION.md` ; reste à faire : `SKULL-VAULT-REMAINING.md`. Preuves visuelles : `artefacts/skull-vault-2/` (voir son README).

## Ce que la passe traite
| Point de `SKULL-VAULT-REMAINING.md` | Réponse |
|---|---|
| Frontal : éminences latérales, arcades latérales, glabelle ↔ arcades, crête métopique | `frontalEminence`, `browArch` (fondue à la glabelle, échelonnée par `browRidge`), `metopicRidge` |
| Occipital : chignon, protubérance externe d'amplitude propre | `occipitalBun`, `inionSize` |
| Temporaux : crête persistante, volume du muscle | `temporalLine`, `temporalMuscle` |
| Astérion : repère sans relief ni paramètre | `asterion` |
| Asymétries propres : mastoïde, **position** des éminences pariétales | `asymMastoid`, `asymParietalHeight` |
| Ancre de visibilité pariétale fixe | l'ancre suit l'éminence déplacée (`anchorOf`) |
| Couche de vérification : géométrie, anatomie, style | `verify-vault-2.ts` |

## Principe : une forme, plusieurs lecteurs
Chaque forme est écrite **une seule fois** dans `src/skull/vault-shapes.ts` (pure, sans dépendance, comme `vault-mastoid.ts`) : un poids sans dimension (0 … 1) et son amplitude `VAULT_SHAPE.<forme>.amp` (U ; 0,010 U ≈ 2,3 mm pour une tête de 230 mm). Tout le reste la lit :

| Lecteur | Fichier | Ce qu'il lit |
|---|---|---|
| Relief 3D (maillage, éclairage, **cheveux** : même surface `skullSurfacePoint`) | `engines/vault-relief.ts` | toutes les formes × paramètre × transmission des tissus de la région |
| Profil 2D (contour, mode os) | `skull/vault.ts` | `archAmp`, éminence, métopique, chignon, protubérance (les reliefs latéraux n'ont pas de contour médian) |
| Registre (structures, voisins, ancres, vues) | `skull/vault-registry*.ts`, `anatomy/components.ts` | 6 structures canoniques de plus |
| Visibilité et occlusion | `vault-visibility.ts` | `anchorOf` : la position **effective** de l'éminence pariétale |
| Preuve de rendu et planches | `vault-proof.ts`, `scripts/head-turntable/` | toutes les clés de `VAULT_KEYS`, aucune liste parallèle |
| Vérification de rendu | `verify-vault-2.ts` | les mêmes constantes de forme (canon écrit avant la mesure) |

## Les dix mesures
Toutes signées [−1, 1], **nulles par défaut : la tête est identique à celle d'avant** (relief de voûte exactement 0). Positions en U, y vers le bas (0 = sommet), azimut 0° = face, 180° = nuque. Conventions d'anatomie artistique (Gray, Bridgman, Hogarth), **non mesurées sur des personnes**.

| Mesure | −1 … +1 | Structure du registre | Forme (position, étendue) | Amp. U | Tissu |
|---|---|---|---|---|---|
| `frontalEminence` | front plan … bosses marquées | `frontal-eminence` | 2 gaussiennes à 0,135 U au-dessus de la glabelle, à 27° (σ 0,07 U × 11°) | 0,028 | frontal |
| `browArch` | gouttière sus-orbitaire … torus | `supraorbital-arch` (+ `glabella`) | axe y = glabelle + 0,004 + 0,05·(az/56)², bord orbite net (σ 0,019), pente douce vers le front (σ 0,03), éteinte entre 28° et 58° | 0,018 × (0,6 + 0,8·`browRidge`) ; creux à 0,5 × | glabelle |
| `metopicRidge` | sillon … crête | `metopic-ridge` (ligne, masquée par défaut) | bande de σ 4,5° entre le bregma et la glabelle | 0,012 | frontal |
| `occipitalBun` | méplat … chignon | `occipital-bun` | gaussienne à 0,16 U au-dessus de l'inion, sur l'axe de la nuque (σ 0,085 U × 26°) | 0,030 | occipital |
| `inionSize` | creux … crochet | `nuchal-line` | sur l'inion (σ 0,036 U × 10°) | 0,014 | occipital |
| `temporalLine` | aucune … crête | `temporal-line` | distance à la courbe `line.temporal` (σ 0,014 U) | 0,012 | temporal |
| `temporalMuscle` | atrophié … volumineux | `temporal-muscle` | sous la crête (bord adouci 0,02 U), centré sur le ptérion, éteint à l'arcade zygomatique | 0,016 | temporal |
| `asterion` | fossette … saillie | `asterion` (repère visible par défaut, comme le ptérion) | gaussienne sur le repère (σ 0,024 U × 8°) | 0,014 | temporal |
| `asymMastoid` | côté +x plus petit et effacé … plus grand et saillant | `mastoid-process` | taille ±0,7 et amplitude ±0,5 de la valeur, signées par côté | via `mastoid` | mastoïde |
| `asymParietalHeight` | bosse +x plus basse … plus haute (l'autre à l'opposé) | `parietal-bone` | hauteur = `parietalHeight` + 1 × valeur × côté (± 0,06 U) | via `parietalBulge` | pariétal |

L'amplitude réelle est multipliée par la transmission des tissus (`vault-tissue.ts`, 0,25 … 1,6) : un cuir chevelu fin ou un os apparent **amplifie**. Les amplitudes ci-dessus sont donc des valeurs de base, bornées pour que le pire cas physique tienne dans la vérification (voir plus bas).

## Arcade, glabelle et `browRidge`
`browRidge` (existant, 0 … 1) n'agissait presque pas en 3D (0,2 % de silhouette). Il **échelonne désormais l'arcade** (×0,6 … ×1,4), sans changer les têtes existantes : à `browArch` = 0, rien ne bouge. La glabelle (relief médian existant) et l'arcade sont **fondues** en un seul bourrelet par une norme 4 (`softUnion`), continue vers le maximum quand un terme tend vers 0, pour les reliefs comme pour les creux : à la jonction, 1,19 × le maximum au lieu de 2 × (somme). La somme faisait dépasser le saut admissible de 0,014 U. `browRidge` se prouve donc avec l'arcade active (`browArch` = 1).

## Corrections et décisions à connaître
- **Sens de `parietalHeight` corrigé.** `y` étant compté vers le bas, +1 (« haute », selon la doc du paramètre) déplaçait en fait l'éminence vers le bas (sommet mesuré à y = 0,300 au lieu de 0,185). Corrigé aux quatre endroits qui le lisent (`skull-relief.ts`, `vault-visibility.ts`, `verify-enlargement.ts`, `skull/vault.ts` pour le profil 2D). Effet : les têtes qui réglaient `parietalHeight` ≠ 0 ont l'éminence de l'autre côté de la valeur ; celles à 0 sont inchangées.
- **La crête persistante remplace la crête fine.** Avec `temporalLine` ≠ 0, la courbe `line.temporal` n'est plus tracée par `suturesShow` : les deux se cumulaient (saut 0,0197 U).
- **Tolérance de largeur.** Le relief est écrêté à la demi-largeur de la coupe (le contour de face reste celui du moteur de visage). `vaultOver` laisse dépasser le muscle et la crête temporaux au point le plus large, sinon ils s'effaceraient ; rien d'autre ne dépasse.
- **Clés ajoutées à la fin** de `VaultParams` : `drawVault` consomme les clés dans l'ordre, les tirages aléatoires existants ne bougent pas.
- **Carène sagittale non faite** : le relief est radial et horizontal, il n'a presque pas de prise sur le sommet (surface horizontale). Voir `SKULL-VAULT-REMAINING.md`.

## Contraintes, préférences, corrélations
- **Strictes** (levées en caricature, journalisées) : un muscle temporal volumineux comble la fosse (`temporalHollow` ≤ 1 − 0,5·`temporalMuscle`) ; un occiput très aplati ne porte pas de chignon prononcé (`occipitalBun` ≤ 1 − 0,6·`occipitalFlat`).
- **Préférences** (mesurées, jamais corrigées) : bosses frontales + forte arcade rares ; muscle puissant sans crête rare ; chignon avec tête très courte rare ; l'asymétrie compte maintenant six mesures.
- **Corrélations** (facultatives, tendance 0 par défaut) : `browArch → glabella` (+0,6), `frontalEminence → browArch` (−0,4), `temporalMuscle → temporalLine` (+0,5), `occipitalBun → inionSize` (+0,4).

## Régénérer
```
VAULT_SHARD=0/3 tsx scripts/head-turntable/artefacts-vault.ts /tmp/vault 300   # idem 1/3 et 2/3, en parallèle
python3 scripts/head-turntable/merge-vault-proofs.py /tmp/vault
python3 scripts/head-turntable/compose-vault.py /tmp/vault artefacts/skull-vault
tsx scripts/head-turntable/artefacts-vault-2.ts /tmp/vault2 420                  # FROM=<n> / TO=<n> pour reprendre
python3 scripts/head-turntable/compose-vault-2.py /tmp/vault2 artefacts/skull-vault-2
```
Copier ensuite `/tmp/vault/verification/*.json` dans `artefacts/skull-vault/verification/` (le test « enregistrement complet » les lit). `compose_lib.py` regroupe les utilitaires de planches partagés.

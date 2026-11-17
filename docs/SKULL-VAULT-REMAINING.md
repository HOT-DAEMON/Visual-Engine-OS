# Voûte crânienne — ce qui reste à faire, par composant

Tout ce qui est écrit ici n'est **pas fait** ou **fait partiellement**. Ce qui est fait est dans `SKULL-VAULT.md`, prouvé dans `SKULL-VAULT-VALIDATION.md`.

| Composant | État | Reste à faire |
|---|---|---|
| Os frontal | ✅ pente, bombé, plat, largeur | éminences frontales latérales (bosses) et arcades sourcilières latérales : seule la glabelle médiane est modelée ; `browRidge` (existant) n'a qu'un effet faible en 3D (≈ 0,2 % de silhouette, ≈ 2 % d'ombre en 3/4) |
| Pariétaux | ✅ bombement, aplatissement, convexité, **position** (`parietalHeight` ±0,06 U, `parietalAzimuth` ±14°) | éminence unique : pas d'asymétrie de position gauche / droite (seul `asymParietal` y touche) ; l'ancre de visibilité `vault.anat.visible` ne suit pas encore la position déplacée |
| Temporaux | ✅ largeur, aplatissement, creux | arcade zygomatique et volume du muscle temporal (seule son épaisseur atténue le relief) ; ligne temporale seulement via `suturesShow` |
| Occipital | ✅ plat, incliné, projection, inion | chignon occipital ; protubérance externe d'amplitude propre (aujourd'hui lue sur le paramètre existant `inion`, ±0,007 U) |
| Mastoïde | ✅ saillie, **taille** (×0,6 … ×1,5), **direction** (±35°, s'allonge), **pente** (cône → plateau) : une seule forme, `skull/vault-mastoid.ts`, lue par le relief 3D et le dessin de profil 2D | c'est un relief (gaussienne anisotrope) et non un cône osseux à volume propre ; pas de forme différente à gauche et à droite ; le centre reste à l'ancre `yM` / 118° |
| Ptérion / astérion | ⚠️ | le ptérion règle les exposants de transition ; l'astérion n'est qu'un repère (donnée) sans relief ni paramètre |
| Vertex | ✅ hauteur réelle 3D ; **sommet de la tête chauve = vertex du visage 2D** (étirement `Y0` retiré : +0,051 → +0,001 U, `SKULL-ENLARGEMENT.md`) | tête COIFFÉE : étirement et épaisseur de la planche conservés (§5 de `SKULL-ENLARGEMENT.md`) ; en 2D le sommet reste lié à H : `vaultHeight` n'y change que la plénitude de la voûte |
| Glabelle | ✅ relief médian | interaction avec les arcades (relief latéral) ; peau mince modélisée par la seule transmission |
| Sutures et lignes | ⚠️ sillons / crêtes fins | reliefs persistants (crête métopique, carène sagittale), diastasis, formes pathologiques (craniosynostoses) |
| Tissus | ⚠️ une carte d'épaisseur par région ; transmission désormais **exponentielle** (`vault-tissue.ts`, identique à l'ancien calibrage à `scalp` = 0,5) | `mastoid × scalp` : **5 paires voisines perceptibles sur 12** (4 avant). Limite physique : à `mastoid` = 1 l'amplitude au centre passe de 0,028 à 0,0206 puis 0,0150 U pour `scalp` 0,05 / 0,5 / 0,95 (≈ 1,7 mm de relief entre deux cellules), sous le seuil visible à 300 px ; je n'ai pas baissé le seuil. Âge, embonpoint, cuir chevelu rasé / dense ; volume de cheveux 3D de l'hôte sur voûtes extrêmes : **non rendu** (cheveux : autre agent) |
| Contraintes | ⚠️ 2 strictes, 6 préférences | table complète des impossibilités (ex. relief maximal toléré selon l'épaisseur de tissu) |
| Corrélations | ❌ 6 tendances posées a priori | **non calibrées : aucune base de mesures crâniennes n'existe dans le dépôt** et je n'invente pas de chiffres. Il faut un fichier de mesures (largeur, longueur, hauteur, indices) puis un script de calibrage ; `generateRandomProfile` ne tire pas encore la voûte par défaut (option `vault`) |
| Familles | ⚠️ combinaisons posées à la main | l'axe `length` (existant) reste borné (`cranialLength`) : la diversité dolicho / brachy vient surtout de `cranialBreadth`, `occipitalFlat`, `templeBreadth` |
| Vue 2D du profil | ⚠️ lit 9 mesures + la forme de la mastoïde | détail dans `SKULL-PROFILE-2D.md` : les mesures de largeur seule n'y ont pas d'effet par nature ; sutures et `boneShow` non dessinés en profil |
| Hors périmètre | — | `thyroid`, `napeHairline` (cou, cheveux) : aucun effet mesuré sur la tête chauve ; `neck*` : voir `HEAD-TURNTABLE-REMAINING.md` |

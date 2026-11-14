# Voûte crânienne — ce qui reste à faire, par composant

Tout ce qui est écrit ici n'est **pas fait** ou **fait partiellement**. Ce qui est fait est dans `SKULL-VAULT.md`, prouvé dans `SKULL-VAULT-VALIDATION.md`.

| Composant | État | Reste à faire |
|---|---|---|
| Os frontal | ✅ pente, bombé, plat, largeur | éminences frontales latérales (bosses) et arcades sourcilières latérales : seule la glabelle médiane est modelée ; `browRidge` (existant) n'a qu'un effet faible en 3D (≈ 0,2 % de silhouette, ≈ 2 % d'ombre en 3/4) |
| Pariétaux | ✅ bombement, aplatissement, convexité | **position** de l'éminence (hauteur 0,24 U, azimut 112° : constantes) à rendre paramétrable |
| Temporaux | ✅ largeur, aplatissement, creux | arcade zygomatique et volume du muscle temporal (seule son épaisseur atténue le relief) ; ligne temporale seulement via `suturesShow` |
| Occipital | ✅ plat, incliné, projection, inion | chignon occipital ; protubérance externe d'amplitude propre (aujourd'hui lue sur le paramètre existant `inion`, ±0,007 U) |
| Mastoïde | ⚠️ saillie seulement | **forme** de la région (taille, direction, pente) : demandée au §4 du TODO, non faite |
| Ptérion / astérion | ⚠️ | le ptérion règle les exposants de transition ; l'astérion n'est qu'un repère (donnée) sans relief ni paramètre |
| Vertex | ✅ hauteur réelle 3D | en 2D (`src/skull/vault.ts`, profil) le sommet reste lié à H (sommet → menton) : `vaultHeight` n'y change que la plénitude de la voûte, pas sa hauteur absolue |
| Glabelle | ✅ relief médian | interaction avec les arcades (relief latéral) ; peau mince modélisée par la seule transmission |
| Sutures et lignes | ⚠️ sillons / crêtes fins | reliefs persistants (crête métopique, carène sagittale), diastasis, formes pathologiques (craniosynostoses) |
| Tissus | ⚠️ une carte d'épaisseur par région | âge, embonpoint, cuir chevelu rasé / dense ; matériau de la peau (texture) non spécialisé par couche ; cheveux : la lisière peinte suit le maillage (preuve : `cheveux-suivent-la-voute.png`) et le volume 3D de l'hôte (`hair-shell.ts`) lit `skullSurfacePoint`, donc la voûte, mais je ne l'ai **pas rendu** sur voûtes extrêmes (chaîne hôte non exercée ici) |
| Contraintes | ⚠️ 2 strictes, 6 préférences | table complète des impossibilités (ex. relief maximal toléré selon l'épaisseur de tissu) |
| Corrélations | ⚠️ 6 tendances posées a priori | à calibrer sur des mesures ; `generateRandomProfile` ne tire pas encore la voûte par défaut (option `vault` : voir `SKULL-VAULT-VALIDATION.md`) |
| Familles | ⚠️ combinaisons posées à la main | l'axe `length` (existant) reste borné (`cranialLength`) : la diversité dolicho / brachy vient surtout de `cranialBreadth`, `occipitalFlat`, `templeBreadth` |
| Vue 2D du profil | ❌ | les nouvelles mesures ne sont lues que par la 3D (turntable), pas par le dessin de profil de `src/skull/` |
| Hors périmètre | — | `thyroid`, `napeHairline` (cou, cheveux) : aucun effet mesuré sur la tête chauve ; `neck*` : voir `HEAD-TURNTABLE-REMAINING.md` |

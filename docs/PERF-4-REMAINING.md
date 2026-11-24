# PERF-4 — ce qui n'est PAS fait ou reste ouvert

| Sujet | État | Détail chiffré / raison |
|---|---|---|
| **Flous → textures précalculées** | NON IMPLÉMENTÉ (mesuré) | La figure porte 72 filtres `feGaussianBlur` : 57 sur des `path` arbitraires (surtout les flous du nez, σ de 0,9 à 6,8, médiane 2), 13 sur des groupes de `path`, 2 sur des ellipses. Ils coûtent 19 ms (380 px), 46 ms (760 px), 146 ms (1 520 px) = 24–34 % de la rastérisation, soit ≈ 6 % du premier rendu à 1 520 px. Les remplacer exige de rasteriser (anti-crénelage, dégradés, mode de fusion) puis flouter ces tracés en JS : au premier rendu le coût JS égale ou dépasse celui du filtre, et l'équivalence de qualité n'est pas démontrée. Le gain n'existerait que par réutilisation (même figure rastérisée plusieurs fois). À faire avec `figureEquivalence` comme juge, en commençant par les 2 ellipses (dégradé radial) puis les flous du nez. |
| Flous « boîte » du JS (`blur` de l'ombre) | laissés | 1,3 % du profil : rien à gagner |
| G-buffer du corps | premier poste restant | 750 ms (1 100 px, à froid) : maillage + rasterisation des triangles. Pistes : rasterisation incrémentale (changerait les bits : à valider par `figureEquivalence`), maillage partagé entre caméras |
| `head.field` (relief) | 303 ms | calcul par pixel de la surface de la tête ; non retouché |
| `head.cast` exact | 396 ms | borne d'arrêt exacte déjà posée ; une analyse de l'horizon n'est pas exacte à cause de la pénombre croissante. L'option `headCastScale: 2` couvre le besoin d'un aperçu rapide |
| Rendu à froid 2,4 s | pas « drastique » | −37 % à identité exacte ; ×3,7 quand seule la lumière change. La barre des 1 s à froid n'est pas atteinte sans approximation |
| Garde `resvg` | partielle | branchée à `scripts/lib/raster.ts` et `scripts/render.ts` ; PAS à `src/hair-grammar/render-fast.ts` (SVG d'une cellule de cheveux) ni aux ≈ 60 `new Resvg` ponctuels des scripts d'artefacts |
| Cause exacte du plantage `resvg` | déduite, pas lue | trace `geom.rs:27 unwrap() on None` et seuils mesurés ; le code de `resvg` n'a pas été lu. Si `resvg` corrige le défaut, le contrôle négatif de `tests/offcanvas.test.ts` échouera : signal pour retirer la garde |
| Immuabilité du jeu de volumes | prouvée côté moteur, non imposée aux appelants | `tests/figure-immutable.test.ts` : le moteur ne modifie ni le jeu (gelé en profondeur) ni les tampons de la tête. Un appelant qui mute un jeu après un rendu servirait un G-buffer périmé (le cache le désigne par identité) |
| `HeadLitOpts.ao / reach / fadeNeck` | non exposés par `litFigure` | inatteignables depuis ce pipeline ; à exposer ou à retirer |
| Paramètres de forme du crâne et voisins | non re-balayés | couverts par les contrats existants, pas par ces preuves |
| Suite complète du dépôt | faite : 4 009 passés, 3 échoués (226 fichiers) | les 3 échecs sont ANTÉRIEURS à ce travail (identiques sur l'état d'origine `ddbbad4`) : `eye-gallery-ext3` (tirages), `highlights-system` (schéma des reflets), `nose-visibility` (référence figée périmée, même hash de SVG avant et après mon travail). Non corrigés ici |
| Mémoire des caches | non plafonnée en octets | 2 G-buffers ≈ 200 Mo à 1 100 px ; borne en entrées, pas en octets |

# Audit des huit principes du moteur de rotation + revue du compilateur du nez (18 nov. 2026)

Méthode : chaque principe est une MESURE sur le moteur réel (`tests/nose-principles.test.ts`, 8 tests, tous verts), pas une relecture du code. Un écart trouvé est affirmé tel quel par le test : s'il disparaît, le test échoue et cette page doit être mise à jour.
Légende : ✅ tenu et mesuré · 🟡 tenu avec une exception documentée · ⬜ non vérifié ici.

| # | Principe | Verdict | Mesure |
|---|---|---|---|
| 1 | Une rotation n'est pas un dessin | ✅ | `buildParts(spec)` ne prend aucune vue (empreinte identique avant/après) ; lacet 0° et 50° donnent des images qui diffèrent (> 2 % des pixels) à partir du MÊME maillage, avec profondeur réelle par pixel |
| 2 | La géométrie n'est pas le rendu | 🟡 | Vérifié dans un sens seulement : changer l'éclairage ne change ni maillage ni silhouette (principe 7). Que certains composants soient « dessinés en 2D tout en gardant des coordonnées 3D » (yeux, bouche de face) n'est pas audité ici |
| 3 | La caméra n'est pas le personnage | ✅ | 30 vues (lacet 0–348°, tangage −24…+24°) : `JSON(spec)` et empreinte du maillage inchangés |
| 4 | Rotations hiérarchiques | ✅ | Avec un roulis de 20° : base du cou immobile (< 1e-9), sommet du cou fléchi (> 1e-3), la tête garde son degré de liberté propre (≠ celui du cou) |
| 5 | La projection ne détruit pas la géométrie source | ✅ | `rasterize` ×4 vues : empreinte des maillages inchangée |
| 6 | L'occultation doit être calculée | 🟡 | ✅ Inverser l'ORDRE des pièces ne change pas l'image (< 0,05 % des pixels à 0°, 45°, 70°) : c'est le tampon de profondeur qui décide. **Exception mesurée** : `cullFarEar` (`engines/ear-cull.ts`) OMET l'oreille lointaine par règle entre ≈ 8° et 35° (convention de la planche) ; effet mesuré à 10° : 34 à 112 pixels, uniquement de l'identifiant oreille ; 0 à 3 pixels à 20°, 0 à 30° et à 0° sur les têtes testées (3 têtes) |
| 7 | Le style est une donnée de première classe | ✅ (périmètre limité) | Deux éclairages (`three-quarter-right` et planche) : identifiants de pièce identiques (0 pixel de différence), SVG différents. Non audité : le profil de stylisation du visage (`src/face/stylize`) |
| 8 | Angles intermédiaires obligatoires | ✅ | Balayage 1°…90° avec des lacets non entiers (+0,37 ; +0,74) : aucun NaN (hors charge PNG) ; plus grand changement d'identifiants entre deux vues voisines **0,97 % des pixels à 38°**, moyenne 0,52 % (cadre 140 px) — pas de saut, le rendu est continu |

Points qui restent faux ou ouverts, dits sans détour :
- L'oreille lointaine omise (6) contredit « l'ordre/la règle ne suffit pas » : c'est une règle de dessin, pas un calcul. Elle reste parce que la planche de référence ne montre pas l'oreille lointaine à ces angles ; la rendre calculée demanderait un maillage d'oreille réaliste vu de dos (non fait).
- Le contour du nez n'est borné qu'à tangage 0 (voir `NOSE-YAW-BOUNDS.md` §5) : le principe 8 « continu » vaut pour le lacet, PAS pour le tangage.
- Principe 2 : audit incomplet (voir tableau).

## Revue du compilateur du nez : pas de compilateur propre au nez
Fait vérifié (lecture de `src/render/registry.ts`) : **un registre de compilateurs existe déjà** (`COMPILERS`, type mappé exhaustif, 10 `kind` : `eye`, `robot_eye`, `panel`, `host`, `compound_eye`, `gem_eye`, `head_lit`, `head_profile`, `head_3d`, `body`) ; `compile.ts` ne contient plus de `switch`. Ajouter un composant = 1 schéma + 1 entrée + 1 ligne dans l'union de `schema/scene.ts`.
Décision pour le nez : **non nécessaire, aucune entrée ajoutée.** Raisons mesurables : (1) le nez n'est pas un `kind` de scène, c'est un bloc de paramètres du `host` (`spec.nose`) rendu par `compileHost` (face) et `compileHead3d` (3D) ; (2) il dépend de la géométrie du visage, de la peau et de la lumière de l'hôte : un compilateur séparé dupliquerait ces entrées ; (3) tout ce qu'il calcule est en fonctions pures testées (`alaSeat`, `alaOverflow`, `frontWidthRatio`, `noseView`). À reconsidérer si un nez doit être posé sur un hôte non-visage (créature, robot) : il deviendrait alors un enfant à instancier, comme `eye` avec son `host`.

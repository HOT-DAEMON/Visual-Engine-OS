# État d'avancement par composant : fait · partiel · reste à faire

Légende : ✅ fait et testé · 🟡 partiel (limite nommée) · ⬜ non fait. Les numéros T1–T16 sont ceux de `docs/TODO-FACE.md`.
Honnêteté d'abord : ce moteur est un moteur 2D de visage vu de FACE. Les volumes sont des régions géométriques éclairées par ombrage, pas un maillage 3D.

## T1 · Nez, régions — ✅ (12 régions) 🟡 rendu
- ✅ les douze régions sont des objets de géométrie (`noseGeometry().regions`) avec contraintes (`constraints.ts`).
- 🟡 la PROJECTION de la pointe se lit mal de face : elle agit sur la longueur dorsale et les ombres, pas sur un profil.
- ⬜ vue de trois quarts et de profil (les régions existent, leur projection latérale non) ; ⬜ narines vues de dessous ; ⬜ asymétrie des ailes comme région ; ⬜ bosse osseuse volumétrique ; ⬜ cartilage supra-alaire.

## T2 · Axes du nez dissociés — ✅
- ✅ sept axes mesurés indépendants (test : moins de 2 % de fuite). ✅ cinq contraintes dont une déclarée mais jamais active (philtrum, schéma déjà borné).
- 🟡 la projection est un rapport à la longueur (choix anatomique hérité) : son équivalent en pixels suit la longueur.

## T3 · Mâchoire (7 régions) — ✅ géométrie 🟡 rendu
- ✅ branche, angle, corps, bord inférieur, préauriculaire, masséter, joues recouvrantes exposés. 🟡 « profondeur » de la mandibule : lisible seulement par l'ombre (pas de profil).

## T4 · Mandibule sans déformer le crâne — ✅ (6 axes testés : contour du sommet à la tempe identique).
- ⬜ asymétrie latérale du contour (mâchoire de travers) : `jawShift` ne déplace que dents et lèvre, pas le contour.

## T5 · Menton — ✅ 9 contrôles. 🟡 hauteur bornée par la place sous la lèvre (ne peut que diminuer). ⬜ menton en « galoche » (prognathisme) de profil.

## T6 · Tissus mous / largeur décomposée — ✅ os, muscle, graisse, silhouette. 🟡 muscle et graisse élargissent symétriquement (pas de graisse asymétrique, pas de double menton sculpté).

## T7 · Bouche — ✅ tous les éléments individualisés. 🟡 dents = bandes (pas d'incisives individuelles), langue = ellipse, gencive = bande. ⬜ lèvres roulées, dents de travers, piercing, lèvre fendue.

## T8 · Joues, sillons, plis — ✅ volumes + plis déplacés par un champ de tissu, aire conservée. 🟡 champ à 6 noyaux (commissures, joues, lèvres) : pas de muscles individuels. ⬜ rides d'expression du bas du visage hors sillons (plis du menton, pattes d'oie).

## T9 · Cou — ✅ angle, ombre, platysma, muscles, menton ≠ cou. 🟡 l'inclinaison de la tête ne tourne pas la tête : elle ne règle que l'angle, l'ombre et la tension. ⬜ rotation de tête, pomme d'Adam, clavicules.

## T10 · Dépendances — ✅ table testée par perturbation (6 règles). ⬜ règles pour le nez et la bouche (hors ouverture) ; ⬜ propagation automatique générique (les formules sont écrites une à une).

## T11 · Articulation — ✅ skinning à deux os, poids, translation latérale, protrusion. ⬜ cycle de mastication animé, interpolation temporelle entre poses, rotation réelle de la mandibule autour du condyle (modèle : translation pondérée).

## T12 · Trois déformations — ✅ A/B/C séparées, somme, os préservé, gain de caricature. 🟡 quatre axes d'expression seulement (sourire, grimace, colère, caricature). ⬜ surprise, dégoût, dédain, bouche en « o » pour le bas du visage ; ⬜ liaison avec `mouthFor` (anciennes expressions) : les deux systèmes coexistent.

## T13 · Stylisation — ✅ 9 contrôles, neutre, idempotent, relations préservées, 3 modes de rendu. 🟡 `anime` = ombrage `cel` + bords nets, pas de contour de cheveux ; `ink` = filtre de seuil global (pas de hachures). ⬜ profils nommés enregistrés (manga, caricature, réaliste…).

## T14 · Vérification — ✅ 3 couches sur la géométrie + mesures sur l'image + tests mutation. 🟡 mesure d'image sur un visage (coûteuse : ~40 s) ; ⬜ campagne d'image sur 100 visages.

## T15 · Artefacts — ✅ `artefacts/face-structure/` (planches rendues, jamais retouchées). ⬜ planche de profil et de trois quarts.

## T16 · Docs — ✅ fichiers ≤ 200 lignes, suites `FACE-STRUCTURE-*.md`, `ERRORS-5.md`, `CHANGELOG-6.md`.

## Génération aléatoire
✅ `generateRandomFace(seed, { structure: true })` : axes de structure tirés dans un flux dérivé (les visages `classic` ne bougent pas). ⬜ tirage de `deform` et de `stylization`.

## Performance
🟡 un rendu structuré coûte ~10–35 s par cellule 340×420 sur un cœur (nombreux flous SVG). ⬜ mutualiser les filtres de flou par sigma.

## Documentation « ligne par ligne »
🟡 chaque fonction, chaque bloc de calcul et la plupart des instructions sont commentés en français (contrat en tête de fichier) ; ce n'est pas littéralement une ligne de commentaire par ligne de code (les lignes triviales : imports, accolades, retours, ne le sont pas).

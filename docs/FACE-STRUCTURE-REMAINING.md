# Ce qui reste à faire, par composant

Mis à jour après la session « performance, contrats, régression visuelle ». Légende : ⬜ non fait · 🟡 partiel. Chaque ligne dit
POURQUOI ce n'est pas fait. Les tâches faites sont dans `docs/FACE-STRUCTURE-STATUS.md`.

## Nez (T1)
- ⬜ Vues de trois quarts et de profil : les régions existent, leur projection latérale non (aucun moteur de vue latérale).
- ⬜ Narines vues de dessous, asymétrie des ailes comme région, bosse osseuse volumétrique, cartilage supra-alaire.
- 🟡 `nose.tip.projection` ne change aucune mesure de forme de face (agit sur l'ombrage) : le cas difficile 09 le garde sous contrôle.
- ⬜ Règles de perturbation dédiées (T10) : la carte d'influence et le résolveur les couvrent en partie.

## Mâchoire et menton (T3, T5, T6)
- ⬜ Asymétrie latérale du contour (`jawShift` ne déplace que dents et lèvre) : demande un déplacement du contour par côté et de nouvelles relations.
- ⬜ Menton en « galoche » de profil ; ⬜ graisse asymétrique, double menton sculpté.
- 🟡 Zone morte `jawWidth` ≥ 0,9 quand masséter et graisse sont au maximum (cas 02) : documentée, non corrigée.
- 🟡 Hauteur du menton bornée par la place sous la lèvre (`chin-height-room`, enregistrée mais ne peut que diminuer).

## Bouche (T7, T12)
- ⬜ **Bouche écrasée dans une mâchoire étroite (cas 01, 45 → 12,6 px)** : mesurée et signalée (`contract-no-crushed-request`), pas corrigée ;
  la correction demande de choisir entre élargir le contour à la hauteur de la bouche et réduire la convergence de la mâchoire.
- 🟡 Plage de `mouth.width` : la moitié supérieure est inerte sur le visage par défaut ; sur 100 tirages, `mouth-inside-contour` corrige 53 visages. Resserrer la plage du schéma ou assouplir l'80 % est une décision de conception, non prise.
- ⬜ Incisives individuelles (dents = bandes), langue (ellipse), lèvres roulées, dents de travers, piercing, lèvre fendue.
- 🟡 Dédain symétrique et discret ; ⬜ liaison avec `mouthFor` (anciennes expressions, deux systèmes coexistent).

## Joues, plis, cou (T8, T9)
- ⬜ Muscles individuels (champ de tissu à 6 noyaux) ; rides d'expression hors sillons.
- ⬜ Rotation réelle de la tête, pomme d'Adam, clavicules (l'inclinaison règle seulement angle, ombre, tension).

## Articulation (T11)
- ⬜ Mastication animée, interpolation entre poses, rotation de la mandibule autour du condyle (modèle : translation pondérée).

## Stylisation (T13)
- 🟡 `anime` = `cel` + bords nets, sans contour de cheveux ; `ink` = seuil global, sans hachures.

## Contrats et mesures
- 🟡 52 paramètres géométriques sans mesure (`artefacts/contrats/influence.json`), surtout de l'ombrage.
- ⬜ Direction de chaque effet vérifiée seulement pour 7 paires (`MONOTONE`).
- ⬜ Propagation automatique générique.

## Performance
- ⬜ Pas de cache entre visages différents ; ⬜ pores et grain de peau couvrent toute la boîte de la tête (~180 ms chacun).
- 🟡 Mesures sur un seul type de machine.

## Régression visuelle et vérification
- ⬜ Aucune référence de profil / trois quarts (non implémentés). ⬜ Pas de SSIM. Seuils à recalibrer avec un corpus plus grand.
- ⬜ **Deux défauts préexistants du moteur de cheveux** : mèche frôlant la bouche (graine 46), oreille couverte (graine 81) — cas 17 et 18.
- ⬜ Le budget de 160 filtres est un seuil d'alerte choisi sur la médiane mesurée (≈ 100), pas un seuil de qualité.

## Hors périmètre de cette session
- `docs/TODO EAR SYSTEM.md` (285 lignes) découpé sans modification en `TODO EAR SYSTEM.md` (sections 1–2.3) et `TODO EAR SYSTEM-2.md` (3–10), tous deux < 200 lignes. Le système d'oreilles lui-même n'est PAS commencé.

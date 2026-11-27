# Moteur capillaire — reste à faire après la passe 11, par composant

Bilan : `HAIR-PASS11.md` ; mesure : `HAIR-MEASURE.md`. Reprend `HAIR-PASS10-REMAINING.md` (inchangé pour ce qui n'est pas cité ici).
Statuts : FAIT · PARTIEL · NON FAIT (raison) · DÉCIDÉ DE NE PAS FAIRE (raison). Rien n'est « fait » sans preuve (tests, planches, JSON).

## Coupes
- Hime : FAIT (données + G/A/S 22/24 ; frange à bord franc mesurée à 0,03 H d'écart de la lecture de la référence 47). PARTIEL au sens rendu : petits
  « picots » en haut du dôme (mèches étroites qui dépassent la calotte) ; les mèches qui descendent sous le menton sont coupées net au bas du cadre de la
  planche de mesure (canevas plus haut que la ROI du moteur, 235 px). NON FAIT : version à chignons doubles (réf. 47 porte deux chignons) — le
  générateur n'a pas d'attache.
- Pixie à frange balayée : FAIT (21/24). PARTIEL : le dessus peut ressembler à un nœud de mèches foncées (zone d'ombre au tourbillon) sur certaines graines.
- Pixie FIDÈLE à la référence 32 (front nu, épi haut) : NON FAIT, bloqué par `anat.dome` (voir Vérification).
- Carré (`bob`) sous-dimensionné d'environ 35 % en hauteur et 31 % en largeur par rapport à la référence 06 (mesuré, `HAIR-MEASURE.md`) : NON FAIT.
  Pistes : gonfler `lift`, `width` et le nombre de mèches de calotte, puis remesurer. Ce n'est pas fait ici pour ne pas régresser les 47/48 de la passe 10.
- Autres coupes des références (04 chignons, 28, 50 ; queue de cheval, tresses, afro) : NON FAIT, voir Intégration / attache.

## Vérification
- `anat.dome` (calotte = ellipse au-dessus de la ligne des yeux −0,12 H, couverture exigée ≥ 0,7 − 0,25·vent) compte le front dans la calotte : une coupe à front nu
  n'est pas atteignable. NON MODIFIÉ sans accord : changer ce seuil change toutes les coupes existantes. À décider : exempter le front quand la famille
  de frange déclare un front dégagé.
- Échecs restants (5/48) : hime +30° g.5 et g.6 (micro-trous, 0,89) ; pixie 0° g.7 (trous, 0,87), +30° g.2 (dominante/seconde 1,12), +30° g.7
  (axes qui se coupent « sans programme »). NON FAIT : `repair.ts` n'a pas de correction pour les trous parasites ni pour la hiérarchie globale.
- Le vérificateur de style ne mesure pas la ressemblance à une référence : NON FAIT. Les descripteurs de `measure-cuts.py` en sont la base (bas de frange,
  retombée latérale, étendues) mais ils ne sont pas branchés comme contrôle.
- Tests : les combinaisons (graine, lacet) épinglées sont celles qui passent ; pas de test sur la fraction d'échecs (instable d'une graine à l'autre).

## Mesure des références
- Réf. 47 : la règle ne capte que la frange teinte ; sommet, étendues et retombée LUS ou absents. Réf. 32 : vue 3/4, axe incertain, `fringe_bottom` inutilisable.
- Réf. 06 : `outer_only` (le visage est dans le masque). Refaire la segmentation par modèle de segmentation de cheveux (ex. SAM/matting) si une dépendance
  est acceptée ; non fait ici (pas d'accès réseau hors registres, éviter une boîte noire).
- Ancres posées à la main (±5 px) : NON FAIT, détection automatique des yeux/menton.

## Intégration
- Le flux de production (`renderHair`) ne génère pas de mèches de grammaire ; `HIME` et `PIXIE` ne servent qu'aux artefacts, scripts et tests. NON FAIT (comme passe 10).
- Seul le lacet (±60°) est exercé ; roulis, tangage et vent non validés sur ces coupes. Barbe, moustache, teintes (`rootColor`) non testées.
- Attache (queue, chignon) et mèches en tresse : nouveaux types de géométrie, NON FAIT.

## Dette préexistante (non traitée, hors périmètre)
- `src/hair-grammar/profiles/bob.ts` ligne 15 : propriété `lift1` dupliquée (erreur tsc TS1117). Corrigeable en une ligne ; non touché car modifierait le rendu du carré.
- `scripts/artefacts-figure-perf.ts` importe des modules de `/tmp/orig/...` absents (TS2307).

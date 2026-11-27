# Moteur capillaire — reste à faire après la passe 10, par composant

Bilan : `HAIR-PASS10.md`. Reprend `HAIR-PASS9-REMAINING.md` (inchangé pour tout ce qui n'est pas cité ici).
Statuts : FAIT · PARTIEL · NON FAIT (raison) · DÉCIDÉ DE NE PAS FAIRE (raison). Rien n'est « fait » sans preuve (tests, planches, JSON).

## Coupes
- Carré (`bob`) et shag : FAIT au sens données + vérification G/A/S (47/48) ; PARTIEL au sens rendu (calotte trop bruitée, voir ci-dessous).
- Pixie : NON FAIT, NON POUSSÉ. Profil écrit puis retiré. Constats : verdict de vérification instable d'une graine à l'autre (comptes exacts non conservés, à remesurer) ; la frange en plaque traverse le front ; le bloc latéral au-dessus de l'oreille est anguleux ; la couleur claire délave les détails. Pistes : mèches de frange plus nombreuses et plus étroites, familles latérales très courtes mais sans `lift`, calotte plus fournie (les contrôles `anat.dome` et `style.speckle` étaient limites).
- Autres coupes lues sur les références (queue de cheval, chignon, tresses, coupe hime, afro) : NON FAIT. Le moteur de grammaire n'a ni attache (queue, chignon) ni mèches en tresse ; ce sont de nouvelles primitives, pas de simples profils.

## Calotte (sommet de la tête)
- Nœud de mèches au tourbillon (lu comme un ruban posé sur la tête), surtout sur le shag : PARTIEL. Atténué par la famille `crown`, pas supprimé. Cause probable : toutes les racines de la calotte convergent vers le même point (`field.whorl`) et leurs lames se recouvrent. NON FAIT : tester un tourbillon décalé ou une raie qui sépare deux flux.
- Aspect « chou-fleur » (beaucoup de petites feuilles) : NON FAIT. Il faudrait des mèches de calotte plus larges et moins nombreuses avec un recouvrement réglé, ou le regroupement en paquets de 3 à 5 mèches déjà listé en passe 9.

## Frange
- Frange sans forme nette sur le bob (lecture « rideau » absente) : NON FAIT. Aucune famille ne modélise une frange pleine qui s'arrête à une ligne de sourcils ; ce serait une contrainte de longueur par rapport au repère des sourcils.

## Vérification
- Un cas sur 48 échoue (bob, lacet −30°, graine 5 : rapport dominante / seconde). NON FAIT : le solveur de réparation (`repair.ts`) n'a pas de correction pour `style.hierarchy` global ; seule une retouche de profil ou de graine le résout.
- La vérification valide la géométrie, l'anatomie et la hiérarchie des masses ; elle ne mesure pas la ressemblance à la référence. NON FAIT : comparer silhouette et masse de cheveux à celles des images de `references/hair` (extraction de masque + IoU de silhouette).
- Aucune mesure numérique des références (hauteur de calotte, longueur de retombée, position de la raie) : NON FAIT, c'est la base d'un étalonnage honnête des paramètres de profil.

## Intégration
- Le flux de production (`renderHair`) ne génère toujours pas de mèches de grammaire ; `BOB` et `SHAG` ne sont utilisés que par les artefacts et les tests. NON FAIT (même point qu'en passe 9).
- Les profils utilisent `DEFAULT_HEAD` ; le vent, le roulis et le tangage ne sont pas validés sur ces coupes (lacet seul, ±60°). NON FAIT.
- Barbe, moustache et couleurs teintes (`rootColor`) : non testées avec ces coupes.

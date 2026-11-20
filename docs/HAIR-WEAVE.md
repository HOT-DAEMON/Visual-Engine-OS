# Moteur capillaire — auteur d'entrelacs (`weaveStrands`)

Code : `src/hair-grammar/weave.ts` · `curve-program.ts` (segment `weave`) · `lock.ts` (`rootShell`, décollement) · `occlusion.ts` (correspondance appariée, coupes adaptatives)
Tests : `tests/hair-engine-weave.test.ts` (13) · preuve : `artefacts/hair-engine-pass2/01-entrelacs.png`.

## Constat
`HAIR-OVERLAP.md` listait : « le moteur ne sait pas AUTEURISER un entrelacs ». L'onde `wave` dérive d'un seul côté ; la tresse des artefacts 04 utilisait des lames fabriquées.
Vérifié : aucun `weave` ni `weaveWith` dans `src/hair-grammar` avant cette passe.

## Principe
Un entrelacs n'est pas un ordre de calques : c'est une géométrie. Deux brins de phases décalées oscillent latéralement ET en profondeur ; l'occlusion locale LIT cette alternance.
- Segment `weave { len, amp, freq, phase, lift }` : le cap oscille autour de l'axe, θ(u) = amp·(cos(2π(f·u+φ)) − cos(2πφ)) → θ(0) = 0 (continuité), net nul sur un nombre entier de périodes ; le cap absolu est centré.
- Décollement `segLift = lift·√sin(πu)·cos(2π(f·u+φ))` : nul aux deux bouts (pas de saut de profondeur), de signe opposé pour deux brins en opposition de phase (φ et φ+½).
- `weaveStrands(head, base, {strands, spread, freq, lift, group?})` → `LockSpec[]` (`id = base.id-sK`, étiquette commune `weave`, phase k/n, amplitude `clamp(2π·f·spread/longueur, 0, 1,1)`, racine décalée sur la coque via `toShell`).
- Déterministe : mêmes entrées → mêmes brins (comparaison JSON).

## Corrections du résolveur d'occlusion (découvertes en testant)
- Les brins entrelacés étaient classés « overlap » : le point le plus proche de A sur B donnait une étendue nulle (plateau). Correction : `runs` mesure l'étendue des points proches sur l'intervalle, et, pour un même groupe `weave`, utilise la correspondance au MÊME paramètre t (`paired`).
- Au premier croisement, le mauvais brin était visible : un tronçon (≈ 5 échantillons) contenait le croisement et le renversement suivant. Correction : `resolveOrder` coupe aussi aux bornes des intervalles forts (`marks`), en plus des PIECES uniformes.

## Preuves
- 2 brins, lift 0,03 : relation `cross`, intervalles forts alternés (a puis b), ordre entrelacé ; rendu : la couleur visible ALTERNE aux croisements (rouge/bleu).
- ABLATION : lift 0 → mêmes brins, `overlap`, aucun entrelacé, le même brin devant à tous les croisements.
- 3 brins (tresse) : 3 paires `cross`, les trois entrelacées (`cross+cross+cross`, métriques).

## Reste à faire (non fait)
1. Tresse « fermée » : pas de nœud/élastique de pied ni de resserrement à la racine ; les brins se séparent librement en pointe.
2. Largeur constante par brin : pas de compression au croisement (un vrai brin s'aplatit quand il passe dessous).
3. Entrelacs à plus de 3 brins : non testés ; la correspondance appariée suppose des brins de longueur égale (même t).
4. Entrelacs sur une chevelure complète (`composeHair`) : pas de famille « tresse » dans les profils ; `weaveStrands` s'appelle à la main.
5. Le mode `all` du résolveur reste non fiable sur cheveux denses (voir `HAIR-OVERLAP.md`) : seul `weave` et `emerge` imposent l'ordre résolu.
6. Ombre de contact au croisement : trait simple, pas d'occlusion ambiante.

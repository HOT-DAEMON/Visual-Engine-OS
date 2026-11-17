import type { Vec } from '../../geometry/eye/primitives';
import type { HairGeometry, HairLock } from '../hair/types';
import type { Poly } from '../poly';
import { densify } from './densify';
import { poseLinked } from './hair-pose-lines';
import { poseLock, rowCache } from './hair-pose-strand';
import type { Skull } from './skull';

/**
 * CHEVEUX 2D SOUS POSE (`docs/ROTATION-STEP-04-HAIR-2D.md`, première tranche : les MASSES). La grammaire capillaire (`hairGeometry`) n'est pas recalculée : ses polygones de masse sont reprojetés point par point
 * avec la MÊME projection que la silhouette du crâne (`Skull.projectX`, qui lit le contour réel de la tête) ; les ordonnées ne changent pas (lacet seul). Le dessin reste du SVG 2D : aucun maillage, aucune coque.
 * Sont posés : la sous-couche `base`, la masse arrière `backBase`, les silhouettes d'étage `tierMasses`, la masse simulée `simMass`, et les entrées de `front` / `back` / `over` qui ne sont PAS une mèche (la base et les
 * bases de frange ; l'identité des objets est conservée, une même forme reste une même forme). Les MÈCHES (`locks`), ombres, zones rasées, calvitie, ligne d'implantation et attaches restent frontales : étape suivante,
 * après validation de la masse. À lacet nul la géométrie est rendue telle quelle (même objet).
 */
const MAX_EDGE_FRACTION = 0.006;
export { densify };

export function poseHairMasses(geo: HairGeometry, skull: Skull, yawDeg: number, W: number): HairGeometry {
  if (yawDeg === 0) return geo;
  const maxLen = MAX_EDGE_FRACTION * W, memo = new Map<Poly, Poly>();
  const P = (poly: Poly): Poly => {
    let hit = memo.get(poly);
    if (!hit) memo.set(poly, (hit = densify(poly, maxLen).map((q) => ({ x: skull.projectX(q.x, q.y, yawDeg), y: q.y }))));
    return hit;
  };
  const strands = new Set<Poly>(geo.locks.map((l: HairLock) => l.poly));
  const layer = (a: Poly[]): Poly[] => a.map((q) => (strands.has(q) ? q : P(q)));
  return {
    ...geo,
    base: geo.base.map(P),
    backBase: geo.backBase ? P(geo.backBase) : geo.backBase,
    tierMasses: geo.tierMasses.map((m) => ({ ...m, poly: P(m.poly) })),
    simMass: geo.simMass ? P(geo.simMass) : geo.simMass,
    front: layer(geo.front),
    back: layer(geo.back),
    over: layer(geo.over),
  };
}

/**
 * CHEVELURE COMPLÈTE SOUS POSE : masses (tranche 1), mèches (tranche 2) et éléments liés (tranche 3). Même projection partout (`Skull.projectX`) ; à lacet nul la géométrie est rendue telle quelle (même objet).
 * L'ordre et le nombre des calques `front` / `back` / `over` sont conservés (le rendu en lit la structure : base, bases de frange, mèches). Pas de maillage, pas de volume : du SVG 2D reprojeté.
 */
export function poseHair(geo: HairGeometry, skull: Skull, yawDeg: number, W: number): HairGeometry {
  if (yawDeg === 0) return geo;
  const masses = poseHairMasses(geo, skull, yawDeg, W), maxLen = MAX_EDGE_FRACTION * W;
  const rows = rowCache(skull, yawDeg), locks = geo.locks.map((l) => poseLock(l, skull, yawDeg, W, geo.ties, rows));
  const swap = new Map<Poly, Poly>(geo.locks.map((l, i) => [l.poly, (locks[i] as HairLock).poly]));
  const layer = (a: Poly[]): Poly[] => a.map((q) => swap.get(q) ?? q);
  const P = (q: Vec): Vec => ({ x: skull.projectX(q.x, q.y, yawDeg), y: q.y });
  const linked = poseLinked(geo, skull, P, (p) => densify(p, maxLen), yawDeg, W, maxLen);
  return { ...masses, locks, front: layer(masses.front), back: layer(masses.back), over: layer(masses.over), ...linked };
}

import type { Vec } from '../../geometry/eye/primitives';
import type { HairGeometry, HairLock } from '../hair/types';
import type { Poly } from '../poly';
import type { Skull } from './skull';

/**
 * CHEVEUX 2D SOUS POSE (`docs/ROTATION-STEP-04-HAIR-2D.md`, première tranche : les MASSES). La grammaire capillaire (`hairGeometry`) n'est pas recalculée : ses polygones de masse sont reprojetés point par point
 * avec la MÊME projection que la silhouette du crâne (`Skull.projectX`, qui lit le contour réel de la tête) ; les ordonnées ne changent pas (lacet seul). Le dessin reste du SVG 2D : aucun maillage, aucune coque.
 * Sont posés : la sous-couche `base`, la masse arrière `backBase`, les silhouettes d'étage `tierMasses`, la masse simulée `simMass`, et les entrées de `front` / `back` / `over` qui ne sont PAS une mèche (la base et les
 * bases de frange ; l'identité des objets est conservée, une même forme reste une même forme). Les MÈCHES (`locks`), ombres, zones rasées, calvitie, ligne d'implantation et attaches restent frontales : étape suivante,
 * après validation de la masse. À lacet nul la géométrie est rendue telle quelle (même objet).
 */
const MAX_EDGE_FRACTION = 0.006;

/** Insère des points sur les arêtes plus longues que `maxLen` : la projection n'est pas affine, une arête droite entre deux sommets éloignés serait fausse une fois projetée. */
export function densify(poly: Poly, maxLen: number): Poly {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec, b = poly[(i + 1) % poly.length] as Vec, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxLen));
    for (let j = 0; j < n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  return out;
}

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

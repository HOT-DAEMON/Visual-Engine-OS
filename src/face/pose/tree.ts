/**
 * HIÉRARCHIE DE POSE : une rotation 3D de la tête se propage de PARENT à ENFANTS ; les FRÈRES gardent leurs décalages relatifs
 * (ils sont exprimés dans le repère du parent, jamais dans celui de l'image). Un nœud peut n'hériter que d'une FRACTION de la
 * rotation de son parent (`ratio` : le cou ne tourne qu'à ≈ 55 % de la tête) et porter une rotation propre (`own` : regard, mâchoire).
 * Repère : x vers la droite de l'image, y vers le bas, z vers la caméra ; yaw > 0 = le visage se tourne vers la droite de l'image.
 */
export interface V3 { readonly x: number; readonly y: number; readonly z: number }
export interface PoseNode {
  readonly id: string;
  readonly parent: string | null;
  /** Position dans le repère du PARENT (px), à la pose neutre. */
  readonly local: V3;
  /** Part (0–1) de la rotation du parent héritée. */
  readonly ratio?: number;
  /** Rotation propre ajoutée (degrés, autour de Y). */
  readonly own?: number;
  /** Azimut de la normale de surface du composant à la pose neutre (degrés, 0 = face, ±90 = profil) : visibilité et raccourcissement. */
  readonly azimuth: number;
}
export interface Posed {
  readonly id: string;
  /** Position projetée (orthographique) et profondeur. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotation totale subie (degrés) : le composant s'y raccourcit (échelle x = cos(azimut + yaw)/cos(azimut)). */
  readonly yaw: number;
  /** Facteur de raccourcissement horizontal (0–1+) ; l'échelle verticale reste 1 (rotation autour de l'axe vertical). */
  readonly scaleX: number;
  /** Vrai si la normale fait face à la caméra (cos > 0,05). */
  readonly visible: boolean;
}

const RAD = Math.PI / 180;
const rotY = (v: V3, deg: number): V3 => ({ x: v.x * Math.cos(deg * RAD) + v.z * Math.sin(deg * RAD), y: v.y, z: -v.x * Math.sin(deg * RAD) + v.z * Math.cos(deg * RAD) });
const rotX = (v: V3, deg: number): V3 => ({ x: v.x, y: v.y * Math.cos(deg * RAD) - v.z * Math.sin(deg * RAD), z: v.y * Math.sin(deg * RAD) + v.z * Math.cos(deg * RAD) });

/** Pose de tous les nœuds (ordre quelconque : le parent est résolu à la demande). `origin` : pivot de la tête (axe du cou). */
export function poseTree(nodes: readonly PoseNode[], yawDeg: number, pitchDeg: number, origin: V3): Map<string, Posed> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const world = new Map<string, { pos: V3; yaw: number }>();
  const resolve = (id: string): { pos: V3; yaw: number } => {
    const hit = world.get(id);
    if (hit) return hit;
    const n = byId.get(id);
    if (!n) throw new Error(`nœud inconnu : ${id}`);
    let r: { pos: V3; yaw: number };
    if (n.parent === null) r = { pos: rotY(n.local, yawDeg), yaw: yawDeg + (n.own ?? 0) };
    else {
      const p = resolve(n.parent);
      // Le décalage local est tourné par la rotation HÉRITÉE du parent (fraction `ratio`), puis ajouté à la position du parent.
      const inherited = (p.yaw - (byId.get(n.parent)?.own ?? 0)) * (n.ratio ?? 1);
      const off = rotY(n.local, inherited);
      r = { pos: { x: p.pos.x + off.x, y: p.pos.y + off.y, z: p.pos.z + off.z }, yaw: p.yaw * (n.ratio ?? 1) + (n.own ?? 0) };
    }
    world.set(id, r);
    return r;
  };
  const out = new Map<string, Posed>();
  for (const n of nodes) {
    const w = resolve(n.id);
    const pr = rotX({ x: w.pos.x - origin.x, y: w.pos.y - origin.y, z: w.pos.z - origin.z }, pitchDeg);
    const c0 = Math.cos(n.azimuth * RAD);
    const c = Math.cos((n.azimuth + w.yaw) * RAD);
    out.set(n.id, { id: n.id, x: pr.x + origin.x, y: pr.y + origin.y, z: pr.z, yaw: w.yaw, scaleX: Math.abs(c0) < 1e-6 ? Math.abs(c) : Math.abs(c / c0), visible: c > 0.05 });
  }
  return out;
}

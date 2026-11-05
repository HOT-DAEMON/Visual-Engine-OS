import type { BoundaryPoint, HairBoundary, RootFrame } from './types';
import type { V3 } from './skull-surface';

const unit3 = (v: V3): V3 => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * REPÈRES DE RACINE le long de la lisière : `n` points équirépartis en longueur 3D sur le parcours fermé. Chaque repère porte la position
 * SUR le crâne, la normale de la surface et la direction d'écoulement (méridienne : tangente à la surface, du sommet vers la lisière).
 * C'est l'interface prévue pour la rotation de la tête (les repères tournent avec le crâne) et pour le vent (`windDir`).
 */
export function rootFrames(b: HairBoundary, n: number): RootFrame[] {
  const S = b.skull;
  const pts: readonly BoundaryPoint[] = b.loop;
  const P = pts.map((q) => S.point(q.y, q.az));
  const cum = [0];
  for (let i = 1; i <= P.length; i++) {
    const a = P[i - 1] as V3;
    const c = P[i % P.length] as V3;
    cum.push((cum[i - 1] as number) + Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z));
  }
  const total = cum[P.length] as number;
  const frames: RootFrame[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / n;
    while (j < P.length - 1 && (cum[j + 1] as number) <= s) j++;
    const f = ((s - (cum[j] as number)) / Math.max(1e-9, (cum[j + 1] as number) - (cum[j] as number)));
    const A = pts[j] as BoundaryPoint;
    const B = pts[(j + 1) % pts.length] as BoundaryPoint;
    // Azimut : interpolation sur le plus court chemin (le parcours traverse ±π derrière la tête).
    let da = B.az - A.az;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const y = A.y + (B.y - A.y) * f;
    const az = A.az + da * f;
    const pos = S.point(y, az);
    const normal = S.normal(y, az);
    // Méridienne vers le bas : d(point)/dy à azimut constant, rendue tangente.
    const eps = 1e-3 * (S.chinY - S.topY);
    // Différence CENTRÉE (ordre 2) : la méridienne est tangente à la surface à ~1e-6 près.
    const p1 = S.point(y + eps, az);
    const p0 = S.point(y - eps, az);
    const flow = unit3({ x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z });
    frames.push({ kind: A.kind, pos, normal, flow, u: k / n });
  }
  return frames;
}

/**
 * Direction d'écoulement d'un repère sous un VENT (vecteur monde, norme libre) : la direction naturelle (méridienne) est tirée par la
 * composante TANGENTE du vent, avec un poids `k` (0 = cheveu raide : ignore le vent, 1 = cheveu souple). Le résultat reste tangent
 * à la surface ; sa composante normale (vent qui soulève la mèche) est traitée à part par `lift`.
 */
export function windDir(f: RootFrame, wind: V3, k: number): { dir: V3; lift: number } {
  const wn = dot(wind, f.normal);
  const tangent = { x: wind.x - wn * f.normal.x, y: wind.y - wn * f.normal.y, z: wind.z - wn * f.normal.z };
  const dir = unit3({ x: f.flow.x + k * tangent.x, y: f.flow.y + k * tangent.y, z: f.flow.z + k * tangent.z });
  return { dir, lift: Math.max(0, wn) * k };
}

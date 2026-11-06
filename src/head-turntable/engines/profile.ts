import type { EngineHead } from './face-model';
import { PX, Y0, sy } from './units';

/** Profil de peau du moteur de crâne en U : ordonnée y (U), z (U, repère de la tête) ; outils pour lire la chaîne ARRIÈRE (nuque → vertex) et AVANT (vertex → menton). */
export interface PV { readonly y: number; readonly z: number; readonly id?: string }

/** Points nommés du profil (y, z en U). */
export function skinPoints(e: EngineHead): Map<string, PV> {
  const m = new Map<string, PV>();
  for (const [id, q] of e.sk.skin) m.set(id, { y: sy(q.y), z: e.fit.zPorion + q.x * PX, id });
  return m;
}

/** Chaîne ordonnée entre deux repères nommés (inclus), échantillonnée par `poly` (12 échantillons par segment). */
function chain(e: EngineHead, from: string, to: string): PV[] {
  const ia = e.sk.sil.findIndex((q) => q.id === from), ib = e.sk.sil.findIndex((q) => q.id === to);
  if (ia < 0 || ib < 0) throw new Error(`profil : repère absent (${from} ou ${to})`);
  return e.sk.poly.slice(Math.min(ia, ib) * 12, Math.max(ia, ib) * 12 + 1).map((q) => ({ y: sy(q.y), z: e.fit.zPorion + q.x * PX }));
}
export const backChain = (e: EngineHead): PV[] => chain(e, 'vertex', 'nape');
export const frontChain = (e: EngineHead): PV[] => chain(e, 'vertex', 'menton');

/** z du chaînon à la hauteur y (U) : interpolation linéaire sur la 1re traversée ; `null` hors de la chaîne. */
export function zAt(c: readonly PV[], y: number): number | null {
  for (let i = 0; i + 1 < c.length; i++) {
    const a = c[i]!, b = c[i + 1]!;
    if ((a.y <= y && y <= b.y) || (b.y <= y && y <= a.y)) { const d = b.y - a.y; return d === 0 ? a.z : a.z + (b.z - a.z) * ((y - a.y) / d); }
  }
  return null;
}

/** Maximum lisse (échelle k, en U) : évite l'angle vif entre la nuque et le plan mandibulaire. */
export const smax = (a: number, b: number, k: number): number => { const m = Math.max(a, b); return m + k * Math.log(Math.exp((a - m) / k) + Math.exp((b - m) / k)); };

export { Y0 };

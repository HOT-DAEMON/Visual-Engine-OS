import { landmarks, project, type HeadSpec, type Landmarks3, type View } from './head';
import type { V2 } from './vec';

/**
 * CALAGE d'une vue sur des repères mesurés dans une image (ici la référence) : on cherche lacet, tangage, échelle et
 * translation qui rapprochent au mieux les repères 3D projetés des points mesurés. Descente par coordonnées à pas décroissant
 * (déterministe, sans dépendance) ; renvoie aussi l'erreur résiduelle par repère (vérification géométrique).
 */
export type Targets = Partial<Record<keyof Landmarks3, V2>>;

export interface FitResult { readonly view: View; readonly rms: number; readonly residual: Record<string, number> }

export function fitView(head: HeadSpec, targets: Targets, init: View, weights: Partial<Record<keyof Landmarks3, number>> = {}): FitResult {
  const lm = landmarks(head);
  const keys = Object.keys(targets) as (keyof Landmarks3)[];
  const cost = (v: View): number => {
    let c = 0;
    for (const k of keys) { const p = project(v, lm[k]); const t = targets[k] as V2; c += (weights[k] ?? 1) * ((p.x - t.x) ** 2 + (p.y - t.y) ** 2); }
    return c;
  };
  let v = init;
  const steps: Record<keyof View, number> = { yaw: 8, pitch: 4, s: 6, tx: 6, ty: 6 };
  for (let it = 0; it < 220; it++) {
    let improved = false;
    for (const k of Object.keys(steps) as (keyof View)[]) {
      for (const sg of [1, -1]) {
        const w = { ...v, [k]: v[k] + sg * steps[k] } as View;
        if (cost(w) < cost(v)) { v = w; improved = true; }
      }
    }
    if (!improved) for (const k of Object.keys(steps) as (keyof View)[]) steps[k] *= 0.6;
  }
  const residual: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) { const p = project(v, lm[k]); const t = targets[k] as V2; const e = Math.hypot(p.x - t.x, p.y - t.y); residual[k] = e; sum += e * e; }
  return { view: v, rms: Math.sqrt(sum / keys.length), residual };
}

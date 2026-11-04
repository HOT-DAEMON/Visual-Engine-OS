import { centroids } from './silhouette';
import { hex } from './color';
import { check, layerOf, type Check, type LayerReport } from './verify-types';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';
import type { RenderAt } from './verify-geo';

const dist = (r: TurnRender, i: number, c: readonly number[]): number => Math.hypot(r.rgba[i]! - c[0]!, r.rgba[i + 1]! - c[1]!, r.rgba[i + 2]! - c[2]!);

/** Fraction des pixels d'une région dont la couleur est proche (≤ tol) de l'un des tons donnés : mesure la discipline d'aplats (cel shading). */
export function flatTones(r: TurnRender, region: number, tones: readonly (readonly number[])[], tol: number): number {
  let n = 0, ok = 0;
  for (let k = 0; k < r.w * r.h; k++) if (r.regions[k] === region && r.ids[k]) { n++; if (tones.some((t) => dist(r, 4 * k, t) <= tol)) ok++; }
  return n ? ok / n : 0;
}

/** Épaisseur médiane du trait de contour (U) : longueur des plages d'encre en partant du bord gauche de la silhouette, sur les lignes du crâne. */
export function inkWidth(r: TurnRender, ink: readonly number[]): number {
  const runs: number[] = [];
  for (let y = Math.round(r.h * 0.2); y < r.h * 0.45; y += 3) {
    let x = 0; while (x < r.w && !r.ids[y * r.w + x]) x++;
    let n = 0; while (x + n < r.w && dist(r, 4 * (y * r.w + x + n), ink) < 45) n++;
    if (n) runs.push(n);
  }
  runs.sort((a, b) => a - b);
  return runs.length ? runs[Math.floor(runs.length / 2)]! / r.ppu : 0;
}

/** Part des pixels de bord de la silhouette qui sont de l'encre : le contour est-il fermé ? */
export function outlineClosure(r: TurnRender, ink: readonly number[]): number {
  let edge = 0, inked = 0;
  for (let y = 1; y < r.h - 1; y++) for (let x = 1; x < r.w - 1; x++) {
    const k = y * r.w + x;
    if (!r.ids[k] || (r.ids[k - 1] && r.ids[k + 1] && r.ids[k - r.w] && r.ids[k + r.w])) continue;
    // pixel de bord = mélange encre/fond (antialiasing) : on teste aussi ses voisins couverts
    edge++; if ([k, k - 1, k + 1, k - r.w, k + r.w].some((j) => r.ids[j] && dist(r, 4 * j, ink) < 70)) inked++;
  }
  return edge ? inked / edge : 0;
}

/** Petits îlots d'encre (< 6 px, connexité 8, seuil large pour inclure l'antialiasing) : bruit de contour — points isolés, traits pointillés. */
export function inkSpecks(r: TurnRender, ink: readonly number[]): number {
  const seen = new Uint8Array(r.w * r.h), is = (k: number): boolean => dist(r, 4 * k, ink) < 95;
  let specks = 0;
  for (let s = 0; s < r.w * r.h; s++) {
    if (seen[s] || !is(s)) continue;
    const st = [s]; seen[s] = 1; let n = 0;
    while (st.length) {
      const k = st.pop()!, x = k % r.w, y = (k - x) / r.w; n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= r.w || yy >= r.h) continue;
        const j = yy * r.w + xx;
        if (!seen[j] && is(j)) { seen[j] = 1; st.push(j); }
      }
    }
    if (n < 6) specks++;
  }
  return specks;
}

/** COUCHE DE STYLE : fidélité de palette, aplats, trait fermé et d'épaisseur de la planche, reflets d'iris, absence de bruit d'encre. */
export function verifyStyle(s: HeadTurnSpec, at: RenderAt): LayerReport {
  const c: Check[] = [], S = 'style' as const, p = s.palette, ink = hex(p.ink), skin = hex(p.skin), shade = hex(p.skinShade), hair = hex(p.hair), hairS = hex(p.hairShade);
  const r0 = at(0), r45 = at(45), r135 = at(135);
  c.push(check(S, 'tones.skin', 'Peau en aplats : part des pixels à ±16 du ton clair ou ombré (0°)', flatTones(r0, REGION.skin, [skin, shade], 16), 0.7, 1));
  c.push(check(S, 'tones.hair', 'Cheveux en aplats : part des pixels à ±16 du ton clair ou ombré (135°)', flatTones(r135, REGION.hair, [hair, hairS], 16), 0.8, 1));
  let black = 0;
  for (const r of [r0, r45, r135]) for (let k = 0; k < r.w * r.h; k++) if (r.ids[k] && r.rgba[4 * k]! + r.rgba[4 * k + 1]! + r.rgba[4 * k + 2]! < 12) black++;
  c.push(check(S, 'pixels.black', 'Pixels noirs purs dans la tête (0,0,0 : valeur NaN peinte ; l\'encre est #493831)', black, 0, 0));
  c.push(check(S, 'ink.width', 'Épaisseur du contour (U) — planche : ≈ 0,015', inkWidth(r0, ink), 0.008, 0.022));
  c.push(check(S, 'ink.closure.0', 'Contour fermé à 0° (part du bord en encre)', outlineClosure(r0, ink), 0.9, 1));
  c.push(check(S, 'ink.closure.135', 'Contour fermé à 135° (part du bord en encre)', outlineClosure(r135, ink), 0.9, 1));
  for (const [yaw, r] of [[0, r0], [45, r45]] as const) c.push(check(S, `ink.specks.${yaw}`, `Bruit d'encre à ${yaw}° (îlots < 6 px, ≤ 6)`, inkSpecks(r, ink), 0, 6));
  const irises = centroids(r0, (i) => r0.rgba[i + 2]! - r0.rgba[i]! > 30 && r0.rgba[i + 2]! > 90, 6);
  let hl = 0;
  for (const ir of irises) {
    const cx = Math.round(r0.originX + ir.x * r0.ppu), cy = Math.round(ir.t * r0.ppu + (() => { let t = 0; while (!r0.ids.subarray(t * r0.w, (t + 1) * r0.w).some((v) => v)) t++; return t; })()), rad = Math.round(0.06 * r0.ppu);
    let found = false;
    for (let y = cy - rad; y <= cy + rad && !found; y++) for (let x = cx - rad; x <= cx + rad; x++) { const i = 4 * (y * r0.w + x); if (r0.rgba[i]! > 245 && r0.rgba[i + 1]! > 245 && r0.rgba[i + 2]! > 245 && Math.hypot(x - cx, y - cy) < rad) { found = true; break; } }
    if (found) hl++;
  }
  c.push(check(S, 'iris.highlight', 'Reflet blanc dans chaque iris à 0° (attendu 2)', hl, 2, 2));
  return layerOf(S, c);
}

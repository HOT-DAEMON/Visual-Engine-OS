import { bladeOutline, makeBlade, smoothPath, type Blade } from './blade';
import { viewRayInHead, type HeadSpec, type View } from './head';
import { localGeometry, lightScreen, LIGHT, occlusionProfile, type Light, type LockGeom } from './local-geometry';
import { walk, type LockSpec } from './lock';
import { relationsOf } from './occlusion';
import { renderResolved, type ResolvedPainting } from './occlusion-paint';
import { INK, fillOf, layerOfLock, strandLines, type PaintStyle, type PaintedLock } from './paint';
import type { V2 } from './vec';

/**
 * FINITION PICTURALE PILOTÉE PAR LA GÉOMÉTRIE LOCALE (grammaire de finition, étage 2). Là où `paint.ts` pose trois aplats, un croissant
 * fixe et une encre commune, ici chaque bande est calculée à partir de `LockGeom` (fournie par la géométrie, pas inventée) :
 *  - REFLET : ruban parallèle à l'axe, collé au bord éclairé (normale 2D · lumière), largeur ∝ exposition, étranglé quand le ruban est
 *    vu par la tranche (|cos φ|), éteint et déplacé quand on voit le dessous ; opacité réduite près d'un recouvrement (occlusion) ;
 *  - OMBRE PROPRE : bande côté opposé à la lumière, plus large quand l'exposition baisse et près des recouvrements ;
 *  - ENCRE : contour plein ; brins fins comme avant. Une mèche torsadée reçoit donc un reflet cassé, une mèche plate un reflet continu.
 */
export interface ProStyle extends PaintStyle { readonly shadow: string; readonly highlight: string }
export const INK_PRO: ProStyle = { ...INK, shadow: '#35353b', highlight: '#ffffff' };
export interface ProLock extends PaintedLock { readonly geom: LockGeom }

/** Point de la lame à l'échantillon i, position latérale u ∈ [−1, 1] (+1 = bord gauche dans le sens racine → pointe). */
const at = (b: Blade, g: LockGeom, i: number, u: number): V2 => { const p = b.spine[i] as V2; const nrm = g.normal[i] as V2; const w = b.half[i] as number; return { x: p.x + nrm.x * u * w, y: p.y + nrm.y * u * w }; };

/** Bande latérale [uc − hw, uc + hw] le long de t, aux échantillons où `hw(i) > ε`, en polygone fermé. */
function band(b: Blade, g: LockGeom, uc: (i: number) => number, hw: (i: number) => number): V2[] | null {
  const A: V2[] = []; const B: V2[] = [];
  for (let i = 0; i < g.n; i++) { const h = hw(i); if (h < 0.02) continue; const c = uc(i); A.push(at(b, g, i, Math.max(-0.96, Math.min(0.96, c - h)))); B.push(at(b, g, i, Math.max(-0.96, Math.min(0.96, c + h)))); }
  return A.length >= 4 ? [...A, ...B.reverse()] : null;
}

export function paintLockPro(h: HeadSpec, L: LockSpec, view: View, st: ProStyle = INK_PRO, light: Light = LIGHT, occ?: number[]): ProLock {
  const ray = viewRayInHead(view); const samples = walk(h, L); const blade = makeBlade(L, samples, view, ray);
  const layer = layerOfLock(L, blade); const geom = localGeometry(h, L, blade, view, light, occ); const l2 = lightScreen(view, light);
  const n = geom.n; const env = (i: number): number => Math.sin((Math.PI * i) / (n - 1)) ** 0.7;
  const twisted = !!L.program && geom.twist.some((x) => Math.abs(x) > 0.2);
  const face = (i: number): number => (twisted ? Math.abs(Math.cos(geom.twist[i] as number)) ** 1.2 : 1);
  const side = (i: number): number => { const o = (geom.normal[i] as V2).x * l2.x + (geom.normal[i] as V2).y * l2.y; return geom.backface[i] ? -o : o; };
  const parts: string[] = [`<path d="${smoothPath(bladeOutline(blade), true)}" fill="${fillOf(L.tone, st)}" stroke="${st.ink}" stroke-width="${st.lineW}" stroke-linejoin="round"/>`];
  // Ombre propre : côté opposé à la lumière ; s'élargit quand l'exposition baisse et près des recouvrements.
  const sh = band(blade, geom, (i) => -side(i) * 0.55, (i) => env(i) * (0.1 + 0.2 * (1 - (geom.exposure[i] as number)) + 0.2 * (geom.occlusion[i] as number)) * (L.tone < -0.6 ? 0.5 : 1));
  if (sh) parts.push(`<path d="${smoothPath(sh, true)}" fill="${st.shadow}" opacity="0.3"/>`);
  // Reflet : collé au bord éclairé, largeur ∝ exposition × |cos φ|, éteint sur le dessous du ruban.
  const hi = band(blade, geom, (i) => side(i) * 0.5, (i) => env(i) * (0.07 + 0.2 * (geom.exposure[i] as number) ** 2) * face(i) * (L.tone < -0.6 ? 0.6 : 1));
  if (hi) { const e = geom.exposure.reduce((a, b) => a + b, 0) / n; const back = geom.backface.filter(Boolean).length / n; parts.push(`<path d="${smoothPath(hi, true)}" fill="${st.highlight}" opacity="${Math.max(0.15, (0.35 + 0.6 * e) * (1 - 0.7 * back)).toFixed(2)}"/>`); }
  for (const line of strandLines(blade, L.strands)) parts.push(`<path d="${smoothPath(line)}" fill="none" stroke="#111" stroke-width="0.4" opacity="0.5"/>`);
  return { spec: L, blade, layer, svg: parts.join(''), geom };
}

/** Coiffure complète en finition pilotée par la géométrie locale, occlusion locale incluse (mèches émergentes et groupes de tressage). */
export function paintHairPro(h: HeadSpec, specs: readonly LockSpec[], view: View, st: ProStyle = INK_PRO, light: Light = LIGHT, mode: 'weave' | 'all' = 'weave'): ResolvedPainting & { readonly geoms: LockGeom[] } {
  const pre = specs.map((L) => paintLockPro(h, L, view, st, light)); const rel = relationsOf(pre, mode === 'all');
  const fin = specs.map((L, i) => paintLockPro(h, L, view, st, light, occlusionProfile(i, pre[i]?.geom.n ?? 40, rel)));
  return { ...renderResolved(fin, st, mode, rel), geoms: fin.map((p) => p.geom) };
}

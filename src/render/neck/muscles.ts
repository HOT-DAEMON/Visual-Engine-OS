import { clamp, clamp01 } from '../../core/math';
import { lineD } from '../face/soft';
import type { P2 } from '../../neck/types';
import type { NeckCtx } from './ctx';

/**
 * Muscles du cou (NECK-02, 03, 04) : sterno-cléido-mastoïdiens (SCM), pente des trapèzes, bandes du platysma. Chaque tracé est PLACÉ sur la surface
 * déformée par (u, ψ) — il suit donc torsion, inclinaison, asymétrie, évasement — et n'est dessiné que là où la surface regarde le spectateur
 * (`facing`). L'intensité vient de la visibilité calculée (`anatomy.ts`), jamais d'un réglage isolé ; `muscleSide` tend davantage le SCM
 * controlatéral à la rotation (côté étiré de l'inclinaison). Lumière : creux ombré côté interne, reflet du côté éclairé.
 */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** Plus longue suite de points visibles d'un tracé paramétré. */
function visibleRun(c: NeckCtx, us: number[], psiOf: (t: number, u: number) => number, lift = 0): P2[] {
  let best: P2[] = [], cur: P2[] = [];
  us.forEach((u, k) => {
    const psi = psiOf(k / (us.length - 1), u);
    if (c.facing(u, psi) > 0.1) cur.push(c.at(u, psi, lift));
    else { if (cur.length > best.length) best = cur; cur = []; }
  });
  return cur.length > best.length ? cur : best;
}
const ramp = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, k) => lerp(a, b, k / (n - 1)));

export function renderMuscles(c: NeckCtx): string[] {
  const out: string[] = [], { u: U, ra, kit, dir } = c, sep = c.sys.musculature.separation, tend = c.sys.musculature.tendonVisibility;
  const mSide = c.field('muscleSide', 0.5);
  const scm = c.vis('scm');
  if (scm > 0.03) for (const s of [-1, 1] as const) {
    const v = clamp01(scm * (1 + 0.8 * s * mSide)), lit = s * dir.x >= 0;
    const u0 = Math.min(0.9, c.jawU + 0.02), us = ramp(u0, 0.97, 16);
    const psiC = (t: number): number => lerp(s * 0.68 * Math.PI, s * 0.14 * Math.PI, smooth(t));
    const half = (t: number): number => (0.05 + 0.06 * Math.sin(Math.PI * t)) * Math.PI * (0.7 + 0.6 * v);
    const mid = visibleRun(c, us, (t) => psiC(t));
    const a = visibleRun(c, us, (t) => psiC(t) - half(t)), b = visibleRun(c, us, (t) => psiC(t) + half(t));
    if (mid.length > 3 && a.length > 3 && b.length > 3) {
      const inner = s > 0 ? a : b, outer = s > 0 ? b : a;
      // Ventre : reflet sur le côté éclairé, creux ombré le long du bord interne (séparation avec la trachée), bord externe plus doux.
      out.push(kit.stroke(lineD(mid), ra.light, (5 + 7 * v) * U * c.detail, (lit ? 0.16 : 0.07) * (0.4 + 0.9 * v) * (0.5 + 1.0 * c.sys.surface.skinTension) * c.I, 3.2 * U));
      out.push(kit.stroke(lineD(inner), c.dark, (2 + 3.5 * v) * U, clamp((0.08 + 0.34 * v) * (0.25 + 1.5 * sep) * (0.3 + 1.4 * c.sys.surface.skinTension), 0, 0.75) * c.detail, (3 - 1.8 * c.sys.surface.skinTension) * U));
      out.push(kit.stroke(lineD(outer), c.dark, (1.4 + 2.4 * v) * U, (0.05 + 0.3 * v) * sep * c.detail, 2.6 * U));
    }
    // Insertions basses : les deux chefs (sternal, claviculaire) apparaissent comme deux cordes quand le muscle est tendu / la peau tendue.
    const tv = tend * v * (0.4 + 1.2 * c.sys.surface.skinTension) * c.detail;
    if (tv > 0.06) for (const d of [-0.05, 0.06]) {
      const run = visibleRun(c, ramp(0.86, 0.985, 6), (t) => lerp(s * 0.2 * Math.PI, s * (0.1 + d) * Math.PI, t));
      if (run.length > 2) out.push(kit.stroke(lineD(run), c.dark, 2.2 * U, clamp(0.55 * tv, 0, 0.8), 1 * U));
    }
  }
  // Trapèzes : creux le long de la pente nuque → épaule (u de 0,6 à la base), reflet côté éclairé.
  const tz = c.vis('trapezius');
  if (tz > 0.03) for (const s of [-1, 1] as const) {
    const run = visibleRun(c, ramp(0.6, 0.99, 12), (t) => s * lerp(0.44, 0.4, t) * Math.PI);
    if (run.length > 3) {
      out.push(kit.stroke(lineD(run), c.dark, 3 * U, (0.07 + 0.2 * tz) * c.detail, 3 * U));
      if (s * dir.x >= 0) out.push(kit.stroke(lineD(run.map((p) => ({ x: p.x - s * 3 * U, y: p.y }))), ra.light, 2.2 * U, 0.12 * tz * c.I * c.detail, 2.2 * U));
    }
  }
  // Platysma : deux bandes minces du menton vers le haut du thorax, visibles sous tension.
  const pl = c.vis('platysma-infrahyoid');
  if (pl > 0.06) for (const s of [-1, 1] as const) {
    const run = visibleRun(c, ramp(c.chinU + 0.01, c.chinU + 0.55 * (1 - c.chinU), 8), (t) => s * lerp(0.2, 0.12, t) * Math.PI);
    if (run.length > 2) out.push(kit.stroke(lineD(run), c.dark, 1.6 * U, 0.3 * pl, 1.6 * U));
  }
  return out.filter((x) => x !== '');
}

import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import { catmullRom } from '../curve';
import type { Poly } from '../poly';
import { pt } from './plan-geom';
import type { ContourSegment, FlatMorph } from './types';

/** Points de contrôle du contour, repère CANONIQUE (u : 0 = bord antérieur → 1 = bord postérieur ; v : 0 = sommet → 1 = lobule). */
interface Ctrl { readonly id: ContourSegment['id']; readonly p: Vec }
/** Sous-points par segment de contrôle. */
export const OUTLINE_N = 8;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const LABELS: Record<ContourSegment['id'], string> = { C01: 'pôle supérieur', C02: 'bord postérieur', C03: 'bord inférieur → lobule', C04: 'bord antérieur', C05: 'tragus + incisure', C06: 'jonction oreille-joue', C07: 'jonction oreille-crâne' };

/** Contrôles du contour pour une morphologie (C07 → C01 → C02 → C03 → C06 → C05 → C04, sens horaire en repère SVG). */
export function outlineControls(m: FlatMorph): Ctrl[] {
  const h = m['pole.height'] ?? 0, rd = m['pole.round'] ?? 0, ln = m['pole.lean'] ?? 0, tip = Math.max(0, m['pole.tip'] ?? 0);
  const cv = m['posterior.convexity'] ?? 0, L = m['lobule.length'] ?? 0, LW = m['lobule.width'] ?? 0, LA = m['lobule.attach'] ?? 0, sag = m['lobule.sag'] ?? 0;
  const trp = m['tragus.projection'] ?? 0, nt = m['notch.depth'] ?? 0;
  const top = h > 0 ? -0.55 * h : -0.1 * h;
  const peakU = 0.42 + 0.22 * ln;
  const tri = Math.min(1, Math.max(0, -rd));
  const a0 = pt(0.04, 0.24);
  const a4 = pt(0.93 + 0.06 * cv, 0.26);
  // Épaules du pôle : cercle (rondeur +) ou flancs droits vers le sommet (rondeur −).
  const sAnt = pt(lerp(0.15, (a0.x + peakU) / 2, tri), lerp(top + 0.09 - 0.04 * Math.max(0, rd), (a0.y + top) / 2, tri));
  const sPost = pt(lerp(0.74 + 0.04 * ln, (peakU + a4.x) / 2, tri), lerp(top + 0.08, (top + a4.y) / 2, tri));
  const peak = pt(peakU + 0.18 * tip, top - 0.45 * tip);
  const vb = 1 + (L >= 0 ? 0.3 * L : 0.2 * L);
  const sw = 0.18 * (1 + 0.5 * LW);
  const u11 = 0.1 + (LA < 0 ? 0.14 * -LA : -0.08 * LA);
  const cu = 0.41 + 0.05 * sag;
  return [
    { id: 'C07', p: a0 },
    { id: 'C01', p: sAnt }, { id: 'C01', p: peak }, { id: 'C01', p: sPost },
    { id: 'C02', p: a4 }, { id: 'C02', p: pt(1 + 0.07 * cv, 0.48) }, { id: 'C02', p: pt(0.93 + 0.05 * cv, 0.7) },
    { id: 'C03', p: pt(0.76 + 0.03 * sag, lerp(0.84, vb - 0.08, 0.5)) }, { id: 'C03', p: pt(cu + sw + 0.04 * sag, vb - 0.03) }, { id: 'C03', p: pt(cu, vb) }, { id: 'C03', p: pt(cu - sw * 0.9, vb - 0.05) },
    { id: 'C06', p: pt(u11, lerp(0.74, vb - 0.12, 0.5)) },
    { id: 'C05', p: pt(0.12 + 0.08 * nt, 0.64) }, { id: 'C05', p: pt(-0.05 * trp, 0.5) },
    { id: 'C04', p: pt(0, 0.36) },
  ];
}

/**
 * Contour fermé échantillonné + segments C01–C07. `angularity` mélange la courbe lisse et la polyligne des contrôles (0 = lisse, 1 = anguleux) ;
 * `asym` ajoute un bruit de position PAR CONTRÔLE (asymétrie au sein d'une même oreille, graine fixe).
 */
export function buildOutline(m: FlatMorph, angularity: number, asym: number, seed: number): { outline: Poly; segments: ContourSegment[] } {
  const rnd = mulberry32(seed >>> 0);
  const ctrl = outlineControls(m).map((c, i, a) => (i === 0 || i === a.length - 1 ? c : { id: c.id, p: pt(c.p.x + (rnd() - 0.5) * 2 * asym * 0.02, c.p.y + (rnd() - 0.5) * 2 * asym * 0.02) }));
  const pts = ctrl.map((c) => c.p);
  const smooth = catmullRom(pts, true, OUTLINE_N);
  const outline = angularity <= 0 ? smooth : smooth.map((q, k) => {
    const i = Math.floor(k / OUTLINE_N);
    const t = (k % OUTLINE_N) / OUTLINE_N;
    const a = pts[i] as Vec;
    const b = pts[(i + 1) % pts.length] as Vec;
    return pt(lerp(q.x, lerp(a.x, b.x, t), angularity), lerp(q.y, lerp(a.y, b.y, t), angularity));
  });
  const segments: ContourSegment[] = [];
  ctrl.forEach((c, i) => {
    const last = segments[segments.length - 1];
    if (last && last.id === c.id) segments[segments.length - 1] = { ...last, to: (i + 1) * OUTLINE_N };
    else segments.push({ id: c.id, label: LABELS[c.id], from: i * OUTLINE_N, to: (i + 1) * OUTLINE_N, lengthU: 0 });
  });
  const len = (a: number, b: number): number => { let s = 0; for (let k = a; k < b; k++) { const p = outline[k % outline.length] as Vec; const q = outline[(k + 1) % outline.length] as Vec; s += Math.hypot(q.x - p.x, q.y - p.y); } return s; };
  return { outline, segments: segments.map((s) => ({ ...s, lengthU: len(s.from, s.to) })) };
}

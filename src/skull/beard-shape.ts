import { mulberry32 } from '../core/prng';
import type { FaceFacialHair, FaceHair } from '../schema';
import type { SkullGeo } from './geometry';
import type { CPoint, V2 } from './types';

/**
 * PILOSITÉ FACIALE EN PROFIL — GÉOMÉTRIE PURE, branchée sur `FaceFacialHair` (moustache, barbe, favoris, longueur, densité, transition peau/poils,
 * zones clairsemées) et sur `FaceHair.sideburns`. Les polygones sont dessinés sur la peau du profil : la moustache épouse la lèvre supérieure
 * (sous-nasal → vermillon), la barbe suit la mandibule (gonion → gnathion) et déborde du menton d'une longueur proportionnelle à `length`,
 * les favoris descendent devant l'oreille. Chaque type a sa propre emprise (stubble = semis de points sur la zone de la barbe courte,
 * goatee = menton seul, full/long = joue + menton + dessous).
 */
export interface BeardShape {
  readonly mustache: CPoint[] | null;
  readonly beard: CPoint[] | null;
  readonly sideburn: CPoint[] | null;
  /** Semis de poils (barbe de quelques jours, lisière diffuse) : points déterministes. */
  readonly dots: V2[];
  /** Ordonnée la plus basse de la pilosité (px) et débord sous le menton (fraction de H) : comparés à la face. */
  readonly bottom: number;
  readonly overhangH: number;
  readonly style: FaceFacialHair['beard'];
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function beardShape(g: SkullGeo, fh: FaceFacialHair, hair: FaceHair): BeardShape | null {
  const { H } = g;
  const S = (id: string): CPoint => g.skin.get(id) as CPoint;
  const noBeard = fh.beard === 'none' && fh.mustache === 'none' && fh.sideburns === 'none';
  if (noBeard) return null;
  const rnd = mulberry32(fh.seed >>> 0);
  const st = S('stomion'), sub = S('subnasale'), vs = S('vermilionSup'), ls = S('labraleSup'), sl = S('sublabiale'), pg = S('pogonion'), mn = S('menton');
  const go = g.bone.lm.gonion as V2, gn = g.bone.lm.gnathion as V2;
  const por = g.frame.f.porion * H;
  const corner = { x: st.x - 0.058 * H, y: st.y + 0.006 * H };
  // Moustache : bande entre le sous-nasal et la lèvre, ÉPAISSEUR selon le type (en profil, `handlebar` s'allonge vers l'avant, `pencil` est fine).
  const mt: Record<FaceFacialHair['mustache'], number> = { none: 0, thin: 0.006, full: 0.014, handlebar: 0.014, pencil: 0.004 };
  const th = mt[fh.mustache] * H;
  const my0 = sub.y + 0.016 * H, my1 = Math.min(ls.y, st.y - 0.004 * H);
  const mustache = th > 0 ? [{ x: sub.x - 0.012 * H, y: my0 }, { x: lerp(sub.x, vs.x, 0.55) + th, y: lerp(my0, my1, 0.4) }, { x: vs.x + th * (fh.mustache === 'handlebar' ? 1.8 : 1), y: my1 - 0.002 * H }, { x: ls.x + th * 0.4, y: my1 + 0.004 * H }, { x: corner.x + 0.01 * H, y: my1 + 0.006 * H }, { x: corner.x - 0.02 * H, y: lerp(my0, my1, 0.5) }] : null;
  // Barbe : débord sous le menton = longueur × 0,16 H (long), 0,05 H (full), 0,02 H (short, stubble) ; le bouc ne couvre que le menton.
  const over = { none: 0, stubble: 0.004, short: 0.02, full: 0.05, long: 0.16, goatee: 0.07 }[fh.beard] * (0.5 + fh.length);
  const cheek = fh.beard === 'short' || fh.beard === 'full' || fh.beard === 'long' || fh.beard === 'stubble';
  const front = (y: number, off: number): number => lerp(sl.x, mn.x, Math.max(0, Math.min(1, (y - sl.y) / (mn.y - sl.y)))) + off;
  const beard = fh.beard === 'none' ? null : [
    { x: sl.x + 0.002 * H, y: sl.y - 0.004 * H, s: 0.5 }, { x: pg.x + 0.01 * H + over * 0.12, y: pg.y }, { x: front(mn.y, 0.012 * H), y: mn.y + over * 0.5 * H },
    { x: mn.x - 0.01 * H, y: H + over * H }, { x: gn.x - 0.06 * H, y: H + over * 0.8 * H },
    ...(cheek ? [{ x: go.x + 0.03 * H, y: go.y + 0.04 * H }, { x: go.x - 0.005 * H, y: go.y - 0.03 * H }, { x: 0.075 * H, y: por + 0.02 * H }, { x: corner.x - 0.03 * H, y: corner.y - 0.045 * H }, corner] : [{ x: corner.x + 0.01 * H, y: corner.y + 0.03 * H }]),
  ];
  // Favoris : devant l'oreille ; `mutton` joint les favoris à la moustache (ici : descente jusqu'à l'angle de la mâchoire).
  const len = { none: 0, short: 0.3, long: 0.62, mutton: 1 }[fh.sideburns] * (0.6 + 0.8 * hair.sideburns);
  const yb = lerp(por - 0.05 * H, go.y, Math.min(1, len));
  const sideburn = len > 0 ? [{ x: 0.052 * H, y: por - 0.06 * H }, { x: 0.085 * H, y: por - 0.05 * H }, { x: 0.082 * H + 0.012 * H * len, y: yb }, { x: 0.056 * H, y: yb + 0.012 * H }] : null;
  // Lisière diffuse : semis de poils autour du bord de la barbe (nombre ∝ `transition`), plus un semis plein pour `stubble`.
  const dots: V2[] = [];
  if (beard) {
    const n = Math.round((fh.beard === 'stubble' ? 140 : 40) * (fh.beard === 'stubble' ? fh.density : fh.transition));
    const xs = beard.map((p) => p.x), ys = beard.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < n * 14 && dots.length < n; i++) {
      const p = { x: lerp(x0, x1, rnd()), y: lerp(y0, y1, rnd()) };
      let c = false; for (let a = 0, b = beard.length - 1; a < beard.length; b = a++) { const u = beard[a] as V2, v = beard[b] as V2; if (u.y > p.y !== v.y > p.y && p.x < ((v.x - u.x) * (p.y - u.y)) / (v.y - u.y) + u.x) c = !c; }
      if (fh.beard === 'stubble' ? c : !c && Math.abs(p.x - x0) > 0) dots.push(p);
    }
  }
  const all = [...(mustache ?? []), ...(beard ?? []), ...(sideburn ?? [])];
  return { mustache, beard, sideburn, dots, bottom: Math.max(...all.map((p) => p.y)), overhangH: over, style: fh.beard };
}

import { el, urlRef } from '../../core/svg';
import type { ResolvedAppearance } from '../../appearance';
import { jawline, type FaceLandmarks } from '../../face';
import { catmullRom } from '../../face/curve';
import { direction2D, type LightVector } from '../../lighting/light';
import { intensityFor } from '../../lighting/rig';
import { gradientStop as stop } from '../../materials';
import type { FaceParams } from '../../schema';
import { lineD, softKit } from './soft';

/**
 * Menton et mâchoire (rendu). Trois grandeurs du menton sont rendues SÉPARÉMENT :
 *  - la HAUTEUR place le sillon mentolabial (repère `lm.chin.sulcusY`) : elle ne change jamais la longueur du visage ;
 *  - la PROJECTION se lit dans la lumière : reflet du pogonion (coussinet) plus marqué, ombre du sillon plus creusée ;
 *  - la LARGEUR vient du contour (`chinWidth`).
 * S'y ajoutent la fossette / fente (symphyse `cleft`), l'ombrage de la ligne de mâchoire (côté opposé à la lumière) et le reflet du coin
 * de mâchoire (plus marqué quand l'angle est franc). La déformation des tissus à l'ouverture aplatit le sillon (`sulcusFlatten`).
 * L'ombre portée du menton sur le cou n'est PAS ici : elle est produite par le sous-moteur d'ombres de contact (composant `head`).
 */
export function renderChin(id: string, p: FaceParams, lm: FaceLandmarks, ra: ResolvedAppearance, L: LightVector): { defs: string[]; markup: string[] } {
  const kit = softKit(`${id}-chin`, lm.W, lm.H);
  const defs: string[] = [];
  const dir = direction2D(L);
  const I = intensityFor(L, 'skin');
  const u = lm.W / 300;
  const c = p.chin;
  const out: string[] = [];
  const half = lm.chin.half;
  // Sillon mentolabial : arc sous la lèvre inférieure, creusé par `mentolabial` et par la projection, aplati quand la bouche s'ouvre.
  const depth = c.mentolabial * (1 - lm.jaw.tissue.sulcusFlatten) * (0.7 + 0.6 * c.projection);
  const w = Math.min(lm.lips.half * 0.85, half * 1.5);
  const y = lm.chin.sulcusY;
  const arc = catmullRom([{ x: -w, y: y - 0.004 * lm.H }, { x: -w * 0.5, y: y + 0.003 * lm.H }, { x: 0, y: y + 0.006 * lm.H }, { x: w * 0.5, y: y + 0.003 * lm.H }, { x: w, y: y - 0.004 * lm.H }], false, 6);
  out.push(kit.stroke(lineD(arc), ra.shadow, 3.4 * u, 0.45 * depth * (0.6 + 0.4 * I), 2.4 * u));
  // Coussinet / pogonion : tache lumineuse sur le menton, décalée vers la lumière ; plus forte et plus petite quand la projection augmente.
  const gid = `${id}-chin-pad`;
  defs.push(el('radialGradient', { id: gid, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, ra.light, 0.34 * c.pad * I * (0.6 + 0.8 * c.projection)), stop(0.6, ra.light, 0.1 * c.pad * I), stop(1, ra.light, 0)]));
  const ph = lm.chin.heightPx;
  const pr = 0.7 * (1 - 0.25 * c.projection);
  out.push(el('ellipse', { cx: dir.x * half * 0.25, cy: y + ph * 0.55 + dir.y * ph * 0.1, rx: half * pr, ry: Math.max(0.012 * lm.H, ph * 0.36), fill: urlRef(gid) }));
  // Fente / fossette centrale : sillon vertical flou bordé de deux lobes clairs.
  if (c.symphysis === 'cleft') {
    const top = y + ph * 0.3;
    const bot = lm.chinY - ph * 0.12;
    out.push(kit.stroke(lineD([{ x: 0, y: top }, { x: 0, y: bot }]), ra.shadow, (1.4 + 2.2 * c.cleft) * u, 0.4 * c.cleft + 0.1, 1.2 * u));
    for (const s of [-1, 1] as const) out.push(kit.stroke(lineD([{ x: s * 2.6 * u, y: top }, { x: s * 2.6 * u, y: bot }]), ra.light, 1.6 * u, 0.14 * I * c.cleft, 1.2 * u));
  }
  // Ligne de mâchoire : bande d'ombre douce le long du contour bas, du côté opposé à la lumière (la mandibule tourne vers l'ombre).
  const jl = jawline(lm);
  const lit = (q: { x: number }): boolean => q.x * dir.x >= 0;
  const dark = jl.filter((q) => !lit(q));
  if (dark.length > 1) out.push(kit.stroke(lineD(dark), ra.shadow, 0.05 * lm.W, 0.22 + 0.1 * (1 - p.jaw.angle), 0.02 * lm.W));
  // Coin de mâchoire : reflet du côté lumière (plus net quand l'angle est franc : `1 - angle`).
  const g = lm.jaw.gonion;
  const sgn = dir.x >= 0 ? 1 : -1;
  const gg = `${id}-gonion`;
  defs.push(el('radialGradient', { id: gg, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, ra.light, 0.18 * I * (0.5 + 0.8 * (1 - p.jaw.angle))), stop(1, ra.light, 0)]));
  out.push(el('ellipse', { cx: sgn * (g.x - 0.03 * lm.W), cy: g.y - 0.02 * lm.H, rx: 0.05 * lm.W, ry: 0.04 * lm.H, fill: urlRef(gg) }));
  return { defs: [...kit.defs, ...defs], markup: out };
}

import { clamp, clamp01 } from '../../core/math';
import { el, num } from '../../core/svg';
import { lineD } from '../face/soft';
import type { P2 } from '../../neck/types';
import type { NeckCtx } from './ctx';

/**
 * Reliefs anatomiques (NECK-05, 06A…06G) : larynx (pomme d'Adam), os hyoïde, anneaux de la trachée, jugulaire externe, clavicules + fosse
 * sus-sternale, plis du tissu mou, fanon. Positions en (u, ψ) sur la surface déformée ; échelle = largeur LOCALE du cou (un cou fin a un larynx plus
 * saillant, un cou massif l'enfouit : la visibilité vient de `anatomy.ts`). Lumière : reflet côté éclairé, ombre de l'autre côté.
 */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ramp = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, k) => lerp(a, b, k / (n - 1)));
const Y = (c: NeckCtx, u: number): number => c.at(u, 0).y;
/** Demi-largeur locale du cou à `u` (px). */
const halfAt = (c: NeckCtx, u: number): number => Math.abs(c.at(u, Math.PI / 2).x - c.at(u, -Math.PI / 2).x) / 2;

export function renderReliefs(c: NeckCtx): string[] {
  const out: string[] = [], { u: U, ra, kit, dir } = c, litSide = dir.x >= 0 ? 1 : -1;
  const uBase = 1, span = uBase - c.chinU;
  // Larynx : prominence thyroïdienne à 38 % de la distance menton → base, deux lames en V (encoche supérieure), reflet côté éclairé.
  const lv = c.vis('larynx');
  if (lv > 0.05) {
    const u = c.chinU + 0.38 * span, a = halfAt(c, u), cx = c.at(u, 0).x, cy = Y(c, u), rx = 0.17 * a, ry = 0.32 * a;
    out.push(kit.fill(`M${num(cx)} ${num(cy - ry)}L${num(cx + rx)} ${num(cy)}L${num(cx)} ${num(cy + ry)}L${num(cx - rx)} ${num(cy)}Z`, ra.light, 0.34 * lv * c.I * c.detail, 2.4 * U));
    out.push(kit.stroke(lineD([{ x: cx - rx * 0.9, y: cy - ry * 0.5 }, { x: cx, y: cy - ry }, { x: cx + rx * 0.9, y: cy - ry * 0.5 }]), ra.shadow, 1.8 * U, 0.5 * lv * c.detail, 1 * U));
    out.push(kit.stroke(lineD([{ x: cx - litSide * rx * 1.1, y: cy - ry * 0.7 }, { x: cx - litSide * rx * 1.5, y: cy + ry * 0.9 }]), ra.shadow, 3 * U, 0.34 * lv * c.detail, 2.2 * U));
  }
  // Hyoïde : barre horizontale sous la mandibule (reflet), ombre sous elle.
  const hv = c.vis('hyoid');
  if (hv > 0.05) {
    const u = c.chinU + 0.14 * span, a = halfAt(c, u), y = Y(c, u), cx = c.at(u, 0).x;
    out.push(kit.stroke(lineD([{ x: cx - 0.45 * a, y }, { x: cx, y: y + 0.03 * a }, { x: cx + 0.45 * a, y }]), ra.light, 3 * U, 0.34 * hv * c.I * c.detail, 1.6 * U));
    out.push(kit.stroke(lineD([{ x: cx - 0.42 * a, y: y + 4 * U }, { x: cx, y: y + 0.03 * a + 4 * U }, { x: cx + 0.42 * a, y: y + 4 * U }]), ra.shadow, 2.4 * U, 0.3 * hv * c.detail, 1.6 * U));
  }
  // Trachée : anneaux sous le larynx, jusqu'à la fosse sus-sternale.
  const tv = c.vis('trachea');
  if (tv > 0.05) for (const t of [0.5, 0.57, 0.64, 0.71, 0.78]) {
    const u = c.chinU + t * span, a = halfAt(c, u), y = Y(c, u), cx = c.at(u, 0).x;
    out.push(kit.stroke(lineD([{ x: cx - 0.28 * a, y }, { x: cx, y: y + 0.08 * a }, { x: cx + 0.28 * a, y }]), ra.shadow, 2.6 * U, 0.55 * tv * c.detail, 0.8 * U));
  }
  // Jugulaire externe : oblique sur le SCM, du dessous de l'angle de la mâchoire vers la clavicule.
  const vv = c.vis('vessels');
  if (vv > 0.05) for (const s of [-1, 1] as const) {
    const pts: P2[] = [];
    for (const t of ramp(0, 1, 10)) { const u = lerp(c.jawU + 0.03, 0.9, t), psi = s * lerp(0.5, 0.22, t) * Math.PI; if (c.facing(u, psi) > 0.1) pts.push(c.at(u, psi, 0.5)); }
    if (pts.length > 3) out.push(kit.stroke(lineD(pts), ra.shadow, (2 + 2 * vv) * U, 0.4 * vv * c.detail, 1.2 * U));
  }
  // Clavicules et fosse sus-sternale : base du cou ; l'âge et la minceur creusent la fosse.
  const cv = c.vis('clavicle');
  if (cv > 0.05) {
    const yb = Y(c, 1), xb = halfAt(c, 1), H = c.model.ctx.H;
    for (const s of [-1, 1] as const) {
      const line = [{ x: 0.06 * xb * s, y: yb - 0.03 * H }, { x: 0.35 * xb * s, y: yb - 0.048 * H }, { x: 0.7 * xb * s, y: yb - 0.04 * H }, { x: 0.98 * xb * s, y: yb - 0.015 * H }];
      out.push(kit.stroke(lineD(line), ra.light, 2.4 * U, 0.2 * cv * c.I * c.detail, 1.4 * U));
      out.push(kit.stroke(lineD(line.map((p) => ({ x: p.x, y: p.y + 3 * U }))), ra.shadow, 2.6 * U, 0.22 * cv * c.detail, 2 * U));
    }
    const age = c.sys.modifiers.age;
    out.push(el('ellipse', { cx: 0, cy: yb - 0.026 * H, rx: 0.1 * xb, ry: 0.02 * H, fill: ra.shadow, 'fill-opacity': clamp(0.12 + 0.3 * cv * (0.5 + age), 0, 0.6) * c.detail }));
  }
  // Plis du tissu mou : arcs en sourire en travers de la face antérieure ; plus nombreux et plus marqués avec la masse, l'âge, la compression (champ lu).
  const fv = c.vis('fat-folds');
  if (fv > 0.04) {
    const n = Math.round(1 + 4 * c.sys.softTissue.foldDistribution + 2 * fv);
    for (let k = 0; k < n; k++) {
      const u = lerp(c.chinU + 0.05, Math.min(0.88, c.chinU + 0.05 + (0.18 + 0.7 * c.sys.softTissue.foldDistribution) * span), n === 1 ? 0 : k / (n - 1));
      const amp = clamp01(fv * c.field('fold', u) * (0.6 + c.field('compression', u)) * (0.4 + 1.2 * c.sys.softTissue.foldDepth) * (1 + 0.8 * c.sys.modifiers.age)), pts: P2[] = [];
      for (const q of ramp(-0.42, 0.42, 9)) { const p = c.at(u, q * Math.PI); pts.push({ x: p.x, y: p.y + (1 - (q / 0.42) ** 2) * (0.006 + 0.014 * amp) * c.model.ctx.H }); }
      out.push(kit.stroke(lineD(pts), ra.shadow, (1.5 + 2.4 * amp) * U, clamp(0.1 + 0.45 * amp, 0, 0.55) * c.detail, 2 * U));
      out.push(kit.stroke(lineD(pts.map((p) => ({ x: p.x, y: p.y + (2.4 + 2 * amp) * U }))), ra.light, 1.4 * U, 0.1 * amp * c.I * c.detail, 1.6 * U));
    }
  }
  return out.filter((x) => x !== '');
}

/** Fanon / double menton : lobe de tissu pendant sous la mandibule, dessiné SOUS la tête (le menton le recouvre en haut). */
export function renderDewlap(c: NeckCtx, base: string): string[] {
  // L'âge relâche la peau sous la mandibule : au-delà de 0,5 il ajoute un fanon (jusqu'à +0,3 à l'âge 1).
  const d = Math.min(1, c.sys.softTissue.dewlap + 0.6 * Math.max(0, c.sys.modifiers.age - 0.5));
  if (d < 0.02) return [];
  // M09 : l'inertie (`pose.tissueLag`) fait pendre le lobe plus bas (+) ou le relève (−) et le déporte légèrement.
  const lag = c.sys.pose.tissueLag, { H, chinY, jawY } = c.model.ctx, a = halfAt(c, c.chinU), drop = d * 0.2 * H * (1 + 0.5 * lag) + lag * 0.02 * H;
  const lobe = `M${num(-a * 0.95)} ${num(jawY)}C${num(-a * 0.9)} ${num(chinY + drop)} ${num(-a * 0.3)} ${num(chinY + drop * 1.1)} ${num(0)} ${num(chinY + drop * 1.1)}C${num(a * 0.3)} ${num(chinY + drop * 1.1)} ${num(a * 0.9)} ${num(chinY + drop)} ${num(a * 0.95)} ${num(jawY)}Z`;
  return [el('path', { d: lobe, fill: base }), c.kit.stroke(lineD([{ x: -a * 0.85, y: chinY + drop * 0.85 }, { x: 0, y: chinY + drop * 1.08 }, { x: a * 0.85, y: chinY + drop * 0.85 }]), c.ra.shadow, 2.6 * c.u, 0.32 * c.detail, 2.2 * c.u)];
}

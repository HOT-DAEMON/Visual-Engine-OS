import { clamp, clamp01 } from '../../core/math';
import { el, num, urlRef } from '../../core/svg';
import { gradientStop as stop } from '../../materials';
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
  // Larynx : prominence thyroïdienne entre menton et base. DIMORPHISME par le sexe exprimé du corps (`HeadContext.sex`, k = 0 féminin … 1 masculin ; 0,5 = indéterminé) :
  // masculin = saillie plus grande, plus basse, en V aigu avec encoche nette ; féminin = petite, plus haute, arrondie (angle thyroïdien ouvert), sans encoche lisible.
  const lv = c.vis('larynx');
  if (lv > 0.05) {
    const k = (c.model.ctx.sex + 1) / 2, u = c.chinU + (0.34 + 0.08 * k) * span, a = halfAt(c, u), cx = c.at(u, 0).x, cy = Y(c, u), rx = (0.11 + 0.12 * k) * a, ry = (0.25 + 0.14 * k) * a;
    // Contour superelliptique : exposant 1 = losange (aigu), 2 = ellipse (arrondi) ; 8 sommets.
    const pw = 2 / lerp(2, 1, k * 0.9 + 0.05), ring: P2[] = Array.from({ length: 8 }, (_, i) => { const t = (i / 8) * 2 * Math.PI, cs = Math.cos(t), sn = Math.sin(t); return { x: cx + rx * Math.sign(cs) * Math.abs(cs) ** pw, y: cy + ry * Math.sign(sn) * Math.abs(sn) ** pw }; });
    out.push(kit.fill(`M${ring.map((q) => `${num(q.x)} ${num(q.y)}`).join('L')}Z`, ra.light, 0.34 * lv * c.I * c.detail, 2.4 * U));
    out.push(kit.stroke(lineD([{ x: cx - rx * 0.9, y: cy - ry * 0.5 }, { x: cx, y: cy - ry }, { x: cx + rx * 0.9, y: cy - ry * 0.5 }]), c.dark, 1.8 * U, 0.5 * lv * c.detail * (0.15 + 1.7 * k * k), 1 * U));
    out.push(kit.stroke(lineD([{ x: cx - litSide * rx * 1.1, y: cy - ry * 0.7 }, { x: cx - litSide * rx * 1.5, y: cy + ry * 0.9 }]), c.dark, 3 * U, 0.34 * lv * c.detail, 2.2 * U));
  }
  // Hyoïde : barre horizontale sous la mandibule (reflet), ombre sous elle.
  const hv = c.vis('hyoid');
  if (hv > 0.05) {
    const u = c.chinU + 0.14 * span, a = halfAt(c, u), y = Y(c, u), cx = c.at(u, 0).x;
    out.push(kit.stroke(lineD([{ x: cx - 0.45 * a, y }, { x: cx, y: y + 0.03 * a }, { x: cx + 0.45 * a, y }]), ra.light, 3 * U, 0.34 * hv * c.I * c.detail, 1.6 * U));
    out.push(kit.stroke(lineD([{ x: cx - 0.42 * a, y: y + 4 * U }, { x: cx, y: y + 0.03 * a + 4 * U }, { x: cx + 0.42 * a, y: y + 4 * U }]), c.dark, 2.4 * U, 0.3 * hv * c.detail, 1.6 * U));
  }
  // Trachée : anneaux sous le larynx, jusqu'à la fosse sus-sternale.
  const tv = c.vis('trachea');
  if (tv > 0.05) for (const t of [0.5, 0.57, 0.64, 0.71, 0.78]) {
    const u = c.chinU + t * span, a = halfAt(c, u), y = Y(c, u), cx = c.at(u, 0).x;
    out.push(kit.stroke(lineD([{ x: cx - 0.28 * a, y }, { x: cx, y: y + 0.08 * a }, { x: cx + 0.28 * a, y }]), c.dark, 2.6 * U, 0.55 * tv * c.detail, 0.8 * U));
  }
  // Jugulaire externe : oblique sur le SCM, du dessous de l'angle de la mâchoire vers la clavicule.
  const vv = c.vis('vessels');
  if (vv > 0.05) for (const s of [-1, 1] as const) {
    const pts: P2[] = [];
    for (const t of ramp(0, 1, 10)) { const u = lerp(c.jawU + 0.03, 0.9, t), psi = s * lerp(0.5, 0.22, t) * Math.PI; if (c.facing(u, psi) > 0.1) pts.push(c.at(u, psi, 0.5)); }
    if (pts.length > 3) out.push(kit.stroke(lineD(pts), c.dark, (2 + 2 * vv) * U, 0.4 * vv * c.detail, 1.2 * U));
  }
  // Clavicules et fosse sus-sternale : base du cou ; l'âge et la minceur creusent la fosse.
  const cv = c.vis('clavicle');
  if (cv > 0.05) {
    const yb = Y(c, 1), xb = halfAt(c, 1), H = c.model.ctx.H;
    for (const s of [-1, 1] as const) {
      const line = [{ x: 0.06 * xb * s, y: yb - 0.03 * H }, { x: 0.35 * xb * s, y: yb - 0.048 * H }, { x: 0.7 * xb * s, y: yb - 0.04 * H }, { x: 0.98 * xb * s, y: yb - 0.015 * H }];
      out.push(kit.stroke(lineD(line), ra.light, 2.4 * U, 0.2 * cv * c.I * c.detail, 1.4 * U));
      out.push(kit.stroke(lineD(line.map((p) => ({ x: p.x, y: p.y + 3 * U }))), c.dark, 2.6 * U, 0.22 * cv * c.detail, 2 * U));
    }
    const age = c.sys.modifiers.age;
    out.push(el('ellipse', { cx: 0, cy: yb - 0.026 * H, rx: 0.1 * xb, ry: 0.02 * H, fill: c.dark, 'fill-opacity': clamp(0.12 + 0.3 * cv * (0.5 + age), 0, 0.6) * c.detail }));
  }
  // Plis du tissu mou : CROISSANTS effilés (épais au milieu, nuls aux extrémités) en travers de la face antérieure, jamais un trait de largeur constante qui
  // irait d'un bord à l'autre (une ligne sombre droite se lit comme une couture, pas comme un pli de peau). Les pointes s'arrêtent avant le contour du cou ;
  // la lèvre inférieure du pli reçoit un reflet. Plus nombreux et plus marqués avec la masse, l'âge, la compression (champ lu).
  const fv = c.vis('fat-folds');
  if (fv > 0.04) {
    const n = Math.round(1 + 4 * c.sys.softTissue.foldDistribution + 2 * fv);
    for (let k = 0; k < n; k++) {
      const u = lerp(c.chinU + 0.05, Math.min(0.88, c.chinU + 0.05 + (0.18 + 0.7 * c.sys.softTissue.foldDistribution) * span), n === 1 ? 0 : k / (n - 1));
      const amp = clamp01(fv * c.field('fold', u) * (0.6 + c.field('compression', u)) * (0.4 + 1.2 * c.sys.softTissue.foldDepth) * (1 + 0.8 * c.sys.modifiers.age));
      const sag = (0.006 + 0.014 * amp) * c.model.ctx.H, thick = (1.6 + 3.4 * amp) * U, Q = 0.34;
      const upper: P2[] = [], lower: P2[] = [];
      for (const q of ramp(-Q, Q, 13)) {
        const p = c.at(u, q * Math.PI), e = Math.max(0, 1 - (q / Q) ** 2), y = p.y + e * sag;
        upper.push({ x: p.x, y }); lower.push({ x: p.x, y: y + thick * e ** 0.8 });
      }
      const ring = [...upper, ...lower.slice().reverse()];
      out.push(c.kit.fill(`M${ring.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`, c.dark, clamp(0.12 + 0.34 * amp, 0, 0.5) * c.detail, 1.6 * U));
      out.push(kit.stroke(lineD(lower.map((p) => ({ x: p.x, y: p.y + 1.6 * U }))), ra.light, 1.4 * U, 0.12 * amp * c.I * c.detail, 1.6 * U));
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
  // Volume du lobe par la loi PARTAGÉE : près de la mandibule la surface regarde vers l'avant-haut, au point bas elle regarde vers le bas → ombre du côté opposé à la lumière.
  const gid = `${c.id}-dewlap`;
  const grad = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: jawY, x2: 0, y2: chinY + drop * 1.1 }, [stop(0, c.tone(base, { x: 0, y: -0.5 }), 1), stop(1, c.tone(base, { x: 0, y: 1 }), 1)]);
  return [el('defs', {}, [grad]), el('path', { d: lobe, fill: urlRef(gid) }), c.kit.stroke(lineD([{ x: -a * 0.85, y: chinY + drop * 0.85 }, { x: 0, y: chinY + drop * 1.08 }, { x: a * 0.85, y: chinY + drop * 0.85 }]), c.dark, 2.6 * c.u, 0.32 * c.detail, 2.2 * c.u)];
}

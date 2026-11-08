import { mix } from '../../core/color';
import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import { el, num } from '../../core/svg';
import { surfaceNormal } from '../../neck/geometry';
import type { P2 } from '../../neck/types';
import type { NeckCtx } from './ctx';

/**
 * MOTIFS DE SURFACE (TODO §7) : écailles, plaques, plumes. Les éléments sont DISTRIBUÉS EN (u, ψ) sur la surface déformée — pas peints à plat —,
 * donc ils suivent courbure, torsion et évasement, se RACCOURCISSENT près des bords (aplatissement = normale·vue), et sont éclairés par leur normale
 * réelle. Règles de distribution : `rows` rangées décalées, `spiral` décalage angulaire progressif, `tiling` pavage hexagonal, `clusters` amas organiques
 * (groupes déterministes). `smoothThroat` laisse la gorge lisse (reptiles, dragons) ; `density` règle le pas ; `overlap` l'imbrication ; `variation`
 * le désordre (taille, rotation, ton). Couleur : celle de la peau (cohérence avec la tête et le corps) sauf `elementColor` explicite.
 * Les éléments se dessinent du bas vers le haut : le haut recouvre le bas, comme des tuiles.
 */
const MAX = 2600;

function shape(kind: 'scales' | 'feathers', cx: number, cy: number, w: number, h: number, rot: number): string {
  const pts: P2[] = kind === 'scales'
    ? [{ x: 0, y: -h * 0.5 }, { x: w * 0.5, y: -h * 0.05 }, { x: w * 0.36, y: h * 0.45 }, { x: 0, y: h * 0.6 }, { x: -w * 0.36, y: h * 0.45 }, { x: -w * 0.5, y: -h * 0.05 }]
    : [{ x: 0, y: -h * 0.5 }, { x: w * 0.5, y: -h * 0.2 }, { x: w * 0.32, y: h * 0.25 }, { x: 0, y: h * 0.7 }, { x: -w * 0.32, y: h * 0.25 }, { x: -w * 0.5, y: -h * 0.2 }];
  const cs = Math.cos(rot), sn = Math.sin(rot), q = pts.map((p) => ({ x: cx + p.x * cs - p.y * sn, y: cy + p.x * sn + p.y * cs }));
  // Courbes douces entre sommets (quadratiques via les milieux) : éléments arrondis, jamais des polygones durs.
  const mid = (a: P2, b: P2): P2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M${num(mid(q[q.length - 1]!, q[0]!).x)} ${num(mid(q[q.length - 1]!, q[0]!).y)}`;
  for (let i = 0; i < q.length; i++) { const m = mid(q[i]!, q[(i + 1) % q.length]!); d += `Q${num(q[i]!.x)} ${num(q[i]!.y)} ${num(m.x)} ${num(m.y)}`; }
  return `${d}Z`;
}

interface Cell { u: number; psi: number; row: number; k: number }

/** Grammaire de distribution : liste de cellules (u, ψ) sur la face antérieure, avant tri. */
function layout(c: NeckCtx, h: number, stepPx: number): Cell[] {
  const s = c.model.composition.surface, S = c.model.stations, cells: Cell[] = [];
  const u0 = Math.max(0, c.jawU - 0.02), L = c.model.composition.morphology.lengthPx;
  const rows = Math.max(2, Math.round(((1 - u0) * L) / (h * (1 - 0.45 * s.overlap))));
  const rnd = mulberry32(c.model.composition.morphology.seed ^ 0x5f3759df);
  const centers = Array.from({ length: 7 }, () => ({ u: u0 + rnd() * (1 - u0), psi: (rnd() - 0.5) * Math.PI }));
  for (let r = 0; r < rows; r++) {
    const u = u0 + ((r + 0.5) / rows) * (1 - u0), st = S[Math.round(u * (S.length - 1))]!, rad = Math.max(10, (st.aL + st.aR) / 2);
    const dpsi = stepPx / rad, n = Math.ceil(Math.PI / dpsi);
    for (let j = -n; j <= n; j++) {
      let psi = j * dpsi + (s.layout === 'spiral' ? r * dpsi * 0.38 : r % 2 ? dpsi / 2 : 0);
      if (s.layout === 'tiling') psi = j * dpsi + (r % 2) * dpsi * 0.5;
      if (Math.abs(psi) > Math.PI / 2 * 1.02) continue;
      if (Math.abs(psi) < s.smoothThroat * 0.5 * Math.PI) continue;
      if (s.layout === 'clusters' && Math.min(...centers.map((q) => Math.hypot((u - q.u) * 3, psi - q.psi))) > 0.55 + 0.6 * s.density) continue;
      cells.push({ u, psi, row: r, k: j });
    }
  }
  return cells.slice(0, MAX);
}

export function renderSurface(c: NeckCtx): string[] {
  const s = c.model.composition.surface;
  if (s.pattern === 'smooth') return [];
  const out: string[] = [], U = c.u, ra = c.ra, base = s.elementColor ?? c.skin;
  const h = Math.max(6 * U, s.sizePx * (s.pattern === 'plates' ? 0.9 : 1)), stepPx = h * (1.05 - 0.55 * s.density) * (s.pattern === 'feathers' ? 0.8 : 1);
  const S = c.model.stations;
  if (s.pattern === 'plates') return plates(c, h);
  const cells = layout(c, h, stepPx).sort((a, b) => b.row - a.row || a.k - b.k);
  for (const cl of cells) {
    const idx = Math.round(cl.u * (S.length - 1)), face = c.facing(cl.u, cl.psi);
    if (face < 0.12) continue;
    const rnd = mulberry32(c.model.composition.morphology.seed + cl.row * 7919 + cl.k * 104729), jit = (rnd() - 0.5) * 2 * s.variation;
    const n = surfaceNormal(c.model, idx, cl.psi), proj = c.proj(n);
    const p = c.at(cl.u, cl.psi), w = stepPx * (1 + 0.55 * s.overlap) * clamp(face, 0.28, 1) * (1 + 0.25 * jit), hh = h * (1 + 0.2 * jit);
    const rot = jit * 0.5 + (s.pattern === 'feathers' ? -n.x * 0.35 : 0);
    const d = shape(s.pattern, p.x, p.y, w, hh, rot);
    const cel = ra.spec.shading?.mode === 'cel';
    // Couleur : loi partagée du terminateur (comme la peau) ; la variation `jit` ne fait que décaler légèrement vers la lumière ou l'ombre.
    const fill = mix(c.tone(base, n), jit > 0 ? ra.light : ra.shadow, cel ? 0 : 0.1 * Math.abs(jit));
    out.push(el('path', { d, fill, stroke: ra.shadow, 'stroke-width': 0.9 * U, 'stroke-opacity': 0.55 * c.detail }));
    if (!cel && proj > 0.5) out.push(el('path', { d: `M${num(p.x - w * 0.25)} ${num(p.y - hh * 0.22)}Q${num(p.x)} ${num(p.y - hh * 0.4)} ${num(p.x + w * 0.25)} ${num(p.y - hh * 0.22)}`, fill: 'none', stroke: ra.light, 'stroke-width': 0.9 * U, 'stroke-opacity': 0.3 * proj * c.I, 'stroke-linecap': 'round' }));
  }
  return out;
}

/** Plaques : lames d'armure en anneaux (une rangée = une lame fendue en 1 à 3 plaques), éclairées par leur normale ; la lame du haut recouvre celle du bas. */
function plates(c: NeckCtx, h: number): string[] {
  const s = c.model.composition.surface, out: string[] = [], U = c.u, ra = c.ra;
  const u0 = Math.max(0, c.jawU - 0.02), L = c.model.composition.morphology.lengthPx;
  const rows = Math.max(2, Math.round(((1 - u0) * L) / (h * (1 - 0.3 * s.overlap)))), parts = 1 + Math.round(s.density * 2);
  for (let r = rows - 1; r >= 0; r--) {
    const ua = u0 + (r / rows) * (1 - u0), ub = Math.min(1, u0 + ((r + 1 + s.overlap * 0.6) / rows) * (1 - u0));
    for (let q = 0; q < parts; q++) {
      const p0 = -Math.PI / 2 + (q / parts) * Math.PI, p1 = -Math.PI / 2 + ((q + 1) / parts) * Math.PI;
      const top: P2[] = [], bot: P2[] = [];
      for (let k = 0; k <= 6; k++) { const ps = p0 + ((p1 - p0) * k) / 6; if (c.facing(ua, ps) < 0.05) continue; top.push(c.at(ua, ps)); bot.push(c.at(ub, ps, 0.8 * U)); }
      if (top.length < 3) continue;
      // Le volume vient du corps ombré (normales réelles) : la plaque n'ajoute que sa JOINTURE — liseré clair en haut (côté éclairé), ombre portée sur la lame du dessous.
      const d = `M${top.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}L${bot.reverse().map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`;
      out.push(el('path', { d, fill: 'none', stroke: ra.shadow, 'stroke-width': 1.2 * U, 'stroke-opacity': 0.75 * c.detail, 'stroke-linejoin': 'round' }));
      out.push(c.kit.stroke(`M${top.map((p) => `${num(p.x)} ${num(p.y + 1.6 * U)}`).join('L')}`, ra.light, 1.2 * U, 0.28 * c.I * c.detail, 0.8 * U));
      out.push(c.kit.stroke(`M${bot.map((p) => `${num(p.x)} ${num(p.y + 2.4 * U)}`).join('L')}`, ra.shadow, 2.4 * U, 0.3 * c.detail, 1.6 * U));
    }
  }
  return out;
}

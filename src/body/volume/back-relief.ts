import type { BodyFrame } from '../frame';
import type { Trunk } from './trunk';

/**
 * CHAMP DE RELIEF DU HAUT DU DOS (itération 08). Jusqu'à l'itération 07 le dos n'était qu'un assemblage de volumes à sections elliptiques : infra-épineux, grand rond, rhomboïde et trapèze
 * moyen/inférieur se lisaient comme des bâtonnets posés sur une peau lisse (docs/BODY-UPPER-LIMB-04-REMAINING.md). Une loft d'ellipses ne peut pas porter un bord médial, une épine et un
 * angle inférieur CONTINUS : ici ils sont définis comme un champ de hauteur h(x, y) sur la peau du tronc, en coordonnées monde POSÉES (les points passent par `tr.point`, donc par le contrapposto),
 * et le rendu par pixel n'en perturbe que la NORMALE (la silhouette et la profondeur ne changent pas ; voir `pixel.ts`).
 * Cotes : celles de `back.ts` (unité vertébrale u = (T12 − C7)/12, acromion y.acr, fractions de la demi-largeur biacromiale x.acr). Amplitudes en hauteurs de tête, modulées par `vis`
 * (visibilité musculaire du cadre : 0 sujet gras/jeune … 1 sec et musclé) : la même anatomie se lit plus ou moins selon le sujet.
 */
export type Pt = readonly [number, number];
export type Shape = { readonly id: string } & (
  | { readonly kind: 'poly'; readonly pts: readonly Pt[]; readonly amp: number; readonly edge: number }
  | { readonly kind: 'line'; readonly pts: readonly Pt[]; readonly amp: number; readonly w: number; readonly fade: number }
  | { readonly kind: 'blob'; readonly c: Pt; readonly ax: Pt; readonly rx: number; readonly ry: number; readonly amp: number });
export interface BackRelief { readonly shapes: readonly Shape[]; readonly H: number; readonly bbox: readonly (readonly [number, number, number, number])[] }

const sm = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
const PI = Math.PI;
/** Distance d'un point à une polyligne et abscisse normalisée t (0 = début, 1 = fin) du pied de la perpendiculaire. */
function distLine(pts: readonly Pt[], x: number, y: number): { d: number; t: number } {
  let best = Infinity, bt = 0, tot = 0; const L: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]); L.push(l); tot += l; }
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, u = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2));
    const d = Math.hypot(x - (ax + u * dx), y - (ay + u * dy)); if (d < best) { best = d; bt = (acc + u * L[i]!) / (tot || 1); }
    acc += L[i]!;
  }
  return { d: best, t: bt };
}
/** Distance signée au contour d'un polygone (négative à l'intérieur). */
function sdPoly(pts: readonly Pt[], x: number, y: number): number {
  let inside = false, best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const dx = xj - xi, dy = yj - yi, l2 = dx * dx + dy * dy || 1e-9, u = Math.min(1, Math.max(0, ((x - xi) * dx + (y - yi) * dy) / l2));
    best = Math.min(best, Math.hypot(x - (xi + u * dx), y - (yi + u * dy)));
  }
  return inside ? -best : best;
}
/** Hauteur du champ (en unités du monde, + = vers l'extérieur du dos) au point posé (x, y). */
export function reliefHeight(r: BackRelief, x: number, y: number): number {
  let h = 0;
  for (let i = 0; i < r.shapes.length; i++) {
    const b = r.bbox[i]!; if (x < b[0] || x > b[1] || y < b[2] || y > b[3]) continue;
    const s = r.shapes[i]!;
    if (s.kind === 'poly') h += s.amp * (1 - sm(sdPoly(s.pts, x, y) / s.edge + 0.5));
    else if (s.kind === 'line') { const { d, t } = distLine(s.pts, x, y); h += s.amp * (1 - s.fade * t) * sm(t / 0.14) * sm((1 - t) / 0.14) * Math.exp(-((d / s.w) ** 2)); }
    else { const dx = x - s.c[0], dy = y - s.c[1], u = dx * s.ax[0] + dy * s.ax[1], v = -dx * s.ax[1] + dy * s.ax[0]; h += s.amp * Math.exp(-((u / s.rx) ** 2 + (v / s.ry) ** 2)); }
  }
  return h;
}
/** Hauteur et gradient (différences centrales) : sert à incliner la normale de peau. */
export function reliefAt(r: BackRelief, x: number, y: number): { h: number; hx: number; hy: number } {
  const e = 0.0035 * r.H, h = reliefHeight(r, x, y);
  return { h, hx: (reliefHeight(r, x + e, y) - reliefHeight(r, x - e, y)) / (2 * e), hy: (reliefHeight(r, x, y + e) - reliefHeight(r, x, y - e)) / (2 * e) };
}

/** Assemble un champ à partir de ses formes : calcule les boîtes englobantes (qui évitent d'évaluer les formes lointaines pour chaque pixel). Exporté pour les tests (formes modifiées). */
export function finishRelief(shapes: readonly Shape[], H: number): BackRelief {
  const bbox = shapes.map((s): [number, number, number, number] => {
    const pad = s.kind === 'poly' ? s.edge * 1.2 : s.kind === 'line' ? s.w * 3.2 : Math.max(s.rx, s.ry) * 3;
    const pts = s.kind === 'blob' ? [s.c] : s.pts;
    return [Math.min(...pts.map((p) => p[0])) - pad, Math.max(...pts.map((p) => p[0])) + pad, Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[1])) + pad];
  });
  return { shapes, H, bbox };
}
export function makeBackRelief(tr: Trunk, f: BodyFrame): BackRelief {
  const fk = 1 - 0.65 * f.fat, H = f.h, y = f.y, lv = tr.spine.lv, u = (lv.t12 - lv.c7) / 12, ys = y.acr + 0.005 * H, XA = f.x.acr, vis = f.vis;
  const bx = (yy: number, x: number): number => PI - Math.asin(Math.min(0.97, x / tr.at(yy).X));
  const yu = (k: number): number => ys + k * u;
  const shapes: Shape[] = [];
  // Amplitude en hauteurs de tête : terme de base (anatomie présente chez tout le monde) atténué par l'adiposité — l'omoplate d'un nourrisson ou d'un sujet obèse ne se devine pas —, plus un terme proportionnel à `vis`.
  const ab = (base: number, mus: number): number => H * (base * fk + mus * vis);
  for (const s of [1, -1] as const) {
    /** Point posé (x, y monde) à k vertèbres sous l'acromion et à la fraction `xf` de x.acr du plan médian, côté s. */
    const sd = s > 0 ? 'L' : 'R';
    const P = (k: number, xf: number): Pt => { const q = tr.point(yu(k), s * bx(yu(k), xf * XA), 0).p; return [q.x, q.y]; };
        // 1. LAME : masse continue (même table que l'atome caché `scapula` de back.ts), bord adouci sur 0,018 h.
    // Contour réel de la lame, sens horaire depuis la racine de l'épine : bord médial (quasi vertical), angle inférieur, bord latéral (oblique vers l'aisselle), glène, angle acromial, bord supérieur
    // (oblique : il monte du bord médial vers l'acromion, ce que l'ancien contour à bord horizontal ne faisait pas). Couples [k vertèbres sous l'acromion, fraction de x.acr].
    const outline: readonly (readonly [number, number])[] = [[0.75, 0.28], [1.2, 0.27], [2.3, 0.28], [3.5, 0.29], [4.7, 0.3], [5.5, 0.32], [5.4, 0.39], [4.5, 0.5], [3.4, 0.65], [2.4, 0.75], [1.4, 0.8], [0.6, 0.79], [0.15, 0.74], [0.3, 0.55], [0.5, 0.38]];
    shapes.push({ id: `blade.${sd}`, kind: 'poly', pts: chaikin(outline.map(([k, xf]) => P(k, xf)), 2), amp: ab(0.018, 0.04), edge: 0.048 * H });
    // 2. ÉPINE : crête oblique de la racine (bord médial) à l'acromion ; s'estompe vers l'acromion où le deltoïde la recouvre.
    shapes.push({ id: `spine.${sd}`, kind: 'line', pts: [P(1.05, 0.27), P(0.85, 0.42), P(0.6, 0.58), P(0.25, 0.74), P(0.0, 0.83)], amp: ab(0.022, 0.045), w: 0.016 * H, fade: 0.55 });
    // 3. BORD MÉDIAL : gouttière entre la lame et les érecteurs (décalée vers la ligne médiane de 0,03 h).
    shapes.push({ id: `medial-border.${sd}`, kind: 'line', pts: [P(1.1, 0.205), P(2.2, 0.215), P(3.5, 0.225), P(4.8, 0.235), P(5.4, 0.24)], amp: -ab(0.015, 0.035), w: 0.018 * H, fade: 0 });
    // 4. ANGLE INFÉRIEUR : saillie de la pointe de la lame, allongée le long du bord.
    { const c = P(5.0, 0.31), d = P(5.8, 0.33); shapes.push({ id: `inferior-angle.${sd}`, kind: 'blob', c, ax: norm2(d[0] - c[0], d[1] - c[1]), rx: 0.036 * H, ry: 0.02 * H, amp: ab(0.02, 0.04) }); }
    // 5. INFRA-ÉPINEUX : masse convexe sous l'épine (centre ≈ celui du volume de back.ts), allongée le long de l'épine.
    { const c = P(2.5, 0.54), sp0 = P(1.05, 0.27), sp1 = P(0.0, 0.83); shapes.push({ id: `infraspinatus.${sd}`, kind: 'blob', c, ax: norm2(sp1[0] - sp0[0], sp1[1] - sp0[1]), rx: 0.072 * H, ry: 0.05 * H, amp: ab(0.015, 0.035) }); }
    // 6. GRAND ROND : renflement oblique vers l'aisselle, formant le pli postérieur.
    { const c = P(4.3, 0.62), d = P(3.5, 0.82); shapes.push({ id: `teres-major.${sd}`, kind: 'blob', c, ax: norm2(d[0] - c[0], d[1] - c[1]), rx: 0.052 * H, ry: 0.026 * H, amp: ab(0.018, 0.036) }); }
  }
  // 7. ÉRECTEURS DU RACHIS : deux colonnes continues de chaque côté du sillon vertébral (mêmes ψ que `back.ts` : 0,16 et 0,42), de la crête à D3 ; elles s'effacent vers le haut où le trapèze les recouvre.
  for (const s of [1, -1] as const) for (const [psi, w, k] of [[0.16, 0.034, 1], [0.42, 0.036, 0.85]] as const) {
    const pts: Pt[] = [y.crop - 0.02 * H, y.waist, y.nipple, y.acr + 0.07 * H].map((yy) => { const q = tr.point(yy, s * (PI - psi), 0).p; return [q.x, q.y] as Pt; });
    shapes.push({ id: `erector.${psi < 0.3 ? 'medial' : 'lateral'}.${s > 0 ? 'L' : 'R'}`, kind: 'line', pts, amp: k * ab(0.016, 0.03), w: w * H, fade: 0.55 });
  }
  return finishRelief(shapes, H);
}
/** Subdivision de Chaikin d'un contour fermé (coins coupés à 1/4 – 3/4) : adoucit un polygone anguleux en courbe. */
const chaikin = (p: readonly Pt[], n: number): Pt[] => { let q: Pt[] = [...p]; for (let it = 0; it < n; it++) { const o: Pt[] = []; for (let i = 0; i < q.length; i++) { const a = q[i]!, b = q[(i + 1) % q.length]!; o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } q = o; } return q; };
const norm2 = (x: number, y: number): Pt => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

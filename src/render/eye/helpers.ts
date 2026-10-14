import { darken, lighten } from '../../core/color';
import { dominantColor, edgeColor } from '../../materials';
import { gazeOf } from '../../lighting/gaze3d';
import { halfVectorXY, toLocal, type LightVector } from '../../lighting/light';
import { mulberry32 } from '../../core/prng';
import { el, num } from '../../core/svg';
import type { OpeningGeometry, Vec } from '../../geometry/eye';
import type { EyeSpec } from '../../schema';

/** Point SVG formaté (voir core/svg.ts pour les garanties de `num`). */
export const P = (v: Vec): string => `${num(v.x)} ${num(v.y)}`;



export const openingPath = (g: OpeningGeometry, dx = 0, dy = 0): string => {
  const o = (v: Vec): Vec => ({ x: v.x + dx, y: v.y + dy });
  return `M${P(o(g.pi))}C${P(o(g.u1))} ${P(o(g.u2))} ${P(o(g.po))}C${P(o(g.l1))} ${P(o(g.l2))} ${P(o(g.pi))}Z`;
};

/** Contour lissé (quadratiques passant par les milieux) : adoucit un polygone échantillonné. */
export function smoothClosed(pts: readonly Vec[]): string {
  const n = pts.length;
  const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const first = pts[0] as Vec;
  const last = pts[n - 1] as Vec;
  let d = `M${P(mid(last, first))}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i] as Vec;
    const q = pts[(i + 1) % n] as Vec;
    d += `Q${P(p)} ${P(mid(p, q))}`;
  }
  return `${d}Z`;
}

/** Anneau limbique (liseré sombre au bord de l'iris), ou `null` s'il est désactivé / invisible. */
export function limbalRing(eye: EyeSpec, c: Vec, irisRx: number, irisRy: number): string | null {
  const ringW = irisRx * 0.12 * eye.iris.limbalRing;
  if (ringW <= 0.01) return null;
  return el('ellipse', {
    cx: c.x,
    cy: c.y,
    rx: irisRx - ringW / 2,
    ry: irisRy - ringW / 2,
    fill: 'none',
    stroke: darken(edgeColor(eye.iris.material.base), 0.6),
    'stroke-width': ringW,
    'stroke-opacity': 0.35 + 0.5 * eye.iris.limbalRing,
  });
}

/**
 * Segments « C » d'une courbe lisse passant par TOUS les points (Catmull-Rom → Bézier), sans le
 * « M » initial. Les extrémités sont dupliquées : la courbe démarre/finit dans la direction du
 * premier/dernier segment, sans dépassement.
 */
export function smoothThrough(pts: readonly Vec[]): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] as Vec;
    const p1 = pts[i] as Vec;
    const p2 = pts[i + 1] as Vec;
    const p3 = pts[Math.min(pts.length - 1, i + 2)] as Vec;
    const c1: Vec = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2: Vec = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

export function polygonPath(pts: readonly Vec[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${P(p)}`).join('') + 'Z';
}

// Le tracé du cil (remplissage + liseré de brillance) vit dans lashes-render.ts, qui a besoin
// d'un accès partagé aux mêmes bords (utilisés par le remplissage ET le liseré) — voir ce fichier.

// ------------------------------------------------------------------ Iris

export function irisRadii(eye: EyeSpec): { rx: number; ry: number } {
  const rx = eye.iris.radius * eye.shape.height;
  return { rx, ry: rx * eye.iris.aspect };
}

/** Centre de l'iris : centre de l'ouverture, décalé par la projection 3D du regard (voir gaze3d.ts). */
export function irisCenter(eye: EyeSpec, g: OpeningGeometry): Vec {
  const gaze = gazeOf(eye);
  return {
    x: g.bbox.x + g.bbox.w / 2 + gaze.dx,
    y: g.bbox.y + g.bbox.h / 2 + gaze.dy,
  };
}

/**
 * Décalages (repère local, relatifs au centre de l'iris) des reflets « anime » :
 * la direction vient du vecteur médian de la lumière DU MONDE exprimée dans le repère local.
 * Ainsi, deux yeux tournés différemment ont leurs reflets du même côté dans le monde.
 */
export function highlightOffsets(eye: EyeSpec, worldLight: LightVector): { primary: Vec; secondary: Vec } {
  const L = toLocal(worldLight, eye.transform.rotationDeg);
  const H = halfVectorXY(L);
  const { rx, ry } = irisRadii(eye);
  // Reflet cornéen : essentiellement fixé par la lumière, pas par la rotation du globe (l'approximation
  // usuelle en dessin — la cornée est quasi sphérique quel que soit le regard). Documenté comme limite.
  return {
    primary: { x: H.x * rx * 0.85, y: H.y * ry * 0.85 },
    secondary: { x: -H.x * rx * 0.6, y: -H.y * ry * 0.6 },
  };
}

export function pupilRadii(eye: EyeSpec, irisRx: number, irisRy: number): { rx: number; ry: number } {
  const { size, shape } = eye.pupil;
  if (shape === 'slit_vertical') return { rx: size * irisRx * 0.28, ry: irisRy * 0.82 };
  if (shape === 'slit_horizontal') return { rx: irisRx * 0.82, ry: size * irisRy * 0.28 };
  return { rx: size * irisRx, ry: size * irisRy };
}

/** Fibres de l'iris : géométrie déterministe (seed), donc éditable et identique d'un rendu à l'autre. */
export function irisFibers(eye: EyeSpec, c: Vec, irisRx: number, irisRy: number): string {
  const n = eye.iris.fibers;
  if (n === 0) return '';
  const rnd = mulberry32(eye.seed);
  const mid = dominantColor(eye.iris.material.base);
  const light = lighten(mid, 0.35);
  const dark = darken(mid, 0.45);
  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    // Ordre d'appel fixe : 7 tirages par fibre, même si la fibre est écartée.
    const jitter = rnd();
    const r0 = rnd();
    const r1 = rnd();
    const bend = rnd();
    const pick = rnd();
    const op = rnd();
    const wd = rnd();
    const a = ((i + (jitter - 0.5) * 0.9) / n) * 2 * Math.PI;
    const f0 = eye.pupil.size * (1.02 + 0.1 * r0);
    const f1 = 0.8 + 0.17 * r1;
    if (f1 <= f0 + 0.05) continue;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const p0: Vec = { x: c.x + ca * irisRx * f0, y: c.y + sa * irisRy * f0 };
    const p1: Vec = { x: c.x + ca * irisRx * f1, y: c.y + sa * irisRy * f1 };
    const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const off = (bend - 0.5) * 0.12 * len;
    const q: Vec = {
      x: (p0.x + p1.x) / 2 + (-(p1.y - p0.y) / len) * off,
      y: (p0.y + p1.y) / 2 + ((p1.x - p0.x) / len) * off,
    };
    paths.push(
      el('path', {
        d: `M${P(p0)}Q${P(q)} ${P(p1)}`,
        stroke: pick < 0.5 ? light : dark,
        'stroke-opacity': 0.12 + 0.25 * op,
        'stroke-width': irisRx * (0.006 + 0.014 * wd),
      }),
    );
  }
  return el('g', { fill: 'none', 'stroke-linecap': 'round' }, paths);
}

// ------------------------------------------------------------------ Compilation


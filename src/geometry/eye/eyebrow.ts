import { rad, clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { BBox } from '../../materials';
import type { OpeningGeometry } from './opening';
import { norm } from './primitives';
import type { Vec } from './primitives';

// ------------------------------------------------------------------ Sourcil

export interface BrowGeometry {
  readonly center: Vec[];
  readonly normals: Vec[];
  readonly tangents: Vec[];
  readonly widths: number[];
  /** Contour fermé : bord supérieur (tête -> queue) puis bord inférieur (queue -> tête). */
  readonly outline: Vec[];
  readonly bbox: BBox;
}

export function browGeometry(g: OpeningGeometry, brow: NonNullable<EyeSpec['eyebrow']>, creaseHeight: number): BrowGeometry {
  const s = g.s;
  const creaseTopY = g.bbox.y - Math.max(0, creaseHeight) * g.h;
  const thickness = brow.thickness * g.h;
  const yc = creaseTopY - brow.gap * g.h - thickness / 2;
  const lenPx = brow.length * g.w;
  const xMid = s * g.w * 0.05;
  // Pinch : pousse la TÊTE (P0, côté nez) vers l'intérieur (horizontal) et vers le bas si positif,
  // vers l'extérieur et le haut si négatif — voir le commentaire du champ dans schema.ts. Le facteur
  // -s ci-dessous garantit que « intérieur » désigne bien le côté nez quel que soit `outerSide`.
  const pinchX = -s * brow.pinch * g.w * 0.09;
  const pinchY = brow.pinch * g.h * 0.16;
  const P0: Vec = { x: xMid - (s * lenPx) / 2 + pinchX, y: yc + pinchY };
  const P2: Vec = { x: xMid + (s * lenPx) / 2, y: yc - Math.tan(rad(brow.tiltDeg)) * lenPx };
  const P1: Vec = { x: xMid, y: (P0.y + P2.y) / 2 - brow.arch * g.h * 0.45 };

  const n = 28;
  const center: Vec[] = [];
  const normals: Vec[] = [];
  const tangents: Vec[] = [];
  const widths: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    center.push({
      x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
      y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
    });
    const T = norm({ x: 2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), y: 2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y) });
    tangents.push(T);
    normals.push({ x: s * T.y, y: -s * T.x });
    // Tête franche mais adoucie, corps épais, queue effilée en pointe.
    const profile = (1 - brow.taper * t ** 1.5) * Math.min(1, 0.55 + 6 * t) * (1 - t ** 14);
    widths.push(thickness * Math.max(0, profile));
  }
  const top: Vec[] = [];
  const bottom: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const c = center[i] as Vec;
    const N = normals[i] as Vec;
    const w2 = (widths[i] as number) / 2;
    top.push({ x: c.x + N.x * w2, y: c.y + N.y * w2 });
    bottom.push({ x: c.x - N.x * w2, y: c.y - N.y * w2 });
  }
  const outline = [...top, ...bottom.reverse()];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { center, normals, tangents, widths, outline, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

export interface Hair {
  readonly p0: Vec;
  readonly p1: Vec;
  readonly p2: Vec;
  /** true : teinte claire ; false : teinte foncée. */
  readonly light: boolean;
}

/** Poils : orientés vers le haut et l'extérieur près de la tête, presque couchés vers la queue. */
export function browHairs(b: BrowGeometry, count: number, seed: number, hPx: number): Hair[] {
  const rnd = mulberry32(seed >>> 0);
  const out: Hair[] = [];
  const last = b.center.length - 1;
  for (let j = 0; j < count; j++) {
    // Ordre d'appel fixe : 5 tirages par poil.
    const rt = rnd();
    const ro = rnd();
    const rl = rnd();
    const ra = rnd();
    const rc = rnd();
    const t = clamp((j + rt) / count, 0, 1);
    const i = Math.round(t * last);
    const c = b.center[i] as Vec;
    const N = b.normals[i] as Vec;
    const T = b.tangents[i] as Vec;
    const w = b.widths[i] as number;
    const base: Vec = { x: c.x + N.x * (ro * 2 - 1) * 0.8 * (w / 2), y: c.y + N.y * (ro * 2 - 1) * 0.8 * (w / 2) };
    const ang = rad(55 + (8 - 55) * t + (ra - 0.5) * 14);
    const dir: Vec = { x: T.x * Math.cos(ang) + N.x * Math.sin(ang), y: T.y * Math.cos(ang) + N.y * Math.sin(ang) };
    const len = w * (0.9 + 0.5 * rl) + hPx * 0.01;
    out.push({
      p0: base,
      p1: { x: base.x + dir.x * len * 0.5 + N.x * len * 0.08, y: base.y + dir.y * len * 0.5 + N.y * len * 0.08 },
      p2: { x: base.x + dir.x * len, y: base.y + dir.y * len },
      light: rc < 0.35,
    });
  }
  return out;
}

import type { EyeSpec } from '../../schema';
import type { HighlightItem } from '../../schema/eye-highlights';
import { chaikin, vertices } from './pupil-shape';
import type { Vec } from './primitives';

/**
 * OPT-01/04 — Placement des reflets (géométrie pure). Entrée : centre et rayons de l'iris, vecteur médian de la lumière
 * (repère local), boîte de l'ouverture. Sortie : centre final, contour, rotation. Règle d'occlusion (testée) : le centre
 * d'un reflet ne sort JAMAIS de la zone de confinement (ellipse de l'iris ou ouverture), et son rayon est réduit pour
 * que le contour y reste.
 */
export interface PlacedHighlight {
  readonly item: HighlightItem;
  readonly cx: number;
  readonly cy: number;
  /** Contour en repère local au centre (vide pour circle/ellipse : tracés par <ellipse>). */
  readonly outline: readonly Vec[];
  readonly rx: number;
  readonly ry: number;
  /** Vrai si la position demandée a dû être ramenée dans la zone de confinement. */
  readonly clamped: boolean;
}

export interface PlaceCtx {
  readonly c: Vec;
  readonly irisRx: number;
  readonly irisRy: number;
  readonly half: Vec;
  readonly bbox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

const SHAPE_PROFILE = (h: HighlightItem): Vec[] => {
  if (h.shape === 'star') return chaikin(vertices(5, h.inner), 1);
  if (h.shape === 'sparkle') return vertices(4, Math.min(0.35, h.inner));
  if (h.shape === 'diamond') return vertices(4, null);
  if (h.shape === 'cross') return vertices(4, 0.5).map((p, i) => (i % 2 ? { x: p.x * 0.55, y: p.y * 0.55 } : p));
  return [];
};

export function placeHighlights(items: readonly HighlightItem[], ctx: PlaceCtx): PlacedHighlight[] {
  return items.map((it) => {
    const rx = it.size * ctx.irisRx;
    const ry = rx * it.aspect;
    let cx: number;
    let cy: number;
    if (it.anchor === 'light') {
      const k = it.role === 'secondary' ? -it.along * 0.7 : it.along;
      cx = ctx.c.x + ctx.half.x * ctx.irisRx * k;
      cy = ctx.c.y + ctx.half.y * ctx.irisRy * k;
    } else if (it.anchor === 'iris') {
      cx = ctx.c.x + it.x * ctx.irisRx;
      cy = ctx.c.y + it.y * ctx.irisRx;
    } else {
      cx = ctx.bbox.x + ctx.bbox.w / 2 + it.x * ctx.irisRx;
      cy = ctx.bbox.y + ctx.bbox.h / 2 + it.y * ctx.irisRx;
    }
    let clamped = false;
    if (it.confine === 'iris') {
      // Centre ramené dans l'ellipse de l'iris, marge = rayon du reflet.
      const ax = Math.max(ctx.irisRx - rx, ctx.irisRx * 0.05);
      const ay = Math.max(ctx.irisRy - Math.max(ry, rx * 0.5), ctx.irisRy * 0.05);
      const dx = (cx - ctx.c.x) / ax;
      const dy = (cy - ctx.c.y) / ay;
      const m = Math.hypot(dx, dy);
      if (m > 1) { cx = ctx.c.x + dx / m * ax; cy = ctx.c.y + dy / m * ay; clamped = true; }
    } else {
      const b = ctx.bbox;
      const nx = Math.min(b.x + b.w - rx, Math.max(b.x + rx, cx));
      const ny = Math.min(b.y + b.h - ry, Math.max(b.y + ry, cy));
      if (nx !== cx || ny !== cy) { clamped = true; cx = nx; cy = ny; }
    }
    const a = (it.rotationDeg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const outline = SHAPE_PROFILE(it).map((p) => {
      const x = p.x * rx;
      const y = p.y * ry;
      return { x: x * ca - y * sa, y: x * sa + y * ca };
    });
    return { item: it, cx, cy, outline, rx, ry, clamped };
  });
}

/** Reflets effectifs d'un œil : la liste détaillée, ou l'équivalent EXACT des deux reflets historiques (non utilisé pour le rendu historique). */
export const hasDetailedHighlights = (h: EyeSpec['highlights']): boolean => h.list.length > 0;

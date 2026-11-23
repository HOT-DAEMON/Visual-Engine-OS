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

/** Empreinte déterministe [0 ; 1[ d'un reflet (position, taille, nombre de pointes) et d'un indice : le `jitter` ne tire pas de hasard au rendu. */
export const highlightHash = (h: HighlightItem, i: number): number => {
  const v = Math.sin((h.x * 12.9898 + h.y * 78.233 + h.size * 37.719 + (h.points ?? 4) * 4.1414 + i * 19.19) * 1.7) * 43758.5453;
  return v - Math.floor(v);
};
/** Facteur de longueur de l'aiguille de la pointe `k` (sur `n`) : la première est la plus longue, les opposées plus courtes, ± `jitter` (réf. 10a : une lame verticale longue, des lames latérales courtes). */
export const rayFactor = (h: HighlightItem, k: number, n: number): number => {
  const base = [1, 0.6, 0.82, 0.6][k % 4] as number * (n > 4 ? 0.9 : 1);
  return Math.max(0.2, base * (1 + h.jitter * (highlightHash(h, 100 + k) - 0.5) * 1.2));
};

const SHAPE_PROFILE = (h: HighlightItem): Vec[] => {
  const lobes = (pts: Vec[], step: number): Vec[] => (h.jitter > 0 ? pts.map((p, i) => { const s = i % step === 0 ? 1 + h.jitter * (highlightHash(h, i) - 0.5) * 0.9 : 1; return { x: p.x * s, y: p.y * s }; }) : pts);
  if (h.shape === 'star') return chaikin(vertices(h.points ?? 5, h.inner), 1);
  if (h.shape === 'sparkle') return lobes(vertices(h.points ?? 4, Math.min(0.35, h.inner)), 2);
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

/**
 * Pupille OCCULTÉE par un éclat en étoile (passe 10, partagée en passe 14) : dans les réfs 04, 10a et 10b la pupille est noyée dans une étoile centrée, aucun disque sombre
 * n'est visible. Un éclat n'occulte que s'il est ancré à l'iris, centré dans la pupille et au moins aussi grand qu'elle. Une seule définition pour la règle de géométrie
 * (`pupil-darker-than-iris`, verify/eye.ts) et la règle de pixels (`pupil-darker-than-iris-pixels`) : avant, seule la seconde l'exemptait (30 faux avertissements sur la galerie 4).
 */
export const pupilOccludedByStar = (eye: { readonly pupil: { readonly size: number }; readonly highlights?: { readonly list: readonly { shape?: string; anchor?: string; x: number; y: number; size: number }[] } }): boolean =>
  (eye.highlights?.list ?? []).some((h) => h.shape === 'sparkle' && h.anchor === 'iris' && Math.hypot(h.x, h.y) <= eye.pupil.size && h.size >= eye.pupil.size);

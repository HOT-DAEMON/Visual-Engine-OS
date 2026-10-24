import { mix } from '../../core/color';
import { clamp } from '../../core/math';
import { el, urlRef } from '../../core/svg';
import type { ResolvedAppearance } from '../../appearance';
import type { HairLock } from '../../face/hair';
import { smoothstep } from '../../face/hair/noise';
import { gradientStop } from '../../materials';
import { celBands } from './hair-cel';
import { smoothPath } from './hair-detail';
import { polyPath } from './path';

/** Contexte de rendu d'une chevelure : apparence résolue, lumière locale 2D (vers la source) et échelle. */
export interface LockStyle {
  readonly id: string;
  readonly ra: ResolvedAppearance;
  readonly ld: { x: number; y: number };
  readonly W: number;
  /** Rendu « encre » : noir franc, bande blanche continue, contour noir épais. */
  readonly ink?: string;
}

/**
 * Rendu ENCRE d'une mèche : aplat noir franc, contour noir épais, UNE bande blanche continue (aplat opaque, bords nets) le
 * long de la mèche, rognée par son contour. Les mèches fines n'ont qu'un contour fin ; les masses arrière, aucun reflet.
 */
function inkMarkup(l: HairLock, k: number, st: LockStyle, d: string): { defs: string[]; markup: string[] } {
  const { ld, W, id, ink } = st;
  const big = l.rank === 'mass' || l.rank === 'main' || l.rank === 'plait';
  const out: string[] = [el('path', { d, fill: ink, stroke: ink, 'stroke-width': W * (big ? 0.0042 : 0.0022), 'stroke-linejoin': 'round' })];
  const defs: string[] = [];
  const bands = big && l.layer !== 'back' ? celBands(l, ld, 0.75, false, [0.05, 0.9]) : null;
  if (bands?.highlight) {
    const cid = `${id}-c${k}`;
    defs.push(el('clipPath', { id: cid }, [el('path', { d })]));
    out.push(el('g', { 'clip-path': urlRef(cid) }, [el('path', { d: polyPath(bands.highlight), fill: '#ffffff' })]));
    // Le contour noir est redessiné par-dessus la bande : elle ne touche jamais le bord.
    out.push(el('path', { d, fill: 'none', stroke: ink, 'stroke-width': W * 0.0042, 'stroke-linejoin': 'round' }));
  }
  return { defs, markup: out };
}

const GRAD_T = [0, 0.25, 0.5, 0.75, 1] as const;
/** Opacité propre à chaque épaisseur : les poils fins et les mèches fines sont un peu translucides. */
const RANK_ALPHA = { mass: 1, main: 1, plait: 1, fine: 0.88, hairline: 0.85 } as const;

/**
 * Éléments SVG d'UNE mèche, dans l'ordre de dessin :
 *  1. ombre portée teintée (couleur d'ombre PROCHE de la principale, légèrement bleutée) décalée à l'opposé de la lumière ;
 *  2. halo translucide (bords qui se fondent) ;
 *  3. remplissage : dégradé racine → pointe à N stops + fondu d'opacité vers la pointe (sinon uni) ;
 *  4. mode cel : ombre, ombre propre et bande de reflet blanche à contour dur, rognées par le contour de la mèche ;
 *  5. contour (seulement mèches épaisses / segments de tresse).
 */
export function lockMarkup(l: HairLock, k: number, st: LockStyle, depth: number, cast: boolean): { defs: string[]; markup: string[] } {
  const { ra, ld, W, id } = st;
  const spec = ra.spec;
  const defs: string[] = [];
  const out: string[] = [];
  const d = smoothPath(l.poly);
  if (st.ink) return inkMarkup(l, k, st, d);
  const dark = (c: string): string => (depth > 0 ? mix(c, '#000000', depth) : c);
  const colorAt = (t: number): string => dark(ra.tone(l.tone, ra.ramp(t)));
  const cel = spec.shading.mode === 'cel';
  const fade = l.fade ?? 0;
  const alphaAt = (t: number): number => ra.rampAlpha(t) * (1 - fade * smoothstep(clamp((t - 0.35) / 0.65, 0, 1))) * spec.opacity * (RANK_ALPHA[l.rank] ?? 1);
  const sp = l.spine;
  // Perf : les brins FINS d'une mèche simulée sont plats (un dégradé par brin = 1 <linearGradient> de plus pour presque rien à l'écran).
  const flatFine = l.sim === true && l.rank === 'fine';
  const needsGrad = !flatFine && !!sp && sp.length > 3 && (spec.gradient.length > 0 || fade > 0.02 || l.rank === 'hairline' || l.rank === 'fine');
  const rankBig = l.rank === 'mass' || l.rank === 'main' || l.rank === 'plait';

  if (cast && spec.shading.castShadow > 0.02 && rankBig && l.layer !== 'back') {
    const o = W * 0.0085;
    out.push(el('path', { d, transform: `translate(${-ld.x * o} ${-ld.y * o})`, fill: ra.shadow, opacity: 0.55 * spec.shading.castShadow }));
  }
  if ((l.edgeFade ?? 0) > 0.02) out.push(el('path', { d, fill: 'none', stroke: colorAt(0.5), 'stroke-width': Math.max(W * 0.003, (l.w0 ?? W * 0.02) * 0.3), 'stroke-linejoin': 'round', opacity: 0.22 * (l.edgeFade ?? 0) }));

  let fill: string;
  let opacity: number | undefined;
  if (needsGrad && sp) {
    const a = sp[0] as { x: number; y: number };
    const b = sp[sp.length - 1] as { x: number; y: number };
    const gid = `${id}-g${k}`;
    const lit = (c: string): string => (cel ? mix(c, ra.light, 0.16) : c);
    defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: b.x + (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < 1e-6 ? 1 : 0), y2: b.y }, GRAD_T.map((t) => gradientStop(t, lit(colorAt(t)), alphaAt(t)))));
    fill = urlRef(gid);
  } else {
    fill = cel ? mix(colorAt(0.5), ra.light, 0.16) : colorAt(0.5);
    opacity = spec.opacity * (RANK_ALPHA[l.rank] ?? 1) < 0.999 ? spec.opacity * (RANK_ALPHA[l.rank] ?? 1) : undefined;
  }
  const outline = l.edge ? mix(ra.base, '#000000', 0.5) : undefined;
  out.push(el('path', { d, fill, opacity, stroke: outline, 'stroke-width': l.edge ? W * (cel ? 0.0018 : 0.0014) : undefined, 'stroke-opacity': l.edge ? (cel ? 0.55 : 0.35) : undefined }));

  if (cel && rankBig && sp && l.layer !== 'back') {
    const tones = ra.cel(dark(ra.tone(l.tone, ra.ramp(0.4))));
    const bands = celBands(l, ld, spec.shading.highlightBand, spec.shading.bands === 3);
    const cid = `${id}-c${k}`;
    defs.push(el('clipPath', { id: cid }, [el('path', { d })]));
    const g: string[] = [];
    if (bands.shade) g.push(el('path', { d: polyPath(bands.shade), fill: tones.shade }));
    if (bands.core) g.push(el('path', { d: polyPath(bands.core), fill: tones.core, opacity: 0.9 }));
    if (bands.highlight) g.push(el('path', { d: polyPath(bands.highlight), fill: ra.highlight, stroke: mix(ra.light, '#ffffff', 0.4), 'stroke-width': W * 0.0011, 'stroke-linejoin': 'miter', opacity: 0.95 }));
    out.push(el('g', { 'clip-path': urlRef(cid) }, g));
  }
  return { defs, markup: out };
}

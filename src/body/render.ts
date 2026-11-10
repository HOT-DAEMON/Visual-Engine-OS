import { darken, lighten, luminance, mix } from '../core/color';
import { el, urlRef } from '../core/svg';
import type { BodyGeo } from './geometry';
import { reveal, tierOf } from './muscle-tiers';
import { box, pathOf } from './shape';
import { bodyTones } from './tones';
import type { Atom, Level } from './types';

export interface BodyRenderOpts {
  /** Teinte de peau (hex). */
  readonly skin: string;
  /** Hiérarchie de présentation : 0 silhouette · 1 + masses · 2 + muscles/segments · 3 + repères et micro-détails. */
  readonly level?: Level;
  /** `skin` = rendu final ; `atoms` = chaque atome coloré par composant (preuve du morcellement, atomes cachés en pointillés). */
  readonly mode?: 'skin' | 'atoms';
  /** Préfixe d'identifiants (plusieurs corps dans un même SVG). */
  readonly uid?: string;
  /**
   * Contour du cou (chemin SVG, repère de l'hôte) fourni par le MOTEUR DE COU : il borne le fondu de la base du cou au-dessus de la base (le fondu ne dépasse
   * jamais du cou sur le fond) ; en dessous, il est limité à la largeur de la base. Absent : fondu non borné (comportement historique).
   */
  readonly neckContour?: string;
  /** Apparence résolue de la peau de l'hôte (base, ombre) : source unique des teintes, lue aussi par le cou. Absente : `darken(peau)` historique (voir `tones.ts`). */
  readonly appearance?: { readonly base: string; readonly shadow: string };
  /** Couleur de BASE du cou (`neckBase`) : le fondu de la base du cou y converge, il n'y a donc pas de bande d'un autre ton. Absente : mélange historique peau/ombre. */
  readonly neckTone?: string;
}
export interface BodyMarkup { readonly back: string; readonly front: string }

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
function hslHex(hh: number, s: number, l: number): string {
  const k = (n: number): number => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number): string => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}
/** Rapport de contraste (lumière relative + 0,05) entre deux couleurs. */
export const contrastRatio = (a: string, b: string): number => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Rapport visé entre la peau et son trait : 2,0, ou 80 % du maximum atteignable (trait noir) quand la peau est si foncée que 2,0 est inatteignable. */
export const inkTarget = (skin: string): number => Math.min(2, 0.8 * contrastRatio(skin, '#000000'));
/**
 * Couleur du trait d'une peau. Historique : `darken(peau, 0,62)` — suffisant sur peau claire (rapport ≥ 2,2) mais un assombrissement RELATIF
 * donne un trait presque invisible sur peau foncée (rapport 1,23 sur #3b2219). On assombrit alors davantage, jusqu'au rapport visé ;
 * sur peau claire le résultat est IDENTIQUE à l'historique (aucune régression visuelle).
 */
export function inkOf(skin: string): string {
  let t = 0.62, ink = darken(skin, t);
  while (contrastRatio(skin, ink) < inkTarget(skin) && t < 0.97) { t = Math.min(0.97, t + 0.02); ink = darken(skin, t); }
  return ink;
}
const hash = (s: string): number => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

/**
 * Rendu = f(géométrie, matière, lumière) : AUCUN filtre (le coût d'un corps est ses chemins). Lumière unique venant de la gauche de l'image ;
 * silhouette = union des enveloppes (contour posé UNE fois sous toutes les peaux : aucun trait interne entre torse, bras et mains).
 * `front` = fondu de la base du cou, à peindre APRÈS le visage pour que le cou « entre » dans le tronc sans couture.
 */
export function renderBody(geo: BodyGeo, o: BodyRenderOpts): BodyMarkup {
  const { frame: f } = geo, h = f.h, level = o.level ?? 3, uid = o.uid ?? 'bd';
  const { skin, shade } = bodyTones(o), ink = inkOf(skin), sw = 0.0085 * h;
  /** Visibilité du relief musculaire : STRICTEMENT nulle quand la définition est nulle (un nourrisson n'a ni abdominaux ni pectoraux visibles). */
  const vis = clamp01(1.4 * f.vis);
  const shown = geo.atoms.filter((a) => a.view === 'front' && a.level <= level).sort((a, b) => a.z - b.z);
  const defs: string[] = [];
  const g: string[] = [];
  if (o.mode === 'atoms') {
    for (const a of [...geo.atoms].filter((q) => q.id !== 'neck').sort((p, q) => p.z - q.z)) {
      const col = hslHex(hash(a.part) % 360, 0.7, 0.45);
      const dash = a.view === 'occluded' ? `${0.012 * h} ${0.01 * h}` : undefined;
      g.push(el('path', { d: pathOf(a.poly, !a.open), fill: a.open ? 'none' : col, 'fill-opacity': a.level === 0 ? 0.12 : 0.3, stroke: col, 'stroke-width': (a.level === 0 ? 1.2 : 0.7) * sw * 0.6, 'stroke-dasharray': dash, 'stroke-linejoin': 'round' }));
    }
    return { back: el('g', {}, g), front: '' };
  }
  // Le tronc est coupé net à la ligne des hanches (sans contour) : le corps est un buste, pas une figure complète (jambes : hors périmètre).
  const clipId = `${uid}-crop`;
  defs.push(el('clipPath', { id: clipId }, [el('rect', { x: -9999, y: -9999, width: 19998, height: 9999 + f.y.crop })]));
  const isTorso = (a: Atom): boolean => !/^(upper-arm|forearm|hand)\./.test(a.part);
  const layerOf = (a: Atom): number => (a.part.startsWith('hand.') ? 3 : a.part.startsWith('forearm.') ? 2 : a.part.startsWith('upper-arm.') ? 1 : 0);
  const detail = (a: Atom): string => {
    const d = pathOf(a.poly, !a.open);
    if (a.kind === 'muscle' || a.kind === 'fat') {
      const t = a.tone ?? 0, k = (a.kind === 'fat' ? (a.part === 'breasts' ? 0.9 : 0.5) : vis) * (a.tier === undefined ? 1 : reveal(tierOf(f.vis), a.tier));
      return el('path', { d, fill: t >= 0 ? lighten(skin, 0.9 * t) : darken(skin, -1.4 * t), 'fill-opacity': 0.7 * k, stroke: shade, 'stroke-width': 0.4 * sw, 'stroke-opacity': 0.7 * k, 'stroke-linejoin': 'round' });
    }
    if (a.kind === 'line') {
      const fold = a.id.startsWith('breast.fold'), crease = a.part.startsWith('hand.') || a.part.startsWith('forearm.');
      return el('path', { d, fill: 'none', stroke: ink, 'stroke-width': (fold ? 0.9 : 0.45) * sw, 'stroke-opacity': fold ? 0.5 : crease ? 0.45 : 0.55 * vis, 'stroke-linecap': 'round' });
    }
    if (a.kind === 'bone') return el('path', { d, fill: 'none', stroke: ink, 'stroke-width': 0.5 * sw, 'stroke-opacity': 0.5 * (1 - f.fat) * clamp01(f.vis * 2 + 0.2), 'stroke-linecap': 'round' });
    if (a.kind === 'nail') return el('path', { d, fill: lighten(skin, 0.42), 'fill-opacity': 0.85, stroke: shade, 'stroke-width': 0.4 * sw });
    if (a.id.includes('areola') || a.id.includes('nipple')) return el('path', { d, fill: mix(skin, '#7a3f35', 0.22 - (a.tone ?? 0) * 0.45), 'fill-opacity': 0.9 });
    if (a.kind === 'skin') return el('path', { d, fill: darken(skin, 0.1), 'fill-opacity': 0.2 });
    return el('path', { d, fill: shade, 'fill-opacity': 0.28 });
  };
  const env = shown.filter((a) => a.kind === 'skin' && a.level === 0);
  const outline = (a: Atom): string => el('path', { d: pathOf(a.poly), fill: ink, stroke: ink, 'stroke-width': 2 * sw, 'stroke-linejoin': 'round' });
  // Un dégradé d'ombre PAR COUCHE (tronc, bras, avant-bras, main) et non par atome : 7 dégradés au lieu de ~70 (le coût d'un corps est ses chemins).
  const grad = new Map<string, string>();
  const gradOf = (a: Atom): string => {
    const key = `${layerOf(a)}${a.side}`;
    let id = grad.get(key);
    if (!id) {
      const grp = env.filter((q) => layerOf(q) === layerOf(a) && q.side === a.side), b = box(grp.flatMap((q) => [...q.poly]));
      id = `${uid}-sh${grad.size}`;
      grad.set(key, id);
      defs.push(el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: b.x0, y1: 0, x2: b.x1, y2: 0 }, [el('stop', { offset: 0, 'stop-color': shade, 'stop-opacity': 0 }), el('stop', { offset: 0.55, 'stop-color': shade, 'stop-opacity': 0.08 }), el('stop', { offset: 1, 'stop-color': shade, 'stop-opacity': layerOf(a) === 0 ? 0.3 : 0.5 })]));
    }
    return id;
  };
  const visible = (a: Atom): boolean => !((a.kind === 'muscle') && (vis < 0.06 || (a.tier !== undefined && reveal(tierOf(f.vis), a.tier) < 0.04))) && !(a.kind === 'line' && !a.part.startsWith('hand.') && !a.part.startsWith('forearm.') && !a.id.startsWith('breast') && vis < 0.08) && !(a.kind === 'bone' && f.vis < 0.03);
  // Ordre : contours des membres (sous toutes les peaux) → tronc (UN SEUL groupe découpé : contour, peau, ombre, détails) → bras → avant-bras → main.
  const layerAtoms = (layer: number): string[] => {
    const out: string[] = [];
    // Main et doigts : peau seule (leur ombre est trop petite pour justifier un 3e dessin du même chemin).
    for (const a of env.filter((q) => layerOf(q) === layer)) out.push(el('path', { d: pathOf(a.poly), fill: skin }), ...(layer === 3 ? [] : [el('path', { d: pathOf(a.poly), fill: urlRef(gradOf(a)) })]));
    for (const a of shown.filter((q) => layerOf(q) === layer && !(q.kind === 'skin' && q.level === 0) && visible(q))) out.push(detail(a));
    return out;
  };
  for (const a of env.filter((q) => !isTorso(q))) g.push(outline(a));
  g.push(el('g', { 'clip-path': urlRef(clipId) }, [...env.filter(isTorso).map(outline), ...layerAtoms(0)]));
  for (let layer = 1; layer < 4; layer++) g.push(...layerAtoms(layer));
  const { a: an } = f, bx = an.baseHalf * 1.04, y0 = an.baseY - 0.09 * h, y1 = an.baseY + 0.012 * h;
  defs.push(el('linearGradient', { id: `${uid}-nk`, x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: 0, 'stop-color': o.neckTone ?? mix(skin, shade, 0.1), 'stop-opacity': 0 }), el('stop', { offset: 1, 'stop-color': o.neckTone ?? mix(skin, shade, 0.1), 'stop-opacity': 1 })]));
  const fade = el('path', { d: `M${-bx} ${y0}L${bx} ${y0}L${bx} ${y1}L${-bx} ${y1}Z`, fill: urlRef(`${uid}-nk`) });
  let front = fade;
  if (o.neckContour) {
    const cid = `${uid}-nk-clip`;
    defs.push(el('clipPath', { id: cid }, [el('path', { d: o.neckContour }), el('rect', { x: -an.baseHalf, y: an.baseY - 0.004 * h, width: 2 * an.baseHalf, height: 9999 })]));
    front = el('g', { 'clip-path': urlRef(cid) }, [fade]);
  }
  return { back: el('g', {}, [el('defs', {}, defs), ...g]), front };
}

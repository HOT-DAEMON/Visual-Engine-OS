import { mix } from '../core/color';
import { clamp01 } from '../core/math';
import { el, num, urlRef } from '../core/svg';
import type { ResolvedAppearance } from '../appearance';
import { polyBox } from '../face/poly';
import type { LightVector } from '../lighting/light';
import { direction2D } from '../lighting/light';
import { gradientStop as stop } from '../materials';
import type { RimSpec } from '../schema';
import type { SoftKit } from '../render/face/soft';
import { relations } from './graph';
import { polysD, type ComponentId, type FaceComponent } from './types';

/** Lumière de contour EFFECTIVE d'un composant, après propagation de ses parent / enfants / frères. */
export interface ResolvedRim {
  readonly id: ComponentId;
  readonly color: string;
  /** Intensité propre + reçue (0–1). `received` est la part venue des autres composants. */
  readonly intensity: number;
  readonly received: number;
  readonly width: number;
  readonly side: RimSpec['side'];
}

/** Part maximale de l'intensité propre qu'un composant peut recevoir des autres : un voisin ne « vole » pas la lumière de contour. */
const MAX_RECEIVED = 0.5;

/**
 * Propage les lumières de contour : l'intensité d'un composant A se partage UN SAUT à son parent (`influence.parent`), à ses enfants
 * (`influence.children`) et à ses frères (`influence.siblings`), pondérée par l'intensité de A. La propagation part des valeurs
 * PROPRES (jamais des valeurs déjà propagées) : pas de cascade ni de boucle. Un composant sans réglage propre reçoit au plus
 * `MAX_RECEIVED` et prend la couleur de celui qui l'éclaire. Le résultat est borné à [0, 1].
 */
export function resolveRims(components: readonly FaceComponent[], specs: Readonly<Record<string, RimSpec>>, ra: ResolvedAppearance): Map<ComponentId, ResolvedRim> {
  const rel = relations(components);
  const own = (id: ComponentId): RimSpec | undefined => specs[id];
  const received = new Map<ComponentId, { amount: number; color: string; w: number }>();
  const give = (to: ComponentId, amount: number, color: string): void => {
    const cur = received.get(to) ?? { amount: 0, color, w: 0 };
    // Couleur reçue : moyenne pondérée par les quantités (la plus forte source domine).
    const w = cur.w + amount;
    received.set(to, { amount: cur.amount + amount, color: w === 0 ? color : mix(cur.color, color, amount / w), w });
  };
  for (const c of components) {
    const s = own(c.rim ?? c.id);
    if (!s || s.intensity <= 0) continue;
    const r = rel.get(c.id);
    const color = s.color ?? ra.rim;
    if (r?.parent) give(r.parent, s.intensity * s.influence.parent, color);
    for (const k of r?.children ?? []) give(k, s.intensity * s.influence.children, color);
    for (const k of r?.siblings ?? []) give(k, s.intensity * s.influence.siblings, color);
  }
  const out = new Map<ComponentId, ResolvedRim>();
  for (const c of components) {
    const s = own(c.rim ?? c.id);
    const base = s?.intensity ?? 0;
    const rec = received.get(c.id);
    const got = rec ? Math.min(rec.amount, s ? MAX_RECEIVED * Math.max(base, 0.2) : MAX_RECEIVED * 0.5) : 0;
    const color = s?.color ?? (rec && base === 0 ? rec.color : ra.rim);
    out.set(c.id, { id: c.id, color: rec && base > 0 ? mix(color, rec.color, got / (base + got)) : color, intensity: clamp01(base + got), received: got, width: s?.width ?? 0.3, side: s?.side ?? 'auto' });
  }
  return out;
}

/** Vecteur du côté éclairé d'une lumière de contour. `auto` : côté OPPOSÉ à la lumière principale (contrat du moteur d'apparence). */
export function sideVector(side: RimSpec['side'], L: LightVector): { x: number; y: number } | null {
  const d = direction2D(L);
  switch (side) {
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'all': return null;
    default: return { x: -d.x, y: -d.y };
  }
}

/**
 * Dessine la lumière de contour d'un composant : liseré intérieur flou (clippé à la silhouette), dégradé le long du côté éclairé qui
 * s'éteint avant le milieu du composant. Les composants à côtés artificiels fournissent `rimEdge` (arêtes ouvertes réelles seulement).
 */
export function renderRim(id: string, c: FaceComponent, r: ResolvedRim, L: LightVector, u: number, kit: SoftKit): { defs: string[]; markup: string } {
  if (r.intensity < 0.01 || c.polys.length === 0) return { defs: [], markup: '' };
  const b = polyBox(c.polys.flat());
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const v = sideVector(r.side, L);
  const clipD = polysD(c.polys);
  const edgeD = c.rimEdge ? c.rimEdge.map((e) => `M${e.map((q) => `${num(q.x)} ${num(q.y)}`).join('L')}`).join('') : clipD;
  const gid = `${id}-rim-g-${c.id}`;
  const cid = `${id}-rim-c-${c.id}`;
  // Largeur apparente : 0,8 à 5 px (échelle `u`) ; doublée car la moitié extérieure du trait est coupée par la silhouette. Flou ∝ largeur.
  const w = (0.8 + 4.2 * r.width) * u * 2;
  const ext = v ? (Math.abs(v.x) * b.w) / 2 + (Math.abs(v.y) * b.h) / 2 : 1;
  const defs = [el('clipPath', { id: cid }, [el('path', { d: clipD })])];
  // Le dégradé s'éteint à 55 % de la traversée : seul le côté éclairé porte le liseré (le côté opposé reste franchement sombre).
  const stroke = v ? (defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: cx + v.x * ext, y1: cy + v.y * ext, x2: cx - v.x * ext, y2: cy - v.y * ext }, [stop(0, r.color, r.intensity), stop(0.3, r.color, r.intensity * 0.35), stop(0.55, r.color, 0)])), urlRef(gid)) : r.color;
  const line = el('path', { d: edgeD, fill: 'none', stroke, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': v ? undefined : r.intensity * 0.6, filter: kit.blur((0.4 + 1.2 * r.width) * u) });
  return { defs, markup: el('g', { 'clip-path': urlRef(cid) }, [line]) };
}

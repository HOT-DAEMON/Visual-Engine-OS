import { clamp01 } from '../core/math';
import { el, urlRef } from '../core/svg';
import { polyBox } from '../face/poly';
import type { LightVector } from '../lighting/light';
import { softness } from '../lighting/rig';
import type { ContactSpec } from '../schema';
import { polysD, type FaceComponent, type Receivers } from './types';

/** Opacité maximale d'une ombre de contact : au-delà, la pièce semble COLLÉE sur la surface (contrôlé par la vérification). */
export const MAX_PEAK = 0.55;
/** Part minimale de l'ombre qui reste toujours au contact (occlusion ambiante) : en dessous, l'objet FLOTTE. */
export const MIN_CONTACT = 0.35;

/** Mesures d'une ombre de contact, pour la vérification et les artefacts. */
export interface ContactMetric {
  readonly id: string;
  /** Opacité maximale effective de l'ombre. */
  readonly peak: number;
  /** Flou (px) et décalage de l'ombre portée (px), et plus petite dimension de la silhouette (px). */
  readonly blurPx: number;
  readonly offsetPx: number;
  readonly sizePx: number;
  /** Écart entre l'ombre portée et la silhouette au-delà de ce qui reste au contact (px, 0 = collée au composant). */
  readonly gapPx: number;
  /** Part de l'ombre qui est de l'occlusion ambiante au contact (0–1). */
  readonly contactShare: number;
}

export interface ContactOut {
  readonly defs: string[];
  /** Ombre de chaque composant, prête à être insérée AVANT lui dans l'ordre de dessin. */
  readonly markup: Map<string, string>;
  readonly metrics: ContactMetric[];
}

/**
 * Ombres de contact. Deux termes, additionnés pour chaque composant :
 *  - occlusion ambiante : un trait flou le long du bord de contact, présent même sans lumière directionnelle (évite que l'objet flotte) ;
 *  - ombre portée : la silhouette décalée à l'opposé de la lumière (décalage ∝ hauteur du composant et à l'inclinaison de la lumière), floutée
 *    selon la douceur de la source.
 * `directionality` répartit entre les deux ; `strength` × `master` donne l'opacité, plafonnée à `MAX_PEAK` (pas de pièce collée). L'ombre est
 * découpée par la surface réceptrice : pour un composant POSÉ (`caster`), la silhouette elle-même est retirée (règle pair-impair), l'ombre
 * ne passe donc jamais sous lui ; pour un CREUX (`socket`), seul le croissant du côté lumière, à l'intérieur, est ombré.
 */
/** Polygone agrandi de `amount` px (homothétie autour du centre de sa boîte, rayon minimal) puis décalé de (dx, dy). */
function grow(poly: readonly { x: number; y: number }[], amount: number, dx: number, dy: number): { x: number; y: number }[] {
  const b = polyBox([...poly]);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const k = 1 + amount / Math.max(1, Math.min(b.w, b.h) / 2);
  return poly.map((q) => ({ x: cx + (q.x - cx) * k + dx, y: cy + (q.y - cy) * k + dy }));
}

/**
 * Boîte englobante d'un tracé `d` en coordonnées ABSOLUES (M L C Q Z) : les points de contrôle d'une courbe sont dans l'enveloppe convexe de
 * la courbe, la boîte de tous les nombres est donc une boîte englobante sûre (un peu large). `null` si le tracé sort de ce cas (relatif, arc…).
 */
export function pathBox(d: string): { x0: number; y0: number; x1: number; y1: number } | null {
  if (/[a-zA-Z]/.test(d.replace(/[MLCQZ]/g, ''))) return null;
  const n = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!n || n.length < 2 || n.length % 2) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n.length; i += 2) { const x = Number(n[i]); const y = Number(n[i + 1]); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return Number.isFinite(x0 + y0 + x1 + y1) ? { x0, y0, x1, y1 } : null;
}

export function compileContact(id: string, comps: readonly FaceComponent[], specs: Readonly<Record<string, ContactSpec>>, master: number, L: LightVector, shadowColor: string, receivers: Receivers, u: number): ContactOut {
  const defs: string[] = [];
  const markup = new Map<string, string>();
  const metrics: ContactMetric[] = [];
  const soft = softness(L);
  const lz = Math.max(0.3, L.z);
  for (const c of comps) {
    const spec = c.contact ? specs[c.contact] : undefined;
    if (!spec || c.polys.length === 0) continue;
    const peak = Math.min(MAX_PEAK, clamp01(spec.strength * master) * 0.8);
    if (peak < 0.01) continue;
    const box = polyBox(c.polys.flat());
    const size = Math.min(box.w, box.h);
    // Décalage de l'ombre portée : à l'opposé de la lumière, proportionnel à la hauteur du composant et à l'inclinaison (1/L.z, borné).
    const off = { x: (-L.x / lz) * c.depth * (0.4 + 0.8 * spec.directionality), y: (-L.y / lz) * c.depth * (0.4 + 0.8 * spec.directionality) };
    const offsetPx = Math.hypot(off.x, off.y);
    const blur = Math.max(0.4 * u, (0.8 + 5 * spec.softness) * u * (0.5 + soft));
    const contactShare = MIN_CONTACT + (1 - MIN_CONTACT) * (1 - spec.directionality);
    const castA = peak * spec.directionality;
    const aoA = peak * contactShare;
    const pad = 4 * blur + offsetPx + blur + 6 * u;
    const fid = `${id}-ct-f-${c.id}`;
    // Région du filtre : le résultat n'est visible que dans la zone RÉCEPTRICE (clip-path) ; un pixel de cette zone ne dépend de la source que
    // dans un voisinage de 4σ. La région peut donc être réduite à (zone réceptrice ± 4σ) ∩ région d'origine, sans changer un pixel visible
    // (mesuré : docs/PERF-2.md). Le coût d'un flou est proportionnel à l'aire de sa région.
    let [fx0, fy0, fx1, fy1] = [box.x - pad, box.y - pad, box.x + box.w + pad, box.y + box.h + pad];
    const rbs = c.receivers.map((rid) => (receivers[rid] ? pathBox(receivers[rid] as string) : null));
    // Seulement quand le clip EST la zone réceptrice (composant posé, ou creux sans bord réel) ; un creux à bord réel (oreille) est découpé par sa propre silhouette.
    if ((c.kind === 'caster' || c.edge === 'soft') && rbs.length > 0 && rbs.every((r) => r !== null)) {
      const m = 4 * blur + 2 * u;
      const ux0 = Math.min(...rbs.map((r) => (r as { x0: number }).x0)) - m; const uy0 = Math.min(...rbs.map((r) => (r as { y0: number }).y0)) - m;
      const ux1 = Math.max(...rbs.map((r) => (r as { x1: number }).x1)) + m; const uy1 = Math.max(...rbs.map((r) => (r as { y1: number }).y1)) + m;
      const [nx0, ny0, nx1, ny1] = [Math.max(fx0, ux0), Math.max(fy0, uy0), Math.min(fx1, ux1), Math.min(fy1, uy1)];
      if (nx1 - nx0 > 4 && ny1 - ny0 > 4) [fx0, fy0, fx1, fy1] = [nx0, ny0, nx1, ny1];
    }
    defs.push(el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: fx0, y: fy0, width: fx1 - fx0, height: fy1 - fy0, 'color-interpolation-filters': 'sRGB' }, [el('feGaussianBlur', { stdDeviation: blur })]));
    const own = polysD(c.polys);
    const moved = polysD(c.polys.map((p) => p.map((v) => ({ x: v.x + off.x, y: v.y + off.y }))));
    const groups: string[] = [];
    c.receivers.forEach((rid, k) => {
      const rd = receivers[rid];
      if (!rd) return;
      const cid = `${id}-ct-c-${c.id}-${k}`;
      let body: string;
      if (c.kind === 'caster') {
        // Receveur seul comme clip (un clip pair-impair + flou produit des artefacts) ; l'évidement sous le composant est fait par un ANNEAU :
        // la silhouette agrandie et décalée MOINS la silhouette (règle pair-impair sur le remplissage, fiable). Composant opaque : pas d'évidement.
        defs.push(el('clipPath', { id: cid }, [el('path', { d: rd })]));
        if (c.opaque) {
          body = el('g', { filter: urlRef(fid) }, [
            el('path', { d: moved, fill: shadowColor, 'fill-opacity': castA }),
            el('path', { d: own, fill: 'none', stroke: shadowColor, 'stroke-width': blur * 1.8, 'stroke-linejoin': 'round', 'stroke-opacity': aoA }),
          ]);
        } else {
          const reach = Math.max(blur * 1.5, offsetPx * 1.2);
          const ring = (dx: number, dy: number, amount: number): string => polysD(c.polys.map((q) => grow(q, amount, dx, dy))) + own;
          body = el('g', { filter: urlRef(fid) }, [
            el('path', { d: ring(off.x, off.y, reach), fill: shadowColor, 'fill-opacity': castA, 'fill-rule': 'evenodd' }),
            el('path', { d: ring(0, 0, blur * 1.5), fill: shadowColor, 'fill-opacity': aoA, 'fill-rule': 'evenodd' }),
          ]);
        }
      } else if (c.edge === 'soft') {
        // Creux sans bord réel (orbite) : croissant du côté lumière, flou, SANS être coupé par la silhouette — il s'estompe naturellement.
        defs.push(el('clipPath', { id: cid }, [el('path', { d: rd })]));
        body = el('g', { filter: urlRef(fid) }, [el('path', { d: `${own}${moved}`, fill: shadowColor, 'fill-opacity': castA * 1.1, 'fill-rule': 'evenodd' })]);
      } else {
        // Creux à bord réel (oreille) : intérieur de la silhouette seulement ; croissant côté lumière + liseré d'occlusion.
        defs.push(el('clipPath', { id: cid }, [el('path', { d: own })]));
        body = el('g', { filter: urlRef(fid) }, [
          el('path', { d: `${own}${moved}`, fill: shadowColor, 'fill-opacity': castA, 'fill-rule': 'evenodd' }),
          el('path', { d: own, fill: 'none', stroke: shadowColor, 'stroke-width': blur * 1.8, 'stroke-linejoin': 'round', 'stroke-opacity': aoA * 0.6 }),
        ]);
      }
      groups.push(el('g', { 'clip-path': urlRef(cid) }, [body]));
    });
    markup.set(c.id, groups.join(''));
    // Le décalage dépassant la moitié de la plus petite dimension laisse un vide entre composant et ombre : c'est l'écart mesuré.
    metrics.push({ id: c.id, peak, blurPx: blur, offsetPx, sizePx: size, gapPx: Math.max(0, offsetPx - 0.6 * size), contactShare });
  }
  return { defs, markup, metrics };
}

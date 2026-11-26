import { corneaWarp, IDENTITY_WARP, type Warp } from '../../geometry/eye';
import { darken } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import { edgeColor, gradientStop as stop } from '../../materials';
import type { EyeSpec } from '../../schema';
import { isFlat } from './flat-finish';
import type { Vec } from '../../geometry/eye';

/** Loi radiale de la cornée de cet œil (identité si `cornea` est null). */
export const warpOf = (eye: EyeSpec): Warp => (eye.cornea ? corneaWarp({ curvature: eye.cornea.curvature, depth: eye.cornea.depth, index: eye.cornea.index, strength: eye.cornea.refraction }) : IDENTITY_WARP);

/**
 * OPT-02 — œil EFFECTIF vu à travers la cornée : chaque paramètre RADIAL de l'iris (en fraction du rayon vrai) est remplacé par sa position apparente `warp(ρ)`. Un seul point d'entrée
 * (appelé par `resolveEye`) : le rendu ET `verifyEye` lisent donc le même œil. Reflets non touchés (ils sont sur la cornée, pas derrière). Identité EXACTE sans `cornea`.
 */
export function applyCornea(eye: EyeSpec): EyeSpec {
  if (!eye.cornea || eye.cornea.refraction <= 0) return eye;
  const w = warpOf(eye); const slope = (m: number): number => Math.max(0.5, Math.min(2, (w(Math.min(1, m + 0.05)) - w(Math.max(0, m - 0.05))) / (Math.min(1, m + 0.05) - Math.max(0, m - 0.05))));
  const d = eye.iris.detail;
  return {
    ...eye,
    pupil: { ...eye.pupil, size: w(eye.pupil.size) },
    iris: {
      ...eye.iris,
      layers: eye.iris.layers.map((l) => ({ ...l, inner: w(l.inner), outer: w(l.outer), spotRadius: l.mask === 'spot' ? l.spotRadius * slope((l.inner + l.outer) / 2) : l.spotRadius })),
      detail: d && {
        ...d,
        collarette: d.collarette && { ...d.collarette, radius: w(d.collarette.radius) },
        rainbow: d.rainbow && { ...d.rainbow, inner: w(d.rainbow.inner), outer: w(d.rainbow.outer) },
        voids: d.voids?.map((v) => ({ ...v, inner: w(v.inner), outer: w(v.outer) })),
        slits: d.slits && { ...d.slits, inner: w(d.slits.inner), outer: w(d.slits.outer) },
        arcs: d.arcs && { ...d.arcs, ringRho: w(d.arcs.ringRho) },
        embers: d.embers && { ...d.embers, ringRho: w(d.embers.ringRho) },
      },
    },
  };
}

/** EYE-03F — transition cornéosclérale : halo de la teinte du limbe, DEHORS de l'iris (nul au-dedans). Largeur ∝ courbure (la bosse cornéenne est plus marquée). `null` si `haze` = 0. */
export function limbalHaze(eye: EyeSpec, c: Vec, rx: number, ry: number, id: string, defs: string[]): string | null {
  const co = eye.cornea; if (!co || co.haze <= 0 || isFlat(eye)) return null;   // fini flat : aucun dégradé ajouté par le moteur
  const k = 0.1 + 0.14 * co.curvature; const col = darken(edgeColor(eye.iris.material.base), 0.25); const inner = 1 / (1 + k);
  defs.push(el('radialGradient', { id: `${id}-haze`, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, col, 0), stop(inner * 0.97, col, 0), stop(inner, col, 0.5 * co.haze), stop(1, col, 0)]));
  return el('ellipse', { cx: c.x, cy: c.y, rx: rx * (1 + k), ry: ry * (1 + k), fill: urlRef(`${id}-haze`) });
}

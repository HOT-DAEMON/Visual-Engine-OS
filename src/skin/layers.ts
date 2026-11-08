import { el, num, urlRef } from '../core/svg';
import { parseHex } from '../core/color';
import { compileEffects, effectsReach, type ResolvedAppearance } from '../appearance';
import { pathBox, padBox, unionBox, type Box } from '../core/pathbox';
import type { SkinRegions } from '../face';
import type { LightVector } from '../lighting/light';
import { spotGradient, gradientStop as stop } from '../materials';
import type { SkinMaterial } from '../schema';
import { noiseSteps } from '../noise';
import type { SkinShading } from './shading';

/**
 * COUCHES DE PEAU PARTAGÉES. Une surface de peau (tête, cou, demain une autre) n'a PAS son propre éclairage : elle assemble ces constructeurs de
 * couches à partir du MÊME `SkinShading` (matériau × lumière × apparence). Seule la géométrie change : `SkinSurface` (contour, boîte, axe).
 * Ordre canonique des calques : base → forme → terminateur → atténuation → zones → reflets → Fresnel → pores → (effets de l'apparence, par `wrapSkin`).
 */
export interface SkinSurface {
  /** Contour (attribut `d`) : sert de découpe ET de forme aux dégradés. */
  readonly d: string;
  /** Étendue de la surface (traversée de la lumière) et bornes verticales de son dégradé de base. */
  readonly w: number;
  readonly h: number;
  readonly top: number;
  readonly bottom: number;
  /** Échelle px par unité de largeur de tête (W/300) : fréquence des pores identique sur toutes les surfaces. */
  readonly unit: number;
}
export interface Layers { readonly defs: string[]; readonly layers: string[] }
type Attrs = Record<string, string | number | undefined>;
const drawOf = (s: SkinSurface) => (a: Attrs): string => el('path', { d: s.d, ...a });
const axisOf = (sh: SkinShading, R: number, cy0: number): Attrs => ({ gradientUnits: 'userSpaceOnUse', x1: sh.dir.x * R, y1: cy0 + sh.dir.y * R, x2: -sh.dir.x * R, y2: cy0 - sh.dir.y * R });
const traverse = (s: SkinSurface, sh: SkinShading): { R: number; cy0: number } => ({ R: 0.5 * (Math.abs(sh.dir.x) * s.w + Math.abs(sh.dir.y) * s.h) * 1.05, cy0: (s.top + s.bottom) / 2 });

/** 1. Base : couleur de peau, ou dégradé vertical de l'apparence quand elle en définit un. */
export function baseLayer(id: string, s: SkinSurface, ra: ResolvedAppearance): Layers {
  const draw = drawOf(s), defs: string[] = [];
  if (ra.spec.gradient.length > 0) {
    const n = 6;
    defs.push(el('linearGradient', { id: `${id}-skin-base`, x1: 0, y1: s.top, x2: 0, y2: s.bottom, gradientUnits: 'userSpaceOnUse' }, Array.from({ length: n }, (_, i) => stop(i / (n - 1), ra.ramp(i / (n - 1)), ra.rampAlpha(i / (n - 1))))));
    return { defs, layers: [draw({ fill: urlRef(`${id}-skin-base`) })] };
  }
  return { defs, layers: [draw({ fill: ra.base })] };
}

/** 2. Ombrage de forme : bords plus sombres, centre décalé vers la lumière. */
export function formLayer(id: string, s: SkinSurface, sh: SkinShading, L: LightVector, ra: ResolvedAppearance): Layers {
  return { defs: [el('radialGradient', { id: `${id}-skin-form`, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5 + L.x * 0.28, fy: 0.5 + L.y * 0.28 }, [stop(0, ra.shadow, 0), stop(0.55, ra.shadow, sh.formEdge * 0.2), stop(1, ra.shadow, sh.formEdge)])], layers: [drawOf(s)({ fill: urlRef(`${id}-skin-form`) })] };
}

/** 3. Terminateur directionnel (lumière → diffusion sous-cutanée → ombre) : dégradé linéaire le long de la lumière. */
export function terminatorLayer(id: string, s: SkinSurface, sh: SkinShading): Layers {
  const { R, cy0 } = traverse(s, sh);
  return { defs: [el('linearGradient', { id: `${id}-skin-term`, ...axisOf(sh, R, cy0) }, sh.terminator.map((t) => stop(t.offset, t.color, t.alpha)))], layers: [drawOf(s)({ fill: urlRef(`${id}-skin-term`) })] };
}

/** 4. Atténuation d'une source à distance finie : côté proche un peu plus clair, côté lointain un peu plus sombre (voile de la lumière / noir). */
export function falloffLayer(id: string, s: SkinSurface, sh: SkinShading, L: LightVector): Layers {
  if (sh.falloff.near === 1 && sh.falloff.far === 1) return { defs: [], layers: [] };
  const { R, cy0 } = traverse(s, sh);
  return { defs: [el('linearGradient', { id: `${id}-skin-fall`, ...axisOf(sh, R, cy0) }, [stop(0, L.color, Math.min(0.3, sh.falloff.near - 1)), stop(0.5, L.color, 0), stop(1, '#000000', Math.min(0.4, 1 - sh.falloff.far))])], layers: [drawOf(s)({ fill: urlRef(`${id}-skin-fall`) })] };
}

/** Terminateur puis atténuation (ordre canonique de la tête). */
export function terminatorLayers(id: string, s: SkinSurface, sh: SkinShading, L: LightVector): Layers {
  const t = terminatorLayer(id, s, sh), f = falloffLayer(id, s, sh, L);
  return { defs: [...t.defs, ...f.defs], layers: [...t.layers, ...f.layers] };
}

/** 5. Reflets spéculaires par région (largeur et douceur pilotées par la rugosité) ; `only` restreint aux régions portées par cette surface. */
export function spotLayers(id: string, sh: SkinShading, only?: ReadonlySet<string>): Layers {
  const defs: string[] = [], layers: string[] = [];
  sh.spots.forEach((p, i) => {
    if (p.alpha < 0.01 || (only && !only.has(p.region))) return;
    defs.push(spotGradient(`${id}-skin-sp${i}`, p.color, p.alpha, p.soft));
    layers.push(el('ellipse', { cx: p.e.cx, cy: p.e.cy, rx: p.e.rx, ry: p.e.ry, fill: urlRef(`${id}-skin-sp${i}`) }));
  });
  return { defs, layers };
}

/** 6. Fresnel : bord éclairci (teinte de la lumière), nul au centre. */
export function fresnelLayer(id: string, s: SkinSurface, sh: SkinShading): Layers {
  if (sh.fresnelAlpha <= 0.005) return { defs: [], layers: [] };
  return { defs: [el('radialGradient', { id: `${id}-skin-fres`, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, sh.specColor, 0), stop(0.8, sh.specColor, 0), stop(1, sh.specColor, sh.fresnelAlpha)])], layers: [drawOf(s)({ fill: urlRef(`${id}-skin-fres`) })] };
}

const rgb01 = (hex: string): [number, number, number] => parseHex(hex).map((v) => v / 255) as [number, number, number];

/** 7. Pores : bruit fractal teinté de l'ombre, sur des taches douces par région (plus fort si la région est rugueuse). `include` choisit les régions de cette surface. */
export function poreLayer(id: string, s: SkinSurface, mat: SkinMaterial, ra: ResolvedAppearance, regions: SkinRegions, include: (rid: keyof SkinMaterial['roughness']) => boolean): Layers {
  if (mat.pores <= 0.02) return { defs: [], layers: [] };
  const [r, g, b] = rgb01(ra.shadow), defs: string[] = [], rids = (Object.keys(mat.roughness) as (keyof SkinMaterial['roughness'])[]).filter(include);
  const spotBoxes: Box[] = [];
  rids.forEach((rid) => { for (const e of regions[rid]) { const q = Math.max(e.rx, e.ry); spotBoxes.push({ x: e.cx - q, y: e.cy - q, w: 2 * q, h: 2 * q }); } });
  const pb = spotBoxes.length ? padBox(unionBox(spotBoxes), 2) : { x: -s.w, y: -s.h, w: 2 * s.w, h: 2 * s.h };
  const fPore = Number(num(1.1 / s.unit));
  const pores = noiseSteps({ freqX: fPore, freqY: fPore, octaves: 2, seed: 5, offset: 0, gain: -1.2 }, { x: pb.x, y: pb.y }, 'n', el);
  defs.push(el('filter', { id: `${id}-skin-pores`, filterUnits: 'userSpaceOnUse', x: pb.x, y: pb.y, width: pb.w, height: pb.h, 'color-interpolation-filters': 'sRGB' }, [
    ...pores.nodes,
    el('feColorMatrix', { in: 'n', type: 'matrix', values: `0 0 0 0 ${num(r)}  0 0 0 0 ${num(g)}  0 0 0 0 ${num(b)}  ${pores.alphaRow}`, result: 'c' }),
    el('feComposite', { in: 'c', in2: 'SourceAlpha', operator: 'in' }),
  ]));
  const spots: string[] = [];
  rids.forEach((rid) => {
    const a = mat.pores * mat.roughness[rid] * 0.7;
    regions[rid].forEach((e, k) => {
      defs.push(spotGradient(`${id}-skin-pg-${rid}${k}`, '#000000', a, 0.6));
      spots.push(el('ellipse', { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: urlRef(`${id}-skin-pg-${rid}${k}`) }));
    });
  });
  return { defs, layers: [el('g', { filter: urlRef(`${id}-skin-pores`) }, spots)] };
}

/** Effets de l'apparence (réfraction, grain, glow, bloom, émission) : UN filtre sur tout le calque, opacité globale ; le tout découpé par le contour. */
export function wrapSkin(id: string, s: SkinSurface, ra: ResolvedAppearance, defs: string[], layers: string[]): { defs: string[]; markup: string } {
  const box = pathBox(s.d), fb = box ? padBox(box, effectsReach(ra.spec)) : { x: -s.w, y: -s.h, w: 2 * s.w, h: 2 * s.h };
  const fx = compileEffects(`${id}-skin`, ra.spec, ra, { x: fb.x, y: fb.y, w: fb.w, h: fb.h });
  return { defs: [...defs, ...fx.defs], markup: el('g', { 'clip-path': urlRef(`${id}-skin-clip`), filter: fx.filter, opacity: ra.spec.opacity < 1 ? ra.spec.opacity : undefined }, layers) };
}

/** Découpe de la surface (premier def, comme à l'origine). */
export const clipDef = (id: string, s: SkinSurface): string => el('clipPath', { id: `${id}-skin-clip` }, [el('path', { d: s.d })]);

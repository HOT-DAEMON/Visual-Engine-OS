import { el, num, urlRef } from '../core/svg';
import { parseHex } from '../core/color';
import { compileEffects, type ResolvedAppearance } from '../appearance';
import { outlinePath, type FaceLandmarks, type SkinRegions } from '../face';
import type { LightVector } from '../lighting/light';
import { spotGradient, gradientStop as stop } from '../materials';
import type { SkinMaterial } from '../schema';
import { skinShading } from './shading';
import { compileZones } from './zones';
import type { FaceLighting } from '../schema';

export interface CompiledSkin {
  readonly defs: string[];
  /** Calque unique de la peau (base + ombrage + reflets + zones + grain), découpé au contour de la tête. */
  readonly markup: string;
}

/** Couleur 0–1 par canal, pour les matrices de couleur des filtres. */
const rgb01 = (hex: string): [number, number, number] => parseHex(hex).map((v) => v / 255) as [number, number, number];

/**
 * Compile le matériau de peau sur la tête. Ordre des calques (tous découpés par le contour) :
 *  1. base (couleur de peau, ou dégradé vertical de l'apparence) ;
 *  2. ombrage de forme (bords) puis terminateur directionnel (lumière → diffusion sous-cutanée → ombre) ;
 *  3. zones lumineuses douces et directionnelles (front, nez, joues, épaules) ;
 *  4. reflets spéculaires par région (largeur et douceur pilotées par la rugosité de la région) ;
 *  5. reflet de Fresnel sur les bords ; 6. micro-relief (pores) dans les régions rugueuses.
 * Le matériau ne contient aucune coordonnée : `regions` (géométrie) et `L` (éclairage) arrivent en paramètres.
 */
export function compileSkin(id: string, lm: FaceLandmarks, mat: SkinMaterial, ra: ResolvedAppearance, L: LightVector, regions: SkinRegions, zones: FaceLighting['zones']): CompiledSkin {
  const { W, H } = lm;
  const sh = skinShading(mat, L, regions, ra, ra.base);
  const d = outlinePath(lm.outline);
  const draw = (a: Record<string, string | number | undefined>): string => el('path', { d, ...a });
  const defs: string[] = [el('clipPath', { id: `${id}-skin-clip` }, [el('path', { d })])];
  const layers: string[] = [];
  // 1. Base : couleur de peau, ou dégradé vertical (haut → bas du crâne) quand l'apparence en définit un.
  if (ra.spec.gradient.length > 0) {
    const n = 6;
    defs.push(el('linearGradient', { id: `${id}-skin-base`, x1: 0, y1: -H / 2, x2: 0, y2: lm.chinY, gradientUnits: 'userSpaceOnUse' }, Array.from({ length: n }, (_, i) => stop(i / (n - 1), ra.ramp(i / (n - 1)), ra.rampAlpha(i / (n - 1))))));
    layers.push(draw({ fill: urlRef(`${id}-skin-base`) }));
  } else layers.push(draw({ fill: ra.base }));
  // 2. Ombrage de forme : bords plus sombres, centre décalé vers la lumière (formule du matériau générique).
  defs.push(el('radialGradient', { id: `${id}-skin-form`, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5 + L.x * 0.28, fy: 0.5 + L.y * 0.28 }, [stop(0, ra.shadow, 0), stop(0.55, ra.shadow, sh.formEdge * 0.2), stop(1, ra.shadow, sh.formEdge)]));
  layers.push(draw({ fill: urlRef(`${id}-skin-form`) }));
  // Terminateur : dégradé le long de la lumière, de x1 (côté lumière, offset 0) à x2 (côté ombre, offset 1).
  // Traversée = demi-étendue du visage le long de la lumière (|x|·W + |y|·H, moitié) : les bords du visage atteignent pleinement lumière et ombre.
  const R = 0.5 * (Math.abs(sh.dir.x) * W + Math.abs(sh.dir.y) * H) * 1.05;
  const cy0 = (-H / 2 + lm.chinY) / 2;
  defs.push(el('linearGradient', { id: `${id}-skin-term`, gradientUnits: 'userSpaceOnUse', x1: sh.dir.x * R, y1: cy0 + sh.dir.y * R, x2: -sh.dir.x * R, y2: cy0 - sh.dir.y * R }, sh.terminator.map((s) => stop(s.offset, s.color, s.alpha))));
  layers.push(draw({ fill: urlRef(`${id}-skin-term`) }));
  // Source à distance finie : le côté proche de la lumière est un peu plus clair, le lointain un peu plus sombre (voile blanc / noir).
  if (sh.falloff.near !== 1 || sh.falloff.far !== 1) {
    defs.push(el('linearGradient', { id: `${id}-skin-fall`, gradientUnits: 'userSpaceOnUse', x1: sh.dir.x * R, y1: cy0 + sh.dir.y * R, x2: -sh.dir.x * R, y2: cy0 - sh.dir.y * R }, [stop(0, L.color, Math.min(0.3, sh.falloff.near - 1)), stop(0.5, L.color, 0), stop(1, '#000000', Math.min(0.4, 1 - sh.falloff.far))]));
    layers.push(draw({ fill: urlRef(`${id}-skin-fall`) }));
  }
  // 3. Zones lumineuses.
  const z = compileZones(id, lm, regions, zones, L, ra, sh.dir);
  defs.push(...z.defs);
  layers.push(...z.markup);
  // 4. Reflets par région : ellipse + dégradé radial dont la douceur dépend de la rugosité.
  sh.spots.forEach((s, i) => {
    if (s.alpha < 0.01) return;
    defs.push(spotGradient(`${id}-skin-sp${i}`, s.color, s.alpha, s.soft));
    layers.push(el('ellipse', { cx: s.e.cx, cy: s.e.cy, rx: s.e.rx, ry: s.e.ry, fill: urlRef(`${id}-skin-sp${i}`) }));
  });
  // 5. Fresnel : bord éclairci (teinte de la lumière), nul au centre.
  if (sh.fresnelAlpha > 0.005) {
    defs.push(el('radialGradient', { id: `${id}-skin-fres`, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, sh.specColor, 0), stop(0.8, sh.specColor, 0), stop(1, sh.specColor, sh.fresnelAlpha)]));
    layers.push(draw({ fill: urlRef(`${id}-skin-fres`) }));
  }
  // 6. Pores : bruit fractal teinté de l'ombre, appliqué à des taches douces sur chaque région, d'autant plus fort que la région est rugueuse.
  if (mat.pores > 0.02) {
    const [r, g, b] = rgb01(ra.shadow);
    defs.push(
      el('filter', { id: `${id}-skin-pores`, filterUnits: 'userSpaceOnUse', x: -W, y: -H, width: 2 * W, height: 2 * H, 'color-interpolation-filters': 'sRGB' }, [
        el('feTurbulence', { type: 'fractalNoise', baseFrequency: `${num(1.1 / (W / 300))} ${num(1.1 / (W / 300))}`, numOctaves: 2, seed: 5, result: 'n' }),
        el('feColorMatrix', { in: 'n', type: 'matrix', values: `0 0 0 0 ${num(r)}  0 0 0 0 ${num(g)}  0 0 0 0 ${num(b)}  0 0 0 ${num(-2.4)} ${num(1.2)}`, result: 'c' }),
        el('feComposite', { in: 'c', in2: 'SourceAlpha', operator: 'in' }),
      ]),
    );
    const spots: string[] = [];
    (Object.keys(mat.roughness) as (keyof typeof mat.roughness)[]).forEach((rid) => {
      if (rid === 'neck') return;
      const a = mat.pores * mat.roughness[rid] * 0.7;
      regions[rid].forEach((e, k) => {
        defs.push(spotGradient(`${id}-skin-pg-${rid}${k}`, '#000000', a, 0.6));
        spots.push(el('ellipse', { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: urlRef(`${id}-skin-pg-${rid}${k}`) }));
      });
    });
    layers.push(el('g', { filter: urlRef(`${id}-skin-pores`) }, spots));
  }
  // Effets de l'apparence (réfraction, grain, glow, bloom, émission) : UN filtre sur tout le calque ; opacité globale.
  const fx = compileEffects(`${id}-skin`, ra.spec, ra, { x: -W, y: -H, w: 2 * W, h: 2 * H });
  defs.push(...fx.defs);
  const group = el('g', { 'clip-path': urlRef(`${id}-skin-clip`), filter: fx.filter, opacity: ra.spec.opacity < 1 ? ra.spec.opacity : undefined }, layers);
  return { defs, markup: group };
}

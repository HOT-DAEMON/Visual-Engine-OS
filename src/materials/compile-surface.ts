import { darken, lighten } from '../core/color';
import { clamp, rad } from '../core/math';
import { el, urlRef } from '../core/svg';
import { direction2D, type LightVector } from '../lighting/light';
import type { ColorSource, MaterialDescriptor } from '../schema';
import { dominantColor, gradientStop as stop, type CompiledSurface, type Surface } from './surface';
import { SHADING } from './shading';
import { specularLayers } from './specular';

/**
 * Dégradé `<linearGradient>`/`<radialGradient>` correspondant à un `ColorSource`, ou `null` si uni.
 * Exporté pour les objets qui ont besoin d'un remplissage orientable/multi-tons SANS passer par tout
 * `compileSurface` (ombrage, reflets, métal) — c'est le cas d'une pupille, qui est un trou, pas une
 * surface éclairée : elle ne doit avoir ni reflet spéculaire ni rampe d'environnement.
 */
export function gradientDef(id: string, src: ColorSource): string | null {
  if (src.type === 'solid') return null;
  const stops = src.stops.map((s) => stop(s.offset, s.color, s.opacity));
  if (src.type === 'radial') return el('radialGradient', { id, cx: 0.5, cy: 0.5, r: 0.5 }, stops);
  const a = rad(src.angleDeg);
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  return el(
    'linearGradient',
    { id, x1: 0.5 - dx * 0.5, y1: 0.5 - dy * 0.5, x2: 0.5 + dx * 0.5, y2: 0.5 + dy * 0.5 },
    stops,
  );
}

/**
 * Compile un matériau sur une géométrie donnée : couleur de base, ombrage diffus, environnement du
 * métal, reflets spéculaires + vernis, émission. Voir `shading.ts` pour le statut (physique/stylisé)
 * de chaque étape.
 *
 * @param rotationDeg rotation de l'objet dans le monde (SVG, sens horaire). Sert à garder la rampe
 *                    d'environnement du métal alignée sur le monde (ciel en haut) et non sur l'objet.
 */
export function compileSurface(
  id: string,
  surface: Surface,
  m: MaterialDescriptor,
  L: LightVector,
  rotationDeg = 0,
): CompiledSurface {
  const S = SHADING;
  const defs: string[] = [];
  const layers: string[] = [];
  const under: string[] = [];
  const { bbox } = surface;
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  const rx = bbox.w / 2;
  const ry = bbox.h / 2;
  const sphere = surface.curvature === 'sphere';
  const dir = direction2D(L);
  const lenXY = Math.hypot(L.x, L.y);
  const base = dominantColor(m.base);

  // 1. Couleur de base ---------------------------------------------------------------
  const baseGrad = gradientDef(`${id}-base`, m.base);
  if (baseGrad) defs.push(baseGrad);
  layers.push(surface.draw({ fill: baseGrad ? urlRef(`${id}-base`) : base }));

  // 2. Ombrage diffus (part diélectrique) --------------------------------------------
  const diffuseWeight = 1 - S.metalDiffuseLoss * m.metallic;
  if (sphere) {
    const edge = S.diffuseMax * diffuseWeight * (0.65 + 0.35 * (1 - L.z));
    defs.push(
      el(
        'radialGradient',
        { id: `${id}-diffuse`, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5 + L.x * S.focalShift, fy: 0.5 + L.y * S.focalShift },
        [stop(0, '#000000', 0), stop(0.5, '#000000', edge * 0.22), stop(1, '#000000', edge)],
      ),
    );
  } else {
    const edge = S.diffuseMax * diffuseWeight * 0.6 * Math.min(1, lenXY * 1.5);
    defs.push(
      el(
        'linearGradient',
        { id: `${id}-diffuse`, x1: 0.5 + dir.x * 0.5, y1: 0.5 + dir.y * 0.5, x2: 0.5 - dir.x * 0.5, y2: 0.5 - dir.y * 0.5 },
        [stop(0, '#000000', 0), stop(1, '#000000', edge)],
      ),
    );
  }
  layers.push(surface.draw({ fill: urlRef(`${id}-diffuse`) }));

  // 3. Environnement du métal (rampe ciel / horizon / sol, alignée sur le monde) ------
  if (m.metallic > 0) {
    const c = 1 - S.metalContrastLoss * m.roughness;
    const rot = rad(rotationDeg);
    // « bas du monde » exprimé dans le repère local de l'objet
    const d = { x: Math.sin(rot), y: Math.cos(rot) };
    const half = Math.abs(d.x) * rx + Math.abs(d.y) * ry;
    const horizon = clamp(0.5 - 0.2 * (L.x * d.x + L.y * d.y), 0.3, 0.7);
    const w = 0.01 + 0.35 * m.roughness;
    defs.push(
      el(
        'linearGradient',
        {
          id: `${id}-env`,
          gradientUnits: 'userSpaceOnUse',
          x1: cx - d.x * half,
          y1: cy - d.y * half,
          x2: cx + d.x * half,
          y2: cy + d.y * half,
        },
        [
          stop(0, lighten(base, S.metalSky * c)),
          stop(horizon - w, lighten(base, S.metalAboveHorizon * c)),
          stop(horizon + w, darken(base, S.metalBelowHorizon * c)),
          stop(1, lighten(base, S.metalGround * c)),
        ],
      ),
    );
    layers.push(surface.draw({ fill: urlRef(`${id}-env`), 'fill-opacity': m.metallic }));
  }

  // 4. Reflets spéculaires + vernis ----------------------------------------------------
  const spec = specularLayers(id, surface, m, L, base);
  defs.push(...spec.defs);
  if (spec.nodes.length > 0) {
    defs.push(el('clipPath', { id: `${id}-clip` }, [surface.draw({})]));
    layers.push(el('g', { 'clip-path': urlRef(`${id}-clip`) }, spec.nodes));
  }

  // 5. Émission (halo derrière + teinte par-dessus) -----------------------------------
  if (m.emission && m.emission.intensity > 0) {
    const I = m.emission.intensity;
    defs.push(
      el('radialGradient', { id: `${id}-halo`, cx: 0.5, cy: 0.5, r: 0.5 }, [
        stop(0, m.emission.color, 0.9 * I),
        stop(0.6, m.emission.color, 0.5 * I),
        stop(1, m.emission.color, 0),
      ]),
    );
    under.push(
      el('ellipse', {
        cx,
        cy,
        rx: rx * (1 + S.emissionHalo * I),
        ry: ry * (1 + S.emissionHalo * I),
        fill: urlRef(`${id}-halo`),
      }),
    );
    layers.push(surface.draw({ fill: m.emission.color, 'fill-opacity': S.emissionOverlay * I }));
  }

  const group = el('g', { opacity: m.opacity < 1 ? m.opacity : undefined }, layers);
  return { defs, markup: [...under, group].join('') };
}

import { darken, lighten } from '../../core/color';
import { mulberry32 } from '../../core/prng';
import { halfVectorXY, toLocal, type LightVector } from '../../lighting/light';
import { compileSurface, dominantColor, type Surface } from '../../materials';
import type { CompoundEyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';
import { objectTransform, type CompiledObject } from '../object';
import { hexGridCenters, hexPoints } from './hex-grid';

const hexPath = (pts: readonly { x: number; y: number }[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('') + 'Z';

/**
 * Œil composé : un dôme (matériau partagé, pour l'ombrage d'ensemble) recouvert d'une mosaïque de
 * facettes hexagonales. Chaque facette est teintée indépendamment (seed déterministe) et reçoit son
 * propre petit reflet, positionné par la même formule que les autres surfaces sphériques — ce qui
 * donne l'aspect scintillant caractéristique d'un œil d'insecte.
 */
export function compileCompoundEye(c: CompoundEyeSpec, worldLight: LightVector): CompiledObject {
  const id = c.id;
  const rot = c.transform.rotationDeg;
  const L = toLocal(worldLight, rot);
  const R = c.size / 2;
  const facetR = R * c.facetRadius;
  const rnd = mulberry32(c.seed);
  const base = dominantColor(c.material.base);
  const H = halfVectorXY(L);

  const defs: string[] = [];
  const body: string[] = [];

  // Socle sombre légèrement plus large que le dôme, pour ancrer visuellement les facettes du bord.
  body.push(el('circle', { cx: 0, cy: 0, r: R * 1.04, fill: darken(base, 0.75) }));

  // Dôme : ombrage d'ensemble via le système de matériaux partagé (cohérent avec tous les autres objets).
  const domeSurface: Surface = {
    bbox: { x: -R, y: -R, w: 2 * R, h: 2 * R },
    curvature: 'sphere',
    draw: (a) => el('circle', { cx: 0, cy: 0, r: R, ...a }),
  };
  const dome = compileSurface(`${id}-dome`, domeSurface, c.material, L, rot);
  defs.push(...dome.defs);
  body.push(dome.markup);

  // Facettes : teinte seedée + reflet positionné par le vecteur médian (même formule que les
  // surfaces sphériques classiques), clippées au disque pour un bord net.
  defs.push(el('clipPath', { id: `${id}-facets-clip` }, [el('circle', { cx: 0, cy: 0, r: R })]));
  const facets: string[] = [];
  for (const center of hexGridCenters(R, facetR)) {
    // Ordre d'appel fixe : 2 tirages par facette, même near du bord où elle pourrait ne rien changer.
    const jitter = rnd() * 2 - 1;
    const highlightJitter = rnd();
    const dist = Math.hypot(center.x, center.y) / R;
    const tint = jitter * c.tint * (1 - 0.3 * dist);
    const facetColor = tint >= 0 ? lighten(base, tint * 0.5) : darken(base, -tint * 0.5);
    facets.push(
      el('path', {
        d: hexPath(hexPoints(center, facetR * 0.96)),
        fill: facetColor,
        stroke: darken(base, 0.6),
        'stroke-width': facetR * 0.04,
      }),
    );
    const hx = center.x + H.x * facetR * 0.3;
    const hy = center.y + H.y * facetR * 0.3;
    facets.push(
      el('circle', {
        cx: hx,
        cy: hy,
        r: facetR * (0.18 + 0.1 * highlightJitter),
        fill: '#ffffff',
        'fill-opacity': 0.5 + 0.3 * (1 - dist),
      }),
    );
  }
  body.push(el('g', { 'clip-path': urlRef(`${id}-facets-clip`) }, facets));

  // Vignettage d'occlusion ambiante au bord du dôme.
  defs.push(
    el('radialGradient', { id: `${id}-ao`, cx: 0.5, cy: 0.5, r: 0.5 }, [
      el('stop', { offset: 0.7, 'stop-color': '#000000', 'stop-opacity': 0 }),
      el('stop', { offset: 1, 'stop-color': '#000000', 'stop-opacity': 0.4 }),
    ]),
  );
  body.push(el('circle', { cx: 0, cy: 0, r: R, fill: urlRef(`${id}-ao`) }));

  return { defs, markup: el('g', { transform: objectTransform(c.transform) }, body) };
}

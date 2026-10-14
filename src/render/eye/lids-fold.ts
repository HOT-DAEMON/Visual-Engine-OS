import { darken } from '../../core/color';
import { creaseCurve, cubicTopY, upperLashes, lowerLashes, type FoldGeometry, type OpeningGeometry, type Vec } from '../../geometry/eye';
import { direction2D, type LightVector } from '../../lighting/light';
import { dominantColor, gradientStop as stop } from '../../materials';
import { clamp01 } from '../../core/math';
import type { EyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';
import { P, polygonPath } from './helpers';
import { renderLashGroup } from './lashes-render';

export interface LidsAndFold {
  readonly defs: string[];
  readonly outside: string[];
}

/**
 * Tout ce qui se dessine EN DEHORS du clip de l'ouverture : pli palpébral (ombre + trait), bords
 * libres des paupières, pointe externe effilée, cils haut/bas (masqués sous le pli épicanthique
 * s'il y en a un), et l'arête de peau du pli épicanthique côté nez.
 */
export function renderLidsAndFold(
  eye: EyeSpec,
  g: OpeningGeometry,
  L: LightVector,
  skin: string,
  lidColor: string,
  th: number,
  fold: FoldGeometry | null,
  id: string,
): LidsAndFold {
  const defs: string[] = [];
  const outside: string[] = [];

  // Pli palpébral : ombre sous le pli (selon la lumière) + trait du pli
  const crease = creaseCurve(g, eye.lids.crease.height);
  if (crease) {
    const depth = eye.lids.crease.depth;
    const topY = cubicTopY(crease);
    const shadowA = depth * 0.45 * clamp01(0.4 - L.y);
    defs.push(
      el('linearGradient', { id: `${id}-crease-shadow`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: topY, x2: 0, y2: g.bbox.y }, [
        stop(0, '#000000', shadowA),
        stop(1, '#000000', 0),
      ]),
    );
    const region = `M${P(g.pi)}C${P(g.u1)} ${P(g.u2)} ${P(g.po)}L${P(crease.p3)}C${P(crease.p2)} ${P(crease.p1)} ${P(crease.p0)}Z`;
    outside.push(
      el('path', { id: `${id}-crease-fill`, d: region, fill: urlRef(`${id}-crease-shadow`) }),
      el('path', {
        id: `${id}-crease`,
        d: `M${P(crease.p0)}C${P(crease.p1)} ${P(crease.p2)} ${P(crease.p3)}`,
        fill: 'none',
        stroke: darken(skin, 0.5),
        'stroke-opacity': 0.15 + 0.55 * depth,
        'stroke-width': g.h * 0.008 * (0.7 + depth),
        'stroke-linecap': 'round',
      }),
    );
  }

  // Bords libres, pointe externe et cils
  const lids: string[] = [
    el('path', {
      d: `M${P(g.po)}C${P(g.l1)} ${P(g.l2)} ${P(g.pi)}`,
      fill: 'none',
      stroke: lidColor,
      'stroke-width': th * 0.35,
      'stroke-opacity': 0.55,
      'stroke-linecap': 'round',
    }),
    el('path', {
      d: `M${P(g.pi)}C${P(g.u1)} ${P(g.u2)} ${P(g.po)}`,
      fill: 'none',
      stroke: lidColor,
      'stroke-width': th,
      'stroke-linecap': 'round',
    }),
  ];

  const wing = eye.lids.wing;
  if (wing > 0.01) {
    // Pointe externe : quadratique po -> tip, tracée en segments à traits arrondis dont la largeur décroît.
    const Lw = wing * g.w * 0.26;
    const rise = wing * g.h * 0.24;
    const p0: Vec = g.po;
    const p1: Vec = { x: g.po.x + g.s * Lw * 0.6, y: g.po.y - rise * 0.1 };
    const p2: Vec = { x: g.po.x + g.s * Lw, y: g.po.y - rise };
    const N = 8;
    const at = (t: number): Vec => {
      const u = 1 - t;
      return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
    };
    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      const a = at(t0);
      const z = at(t1);
      const k = t1 - t0;
      const q1: Vec = {
        x: a.x + k * ((1 - t0) * (p1.x - p0.x) + t0 * (p2.x - p1.x)),
        y: a.y + k * ((1 - t0) * (p1.y - p0.y) + t0 * (p2.y - p1.y)),
      };
      lids.push(
        el('path', {
          d: `M${P(a)}Q${P(q1)} ${P(z)}`,
          fill: 'none',
          stroke: lidColor,
          'stroke-width': th * (0.95 - 0.85 * ((i + 0.5) / N)),
          'stroke-linecap': 'round',
        }),
      );
    }
  }

  // Couleur : le matériau propre au groupe (s'il est précisé) prime sur celle de la paupière —
  // voir eye-lashes.ts (`material: null` = hérite de `lidColor`, comportement historique).
  const lightDir = direction2D(L);
  const upLashes = upperLashes(g, eye.lashes.upper, th, (eye.seed ^ 0xa5a5a5a5) >>> 0);
  if (upLashes.length > 0) {
    const upColor = eye.lashes.upper.material ? dominantColor(eye.lashes.upper.material.base) : lidColor;
    lids.push(
      el('g', { id: `${id}-lashes-up` }, renderLashGroup(upLashes, upColor, eye.lashes.upper.opacity, eye.lashes.upper.gloss, lightDir)),
    );
  }
  const loLashes = lowerLashes(g, eye.lashes.lower, th, (eye.seed ^ 0x5a5a5a5a) >>> 0);
  if (loLashes.length > 0) {
    const loColor = eye.lashes.lower.material ? dominantColor(eye.lashes.lower.material.base) : lidColor;
    lids.push(
      el('g', { id: `${id}-lashes-low` }, renderLashGroup(loLashes, loColor, eye.lashes.lower.opacity, eye.lashes.lower.gloss, lightDir)),
    );
  }

  if (fold) {
    // Les bords libres et les cils disparaissent sous le pli.
    const X = Math.max(g.w, g.h) * 3;
    defs.push(
      el('clipPath', { id: `${id}-nofold` }, [
        el('path', {
          d: `M${num(-X)} ${num(-X)}H${num(X)}V${num(X)}H${num(-X)}Z${polygonPath(fold.region)}`,
          'clip-rule': 'evenodd',
        }),
      ]),
    );
    outside.push(el('g', { 'clip-path': urlRef(`${id}-nofold`) }, lids));
  } else {
    outside.push(...lids);
  }

  // Pli épicanthique : l'extrémité arrondie de la fente prolonge le bord libre ; l'arête côté nez
  // est rendue par une ligne + une ombre douce (deux traits plus larges et transparents).
  if (fold) {
    const a = eye.epicanthicFold.amount;
    const arc = fold.arc;
    const arcD = `M${P(arc.p0)}C${P(arc.p1)} ${P(arc.p2)} ${P(arc.p3)}`;
    const common = { d: arcD, fill: 'none', stroke: darken(skin, 0.55), 'stroke-linecap': 'round' } as const;
    outside.push(
      el('path', {
        d: `M${P(fold.pu)}C${P(fold.c1)} ${P(fold.c2)} ${P(fold.pl)}`,
        fill: 'none',
        stroke: lidColor,
        'stroke-width': th * 0.55,
        'stroke-opacity': 0.9,
        'stroke-linecap': 'round',
      }),
      el('g', { id: `${id}-fold` }, [
        el('path', { ...common, 'stroke-width': g.h * 0.05, 'stroke-opacity': 0.08 * a }),
        el('path', { ...common, 'stroke-width': g.h * 0.028, 'stroke-opacity': 0.12 * a }),
        el('path', { ...common, 'stroke-width': g.h * 0.008, 'stroke-opacity': 0.55 * a }),
      ]),
    );
  }


  return { defs, outside };
}

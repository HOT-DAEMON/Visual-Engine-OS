import { darken, lighten } from '../../core/color';
import type { Lash } from '../../geometry/eye';
import { el } from '../../core/svg';
import { P } from './helpers';

/** Bords (gauche/droite) et normale d'un cil — partagés par le remplissage et le liseré de brillance. */
function lashEdges(l: Lash) {
  const dx = l.ctrl.x - l.base.x;
  const dy = l.ctrl.y - l.base.y;
  const n = Math.hypot(dx, dy) || 1;
  const nx = -dy / n;
  const ny = dx / n;
  const hw = l.baseWidth / 2;
  const ctrlFactor = 0.75 - 0.6 * l.tipSharpness;
  return {
    nx,
    ny,
    bl: { x: l.base.x + nx * hw, y: l.base.y + ny * hw },
    br: { x: l.base.x - nx * hw, y: l.base.y - ny * hw },
    c1: { x: l.ctrl.x + nx * hw * ctrlFactor, y: l.ctrl.y + ny * hw * ctrlFactor },
    c2: { x: l.ctrl.x - nx * hw * ctrlFactor, y: l.ctrl.y - ny * hw * ctrlFactor },
  };
}

/**
 * Liseré de brillance (`gloss`) : un fibre fine montre un reflet directionnel sur le bord tourné
 * vers la lumière — on redessine simplement, en plus fin et plus clair, celui des deux bords du
 * cil (déjà calculés pour le remplissage) dont la normale est la plus alignée avec la lumière.
 * Approximation légère assumée, pas un calcul d'éclairage physique sur une fibre cylindrique.
 */
function glossPath(l: Lash, lightDir: { x: number; y: number }): string {
  const e = lashEdges(l);
  const lit = e.nx * lightDir.x + e.ny * lightDir.y >= 0;
  const [a, c] = lit ? [e.bl, e.c1] : [e.br, e.c2];
  return `M${P(a)}Q${P(c)} ${P(l.tip)}`;
}

/**
 * Assemble un groupe de cils complet : remplissage (avec variation de luminosité par cil, voir
 * `colorJitter`) et, si `gloss > 0`, un liseré de brillance directionnel par-dessus.
 */
export function renderLashGroup(
  lashes: readonly Lash[],
  baseColor: string,
  opacity: number,
  gloss: number,
  lightDir: { x: number; y: number },
): string[] {
  const fills = lashes.map((l) => {
    const e = lashEdges(l);
    const d = `M${P(e.bl)}Q${P(e.c1)} ${P(l.tip)}Q${P(e.c2)} ${P(e.br)}Z`;
    const color = l.colorJitter === 0 ? baseColor : l.colorJitter > 0 ? lighten(baseColor, l.colorJitter) : darken(baseColor, -l.colorJitter);
    return el('path', { d, fill: color, 'fill-opacity': opacity });
  });
  if (gloss <= 0) return fills;
  const glossColor = lighten(baseColor, 0.55);
  const glints = lashes.map((l) =>
    el('path', {
      d: glossPath(l, lightDir),
      fill: 'none',
      stroke: glossColor,
      'stroke-width': Math.max(0.3, l.baseWidth * 0.22),
      'stroke-opacity': gloss * opacity * 0.85,
      'stroke-linecap': 'round',
    }),
  );
  return [...fills, ...glints];
}
